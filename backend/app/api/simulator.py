import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession

from app.models.database import SessionLocal
from app.models.simulator import Scenario, Session, Conversation, Message

from app.services.analysis_service import analyze_customer_message
from app.services.simulator_service import generate_customer_turn
from app.services.simulator_state import initial_state
from app.services.scenario_service import SCENARIOS, get_scenario_brief
from app.services.persona_service import get_persona_brief
from app.services.knowledge_recommendation_service import recommend_knowledge
from app.services.escalation_service import calculate_escalation_risk


router = APIRouter(
    prefix="/simulator",
    tags=["Customer Simulator"]
)


# --------------------------------------------------
# Database dependency
# --------------------------------------------------

def get_db():

    db = SessionLocal()

    try:
        yield db

    finally:
        db.close()


# --------------------------------------------------
# Request models
# --------------------------------------------------

class SimulatorStartRequest(BaseModel):

    session_label: str

    persona: str

    scenario: str

    initial_emotion: str

    issue_severity: int

    patience_level: int

    expected_resolution: str


class SimulatorMessageRequest(BaseModel):

    session_id: int

    agent_response: str


# --------------------------------------------------
# Endpoint 1: Start Simulation
# --------------------------------------------------

@router.post("/start")
def start_simulator_session(

    request: SimulatorStartRequest,

    db: DBSession = Depends(get_db)

):
    # --------------------------------------------------
    # Validate scenario
    # --------------------------------------------------

    try:

        get_scenario_brief(request.scenario)

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


    # --------------------------------------------------
    # Validate persona
    # --------------------------------------------------

    try:

        get_persona_brief(request.persona)

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )


    scenario_key = request.scenario.strip().lower()

    scenario_data = SCENARIOS[scenario_key]


    # --------------------------------------------------
    # Create Scenario row
    # --------------------------------------------------

    scenario_row = Scenario(
        title=request.session_label
        or f"Scenario - {scenario_key.title()}",

        category=scenario_key,

        difficulty="Medium",

        objective=(
            request.expected_resolution
            or scenario_data.get("resolution_condition")
        ),

        description=scenario_data.get(
            "opening_complaint"
        ),

        is_active=True
    )

    db.add(scenario_row)

    db.flush()


    # --------------------------------------------------
    # Create Session row
    # --------------------------------------------------

    session_row = Session(
        scenario_id=scenario_row.scenario_id,

        start_time=datetime.utcnow(),

        status="In Progress"
    )

    db.add(session_row)

    db.flush()


    # --------------------------------------------------
    # Build initial simulator state
    # --------------------------------------------------

    start_state = initial_state(

        persona=request.persona,

        initial_emotion=request.initial_emotion,

        issue_severity=request.issue_severity,

        patience_level=request.patience_level
    )


    opening_message = scenario_data[
        "opening_complaint"
    ]


    # ==================================================
    # TASK 4 - ANALYSIS
    # ==================================================

    opening_analysis = analyze_customer_message(

        message=opening_message,

        conversation_history=[]
    )


    # ==================================================
    # TASK 5 - KNOWLEDGE RECOMMENDATION
    # ==================================================

    opening_knowledge = recommend_knowledge(

        message=opening_message,

        conversation_history=[],

        number_of_recommendations=3,
    )

    opening_analysis[
        "knowledge_recommendations"
    ] = opening_knowledge[
        "recommendations"
    ]

    opening_analysis[
        "knowledge_message"
    ] = opening_knowledge[
        "message"
    ]


    # ==================================================
    # TASK 6 - ESCALATION RISK MONITOR
    # ==================================================

    opening_escalation = calculate_escalation_risk(

        message=opening_message,

        frustration_level=opening_analysis[
            "frustration_level"
        ],

        sentiment=opening_analysis[
            "sentiment"
        ],

        conversation_history=[]
    )


    opening_analysis[
        "escalation_risk"
    ] = opening_escalation[
        "risk_level"
    ]

    opening_analysis[
        "escalation_risk_score"
    ] = opening_escalation[
        "risk_score"
    ]

    opening_analysis[
        "escalation_risk_threshold"
    ] = opening_escalation[
        "risk_threshold"
    ]

    opening_analysis[
        "escalation_reasons"
    ] = opening_escalation[
        "reasons"
    ]

    opening_analysis[
        "escalation_recommended_action"
    ] = opening_escalation[
        "recommended_action"
    ]

    opening_analysis[
        "escalation_alert"
    ] = opening_escalation[
        "alert"
    ]


    # --------------------------------------------------
    # Create Conversation row
    # --------------------------------------------------

    conversation_row = Conversation(

        session_id=session_row.session_id,

        intent=opening_analysis[
            "intent"
        ],

        sentiment=opening_analysis[
            "sentiment"
        ],

        resolution_status="Unresolved",

        escalation_risk=opening_analysis[
            "escalation_risk"
        ],

        created_at=datetime.utcnow()
    )

    db.add(conversation_row)

    db.flush()


    # --------------------------------------------------
    # Customer opening message
    # --------------------------------------------------

    customer_msg = Message(

        conversation_id=conversation_row.conversation_id,

        sender_type="Customer",

        message_text=opening_message,

        timestamp=datetime.utcnow(),

        message_type="Text"
    )

    db.add(customer_msg)


    # --------------------------------------------------
    # System state message
    # --------------------------------------------------

    system_state_msg = Message(

        conversation_id=conversation_row.conversation_id,

        sender_type="AI",

        message_text=json.dumps({

            "persona": request.persona,

            "scenario": scenario_key,

            "state": start_state

        }),

        timestamp=datetime.utcnow(),

        message_type="System"
    )

    db.add(system_state_msg)


    db.commit()


    # --------------------------------------------------
    # Return initial simulation
    # --------------------------------------------------

    return {

        "session_id": session_row.session_id,

        "conversation_id": conversation_row.conversation_id,

        "customer_message": opening_message,

        "analysis": opening_analysis,

        "state": start_state,

        "turn": 1
    }


# --------------------------------------------------
# Endpoint 2: Next Customer Turn
# --------------------------------------------------

@router.post("/message")
def send_simulator_message(

    request: SimulatorMessageRequest,

    db: DBSession = Depends(get_db)

):

    # --------------------------------------------------
    # Lookup Session
    # --------------------------------------------------

    session_row = (

        db.query(Session)

        .filter(
            Session.session_id
            == request.session_id
        )

        .first()
    )


    if not session_row:

        raise HTTPException(

            status_code=404,

            detail="Simulator session not found"
        )


    # --------------------------------------------------
    # Lookup Conversation
    # --------------------------------------------------

    conversation_row = (

        db.query(Conversation)

        .filter(
            Conversation.session_id
            == session_row.session_id
        )

        .first()
    )


    if not conversation_row:

        raise HTTPException(

            status_code=404,

            detail="Conversation not found for session"
        )


    # --------------------------------------------------
    # Lookup Scenario
    # --------------------------------------------------

    scenario_row = (

        db.query(Scenario)

        .filter(
            Scenario.scenario_id
            == session_row.scenario_id
        )

        .first()
    )


    # --------------------------------------------------
    # Fetch ordered messages
    # --------------------------------------------------

    all_messages = (

        db.query(Message)

        .filter(
            Message.conversation_id
            == conversation_row.conversation_id
        )

        .order_by(
            Message.message_id.asc()
        )

        .all()
    )


    # --------------------------------------------------
    # Reconstruct current state
    # --------------------------------------------------

    current_state = None

    persona = "calm"

    scenario_key = (
        scenario_row.category
        if scenario_row
        else "refund"
    )


    for message in reversed(all_messages):

        if message.message_type != "System":

            continue

        try:

            payload = json.loads(
                message.message_text
            )

            current_state = payload.get(
                "state"
            )

            persona = payload.get(
                "persona",
                persona
            )

            scenario_key = payload.get(
                "scenario",
                scenario_key
            )

            break

        except Exception:

            pass


    if not current_state:

        current_state = initial_state(

            persona,

            "neutral",

            3,

            3
        )


    # --------------------------------------------------
    # Filter dialogue history
    # --------------------------------------------------

    dialogue_history = [

        {

            "sender_type": message.sender_type,

            "message_text": message.message_text

        }

        for message in all_messages

        if message.message_type != "System"
    ]


    # --------------------------------------------------
    # Persist support agent response
    # --------------------------------------------------

    agent_msg = Message(

        conversation_id=conversation_row.conversation_id,

        sender_type="Support Agent",

        message_text=request.agent_response,

        timestamp=datetime.utcnow(),

        message_type="Text"
    )

    db.add(agent_msg)

    db.flush()


    # ==================================================
    # Generate next customer turn
    # ==================================================

    turn_result = generate_customer_turn(

        persona=persona,

        scenario=scenario_key,

        state=current_state,

        conversation_history=dialogue_history,

        agent_response=request.agent_response
    )


    customer_message = turn_result[
        "customer_message"
    ]

    updated_state = turn_result[
        "updated_state"
    ]

    is_res = turn_result[
        "is_resolved"
    ]

    is_esc = turn_result[
        "is_escalated"
    ]


    # ==================================================
    # TASK 4 - ANALYSIS
    # ==================================================

    customer_analysis = analyze_customer_message(

        message=customer_message,

        conversation_history=dialogue_history
    )


    # ==================================================
    # TASK 5 - KNOWLEDGE RECOMMENDATION
    # ==================================================

    knowledge_result = recommend_knowledge(

        message=customer_message,

        conversation_history=dialogue_history,

        number_of_recommendations=3,
    )


    customer_analysis[
        "knowledge_recommendations"
    ] = knowledge_result[
        "recommendations"
    ]

    customer_analysis[
        "knowledge_message"
    ] = knowledge_result[
        "message"
    ]


    # ==================================================
    # TASK 6 - ESCALATION RISK MONITOR
    # ==================================================

    escalation_result = calculate_escalation_risk(

        message=customer_message,

        frustration_level=customer_analysis[
            "frustration_level"
        ],

        sentiment=customer_analysis[
            "sentiment"
        ],

        conversation_history=dialogue_history
    )


    customer_analysis[
        "escalation_risk"
    ] = escalation_result[
        "risk_level"
    ]

    customer_analysis[
        "escalation_risk_score"
    ] = escalation_result[
        "risk_score"
    ]

    customer_analysis[
        "escalation_risk_threshold"
    ] = escalation_result[
        "risk_threshold"
    ]

    customer_analysis[
        "escalation_reasons"
    ] = escalation_result[
        "reasons"
    ]

    customer_analysis[
        "escalation_recommended_action"
    ] = escalation_result[
        "recommended_action"
    ]

    customer_analysis[
        "escalation_alert"
    ] = escalation_result[
        "alert"
    ]


    # --------------------------------------------------
    # Persist customer message
    # --------------------------------------------------

    customer_msg_row = Message(

        conversation_id=conversation_row.conversation_id,

        sender_type="Customer",

        message_text=customer_message,

        timestamp=datetime.utcnow(),

        message_type="Text"
    )

    db.add(customer_msg_row)


    # --------------------------------------------------
    # Persist updated state
    # --------------------------------------------------

    system_state_row = Message(

        conversation_id=conversation_row.conversation_id,

        sender_type="AI",

        message_text=json.dumps({

            "persona": persona,

            "scenario": scenario_key,

            "state": updated_state

        }),

        timestamp=datetime.utcnow(),

        message_type="System"
    )

    db.add(system_state_row)


    # --------------------------------------------------
    # Synchronize Conversation record
    # --------------------------------------------------

    conversation_row.intent = customer_analysis[
        "intent"
    ]

    conversation_row.sentiment = customer_analysis[
        "sentiment"
    ]

    conversation_row.escalation_risk = customer_analysis[
        "escalation_risk"
    ]


    # --------------------------------------------------
    # Update resolution / escalation status
    # --------------------------------------------------

    if is_res:

        session_row.status = "Completed"

        session_row.end_time = datetime.utcnow()

        conversation_row.resolution_status = "Resolved"


    elif is_esc:

        session_row.status = "Completed"

        session_row.end_time = datetime.utcnow()

        conversation_row.escalation_risk = "High"


    # --------------------------------------------------
    # Calculate customer turn count
    # --------------------------------------------------

    customer_turns = (

        sum(

            1

            for message in dialogue_history

            if message["sender_type"]
            == "Customer"

        )

        + 1
    )


    db.commit()


    # --------------------------------------------------
    # Return Task 4 + Task 5 + Task 6 results
    # --------------------------------------------------

    return {

        "session_id": session_row.session_id,

        "customer_message": customer_message,

        "analysis": customer_analysis,

        "state": updated_state,

        "turn": customer_turns,

        "is_resolved": is_res,

        "is_escalated": is_esc
    }


# --------------------------------------------------
# Endpoint 3: History
# --------------------------------------------------

@router.get("/{session_id}/history")
def get_simulator_history(

    session_id: int,

    db: DBSession = Depends(get_db)

):

    # --------------------------------------------------
    # Lookup Session
    # --------------------------------------------------

    session_row = (

        db.query(Session)

        .filter(
            Session.session_id
            == session_id
        )

        .first()
    )


    if not session_row:

        raise HTTPException(

            status_code=404,

            detail="Simulator session not found"
        )


    # --------------------------------------------------
    # Lookup Conversation
    # --------------------------------------------------

    conversation_row = (

        db.query(Conversation)

        .filter(
            Conversation.session_id
            == session_id
        )

        .first()
    )


    if not conversation_row:

        return {

            "session_id": session_id,

            "status": session_row.status,

            "messages": []
        }


    # --------------------------------------------------
    # Retrieve dialogue messages
    # --------------------------------------------------

    messages = (

        db.query(Message)

        .filter(

            Message.conversation_id
            == conversation_row.conversation_id,

            Message.message_type
            != "System"

        )

        .order_by(
            Message.message_id.asc()
        )

        .all()
    )


    return {

        "session_id": session_id,

        "status": session_row.status,

        "messages": [

            {

                "message_id": message.message_id,

                "sender_type": message.sender_type,

                "message_text": message.message_text,

                "message_type": message.message_type,

                "timestamp": message.timestamp

            }

            for message in messages
        ]
    }

