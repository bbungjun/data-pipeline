from __future__ import annotations

import base64
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib import error, request
from urllib.parse import quote


ALERT_STATE_PATH = Path(os.environ.get("ALERT_STATE_PATH", ".state/discord_alert_state.json"))
WINDOW_MINUTES = int(os.environ.get("ALERT_WINDOW_MINUTES", "5"))
FIVE_XX_THRESHOLD = int(os.environ.get("ALERT_5XX_THRESHOLD", "5"))
REPEATED_ERROR_THRESHOLD = int(os.environ.get("ALERT_REPEATED_ERROR_THRESHOLD", "3"))
LATENCY_P95_THRESHOLD_MS = float(os.environ.get("ALERT_P95_LATENCY_MS", "1000"))
DB_ERROR_THRESHOLD = int(os.environ.get("ALERT_DB_ERROR_THRESHOLD", "5"))
AUTH_FAILURE_THRESHOLD = int(os.environ.get("ALERT_AUTH_FAILURE_THRESHOLD", "20"))
DEPENDENCY_ERROR_THRESHOLD = int(os.environ.get("ALERT_DEPENDENCY_ERROR_THRESHOLD", "1"))
PIPELINE_SILENT_MINUTES = int(os.environ.get("ALERT_PIPELINE_SILENT_MINUTES", "10"))
EXPECT_TRAFFIC = os.environ.get("ALERT_EXPECT_TRAFFIC", "false").lower() == "true"
COOLDOWN_MINUTES = int(os.environ.get("ALERT_COOLDOWN_MINUTES", str(WINDOW_MINUTES)))
OPENSEARCH_SEARCH_URL = os.environ.get("OPENSEARCH_SEARCH_URL")
OPENSEARCH_USERNAME = os.environ.get("OPENSEARCH_USERNAME")
OPENSEARCH_PASSWORD = os.environ.get("OPENSEARCH_PASSWORD")
OPENSEARCH_SEARCH_SIZE = int(os.environ.get("OPENSEARCH_SEARCH_SIZE", "1000"))
DASHBOARD_URL = os.environ.get("DASHBOARD_URL", "")
DASHBOARD_DATA_VIEW_ID = os.environ.get("DASHBOARD_DATA_VIEW_ID", "gmok-back-logs-pattern")
DASHBOARD_DISCOVER_COLUMNS = [
    "@timestamp",
    "severity",
    "source_log",
    "event_type",
    "route",
    "status_code",
    "error_name",
    "error_code",
    "message",
]
DEPENDENCY_ERROR_TERMS = [
    "RiotApiGatewayError",
    "ReplayStorageUnavailable",
    "Database connection failed",
    "StatisticsQueryFailed",
]


Alert = dict[str, Any]
Document = dict[str, Any]


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * q
    lower = int(position)
    upper = min(lower + 1, len(ordered) - 1)
    if lower == upper:
        return ordered[lower]
    fraction = position - lower
    return ordered[lower] * (1 - fraction) + ordered[upper] * fraction


def safe_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def load_documents(paths: list[str]) -> list[Document]:
    documents: list[Document] = []
    for raw_path in paths:
        path = Path(raw_path)
        text = path.read_text(encoding="utf-8").strip()
        if not text:
            continue
        if text.startswith("["):
            documents.extend(json.loads(text))
            continue
        for line in text.splitlines():
            stripped = line.strip()
            if stripped:
                documents.append(json.loads(stripped))
    return documents


def load_documents_from_opensearch(search_url: str, minutes: int) -> list[Document]:
    query = {
        "size": OPENSEARCH_SEARCH_SIZE,
        "sort": [{"@timestamp": {"order": "desc"}}],
        "query": {
            "range": {
                "@timestamp": {
                    "gte": f"now-{minutes}m",
                    "lte": "now",
                }
            }
        },
    }
    headers = {
        "Content-Type": "application/json",
    }
    if OPENSEARCH_USERNAME and OPENSEARCH_PASSWORD:
        token = base64.b64encode(f"{OPENSEARCH_USERNAME}:{OPENSEARCH_PASSWORD}".encode("utf-8")).decode("utf-8")
        headers["Authorization"] = f"Basic {token}"

    data = json.dumps(query).encode("utf-8")
    req = request.Request(search_url, data=data, headers=headers, method="POST")
    with request.urlopen(req, timeout=15) as response:
        payload = json.loads(response.read().decode("utf-8"))
    hits = payload.get("hits", {}).get("hits", [])
    return [hit.get("_source", {}) for hit in hits]


def load_state() -> dict[str, str]:
    if not ALERT_STATE_PATH.exists():
        return {}
    return json.loads(ALERT_STATE_PATH.read_text(encoding="utf-8"))


def save_state(state: dict[str, str]) -> None:
    ALERT_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
    ALERT_STATE_PATH.write_text(json.dumps(state, indent=2), encoding="utf-8")


def window_documents(documents: list[Document], minutes: int = WINDOW_MINUTES) -> tuple[list[Document], datetime]:
    parseable_docs = [doc for doc in documents if doc.get("@timestamp")]
    if not parseable_docs:
        now = datetime.now(timezone.utc)
        return ([], now)
    reference_now = max(parse_timestamp(str(doc["@timestamp"])) for doc in parseable_docs)
    threshold = reference_now - timedelta(minutes=minutes)
    return (
        [doc for doc in parseable_docs if parse_timestamp(str(doc["@timestamp"])) >= threshold],
        reference_now,
    )


def most_common_value(documents: list[Document], field: str, default: str = "unknown") -> str:
    values = Counter(str(doc.get(field) or default) for doc in documents)
    return values.most_common(1)[0][0] if values else default


def get_error_message(doc: Document) -> str:
    return str(doc.get("error_message") or doc.get("message") or "unknown error")


def get_error_name(doc: Document) -> str:
    return str(doc.get("error_name") or doc.get("raw", {}).get("error", {}).get("name") or "unknown")


def truncate_text(value: str, max_length: int = 220) -> str:
    compact = " ".join(value.split())
    if len(compact) <= max_length:
        return compact
    return compact[: max_length - 3] + "..."


def rison_quote(value: Any) -> str:
    return "'" + str(value).replace("'", "!'") + "'"


def kql_quote(value: Any) -> str:
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def dashboard_app_base() -> str:
    base = DASHBOARD_URL.strip()
    if not base:
        return ""

    without_hash = base.split("#", 1)[0].rstrip("/")
    marker = "/_dashboards"
    marker_position = without_hash.lower().find(marker)
    if marker_position >= 0:
        return without_hash[: marker_position + len(marker)]
    return f"{without_hash}{marker}"


def build_discover_query(alert: Alert) -> str:
    error_code = alert.get("example_error_code")
    if error_code:
        return f"error_code:{kql_quote(error_code)}"

    terms: list[str] = []
    route = alert.get("route")
    if route and route != "unknown":
        terms.append(f"route:{kql_quote(route)}")

    error_name = alert.get("error_name")
    if error_name and error_name != "unknown":
        terms.append(f"error_name:{kql_quote(error_name)}")

    status_code = alert.get("status_code")
    if isinstance(status_code, int):
        terms.append(f"status_code:{status_code}")

    return " and ".join(terms) if terms else "*"


def build_discover_url(alert: Alert) -> str:
    base = dashboard_app_base()
    if not base:
        return ""

    window_minutes = alert.get("window_minutes") or WINDOW_MINUTES
    query = build_discover_query(alert)
    columns = "!({})".format(",".join(rison_quote(column) for column in DASHBOARD_DISCOVER_COLUMNS))
    global_state = f"(refreshInterval:(pause:!t,value:0),time:(from:now-{window_minutes}m,to:now))"
    app_state = (
        f"(columns:{columns},filters:!(),index:{rison_quote(DASHBOARD_DATA_VIEW_ID)},"
        f"interval:auto,query:(language:kuery,query:{rison_quote(query)}),sort:!(!('@timestamp',desc)))"
    )
    return f"{base}/app/discover#/?_g={quote(global_state, safe='')}&_a={quote(app_state, safe='')}"


def is_raw_stack_fragment(doc: Document) -> bool:
    if doc.get("event_type") == "error_event":
        return False
    if doc.get("source_log") != "error":
        return False

    message = str(doc.get("message") or "").strip()
    if not message:
        return True

    stripped = message.strip("'\" ")
    noisy_prefixes = (
        "{",
        "}",
        "[",
        "]",
        "+",
        "type:",
        "title:",
        "status:",
        "detail:",
        "instance:",
        "errors:",
        "code:",
        "message:",
        "path:",
        "value:",
    )
    stack_markers = (
        " at ",
        " at Layer.",
        " at Route.",
        " at Function.",
        "node_modules/",
        "node:internal/",
        ".ts:",
        ".js:",
        "\\n' +",
    )
    return stripped.startswith(noisy_prefixes) or any(marker in stripped for marker in stack_markers)


def is_actionable_error_doc(doc: Document) -> bool:
    if doc.get("event_type") == "error_event":
        return True
    if doc.get("source_log") == "error":
        return not is_raw_stack_fragment(doc)
    return False


def matches_dependency_error(doc: Document) -> str | None:
    haystack = " ".join(
        str(value or "")
        for value in [
            doc.get("error_name"),
            doc.get("error_message"),
            doc.get("message"),
            doc.get("raw", {}).get("error", {}).get("name") if isinstance(doc.get("raw"), dict) else "",
            doc.get("raw", {}).get("error", {}).get("message") if isinstance(doc.get("raw"), dict) else "",
        ]
    )
    for term in DEPENDENCY_ERROR_TERMS:
        if term in haystack:
            return term
    return None


def create_alert(
    severity: str,
    alert_type: str,
    key: str,
    title: str,
    summary: str,
    *,
    route: str | None = None,
    status_code: int | str | None = None,
    count: int | None = None,
    example_error_code: str | None = None,
    error_name: str | None = None,
    operator_hint: str | None = None,
    timestamp: str | None = None,
) -> Alert:
    alert = {
        "severity": severity,
        "alert_type": alert_type,
        "key": key,
        "title": title,
        "summary": summary,
        "route": route,
        "status_code": status_code,
        "count": count,
        "window_minutes": WINDOW_MINUTES,
        "example_error_code": example_error_code,
        "error_name": error_name,
        "operator_hint": operator_hint,
        "timestamp": timestamp or iso_now(),
    }
    alert["dashboard_url"] = build_discover_url(alert)
    return alert


def evaluate_alerts(documents: list[Document]) -> list[Alert]:
    docs, reference_now = window_documents(documents)
    alerts: list[Alert] = []
    reference_timestamp = reference_now.isoformat().replace("+00:00", "Z")

    requests = [doc for doc in docs if doc.get("event_type") == "http_request"]
    five_xx = [doc for doc in requests if (safe_int(doc.get("status_code")) or 0) >= 500]
    if len(five_xx) >= FIVE_XX_THRESHOLD:
        route = most_common_value(five_xx, "route")
        status_code = most_common_value(five_xx, "status_code")
        route_count = Counter(str(doc.get("route") or "unknown") for doc in five_xx)[route]
        alerts.append(
            create_alert(
                "CRITICAL",
                "5xx_burst",
                route,
                "5xx burst detected",
                f"route={route} | count={route_count}/{len(five_xx)} within {WINDOW_MINUTES}m",
                route=route,
                status_code=status_code,
                count=len(five_xx),
                operator_hint="Server-side failures are repeating on one route. Check the route panel and recent error_event documents.",
                timestamp=reference_timestamp,
            )
        )

    grouped_errors: defaultdict[str, list[Document]] = defaultdict(list)
    for doc in docs:
        if is_actionable_error_doc(doc):
            grouped_errors[truncate_text(get_error_message(doc))].append(doc)

    for message, group in grouped_errors.items():
        if len(group) >= REPEATED_ERROR_THRESHOLD:
            sample = next((doc for doc in group if doc.get("route")), group[0])
            route = str(sample.get("route") or "unknown")
            error_name = get_error_name(sample)
            alerts.append(
                create_alert(
                    "ERROR",
                    "repeated_error",
                    f"{route}::{message}",
                    "Repeated error detected",
                    f"route={route} | count={len(group)} within {WINDOW_MINUTES}m | message={message}",
                    route=route,
                    status_code=safe_int(sample.get("status_code")),
                    count=len(group),
                    example_error_code=sample.get("error_code"),
                    error_name=error_name,
                    operator_hint="Same application error is repeating. Use example_error_code or route in Discover for the full stack trace.",
                    timestamp=reference_timestamp,
                )
            )

    latency_values = [float(doc["latency_ms"]) for doc in requests if doc.get("latency_ms") is not None]
    p95 = percentile(latency_values, 0.95)
    if p95 is not None and p95 > LATENCY_P95_THRESHOLD_MS:
        slow_requests = [
            doc for doc in requests
            if doc.get("latency_ms") is not None and float(doc["latency_ms"]) >= p95
        ]
        route = most_common_value(slow_requests, "route")
        alerts.append(
            create_alert(
                "WARN",
                "high_latency",
                "p95_latency",
                "High latency detected",
                f"p95={p95:.2f}ms within {WINDOW_MINUTES}m | threshold={LATENCY_P95_THRESHOLD_MS:.0f}ms",
                route=route,
                count=len(latency_values),
                operator_hint="The slowest request group exceeded latency threshold. Check route latency and recent deploy/API dependency status.",
                timestamp=reference_timestamp,
            )
        )

    db_errors = [
        doc for doc in docs
        if doc.get("source_log") == "db_error_log" and str(doc.get("severity", "")).lower() == "error"
    ]
    if len(db_errors) >= DB_ERROR_THRESHOLD:
        grouped_by_error_name: defaultdict[str, list[Document]] = defaultdict(list)
        for doc in db_errors:
            grouped_by_error_name[get_error_name(doc)].append(doc)
        error_name, top_group = max(grouped_by_error_name.items(), key=lambda item: len(item[1]))
        route = most_common_value(top_group, "route")
        sample = top_group[0]
        alerts.append(
            create_alert(
                "ERROR",
                "db_error_spike",
                error_name,
                "DB error_log spike detected",
                f"error_name={error_name} | route={route} | count={len(top_group)}/{len(db_errors)} within {WINDOW_MINUTES}m",
                route=route,
                status_code=safe_int(sample.get("status_code")),
                count=len(db_errors),
                example_error_code=sample.get("error_code"),
                error_name=error_name,
                operator_hint="Structured DB error_log rows are increasing. Inspect error_name, route, and example_error_code first.",
                timestamp=reference_timestamp,
            )
        )

    auth_failures = [
        doc for doc in requests
        if safe_int(doc.get("status_code")) in {401, 403}
    ]
    if len(auth_failures) >= AUTH_FAILURE_THRESHOLD:
        route = most_common_value(auth_failures, "route")
        status_code = "/".join(str(code) for code in sorted({safe_int(doc.get("status_code")) for doc in auth_failures if safe_int(doc.get("status_code"))}))
        alerts.append(
            create_alert(
                "WARN",
                "auth_failure_spike",
                route,
                "Auth failure spike detected",
                f"top_route={route} | status={status_code} | count={len(auth_failures)} within {WINDOW_MINUTES}m",
                route=route,
                status_code=status_code,
                count=len(auth_failures),
                operator_hint="Authentication or authorization failures spiked. Check session cookie, role policy, and affected route.",
                timestamp=reference_timestamp,
            )
        )

    dependency_groups: defaultdict[str, list[Document]] = defaultdict(list)
    for doc in docs:
        term = matches_dependency_error(doc)
        if term:
            dependency_groups[term].append(doc)

    for term, group in dependency_groups.items():
        if len(group) >= DEPENDENCY_ERROR_THRESHOLD:
            sample = group[0]
            route = str(sample.get("route") or "unknown")
            alerts.append(
                create_alert(
                    "CRITICAL",
                    "dependency_error_detected",
                    term,
                    "Dependency error detected",
                    f"dependency={term} | route={route} | count={len(group)} within {WINDOW_MINUTES}m",
                    route=route,
                    status_code=safe_int(sample.get("status_code")),
                    count=len(group),
                    example_error_code=sample.get("error_code"),
                    error_name=get_error_name(sample),
                    operator_hint="A downstream dependency-style error was detected. Check the named dependency and route before code-level debugging.",
                    timestamp=reference_timestamp,
                )
            )

    silent_docs, _ = window_documents(documents, PIPELINE_SILENT_MINUTES)
    recent_requests = [doc for doc in silent_docs if doc.get("event_type") == "http_request"]
    if EXPECT_TRAFFIC and not recent_requests:
        alerts.append(
            create_alert(
                "CRITICAL",
                "pipeline_silent",
                "http_request",
                "Log pipeline is silent",
                f"no http_request documents observed within {PIPELINE_SILENT_MINUTES}m",
                count=0,
                operator_hint="Expected traffic is enabled but no request logs were indexed. Check CloudWatch subscription, Lambda, and OpenSearch ingest.",
                timestamp=reference_timestamp,
            )
        )

    return alerts


def create_opensearch_failure_alert(exc: BaseException) -> Alert:
    status_code: int | None = None
    message = str(exc)
    if isinstance(exc, error.HTTPError):
        status_code = exc.code
        message = f"{exc.code} {exc.reason}"
    return create_alert(
        "CRITICAL",
        "opensearch_query_failure",
        "opensearch_search",
        "OpenSearch alert query failed",
        f"OpenSearch search failed: {message}",
        route="opensearch",
        status_code=status_code,
        count=1,
        operator_hint="The alert evaluator could not query OpenSearch. Check endpoint, credentials, domain policy, and network egress.",
    )


def filter_new_alerts(alerts: list[Alert], state: dict[str, str]) -> tuple[list[Alert], dict[str, str]]:
    now = datetime.now(timezone.utc)
    filtered: list[Alert] = []
    new_state = dict(state)

    for alert in alerts:
        dedupe_key = f"{alert['alert_type']}::{alert['key']}"
        previous = state.get(dedupe_key)
        if previous:
            previous_time = parse_timestamp(previous)
            if now - previous_time < timedelta(minutes=COOLDOWN_MINUTES):
                continue
        filtered.append(alert)
        new_state[dedupe_key] = now.isoformat().replace("+00:00", "Z")

    return filtered, new_state


def format_discord_message(alert: Alert) -> str:
    lines = [
        f"[{alert['severity']}] {alert['title']}",
        f"summary={alert['summary']}",
    ]
    details = [
        ("route", alert.get("route")),
        ("status", alert.get("status_code")),
        ("count", alert.get("count")),
        ("window", f"{alert.get('window_minutes')}m"),
        ("error_name", alert.get("error_name")),
        ("example_error_code", alert.get("example_error_code")),
    ]
    for label, value in details:
        if value not in (None, ""):
            lines.append(f"{label}={value}")
    if alert.get("operator_hint"):
        lines.append(f"operator_hint={alert['operator_hint']}")
    if alert.get("dashboard_url"):
        lines.append(f"dashboard={alert['dashboard_url']}")
    return "\n".join(lines)


def send_discord(alerts: Iterable[Alert], webhook_url: str) -> None:
    for alert in alerts:
        payload = {
            "content": format_discord_message(alert)
        }
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            webhook_url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "GMOK-Alert-Evaluator/1.0",
            },
            method="POST",
        )
        with request.urlopen(req, timeout=10) as response:
            response.read()


def main(argv: list[str]) -> int:
    if not argv and not OPENSEARCH_SEARCH_URL:
        print("usage: evaluate_alerts.py <normalized-file> [<normalized-file> ...]")
        return 1

    if OPENSEARCH_SEARCH_URL:
        try:
            search_window = max(WINDOW_MINUTES, PIPELINE_SILENT_MINUTES if EXPECT_TRAFFIC else WINDOW_MINUTES)
            documents = load_documents_from_opensearch(OPENSEARCH_SEARCH_URL, search_window)
            alerts = evaluate_alerts(documents)
        except Exception as exc:
            alerts = [create_opensearch_failure_alert(exc)]
    else:
        documents = load_documents(argv)
        alerts = evaluate_alerts(documents)

    state = load_state()
    new_alerts, new_state = filter_new_alerts(alerts, state)

    print(json.dumps(new_alerts, ensure_ascii=False, indent=2))

    webhook_url = os.environ.get("DISCORD_WEBHOOK_URL")
    if webhook_url and new_alerts:
        send_discord(new_alerts, webhook_url)

    save_state(new_state)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
