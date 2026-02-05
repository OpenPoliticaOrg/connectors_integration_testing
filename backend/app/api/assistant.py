"""
Assistant API endpoints.
Based on product analysis section 15.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any, Optional
from pydantic import BaseModel


router = APIRouter(prefix="/assistant", tags=["assistant"])


class QueryRequest(BaseModel):
    """Assistant query request."""
    query: str
    workspace_id: str
    context: Optional[Dict[str, Any]] = None


class FeedbackRequest(BaseModel):
    """Feedback submission request."""
    query: str
    response: str
    rating: int
    feedback_text: Optional[str] = None


@router.post("/query")
async def query_assistant(
    request: QueryRequest,
    app: Any = None
):
    """
    Query the assistant for insights.
    Based on product analysis section 15.
    """
    if not app or not hasattr(app, 'assistant_agent'):
        raise HTTPException(status_code=503, detail="Assistant not available")
    
    response = await app.assistant_agent.query(
        user_query=request.query,
        workspace_id=request.workspace_id,
        context=request.context
    )
    
    return {
        "answer": response.answer,
        "sources": response.sources,
        "confidence": response.confidence,
        "suggestions": response.suggestions,
    }


@router.post("/feedback")
async def submit_feedback(
    request: FeedbackRequest,
    app: Any = None
):
    """Collect feedback on assistant response."""
    if not app:
        raise HTTPException(status_code=503, detail="Service not available")
    
    feedback = app.assistant_agent.collect_feedback(
        query=request.query,
        response=request.response,
        rating=request.rating,
        feedback_text=request.feedback_text
    )
    
    return {"status": "received", "feedback": feedback}
