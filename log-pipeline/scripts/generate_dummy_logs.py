from __future__ import annotations

import json
import random
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SAMPLES_DIR = ROOT / "samples" / "raw"
APP_LOG = SAMPLES_DIR / "backend-app.ndjson"
ERROR_LOG = SAMPLES_DIR / "backend-error.ndjson"


ROUTES = [
    ("GET", "/api/health"),
    ("POST", "/api/matches"),
    ("GET", "/api/matches/{matchId}"),
    ("POST", "/api/auth/login"),
    ("GET", "/api/users/me"),
]

MESSAGES = {
    "request": [
        "request completed",
        "request accepted",
        "request routed",
    ],
    "business": [
        "match result persisted",
        "outbox event created",
        "player mmr update scheduled",
    ],
    "auth": [
        "login succeeded",
        "token refreshed",
    ],
    "system": [
        "background worker heartbeat",
        "pm2 process started",
    ],
}

ERRORS = [
    ("DatabaseTimeoutError", "query execution exceeded timeout"),
    ("ReplayParseError", "failed to parse replay payload"),
    ("UnauthorizedError", "invalid access token"),
]


def iso_now(offset_seconds: int) -> str:
    current = datetime.now(UTC) - timedelta(seconds=offset_seconds)
    return current.isoformat().replace("+00:00", "Z")


def random_ip() -> str:
    return ".".join(str(random.randint(1, 254)) for _ in range(4))


def build_request_event(index: int) -> dict:
    method, route = random.choice(ROUTES)
    event_type = random.choice(["request", "business", "auth", "system"])
    request_id = str(uuid.uuid4())
    user_id = random.randint(1000, 1100)
    match_id = None
    if route.startswith("/api/matches") or event_type == "business":
        match_id = f"match-{random.randint(20000, 20100)}"

    return {
        "timestamp": iso_now(index * 5),
        "level": random.choices(["INFO", "WARN"], weights=[8, 2], k=1)[0],
        "service": "mmr-backend",
        "environment": "dev",
        "event_type": event_type,
        "message": random.choice(MESSAGES[event_type]),
        "request_id": request_id,
        "user_id": str(user_id),
        "match_id": match_id,
        "method": method,
        "route": route,
        "status_code": random.choices([200, 201, 202, 400], weights=[7, 1, 1, 1], k=1)[0],
        "latency_ms": random.randint(15, 900),
        "client_ip": random_ip(),
        "meta": {
            "instance_id": "i-demo1234567890",
            "az": "eu-central-1a",
            "source": "pm2",
        },
    }


def build_error_event(index: int) -> dict:
    error_name, error_message = random.choice(ERRORS)
    request_id = str(uuid.uuid4())
    match_id = f"match-{random.randint(20000, 20100)}"

    return {
        "timestamp": iso_now(index * 13),
        "level": "ERROR",
        "service": "mmr-backend",
        "environment": "dev",
        "event_type": "exception",
        "message": error_message,
        "request_id": request_id,
        "user_id": str(random.randint(1000, 1100)),
        "match_id": match_id,
        "method": "POST",
        "route": "/api/matches",
        "status_code": random.choice([500, 502, 503]),
        "latency_ms": random.randint(1000, 4000),
        "client_ip": random_ip(),
        "error": {
            "name": error_name,
            "message": error_message,
            "stack": [
                "ReplayService.parseReplay (services/replay.js:42:13)",
                "MatchController.createMatch (controllers/match.js:18:5)",
            ],
        },
        "meta": {
            "instance_id": "i-demo1234567890",
            "az": "eu-central-1a",
            "source": "pm2",
        },
    }


def write_ndjson(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    app_rows = [build_request_event(i) for i in range(30)]
    error_rows = [build_error_event(i) for i in range(10)]

    write_ndjson(APP_LOG, app_rows)
    write_ndjson(ERROR_LOG, error_rows)

    print(f"generated: {APP_LOG}")
    print(f"generated: {ERROR_LOG}")


if __name__ == "__main__":
    main()
