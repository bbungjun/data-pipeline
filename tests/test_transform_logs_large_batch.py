from __future__ import annotations

import importlib.util
import json
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HANDLER_PATH = ROOT / "log-pipeline" / "lambda" / "transform_logs" / "handler.py"


def load_handler():
    spec = importlib.util.spec_from_file_location("transform_logs_handler_test", HANDLER_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def make_document(index: int) -> dict:
    return {
        "@timestamp": "2026-05-16T12:00:00Z",
        "source_log": "out",
        "message": f"GET /api/matches/{index} 200 30 ms - 123",
        "route": f"/api/matches/{index}",
        "meta": {
            "log_event_id": f"event-{index}",
        },
    }


def json_dumps(value):
    return json.dumps(value)


def json_loads(value):
    return json.loads(value)


class TransformLogsLargeBatchTests(unittest.TestCase):
    def test_chunks_bulk_documents_by_document_count(self):
        handler = load_handler()
        documents = [make_document(index) for index in range(10001)]

        chunks = list(handler.chunk_documents_for_bulk(documents, max_documents=3000))

        self.assertEqual([len(chunk) for chunk in chunks], [3000, 3000, 3000, 1001])
        self.assertEqual(chunks[0][0]["route"], "/api/matches/0")
        self.assertEqual(chunks[-1][-1]["route"], "/api/matches/10000")

    def test_summarizes_bulk_item_failures(self):
        handler = load_handler()
        response = {
            "errors": True,
            "items": [
                {"index": {"status": 201}},
                {"index": {"status": 429, "error": {"type": "too_many_requests"}}},
                {"index": {"status": 400, "error": {"type": "mapper_parsing_exception"}}},
            ],
        }

        summary = handler.summarize_bulk_response(response)

        self.assertEqual(summary["failed"], 2)
        self.assertEqual(summary["succeeded"], 1)
        self.assertEqual(
            summary["failure_types"],
            {
                "too_many_requests": 1,
                "mapper_parsing_exception": 1,
            },
        )

    def test_bulk_payload_uses_stable_document_id(self):
        handler = load_handler()
        document = make_document(7)

        payload = handler.build_bulk_payload([document])
        action = payload.splitlines()[0]

        self.assertIn('"_id": "out:event-7"', action)

    def test_sqs_messages_are_batched_in_groups_of_ten(self):
        handler = load_handler()
        documents = [make_document(index) for index in range(11)]

        batches = handler.build_sqs_entries(documents)

        self.assertEqual([len(batch) for batch in batches], [10, 1])
        first_body = json_loads(batches[0][0]["MessageBody"])
        self.assertEqual(first_body["document_id"], "out:event-0")
        self.assertEqual(first_body["document"]["route"], "/api/matches/0")

    def test_sqs_worker_reports_only_failed_messages(self):
        handler = load_handler()
        event = {
            "Records": [
                {
                    "messageId": "ok-message",
                    "body": json_dumps({"document": make_document(1), "document_id": "out:event-1"}),
                    "eventSource": "aws:sqs",
                },
                {
                    "messageId": "failed-message",
                    "body": json_dumps({"document": make_document(2), "document_id": "out:event-2"}),
                    "eventSource": "aws:sqs",
                },
            ]
        }

        def fake_push(documents):
            return {
                "pushed": False,
                "failed_document_ids": ["out:event-2"],
            }

        result = handler.handle_sqs_event(event, push=fake_push)

        self.assertEqual(result["processed_messages"], 2)
        self.assertEqual(result["batchItemFailures"], [{"itemIdentifier": "failed-message"}])

    def test_sqs_enqueue_failure_raises_for_ingest_retry(self):
        handler = load_handler()

        class FakeSqsClient:
            def send_message_batch(self, QueueUrl, Entries):
                return {
                    "Failed": [
                        {
                            "Id": Entries[0]["Id"],
                            "Code": "InternalError",
                            "Message": "temporary failure",
                        }
                    ]
                }

        class FakeBoto3:
            def client(self, service_name):
                return FakeSqsClient()

        handler.boto3 = FakeBoto3()
        handler.SQS_QUEUE_URL = "https://sqs.example/queue"

        with self.assertRaises(RuntimeError):
            handler.enqueue_documents_to_sqs([make_document(1)])


if __name__ == "__main__":
    unittest.main()
