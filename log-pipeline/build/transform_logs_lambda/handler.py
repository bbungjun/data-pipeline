from __future__ import annotations

import base64
import gzip
import json
import os
import re
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib import request

try:
    import boto3
except ImportError:  # pragma: no cover
    boto3 = None


DEFAULT_SERVICE = os.getenv("DEFAULT_SERVICE", "gmok-back")
DEFAULT_ENVIRONMENT = os.getenv("DEFAULT_ENVIRONMENT", "dev")
OUTPUT_INDEX_PREFIX = os.getenv("OUTPUT_INDEX_PREFIX", "gmok-back-logs")
OPENSEARCH_BULK_URL = os.getenv("OPENSEARCH_BULK_URL")
OPENSEARCH_USERNAME = os.getenv("OPENSEARCH_USERNAME")
OPENSEARCH_PASSWORD = os.getenv("OPENSEARCH_PASSWORD")
PLAIN_TEXT_PATTERN = re.compile(r"^(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}):\s?(?P<message>.*)$")
ANSI_ESCAPE_PATTERN = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")
REQUEST_LOG_PATTERN = re.compile(
    r"^(?P<method>GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s+"
    r"(?P<route>\S+)\s+"
    r"(?P<status>\d{3})\s+"
    r"(?P<latency_ms>[\d.]+)\s+ms\s+-\s+"
    r"(?P<response_size>-|\d+)$"
)
LAMBDA_APP_LOG_PATTERN = re.compile(
    r"^\[(?P<level>[A-Z]+)\]\s+"
    r"(?P<timestamp>\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\s+"
    r"(?P<request_id>[^\t ]*)\s*"
    r"(?P<message>.*)$",
    re.DOTALL,
)
LAMBDA_START_END_PATTERN = re.compile(r"^(?P<event>START|END) RequestId: (?P<request_id>[^\s]+)")
LAMBDA_REPORT_PATTERN = re.compile(r"^REPORT RequestId: (?P<request_id>[^\s]+)\s+(?P<details>.*)$", re.DOTALL)
LAMBDA_ERROR_NAME_PATTERN = re.compile(
    r"(?:\[ERROR\]\s*)?(?P<name>(?:[A-Za-z_][\w]*\.)*[A-Za-z_][\w]*(?:Error|Exception|Detected)):"
)


@dataclass
class NormalizedLog:
    timestamp: str
    level: str
    service: str
    environment: str
    source_log: str | None
    instance_id: str | None
    instance_name: str | None
    event_type: str
    message: str
    request_id: str | None
    user_id: str | None
    match_id: str | None
    route: str | None
    method: str | None
    status_code: int | None
    latency_ms: int | None
    client_ip: str | None
    error_name: str | None
    error_message: str | None
    error_code: str | None
    severity: str | None
    meta: dict[str, Any]
    raw: dict[str, Any]

    def to_document(self) -> dict[str, Any]:
        return {
            "@timestamp": self.timestamp,
            "level": self.level,
            "service": self.service,
            "environment": self.environment,
            "source_log": self.source_log,
            "instance_id": self.instance_id,
            "instance_name": self.instance_name,
            "event_type": self.event_type,
            "message": self.message,
            "request_id": self.request_id,
            "user_id": self.user_id,
            "match_id": self.match_id,
            "route": self.route,
            "method": self.method,
            "status_code": self.status_code,
            "latency_ms": self.latency_ms,
            "client_ip": self.client_ip,
            "error_name": self.error_name,
            "error_message": self.error_message,
            "error_code": self.error_code,
            "severity": self.severity,
            "meta": self.meta,
            "raw": self.raw,
        }


def _safe_timestamp(value: str | None) -> str:
    if not value:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC).isoformat().replace("+00:00", "Z")
    except ValueError:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _timestamp_from_millis(value: int | float | None) -> str:
    if value is None:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")
    return datetime.fromtimestamp(value / 1000, UTC).isoformat().replace("+00:00", "Z")


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    error = record.get("error") or {}
    event_type = record.get("event_type") or record.get("type") or "application"
    route = record.get("route") or record.get("url")
    status_code = record.get("status_code")
    if status_code is None:
        status_code = record.get("statusCode")
    latency_ms = record.get("latency_ms")
    if latency_ms is None:
        latency_ms = record.get("responseTimeMs")
    client_ip = record.get("client_ip") or record.get("ip")

    meta = record.get("meta") or {}
    if record.get("statusGroup") is not None:
        meta["status_group"] = record.get("statusGroup")
    if record.get("contentLength") is not None:
        meta["content_length"] = record.get("contentLength")
    if record.get("userAgent") is not None:
        meta["user_agent"] = record.get("userAgent")

    log = NormalizedLog(
        timestamp=_safe_timestamp(record.get("timestamp")),
        level=str(record.get("level", "INFO")).upper(),
        service=record.get("service") or DEFAULT_SERVICE,
        environment=record.get("environment") or DEFAULT_ENVIRONMENT,
        source_log=record.get("source_log") or meta.get("source_name"),
        instance_id=record.get("instance_id") or meta.get("instance_id"),
        instance_name=record.get("instance_name") or meta.get("instance_name"),
        event_type=event_type,
        message=record.get("message") or "",
        request_id=record.get("request_id"),
        user_id=record.get("user_id"),
        match_id=record.get("match_id"),
        route=route,
        method=record.get("method"),
        status_code=status_code,
        latency_ms=latency_ms,
        client_ip=client_ip,
        error_name=error.get("name"),
        error_message=error.get("message"),
        error_code=record.get("error_code"),
        severity=record.get("severity"),
        meta=meta,
        raw=record,
    )
    return log.to_document()


def infer_level(message: str, source_name: str | None) -> str:
    lowered = message.lower()
    request = parse_request_message(message)
    if request:
        status_code = request["status_code"]
        if status_code >= 500:
            return "ERROR"
        if status_code >= 400:
            return "WARN"
        return "INFO"
    if source_name and "error" in source_name.lower():
        if "warning" in lowered:
            return "WARN"
        return "ERROR"
    if "error" in lowered or "failed" in lowered or "exception" in lowered:
        return "ERROR"
    if "warning" in lowered or "warn" in lowered:
        return "WARN"
    return "INFO"


def infer_event_type(message: str) -> str:
    lowered = message.lower()
    if parse_request_message(message):
        return "http_request"
    if "database connection successful" in lowered:
        return "system"
    if "server running" in lowered or "pm2" in lowered:
        return "system"
    if "warning" in lowered:
        return "system"
    if "error" in lowered or "exception" in lowered or "failed" in lowered:
        return "exception"
    return "application"


def _infer_lambda_event_type(message: str, level: str) -> str:
    if level in {"ERROR", "WARN", "WARNING"}:
        return "lambda_error"
    lowered = message.lower()
    if "status: error" in lowered or "error type:" in lowered:
        return "lambda_error"
    if message.startswith(("START RequestId:", "END RequestId:", "REPORT RequestId:", "INIT_START", "INIT_REPORT")):
        return "lambda_runtime"
    return "lambda_application"


def should_merge_message(previous_message: str, next_message: str) -> bool:
    if not previous_message:
        return False
    if next_message.startswith((" ", "\t")):
        return True
    if next_message.startswith(("status:", "type:", "title:", "isLoggable:", "showMessage:", "}")):
        return True
    if previous_message.rstrip().endswith((".", "!", "?", "}", "]")):
        return False
    if next_message[:1].islower():
        return True
    if next_message.startswith(("at ", "    at ", "memory,", "designed ", "{")):
        return True
    return False


def strip_ansi(value: str) -> str:
    return ANSI_ESCAPE_PATTERN.sub("", value)


def parse_request_message(message: str) -> dict[str, Any] | None:
    cleaned = strip_ansi(message).strip()
    match = REQUEST_LOG_PATTERN.match(cleaned)
    if not match:
        return None
    response_size = match.group("response_size")
    return {
        "message": cleaned,
        "method": match.group("method"),
        "route": match.group("route"),
        "status_code": int(match.group("status")),
        "latency_ms": int(float(match.group("latency_ms"))),
        "status_group": f"{int(match.group('status')[0])}xx",
        "response_size": None if response_size == "-" else int(response_size),
    }


def _guess_source_log(source_name: str | None) -> str | None:
    if not source_name:
        return None
    lowered = source_name.lower()
    if lowered.startswith("/aws/lambda/"):
        return "lambda"
    if "error" in lowered:
        return "error"
    if "out" in lowered:
        return "out"
    if "db_error_log" in lowered:
        return "db_error_log"
    return source_name


def _enrich_record(record: dict[str, Any], source_name: str | None = None) -> dict[str, Any]:
    record.setdefault("service", DEFAULT_SERVICE)
    record.setdefault("environment", DEFAULT_ENVIRONMENT)
    record["source_log"] = record.get("source_log") or _guess_source_log(source_name)
    meta = record.get("meta") or {}
    if source_name and "source_name" not in meta:
        meta["source_name"] = source_name
    record["meta"] = meta
    return record


def _extract_instance_fields(log_stream: str | None) -> tuple[str | None, str | None]:
    if not log_stream:
        return (None, None)
    parts = [part for part in log_stream.split("/") if part]
    if len(parts) >= 2:
        return (parts[0], parts[1])
    return (parts[0], parts[0])


def _lambda_function_name(log_group: str | None) -> str | None:
    if not log_group:
        return None
    prefix = "/aws/lambda/"
    if log_group.startswith(prefix):
        return log_group[len(prefix) :]
    return None


def _parse_lambda_report_details(details: str) -> dict[str, Any]:
    meta: dict[str, Any] = {}
    for part in details.split("\t"):
        if ":" not in part:
            continue
        key, value = part.split(":", 1)
        normalized_key = key.strip().lower().replace(" ", "_")
        meta[normalized_key] = value.strip()
    return meta


def _extract_error_name(message: str) -> str | None:
    match = LAMBDA_ERROR_NAME_PATTERN.search(message)
    if match:
        return match.group("name")
    return None


def _extract_lambda_payload_error_name(payload: dict[str, Any], payload_message: str) -> str | None:
    exception = payload.get("exception")
    if isinstance(exception, dict):
        exception_type = exception.get("type")
        if exception_type:
            return str(exception_type)
        stacktrace = exception.get("stacktrace")
        if stacktrace:
            extracted = _extract_error_name(str(stacktrace))
            if extracted:
                return extracted
    if payload.get("error_type"):
        return str(payload["error_type"])
    return _extract_error_name(payload_message)


def _normalize_lambda_json_payload(
    payload: dict[str, Any],
    fallback_timestamp: str,
    fallback_level: str,
    fallback_request_id: str | None,
    function_name: str | None,
    meta: dict[str, Any],
) -> dict[str, Any]:
    payload_level = str(payload.get("level") or fallback_level).upper()
    payload_message = str(payload.get("message") or json.dumps(payload, ensure_ascii=False))
    payload_request_id = payload.get("request_id") or fallback_request_id
    payload_meta = {
        key: value
        for key, value in payload.items()
        if key
        not in {
            "timestamp",
            "level",
            "message",
            "request_id",
        }
    }
    payload_meta.update(meta)
    error_name = _extract_lambda_payload_error_name(payload, payload_message)
    return normalize_record(
        {
            "timestamp": payload.get("timestamp") or fallback_timestamp,
            "level": "WARN" if payload_level == "WARNING" else payload_level,
            "service": function_name or payload.get("function") or payload.get("service") or DEFAULT_SERVICE,
            "environment": DEFAULT_ENVIRONMENT,
            "source_log": "lambda",
            "event_type": _infer_lambda_event_type(payload_message, payload_level),
            "message": payload_message,
            "request_id": payload_request_id,
            "severity": "error" if payload_level == "ERROR" else "warning" if payload_level in {"WARN", "WARNING"} else None,
            "error": {
                "name": error_name,
                "message": payload_message if payload_level == "ERROR" else None,
            },
            "meta": payload_meta,
            "raw": payload,
        }
    )


def parse_lambda_log_event(
    message: str,
    log_group: str | None,
    log_stream: str | None,
    log_event: dict[str, Any],
) -> dict[str, Any]:
    function_name = _lambda_function_name(log_group)
    cleaned = strip_ansi(message).strip().lstrip("\ufeff")
    timestamp = _timestamp_from_millis(log_event.get("timestamp"))
    level = infer_level(cleaned, log_group)
    request_id = None
    meta: dict[str, Any] = {
        "log_format": "aws_lambda",
        "lambda_function": function_name,
        "log_group": log_group,
        "log_stream": log_stream,
        "log_event_id": log_event.get("id"),
    }
    error_name = _extract_error_name(cleaned)
    error_message = None

    if cleaned.startswith("{") and cleaned.endswith("}"):
        try:
            payload = json.loads(cleaned)
            if isinstance(payload, dict):
                return _normalize_lambda_json_payload(payload, timestamp, level, request_id, function_name, meta)
        except json.JSONDecodeError:
            pass

    app_match = LAMBDA_APP_LOG_PATTERN.match(cleaned)
    if app_match:
        level = app_match.group("level")
        timestamp = app_match.group("timestamp")
        request_id = app_match.group("request_id") or None
        cleaned = app_match.group("message").strip()
        if cleaned.startswith("{") and cleaned.endswith("}"):
            try:
                payload = json.loads(cleaned)
                if isinstance(payload, dict):
                    return _normalize_lambda_json_payload(payload, timestamp, level, request_id, function_name, meta)
            except json.JSONDecodeError:
                pass
        error_name = _extract_error_name(cleaned)
        if level == "ERROR":
            error_message = cleaned.splitlines()[0] if cleaned else None

    start_end_match = LAMBDA_START_END_PATTERN.match(cleaned)
    if start_end_match:
        request_id = start_end_match.group("request_id")
        level = "INFO"

    report_match = LAMBDA_REPORT_PATTERN.match(cleaned)
    if report_match:
        request_id = report_match.group("request_id")
        report_meta = _parse_lambda_report_details(report_match.group("details"))
        meta["report"] = report_meta
        if str(report_meta.get("status", "")).lower() == "error":
            level = "ERROR"
            error_name = report_meta.get("error_type") or error_name
            error_message = f"Lambda invocation failed: {error_name}" if error_name else "Lambda invocation failed"
        else:
            level = "INFO"

    event_type = _infer_lambda_event_type(cleaned, level)
    severity = "error" if level == "ERROR" else "warning" if level in {"WARN", "WARNING"} else None

    return normalize_record(
        {
            "timestamp": timestamp,
            "level": "WARN" if level == "WARNING" else level,
            "service": function_name or DEFAULT_SERVICE,
            "environment": DEFAULT_ENVIRONMENT,
            "source_log": "lambda",
            "event_type": event_type,
            "message": cleaned,
            "request_id": request_id,
            "severity": severity,
            "error": {
                "name": error_name,
                "message": error_message,
            },
            "meta": meta,
            "raw": {
                "message": message,
            },
        }
    )


def parse_plain_text_logs(text: str, source_name: str | None = None) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []

    for line in text.splitlines():
        stripped = line.strip().lstrip("\ufeff")
        if not stripped:
            continue

        match = PLAIN_TEXT_PATTERN.match(stripped)
        if not match:
            continue

        prefix_timestamp = match.group("timestamp")
        message = strip_ansi(match.group("message")).strip()

        if message.startswith("{") and message.endswith("}"):
            try:
                payload = json.loads(message)
                payload.setdefault("timestamp", payload.get("timestamp") or prefix_timestamp)
                payload.setdefault(
                    "message",
                    f"{payload.get('method', '')} {payload.get('url', '')} {payload.get('statusCode', '')}".strip(),
                )
                payload = _enrich_record(payload, source_name)
                payload["meta"] = {
                    **(payload.get("meta") or {}),
                    "log_format": "pm2_prefixed_json",
                }
                records.append(payload)
                continue
            except json.JSONDecodeError:
                pass

        timestamp = prefix_timestamp

        if records:
            previous = records[-1]
            if (
                isinstance(previous, dict)
                and "message" in previous
                and previous.get("timestamp") == timestamp
                and should_merge_message(str(previous["message"]), message)
            ):
                previous["message"] = f"{previous['message']} {message}".strip()
                previous["raw"]["lines"].append(stripped)
                previous["level"] = infer_level(previous["message"], source_name)
                previous["event_type"] = infer_event_type(previous["message"])
                continue

        records.append(
            _enrich_record(
                {
                    "timestamp": timestamp,
                    "level": infer_level(message, source_name),
                    "event_type": infer_event_type(message),
                    "message": message,
                    "method": None,
                    "route": None,
                    "status_code": None,
                    "latency_ms": None,
                    "meta": {
                        "log_format": "plain_text_pm2",
                        "source_name": source_name,
                    },
                    "raw": {
                        "lines": [stripped],
                    },
                },
                source_name,
            )
        )

        request = parse_request_message(records[-1]["message"])
        if request:
            records[-1]["message"] = request["message"]
            records[-1]["method"] = request["method"]
            records[-1]["route"] = request["route"]
            records[-1]["status_code"] = request["status_code"]
            records[-1]["latency_ms"] = request["latency_ms"]
            records[-1]["meta"]["status_group"] = request["status_group"]
            records[-1]["meta"]["response_size"] = request["response_size"]

    return [normalize_record(record) for record in records]


def parse_ndjson(text: str) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
    for line in text.splitlines():
        stripped = line.strip().lstrip("\ufeff")
        if not stripped:
            continue
        documents.append(normalize_record(json.loads(stripped)))
    return documents


def parse_logs(text: str, source_name: str | None = None) -> list[dict[str, Any]]:
    for line in text.splitlines():
        stripped = line.strip().lstrip("\ufeff")
        if not stripped:
            continue
        if stripped.startswith("{"):
            return parse_ndjson(text)
        if PLAIN_TEXT_PATTERN.match(stripped):
            return parse_plain_text_logs(text, source_name)
        break
    return []


def index_name_for(document: dict[str, Any]) -> str:
    day = document["@timestamp"][:10]
    return f"{OUTPUT_INDEX_PREFIX}-{day}"


def build_bulk_payload(documents: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for document in documents:
        lines.append(json.dumps({"index": {"_index": index_name_for(document)}}))
        lines.append(json.dumps(document, ensure_ascii=False))
    return "\n".join(lines) + "\n"


def push_to_opensearch(documents: list[dict[str, Any]]) -> dict[str, Any]:
    if not OPENSEARCH_BULK_URL:
        return {"pushed": False, "reason": "OPENSEARCH_BULK_URL not set"}
    if not documents:
        return {"pushed": False, "reason": "no documents"}

    payload = build_bulk_payload(documents).encode("utf-8")
    headers = {
        "Content-Type": "application/x-ndjson",
    }

    if OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD:
        token = base64.b64encode(f"{OPENSEARCH_USERNAME}:{OPENSEARCH_PASSWORD}".encode("utf-8")).decode("utf-8")
        headers["Authorization"] = f"Basic {token}"

    req = request.Request(
        OPENSEARCH_BULK_URL,
        data=payload,
        headers=headers,
        method="POST",
    )

    with request.urlopen(req, timeout=15) as response:
        body = response.read().decode("utf-8")
        return {
            "pushed": True,
            "status": response.status,
            "body_preview": body[:500],
        }


def load_s3_text(bucket: str, key: str) -> str:
    if boto3 is None:
        raise RuntimeError("boto3 is required in Lambda runtime")
    client = boto3.client("s3")
    response = client.get_object(Bucket=bucket, Key=key)
    return response["Body"].read().decode("utf-8")


def _decode_cloudwatch_event(event: dict[str, Any]) -> dict[str, Any]:
    raw = base64.b64decode(event["awslogs"]["data"])
    decoded = gzip.decompress(raw)
    return json.loads(decoded.decode("utf-8"))


def _normalize_cloudwatch_logs(event: dict[str, Any]) -> list[dict[str, Any]]:
    payload = _decode_cloudwatch_event(event)
    log_group = payload.get("logGroup")
    log_stream = payload.get("logStream")
    instance_id, instance_name = _extract_instance_fields(log_stream)
    source_log = _guess_source_log(log_group)
    lambda_function = _lambda_function_name(log_group)

    documents: list[dict[str, Any]] = []
    for log_event in payload.get("logEvents", []):
        message = log_event.get("message", "")
        if lambda_function:
            documents.append(parse_lambda_log_event(message, log_group, log_stream, log_event))
            continue

        parsed = parse_logs(message, source_log)
        for document in parsed:
            document["source_log"] = document.get("source_log") or source_log
            document["instance_id"] = document.get("instance_id") or instance_id
            document["instance_name"] = document.get("instance_name") or instance_name
            document["meta"] = {
                **(document.get("meta") or {}),
                "log_group": log_group,
                "log_stream": log_stream,
                "log_event_id": log_event.get("id"),
            }
            documents.append(document)
    return documents


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    if "awslogs" in event:
        documents = _normalize_cloudwatch_logs(event)
        push_result = push_to_opensearch(documents)
        return {
            "processed_files": 1,
            "document_count": len(documents),
            "bulk_preview": build_bulk_payload(documents[:2]) if documents else "",
            "push_result": push_result,
        }

    records = event.get("Records", [])
    processed: list[dict[str, Any]] = []

    for record in records:
        s3 = record.get("s3", {})
        bucket = s3.get("bucket", {}).get("name")
        key = s3.get("object", {}).get("key")
        if not bucket or not key:
            continue

        text = load_s3_text(bucket, key)
        documents = parse_logs(text, key)
        push_result = push_to_opensearch(documents)
        processed.append(
            {
                "bucket": bucket,
                "key": key,
                "document_count": len(documents),
                "bulk_preview": build_bulk_payload(documents[:2]),
                "push_result": push_result,
            }
        )

    return {
        "processed_files": len(processed),
        "results": processed,
    }


def _run_local(input_path: str, output_path: str) -> None:
    source = Path(input_path)
    destination = Path(output_path)
    documents = parse_logs(source.read_text(encoding="utf-8"), source.name)
    destination.write_text(json.dumps(documents, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"normalized {len(documents)} records to {destination}")


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    if len(sys.argv) >= 3:
        sample_input = Path(sys.argv[1])
        sample_output = Path(sys.argv[2])
    else:
        sample_input = root / "samples" / "raw" / "backend-app.ndjson"
        sample_output = root / "samples" / "normalized" / "normalized-backend-app.json"
    _run_local(str(sample_input), str(sample_output))
