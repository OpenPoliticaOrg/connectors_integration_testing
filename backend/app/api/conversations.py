"""
Conversation API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from datetime import datetime
from sqlalchemy.orm import Session


router = APIRouter(prefix="/conversations", tags=["conversations"])


def get_db():
    """Database dependency."""
    from app.core.database import get_db as _get_db
    return _get_db()


@router.get("/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Get conversation details."""
    from app.models.database import Conversation
    
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id
    ).first()
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "id": conversation.id,
        "current_state": conversation.current_state.value if conversation.current_state else None,
        "summary": conversation.summary,
        "created_at": conversation.created_at.isoformat(),
        "last_activity_at": conversation.last_activity_at.isoformat(),
    }


@router.get("/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get messages in a conversation."""
    from app.services.conversation_memory import ConversationMemoryService
    
    service = ConversationMemoryService(db)
    messages = service.get_conversation_messages(
        conversation_id, limit, offset
    )
    
    return {"messages": messages}


@router.get("/{conversation_id}/history")
async def get_conversation_state_history(
    conversation_id: str,
    db: Session = Depends(get_db)
):
    """Get state transition history."""
    from app.services.conversation_memory import ConversationMemoryService
    
    service = ConversationMemoryService(db)
    history = service.get_conversation_state_history(conversation_id)
    
    return {"history": history}


@router.get("/workspace/{workspace_id}/active")
async def get_active_conversations(
    workspace_id: str,
    states: Optional[List[str]] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get active conversations for a workspace."""
    from app.services.conversation_memory import ConversationMemoryService
    
    service = ConversationMemoryService(db)
    conversations = service.get_active_conversations(
        workspace_id, states, limit
    )
    
    return {"conversations": conversations}
