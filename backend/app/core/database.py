"""
Database connection and session management.
Supports SQLite for development and PostgreSQL for production.
"""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import get_settings, is_sqlite


settings = get_settings()


if is_sqlite():
    engine = create_engine(
        settings.database_url,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    engine = create_engine(
        settings.database_url,
        pool_pre_ping=True,
        pool_recycle=3600,
    )


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


Base = declarative_base()


def get_db():
    """FastAPI dependency for database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables."""
    from app.models.database import (
        Workspace, User, Conversation, Message,
        StateTransition, Ownership, CommunicationGap,
        ConversationMetric, TeamMetric, AssistantFeedback
    )
    Base.metadata.create_all(bind=engine)


def get_engine():
    """Get the database engine."""
    return engine


def get_session():
    """Get a new database session."""
    return SessionLocal()
