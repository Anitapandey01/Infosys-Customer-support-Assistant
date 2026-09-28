from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.escalation_service import calculate_escalation_risk


router = APIRouter(
    prefix="/escalation",
    tags=["Escalation Risk Monitoring"],
)


class EscalationRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        description="Current customer message.",
    )

    frustration_level: int = Field(
        default=0,
        ge=0,
        le=10,
        description="Current customer frustration level.",
    )

    sentiment: str = Field(
        default="Neutral",
        description="Current customer sentiment.",
    )

    conversation_history: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Previous conversation messages.",
    )

    escalation_threshold: int = Field(
        default=7,
        ge=1,
        le=10,
        description="Configurable threshold for a high-risk alert.",
    )


class EscalationResponse(BaseModel):
    risk_score: int
    risk_level: str
    risk_threshold: int
    reasons: list[str]
    recommended_action: str
    alert: bool


@router.post(
    "/monitor",
    response_model=EscalationResponse,
    summary="Monitor Customer Escalation Risk",
    description="""
Calculate the current escalation risk for a customer conversation.

The monitor considers:

- Customer frustration
- Sentiment
- Repeated complaints
- Unresolved issues
- Explicit escalation requests
- Severe escalation indicators
- Conversation history

The response contains a risk score, risk level,
reasoning, recommended action, and alert status.
""",
)
def monitor_escalation_risk(
    request: EscalationRequest,
):
    return calculate_escalation_risk(
        message=request.message,
        frustration_level=request.frustration_level,
        sentiment=request.sentiment,
        conversation_history=request.conversation_history,
        escalation_threshold=request.escalation_threshold,
    )