from __future__ import annotations

import base64
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib import parse, request


ALERT_STATE_PATH = Path(".state/discord_alert_state.json")
WINDOW_MINUTES = int(os.environ.get("ALERT_WINDOW_MINUTES", "5"))
FIVE_XX_THRESHOLD = int(os.environ.get("ALERT_5XX_THRESHOLD", "5"))
REPEATED_ERROR_THRESHOLD = int(os.environ.get("ALERT_REPEATED_ERROR_THRESHOLD", "3"))
LATENCY_P95_THRESHOLD_MS = float(os.environ.get("ALERT_P95_LATENCY_MS", "1000"))
DB_ERROR_THRESHOLD = int(os.environ.get("ALERT_DB_ERROR_THRESHOLD", "5"))
OPENSEARCH_SEARCH_URL = os.environ.get("OPENSEARCH_SEARCH_URL")
OPENSEARCH_USERNAME = os.environ.get("OPENSEARCH_USERNAME")
OPENSEARCH_PASSWORD = os.environ.get("OPENSEARCH_PASSWORD")
OPENSEARCH_SEARCH_SIZE = int(os.environ.get("OPENSEARCH_SEARCH_SIZE", "1000"))


def parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


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


def load_documents(paths: list[str]) -> list[dict[str, Any]]:
    documents: list[dict[str, Any]] = []
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


def load_documents_from_opensearch(search_url: str) -> list[dict[str, Any]]:
    query = {
        "size": OPENSEARCH_SEARCH_SIZE,
        "sort": [{"@timestamp": {"order": "desc"}}],
        "query": {
            "range": {
                "@timestamp": {
                    "gte": f"now-{WINDOW_MINUTES}m",
                    "lte": "now"
                }
            }
        }
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


def window_documents(documents: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], datetime]:
    if not documents:
        now = datetime.now(timezone.utc)
        return ([], now)
    reference_now = max(parse_timestamp(doc["@timestamp"]) for doc in documents)
    threshold = reference_now - timedelta(minutes=WINDOW_MINUTES)
    return (
        [doc for doc in documents if parse_timestamp(doc["@timestamp"]) >= threshold],
        reference_now,
    )


def create_alert(alert_type: str, key: str, title: str, body: str) -> dict[str, str]:
    return {
        "alert_type": alert_type,
        "key": key,
        "title": title,
        "body": body,
    }


def evaluate_alerts(documents: list[dict[str, Any]]) -> list[dict[str, str]]:
    docs, reference_now = window_documents(documents)
    alerts: list[dict[str, str]] = []

    requests = [doc for doc in docs if doc.get("event_type") == "http_request"]
    five_xx = [doc for doc in requests if isinstance(doc.get("status_code"), int) and doc["status_code"] >= 500]
    if len(five_xx) >= FIVE_XX_THRESHOLD:
        routes = Counter(doc.get("route") or "unknown" for doc in five_xx)
        route, count = routes.most_common(1)[0]
        alerts.append(
            create_alert(
                "5xx_burst",
                route,
                "5xx burst detected",
                f"{reference_now.isoformat()} | route={route} | count={count} within last {WINDOW_MINUTES}m",
            )
        )

    grouped_errors: defaultdict[str, list[dict[str, Any]]] = defaultdict(list)
    for doc in docs:
        if doc.get("source_log") == "error" or doc.get("event_type") == "error_event":
            message = doc.get("error_message") or doc.get("message") or "unknown error"
            grouped_errors[message].append(doc)

    for message, group in grouped_errors.items():
        if len(group) >= REPEATED_ERROR_THRESHOLD:
            sample = group[0]
            alerts.append(
                create_alert(
                    "repeated_error",
                    message,
                    "Repeated error detected",
                    (
                        f"{reference_now.isoformat()} | count={len(group)} | "
                        f"route={sample.get('route') or 'unknown'} | message={message}"
                    ),
                )
            )

    latency_values = [float(doc["latency_ms"]) for doc in requests if doc.get("latency_ms") is not None]
    p95 = percentile(latency_values, 0.95)
    if p95 is not None and p95 > LATENCY_P95_THRESHOLD_MS:
        alerts.append(
            create_alert(
                "high_latency",
                "p95_latency",
                "High latency detected",
                f"{reference_now.isoformat()} | p95 latency={p95:.2f}ms within last {WINDOW_MINUTES}m",
            )
        )

    db_errors = [
        doc for doc in docs
        if doc.get("source_log") == "db_error_log" and str(doc.get("severity", "")).lower() == "error"
    ]
    if len(db_errors) >= DB_ERROR_THRESHOLD:
        error_codes = Counter(doc.get("error_code") or "unknown" for doc in db_errors)
        error_code, count = error_codes.most_common(1)[0]
        alerts.append(
            create_alert(
                "db_error_spike",
                error_code,
                "DB error_log spike detected",
                f"{reference_now.isoformat()} | error_code={error_code} | count={count} within last {WINDOW_MINUTES}m",
            )
        )

    return alerts


def filter_new_alerts(alerts: list[dict[str, str]], state: dict[str, str]) -> tuple[list[dict[str, str]], dict[str, str]]:
    now = datetime.now(timezone.utc)
    filtered: list[dict[str, str]] = []
    new_state = dict(state)

    for alert in alerts:
        dedupe_key = f"{alert['alert_type']}::{alert['key']}"
        previous = state.get(dedupe_key)
        if previous:
            previous_time = parse_timestamp(previous)
            if now - previous_time < timedelta(minutes=WINDOW_MINUTES):
                continue
        filtered.append(alert)
        new_state[dedupe_key] = now.isoformat().replace("+00:00", "Z")

    return filtered, new_state


def send_discord(alerts: Iterable[dict[str, str]], webhook_url: str) -> None:
    for alert in alerts:
        payload = {
            "content": f"**{alert['title']}**\n{alert['body']}"
        }
        data = json.dumps(payload).encode("utf-8")
        req = request.Request(
            webhook_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=10) as response:
            response.read()


def main(argv: list[str]) -> int:
    if not argv and not OPENSEARCH_SEARCH_URL:
        print("usage: evaluate_alerts.py <normalized-file> [<normalized-file> ...]")
        return 1

    documents = load_documents_from_opensearch(OPENSEARCH_SEARCH_URL) if OPENSEARCH_SEARCH_URL else load_documents(argv)
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
