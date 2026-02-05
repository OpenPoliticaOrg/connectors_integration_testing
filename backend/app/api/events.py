"""
Event API endpoints.
Based on product analysis section 7.
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from typing import Dict, Any
import time


router = APIRouter(prefix="/events", tags=["events"])


@router.post("/slack")
async def slack_events(
    request: Request,
    body: bytes
):
    """
    Slack Events API endpoint.
    Must respond within 3 seconds.
    Based on product analysis section 7.
    """
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")
    
    app = request.state.app
    
    try:
        result = await app.ingestion_service.handle_slack_event(
            await request.json(),
            timestamp,
            signature,
            body
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/slack")
async def slack_url_verification(
    request: Request,
    challenge: str
):
    """Slack URL verification endpoint."""
    return {"challenge": challenge}
