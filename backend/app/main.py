"""
Coordination Intelligence Platform - Main Application.
Based on product analysis sections 0-19.
"""
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import asyncio


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ApplicationState:
    """Application state holder."""
    def __init__(self):
        self.ingestion_service = None
        self.conversation_service = None
        self.analytics_engine = None
        self.understanding_agent = None
        self.coordination_agent = None
        self.assistant_agent = None
        self.slack_mcp = None


app_state = ApplicationState()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting Coordination Intelligence Platform...")
    
    from app.core.config import get_settings
    from app.services.event_ingestion import EventIngestionService
    from app.services.conversation_memory import ConversationMemoryService
    from app.services.analytics import AnalyticsEngine
    from app.agents.understanding import UnderstandingAgent
    from app.agents.coordinator import CoordinationAgent
    from app.agents.assistant import AssistantAgent
    from app.mcp.client import SlackMCPClient
    from app.core.database import init_db
    
    settings = get_settings()
    
    init_db()
    
    app_state.slack_mcp = SlackMCPClient(settings.slack_bot_token)
    app_state.conversation_service = ConversationMemoryService(None)
    app_state.analytics_engine = AnalyticsEngine(None)
    app_state.understanding_agent = UnderstandingAgent()
    app_state.coordination_agent = CoordinationAgent()
    app_state.assistant_agent = AssistantAgent()
    
    async def process_event(event):
        await handle_event(event)
    
    app_state.ingestion_service = EventIngestionService(
        signing_secret=settings.slack_signing_secret,
        on_event_callback=process_event
    )
    
    asyncio.create_task(app_state.ingestion_service.start_processing())
    
    logger.info("Application started successfully")
    
    yield
    
    await app_state.ingestion_service.stop_processing()
    logger.info("Application shutdown complete")


app = FastAPI(
    title="Coordination Intelligence Platform",
    description="Understanding how work flows through communication",
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.state.app = app_state


async def handle_event(event):
    """Process a Slack event."""
    try:
        from app.services.conversation_memory import ConversationMemoryService
        from app.agents.understanding import UnderstandingAgent
        from app.agents.coordinator import CoordinationAgent
        from app.core.state_machine import BehaviorStateMachine, ConversationState
        from datetime import datetime
        from app.core.database import SessionLocal
        from sqlalchemy.orm import Session
        
        db: Session = SessionLocal()
        
        try:
            conversation_service = ConversationMemoryService(db)
            understanding = UnderstandingAgent()
            coordinator = CoordinationAgent()
            
            conversation = conversation_service.get_or_create_conversation(
                workspace_id="workspace_id",
                slack_channel_id=event.channel,
                thread_ts=event.thread_ts,
            )
            
            signal = understanding.analyze_message(event.text)
            
            conversation_service.add_message(
                conversation_id=conversation["id"],
                slack_message_ts=event.message_ts,
                content=event.text,
                timestamp=datetime.fromisoformat(event.event_ts),
                intent=signal.intent.value,
                topic=signal.topic,
                needs_owner=signal.needs_owner,
            )
            
            state_machine = BehaviorStateMachine()
            state_str = conversation.get("current_state", "idle")
            if state_str:
                state_machine.current_state = ConversationState(state_str)
            
            trigger = f"message:{signal.intent.value}"
            
            new_state = determine_state_transition(
                state_machine, signal, trigger
            )
            
            if new_state:
                conversation_service.update_conversation_state(
                    conversation["id"],
                    new_state.value,
                )
                
                conversation_service.record_state_transition(
                    conversation["id"],
                    state_machine.current_state.value,
                    new_state.value,
                    trigger,
                )
            
            db.commit()
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error processing event: {e}")


def determine_state_transition(state_machine, signal, trigger):
    """Determine next state based on signal."""
    from app.core.state_machine import ConversationState
    
    intent = signal.intent.value if hasattr(signal.intent, 'value') else str(signal.intent)
    
    if intent == "question":
        if signal.needs_owner:
            return ConversationState.QUESTION_RAISED
        return ConversationState.CLARIFYING
    
    if intent == "resolution":
        return ConversationState.RESOLVED
    
    if intent == "bug_report":
        return ConversationState.IN_PROGRESS
    
    return ConversationState.IDLE


from app.api import events, conversations, analytics, assistant, oauth


# Mount all API routers with /api/v1 prefix
app.include_router(events.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
# OAuth router has /oauth prefix, so mount at /api/v1 to get /api/v1/oauth/...
app.include_router(oauth.router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "coordination-intelligence-platform",
        "version": "1.0.0",
    }


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Coordination Intelligence Platform",
        "docs": "/docs",
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    from app.core.config import get_settings
    
    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
    )
