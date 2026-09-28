from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.coaching_service import generate_coaching


router = APIRouter(
    prefix="/coaching",
    tags=["Coaching & Response Suggestion"],
)


class CoachingRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="Current customer message.",
    )

    intent: str = Field(
        ...,
        description="Customer intent detected by Task 4.",
    )

    emotion: str = Field(
        ...,
        description="Customer emotion detected by Task 4.",
    )

    sentiment: str = Field(
        ...,
        description="Customer sentiment detected by Task 4.",
    )

    frustration_level: int = Field(
        ...,
        ge=0,
        le=10,
        description="Customer frustration level from 0 to 10.",
    )

    escalation_risk: str = Field(
        ...,
        description="Current escalation risk.",
    )

    conversation_history: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Previous conversation messages.",
    )

    knowledge_recommendations: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Task 5 knowledge recommendations.",
    )


class CoachingResponse(BaseModel):
    suggested_response: str
    tone: str
    clarity: str
    empathy: str
    professionalism: str
    communication_rating: str
    coaching_tips: list[str]


@router.post(
    "/suggest",
    response_model=CoachingResponse,
    summary="Generate Support Response Suggestion and Coaching",
    description="""
Generate a context-aware response suggestion for a support agent.

The coaching agent uses:

- Customer message
- Intent
- Emotion
- Sentiment
- Frustration level
- Escalation risk
- Conversation history
- Knowledge-base recommendations

It returns a suggested response together with
communication-quality evaluation and actionable coaching tips.
""",
)
def generate_response_suggestion(
    request: CoachingRequest,
):
    return generate_coaching(
        message=request.message,
        intent=request.intent,
        emotion=request.emotion,
        sentiment=request.sentiment,
        frustration_level=request.frustration_level,
        escalation_risk=request.escalation_risk,
        conversation_history=request.conversation_history,
        knowledge_recommendations=request.knowledge_recommendations,
    )