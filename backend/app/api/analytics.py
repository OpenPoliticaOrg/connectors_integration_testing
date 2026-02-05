"""
Analytics API endpoints.
Based on product analysis section 12.
"""
from fastapi import APIRouter, Depends, Query
from typing import Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session


router = APIRouter(prefix="/analytics", tags=["analytics"])


def get_db():
    """Database dependency."""
    from app.core.database import get_db as _get_db
    return _get_db()


@router.get("/team/{workspace_id}")
async def get_team_analytics(
    workspace_id: str,
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get team-level analytics.
    Based on product analysis section 12.
    """
    from app.services.analytics import AnalyticsEngine
    
    engine = AnalyticsEngine(db)
    analytics = engine.compute_team_analytics(
        workspace_id, start_date, end_date
    )
    
    return engine.to_dict(analytics)


@router.get("/user/{user_id}")
async def get_user_analytics(
    user_id: str,
    workspace_id: str,
    start_date: datetime = Query(...),
    end_date: datetime = Query(...),
    db: Session = Depends(get_db)
):
    """
    Get user-level private analytics.
    Based on product analysis section 12.
    """
    from app.services.analytics import AnalyticsEngine
    
    engine = AnalyticsEngine(db)
    analytics = engine.compute_user_analytics(
        user_id, workspace_id, start_date, end_date
    )
    
    return {
        "user_id": analytics.user_id,
        "response_latency_avg": analytics.response_latency_avg,
        "issues_unblocked": analytics.issues_unblocked,
        "context_contributions": analytics.context_contributions,
    }


@router.get("/gaps/{conversation_id}")
async def detect_gaps(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """
    Detect communication gaps in a conversation.
    Based on product analysis section 11.
    """
    from app.services.analytics import AnalyticsEngine
    
    engine = AnalyticsEngine(db)
    gaps = engine.detect_gaps(conversation_id)
    
    return {
        "conversation_id": conversation_id,
        "gaps": gaps,
        "count": len(gaps),
    }
