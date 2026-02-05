"""
Pytest configuration for the Coordination Intelligence Platform.
"""
import pytest
import sys
import os

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture(scope="session")
def app():
    """Create application for testing."""
    from app.main import app
    return app


@pytest.fixture(scope="session")
def client(app):
    """Create test client."""
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture
def db_session():
    """Create database session for testing."""
    from app.core.config import get_settings
    from app.models.database import Base, create_engine_func
    from sqlalchemy.orm import Session
    
    settings = get_settings()
    engine = create_engine_func(settings.database_url)
    
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    session = Session(engine)
    
    yield session
    
    # Cleanup
    session.rollback()
    session.close()
