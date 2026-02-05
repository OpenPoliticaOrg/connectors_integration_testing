"""
Conversation Memory Service.
Based on product analysis section 8.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
import uuid


class ConversationMemoryService:
    """
    Manages conversation persistence and retrieval.
    Separates raw messages from extracted intelligence.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_or_create_conversation(
        self,
        workspace_id: str,
        slack_channel_id: str,
        thread_ts: Optional[str] = None,
        conversation_type: str = "channel_thread"
    ) -> Dict[str, Any]:
        """Get existing conversation or create new one."""
        from app.models.database import Conversation, ConversationType
        
        query = self.db.query(Conversation).filter(
            Conversation.workspace_id == workspace_id,
            Conversation.slack_channel_id == slack_channel_id,
        )
        
        if thread_ts:
            query = query.filter(Conversation.thread_ts == thread_ts)
        else:
            query = query.filter(Conversation.thread_ts.is_(None))
        
        conversation = query.first()
        
        if not conversation:
            conversation = Conversation(
                id=str(uuid.uuid4()),
                workspace_id=workspace_id,
                slack_channel_id=slack_channel_id,
                thread_ts=thread_ts,
                conversation_type=ConversationType(conversation_type),
                first_message_at=datetime.utcnow(),
                last_message_at=datetime.utcnow(),
                last_activity_at=datetime.utcnow(),
            )
            self.db.add(conversation)
            self.db.commit()
            self.db.refresh(conversation)
        
        return {
            "id": conversation.id,
            "workspace_id": conversation.workspace_id,
            "current_state": conversation.current_state.value if conversation.current_state else None,
            "created_at": conversation.created_at,
        }
    
    def update_conversation_state(
        self,
        conversation_id: str,
        new_state: str,
        summary: Optional[str] = None,
        extracted_facts: Optional[Dict] = None
    ) -> None:
        """Update conversation state and metadata."""
        from app.models.database import Conversation, ConversationState
        
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if conversation:
            conversation.current_state = ConversationState(new_state)
            conversation.last_activity_at = datetime.utcnow()
            
            if summary:
                conversation.summary = summary
            if extracted_facts:
                conversation.extracted_facts = extracted_facts
            
            self.db.commit()
    
    def add_message(
        self,
        conversation_id: str,
        slack_message_ts: str,
        content: str,
        timestamp: datetime,
        user_id: Optional[str] = None,
        intent: Optional[str] = None,
        topic: Optional[str] = None,
        needs_owner: Optional[bool] = None
    ) -> str:
        """Add a message to conversation."""
        from app.models.database import Message, Conversation, IntentType
        import uuid
        
        message = Message(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            slack_message_ts=slack_message_ts,
            content=content,
            timestamp=timestamp,
            user_id=user_id,
            needs_owner=needs_owner,
        )
        
        if intent:
            try:
                message.extracted_intent = IntentType(intent)
            except ValueError:
                pass
        
        message.extracted_topic = topic
        
        self.db.add(message)
        
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        if conversation:
            conversation.last_message_at = timestamp
            conversation.last_activity_at = datetime.utcnow()
        
        self.db.commit()
        return message.id
    
    def get_conversation_messages(
        self,
        conversation_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get messages for a conversation."""
        from app.models.database import Message
        
        messages = self.db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(Message.timestamp.desc()).offset(offset).limit(limit).all()
        
        return [
            {
                "id": m.id,
                "content": m.content,
                "timestamp": m.timestamp.isoformat(),
                "intent": m.extracted_intent.value if m.extracted_intent else None,
                "topic": m.extracted_topic,
            }
            for m in messages
        ]
    
    def record_state_transition(
        self,
        conversation_id: str,
        from_state: str,
        to_state: str,
        trigger: str,
        message_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> str:
        """Record a state transition."""
        from app.models.database import StateTransition
        import uuid
        
        transition = StateTransition(
            id=str(uuid.uuid4()),
            conversation_id=conversation_id,
            from_state=from_state,
            to_state=to_state,
            trigger=trigger,
            trigger_message_id=message_id,
            trans_metadata=metadata,
        )
        
        self.db.add(transition)
        self.db.commit()
        
        return transition.id
    
    def get_conversation_state_history(
        self,
        conversation_id: str
    ) -> List[Dict[str, Any]]:
        """Get state transition history for a conversation."""
        from app.models.database import StateTransition
        
        transitions = self.db.query(StateTransition).filter(
            StateTransition.conversation_id == conversation_id
        ).order_by(StateTransition.timestamp.asc()).all()
        
        return [
            {
                "from_state": t.from_state.value if t.from_state else None,
                "to_state": t.to_state.value,
                "trigger": t.trigger,
                "timestamp": t.timestamp.isoformat(),
            }
            for t in transitions
        ]
    
    def get_active_conversations(
        self,
        workspace_id: str,
        states: Optional[List[str]] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get active conversations, optionally filtered by state."""
        from app.models.database import Conversation, ConversationState
        
        query = self.db.query(Conversation).filter(
            Conversation.workspace_id == workspace_id,
        )
        
        if states:
            state_enums = [ConversationState(s) for s in states]
            query = query.filter(Conversation.current_state.in_(state_enums))
        
        conversations = query.order_by(
            Conversation.last_activity_at.desc()
        ).limit(limit).all()
        
        return [
            {
                "id": c.id,
                "current_state": c.current_state.value if c.current_state else None,
                "last_activity_at": c.last_activity_at.isoformat(),
                "summary": c.summary,
            }
            for c in conversations
        ]
