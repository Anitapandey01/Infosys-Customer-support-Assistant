# Task 5 — Knowledge Recommendation Agent

## Implemented flow

Customer Simulator -> customer message -> Task 4 analysis -> Task 5 knowledge retrieval -> next support response.

The Task 5 agent reuses the existing SentenceTransformer embedding model and persistent ChromaDB collection. It does not create a second vector store.

## API

`POST /knowledge/recommend`

Request:
```json
{
  "message": "My package is late and tracking has not updated.",
  "conversation_history": [],
  "number_of_recommendations": 3
}
```

Response contains a ranked `recommendations` array with document name, type, version, page, chunk ID, relevance distance/score, content and reference metadata.

## Simulator integration

Both `POST /simulator/start` and `POST /simulator/message` now attach:

- `knowledge_recommendations`
- `knowledge_message`

inside the returned `analysis` object.

## Evaluation scenarios

`tests/test_knowledge_recommendation.py` contains 12 support scenarios covering payment failure, refund, account/login, cancellation, delivery, replacement, subscription, duplicate charge, refund policy, shipping policy, return policy and FAQ/account information.

## Validation commands

From `backend`:

```cmd
python -m py_compile app\services\knowledge_recommendation_service.py app\api\knowledge.py app\api\simulator.py app\main.py
python -m pytest tests\test_knowledge_recommendation.py -v
```

Then start the backend and manually verify:

```cmd
python -m uvicorn app.main:app --reload
```

Open `/docs` and test `POST /knowledge/recommend`.

For the full Task 5 demonstration, start a simulator session and confirm that each customer turn returns `analysis.knowledge_recommendations`.
