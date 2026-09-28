from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.knowledge_recommendation_service import (
    DEFAULT_RECOMMENDATION_COUNT,
    MAX_RECOMMENDATION_COUNT,
    recommend_knowledge,
)

router = APIRouter(prefix="/knowledge", tags=["Knowledge Recommendation"])


class KnowledgeHistoryMessage(BaseModel):
    sender_type: str
    message_text: str = Field(..., min_length=1)


class KnowledgeRecommendationRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_history: list[KnowledgeHistoryMessage] = Field(default_factory=list)
    number_of_recommendations: int = Field(
        DEFAULT_RECOMMENDATION_COUNT,
        ge=1,
        le=MAX_RECOMMENDATION_COUNT,
    )


@router.post("/recommend")
def recommend_support_knowledge(request: KnowledgeRecommendationRequest) -> dict[str, Any]:
    history = [item.model_dump() for item in request.conversation_history]
    try:
        return recommend_knowledge(
            message=request.message,
            conversation_history=history,
            number_of_recommendations=request.number_of_recommendations,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Knowledge recommendation failed: {exc}",
        ) from exc
