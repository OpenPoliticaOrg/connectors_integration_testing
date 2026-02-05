"""
Database models for the Coordination Intelligence Platform.
Based on product analysis sections 8 and 16.
SQLAlchemy 2.0 compatible with SQLite/PostgreSQL support.
"""
from datetime import datetime
from typing import Optional, List
from enum import Enum
from sqlalchemy import (
    Column, String, Boolean, DateTime, ForeignKey, 
    Integer, Text, JSON, Float, Enum as SQLEnum,
    create_engine
)
from sqlalchemy.orm import (
    relationship, declarative_base, Session, sessionmaker
)


Base = declarative_base()


class ConversationType(str, Enum):
    DM = "dm"
    CHANNEL_THREAD = "channel_thread"
    ASSISTANT = "assistant"


class ConversationState(str, Enum):
    IDLE = "idle"
    QUESTION_RAISED = "question_raised"
    CLARIFYING = "clarifying"
    OWNER_ASSIGNED = "owner_assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class IntentType(str, Enum):
    QUESTION = "question"
    BUG_REPORT = "bug_report"
    UPDATE = "update"
    RESOLUTION = "resolution"


class GapType(str, Enum):
    OWNERSHIP = "ownership"
    CONTEXT = "context"
    RESPONSE = "response"
    RESOLUTION = "resolution"


class Workspace(Base):
    """Workspace that has connected Slack."""
    __tablename__ = "workspaces"
    
    id = Column(String(36), primary_key=True)
    slack_team_id = Column(String(36), unique=True, index=True)
    name = Column(String(255))
    encrypted_bot_token = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    conversations = relationship("Conversation", back_populates="workspace")


class User(Base):
    """User within a workspace."""
    __tablename__ = "users"
    
    id = Column(String(36), primary_key=True)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), index=True)
    slack_user_id = Column(String(36), index=True)
    display_name = Column(String(255))
    email = Column(String(255))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    messages = relationship("Message", back_populates="user")
    ownerships = relationship("Ownership", back_populates="owner")


class Conversation(Base):
    """
    Conversation entity - the core unit of coordination intelligence.
    Based on product analysis section 8.
    """
    __tablename__ = "conversations"
    
    id = Column(String(36), primary_key=True)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    
    slack_channel_id = Column(String(36), index=True)
    thread_ts = Column(String(36), index=True)
    parent_message_ts = Column(String(36), nullable=True)
    
    conversation_type = Column(SQLEnum(ConversationType), nullable=False)
    
    current_state = Column(SQLEnum(ConversationState), default=ConversationState.IDLE)
    
    summary = Column(Text, nullable=True)
    extracted_facts = Column(JSON, nullable=True)
    behavioral_signals = Column(JSON, nullable=True)
    
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    first_message_at = Column(DateTime, index=True)
    last_message_at = Column(DateTime)
    last_activity_at = Column(DateTime, index=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    workspace = relationship("Workspace", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", order_by="Message.timestamp")
    state_transitions = relationship("StateTransition", back_populates="conversation")
    gaps = relationship("CommunicationGap", back_populates="conversation")
    metrics = relationship("ConversationMetric", back_populates="conversation")


class Message(Base):
    """Individual message within a conversation."""
    __tablename__ = "messages"
    
    id = Column(String(36), primary_key=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    
    slack_message_ts = Column(String(36), unique=True, index=True)
    slack_thread_ts = Column(String(36), index=True)
    
    content = Column(Text)
    content_embedding = Column(JSON, nullable=True)
    
    extracted_intent = Column(SQLEnum(IntentType), nullable=True)
    extracted_topic = Column(String(100), nullable=True)
    needs_owner = Column(Boolean, nullable=True)
    
    timestamp = Column(DateTime, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="messages")
    user = relationship("User", back_populates="messages")


class StateTransition(Base):
    """Record of state transitions in a conversation."""
    __tablename__ = "state_transitions"
    
    id = Column(String(36), primary_key=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    
    from_state = Column(SQLEnum(ConversationState))
    to_state = Column(SQLEnum(ConversationState), nullable=False)
    
    trigger = Column(String(255))
    trigger_message_id = Column(String(36), nullable=True)
    transition_metadata = Column(JSON, nullable=True)
    
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="state_transitions")


class Ownership(Base):
    """Record of ownership assignments."""
    __tablename__ = "ownerships"
    
    id = Column(String(36), primary_key=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    owner_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    
    assigned_at = Column(DateTime, default=datetime.utcnow)
    released_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    conversation = relationship("Conversation")
    owner = relationship("User", back_populates="ownerships")


class CommunicationGap(Base):
    """
    Detected communication gaps.
    Based on product analysis section 11.
    """
    __tablename__ = "communication_gaps"
    
    id = Column(String(36), primary_key=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    
    gap_type = Column(SQLEnum(GapType), nullable=False)
    
    detected_at = Column(DateTime, default=datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)
    is_resolved = Column(Boolean, default=False)
    
    severity = Column(Float, default=0.5)
    description = Column(Text)
    evidence = Column(JSON, nullable=True)
    
    conversation = relationship("Conversation", back_populates="gaps")


class ConversationMetric(Base):
    """Computed metrics for a conversation."""
    __tablename__ = "conversation_metrics"
    
    id = Column(String(36), primary_key=True)
    conversation_id = Column(String(36), ForeignKey("conversations.id"), nullable=False)
    
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Float)
    computed_at = Column(DateTime, default=datetime.utcnow)
    
    conversation = relationship("Conversation", back_populates="metrics")


class TeamMetric(Base):
    """Aggregated team-level metrics."""
    __tablename__ = "team_metrics"
    
    id = Column(String(36), primary_key=True)
    workspace_id = Column(String(36), ForeignKey("workspaces.id"), nullable=False)
    
    period_start = Column(DateTime, index=True)
    period_end = Column(DateTime)
    
    avg_time_to_clarity = Column(Float, nullable=True)
    avg_time_to_ownership = Column(Float, nullable=True)
    avg_time_to_resolution = Column(Float, nullable=True)
    clarification_loops = Column(Integer, default=0)
    drop_off_rate = Column(Float, default=0.0)
    
    total_conversations = Column(Integer, default=0)
    resolved_conversations = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow)


class AssistantFeedback(Base):
    """Feedback on assistant responses."""
    __tablename__ = "assistant_feedback"
    
    id = Column(String(36), primary_key=True)
    conversation_id = Column(String(36), nullable=True)
    
    query = Column(Text)
    response = Column(Text)
    rating = Column(Integer)
    feedback_text = Column(Text, nullable=True)
    
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


def create_engine_func(database_url: str):
    """Create database engine from URL."""
    return create_engine(database_url)


def init_db(engine):
    """Initialize database tables."""
    Base.metadata.create_all(bind=engine)
