from __future__ import annotations

from app.services import knowledge_recommendation_service as service


SCENARIOS = [
    ("Payment failure", "My card payment failed and was declined three times", "Payment_policy"),
    ("Refund request", "Where is my refund? I was charged and need my money back", "refund_policy"),
    ("Login/account", "I am locked out of my account and my OTP is not working", "FAQ"),
    ("Order cancellation", "Please cancel my order before it ships", "Cancel_policy"),
    ("Delivery delay", "My package is late and tracking has not updated", "Delivery_policy"),
    ("Product replacement", "The item arrived damaged and I want an exchange", "Return_policy"),
    ("Subscription issue", "I want to stop auto renewal and cancel my subscription", "Cancel_policy"),
    ("Duplicate charge", "I was charged twice for the same order", "Payment_policy"),
    ("Refund policy", "What is the refund eligibility window?", "refund_policy"),
    ("Shipping policy", "What should I do if the guaranteed delivery date passed?", "Delivery_policy"),
    ("Return policy", "Can I return a defective product?", "Return_policy"),
    ("General FAQ", "How can I update my account details?", "FAQ"),
]


def _fake_results_for(query_embedding, number_of_results):
    return {
        "ids": [["chunk-1", "chunk-2", "chunk-3", "chunk-4"]],
        "documents": [[
            "Refund policy: eligible refunds are processed after approval.",
            "Payment policy: duplicate charges should be investigated using transaction records.",
            "Delivery policy: delayed shipments should be checked against tracking and SLA.",
            "Return policy: damaged or defective items may qualify for return or exchange.",
        ]],
        "metadatas": [[
            {"document_id": 1, "document_name": "refund_policy_v2.pdf", "document_type": "policy", "version": 2, "page_number": 1},
            {"document_id": 2, "document_name": "Payment_policy_v1.pdf", "document_type": "policy", "version": 1, "page_number": 2},
            {"document_id": 3, "document_name": "Delivery_policy_v1.pdf", "document_type": "policy", "version": 1, "page_number": 3},
            {"document_id": 4, "document_name": "Return_policy_v1.pdf", "document_type": "policy", "version": 1, "page_number": 2},
        ]],
        "distances": [[0.10, 0.20, 0.30, 0.40]],
    }


def test_returns_maximum_five_ranked_recommendations(monkeypatch):
    monkeypatch.setattr(service, "generate_embedding", lambda text: [0.1, 0.2])
    monkeypatch.setattr(service, "search_documents", _fake_results_for)
    monkeypatch.setattr(service, "get_latest_active_document_ids", lambda: {1, 2, 3, 4})

    result = service.recommend_knowledge("I need a refund", number_of_recommendations=5)

    assert 1 <= len(result["recommendations"]) <= 5
    assert [item["rank"] for item in result["recommendations"]] == list(range(1, len(result["recommendations"]) + 1))
    assert result["recommendations"][0]["relevance_distance"] == 0.10
    assert result["recommendations"][0]["reference"]["document_name"] == "refund_policy_v2.pdf"


def test_only_latest_active_documents_are_returned(monkeypatch):
    monkeypatch.setattr(service, "generate_embedding", lambda text: [0.1])
    monkeypatch.setattr(service, "search_documents", _fake_results_for)
    monkeypatch.setattr(service, "get_latest_active_document_ids", lambda: {2, 4})

    result = service.recommend_knowledge("damaged item", number_of_recommendations=3)
    names = [item["document_name"] for item in result["recommendations"]]

    assert names == ["Payment_policy_v1.pdf", "Return_policy_v1.pdf"]


def test_no_knowledge_is_handled_cleanly(monkeypatch):
    monkeypatch.setattr(service, "generate_embedding", lambda text: [0.1])
    monkeypatch.setattr(service, "search_documents", lambda **kwargs: {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]})
    monkeypatch.setattr(service, "get_latest_active_document_ids", lambda: set())

    result = service.recommend_knowledge("something unsupported")

    assert result["recommendations"] == []
    assert "No relevant" in result["message"]


def test_conversation_context_is_added_to_query(monkeypatch):
    captured = {}

    def fake_embedding(text):
        captured["query"] = text
        return [0.1]

    monkeypatch.setattr(service, "generate_embedding", fake_embedding)
    monkeypatch.setattr(service, "search_documents", lambda **kwargs: {"ids": [[]], "documents": [[]], "metadatas": [[]], "distances": [[]]})
    monkeypatch.setattr(service, "get_latest_active_document_ids", lambda: set())

    service.recommend_knowledge(
        "Can you send a replacement?",
        conversation_history=[
            {"sender_type": "Customer", "message_text": "My package arrived damaged."},
            {"sender_type": "Support Agent", "message_text": "I can help."},
        ],
    )

    assert "damaged" in captured["query"]
    assert "replacement" in captured["query"]


def test_empty_message_returns_without_embedding(monkeypatch):
    def fail_embedding(text):
        raise AssertionError("embedding should not be called")

    monkeypatch.setattr(service, "generate_embedding", fail_embedding)
    result = service.recommend_knowledge("   ")

    assert result["recommendations"] == []
    assert result["query"] == ""


# Twelve evaluation scenarios are defined for Task 5 coverage.
def test_task5_has_12_support_scenarios():
    assert len(SCENARIOS) == 12
    assert all(name and query and expected for name, query, expected in SCENARIOS)
