"""Task 5 knowledge recommendation service.

Reuses the existing embedding + ChromaDB RAG pipeline and returns the
most relevant active knowledge chunks for each customer turn.
"""
from __future__ import annotations

from typing import Any

from app.services.embedding_service import generate_embedding
from app.services.vector_service import search_documents
from app.services.rag_service import get_latest_active_document_ids

DEFAULT_RECOMMENDATION_COUNT = 3
MAX_RECOMMENDATION_COUNT = 5
MIN_CANDIDATES = 30
CANDIDATE_MULTIPLIER = 10
MAX_RELEVANCE_DISTANCE = 1.40


def _normalize_text(text: str) -> str:
    return " ".join(str(text or "").lower().strip().split())


def _build_recommendation_query(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
) -> str:
    """Build a context-aware query from the current and recent customer turns."""
    current = _normalize_text(message)
    if not current:
        return ""

    if not conversation_history:
        return current

    previous_customer_messages: list[str] = []
    for item in conversation_history:
        sender = str(item.get("sender_type", item.get("sender", ""))).lower()
        text = str(item.get("message_text", item.get("text", ""))).strip()
        if sender in {"customer", "user", "customer_message"} and text:
            if _normalize_text(text) != current:
                previous_customer_messages.append(text)

    previous_customer_messages = previous_customer_messages[-3:]
    if not previous_customer_messages:
        return current

    return " ".join(previous_customer_messages + [message]).strip()


def _extract_results(results: dict[str, Any]) -> list[dict[str, Any]]:
    ids = results.get("ids", [[]])
    documents = results.get("documents", [[]])
    metadatas = results.get("metadatas", [[]])
    distances = results.get("distances", [[]])

    ids = ids[0] if ids else []
    documents = documents[0] if documents else []
    metadatas = metadatas[0] if metadatas else []
    distances = distances[0] if distances else []

    candidates: list[dict[str, Any]] = []
    for index, chunk_id in enumerate(ids):
        metadata = metadatas[index] or {} if index < len(metadatas) else {}
        text = documents[index] if index < len(documents) else ""
        distance = distances[index] if index < len(distances) else None
        candidates.append({
            "chunk_id": chunk_id,
            "text": text,
            "metadata": metadata,
            "distance": float(distance) if distance is not None else None,
        })
    return candidates


def _filter_latest_active_documents(candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest_active_ids = {str(value) for value in get_latest_active_document_ids()}
    filtered: list[dict[str, Any]] = []

    for candidate in candidates:
        document_id = candidate["metadata"].get("document_id")
        if document_id is None or str(document_id) not in latest_active_ids:
            continue
        filtered.append(candidate)

    return filtered


def _distance_to_relevance(distance: float | None) -> float | None:
    """Convert Chroma distance into a bounded display relevance score."""
    if distance is None:
        return None
    return round(max(0.0, min(1.0, 1.0 / (1.0 + max(0.0, distance)))), 3)


def _build_recommendation(candidate: dict[str, Any], rank: int) -> dict[str, Any]:
    metadata = candidate["metadata"]
    document_name = metadata.get("document_name", "Support Knowledge")
    document_type = metadata.get("document_type", "Unknown")
    version = metadata.get("version")
    page_number = metadata.get("page_number")
    source = metadata.get("source") or (f"{document_name} (Page {page_number})" if page_number else document_name)

    return {
        "rank": rank,
        "chunk_id": candidate["chunk_id"],
        "title": document_name,
        "document_name": document_name,
        "document_type": document_type,
        "version": version,
        "page_number": page_number,
        "source": source,
        "relevance_distance": candidate["distance"],
        "relevance_score": _distance_to_relevance(candidate["distance"]),
        "content": candidate["text"],
        "reference": {
            "document_name": document_name,
            "document_type": document_type,
            "version": version,
            "page_number": page_number,
            "chunk_id": candidate["chunk_id"],
            "source": source,
        },
    }


def recommend_knowledge(
    message: str,
    conversation_history: list[dict[str, Any]] | None = None,
    number_of_recommendations: int = DEFAULT_RECOMMENDATION_COUNT,
) -> dict[str, Any]:
    """Return 3-5 ranked, active knowledge recommendations for a support turn."""
    if not str(message or "").strip():
        return {
            "query": "",
            "recommendations": [],
            "message": "No customer message was provided.",
        }

    count = max(1, min(int(number_of_recommendations), MAX_RECOMMENDATION_COUNT))
    query = _build_recommendation_query(message, conversation_history)
    embedding = generate_embedding(query)

    candidate_count = max(count * CANDIDATE_MULTIPLIER, MIN_CANDIDATES)
    results = search_documents(
        query_embedding=embedding,
        number_of_results=candidate_count,
    )

    candidates = _filter_latest_active_documents(_extract_results(results))
    candidates = [
        item for item in candidates
        if item["distance"] is not None and item["distance"] <= MAX_RELEVANCE_DISTANCE
    ]
    candidates.sort(key=lambda item: item["distance"])
    selected = candidates[:count]

    if not selected:
        return {
            "query": query,
            "recommendations": [],
            "message": "No relevant active support knowledge was found.",
        }

    recommendations = [
        _build_recommendation(candidate, rank=index + 1)
        for index, candidate in enumerate(selected)
    ]

    return {
        "query": query,
        "recommendations": recommendations,
        "message": "Relevant support knowledge recommendations found.",
    }
