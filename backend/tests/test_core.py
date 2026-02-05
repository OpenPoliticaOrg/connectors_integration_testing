"""
Tests for the Coordination Intelligence Platform.
"""
import pytest
from datetime import datetime, timezone
import uuid
from app.core.state_machine import BehaviorStateMachine, ConversationState
from app.core.config import get_settings, is_sqlite
from app.models.database import (
    Conversation, Message, ConversationType, ConversationState as ModelConversationState,
    IntentType
)


class TestStateMachine:
    """Tests for the behavior state machine."""
    
    def test_initial_state(self):
        """Test that initial state is idle."""
        sm = BehaviorStateMachine()
        assert sm.current_state == ConversationState.IDLE
    
    def test_question_raised_transition(self):
        """Test transition to question_raised."""
        sm = BehaviorStateMachine()
        result = sm.transition_to(ConversationState.QUESTION_RAISED, "question_asked")
        
        assert result is not None
        assert result.from_state == ConversationState.IDLE
        assert result.to_state == ConversationState.QUESTION_RAISED
        assert sm.current_state == ConversationState.QUESTION_RAISED
    
    def test_full_resolution_flow(self):
        """Test full conversation resolution flow."""
        sm = BehaviorStateMachine()
        
        transitions = [
            (ConversationState.QUESTION_RAISED, "question_asked"),
            (ConversationState.OWNER_ASSIGNED, "owner_mentioned"),
            (ConversationState.IN_PROGRESS, "work_started"),
            (ConversationState.RESOLVED, "fix_complete"),
        ]
        
        for expected_state, trigger in transitions:
            result = sm.transition_to(expected_state, trigger)
            assert result is not None
            assert sm.current_state == expected_state
        
        assert len(sm.transitions) == 4
    
    def test_invalid_transition(self):
        """Test that invalid transitions are rejected."""
        sm = BehaviorStateMachine()
        
        # Can't go from idle directly to resolved
        result = sm.transition_to(ConversationState.RESOLVED, "invalid")
        assert result is None
        assert sm.current_state == ConversationState.IDLE
    
    def test_get_time_in_state(self):
        """Test time tracking in state."""
        sm = BehaviorStateMachine()
        sm.transition_to(ConversationState.QUESTION_RAISED, "question")
        
        time_in_state = sm.get_time_in_state()
        assert time_in_state >= 0


class TestConfiguration:
    """Tests for configuration management."""
    
    def test_get_settings(self):
        """Test that settings can be retrieved."""
        settings = get_settings()
        assert settings is not None
        assert settings.app_name == "Coordination Intelligence Platform"
    
    def test_is_sqlite(self):
        """Test database type detection."""
        settings = get_settings()
        if "sqlite" in settings.database_url.lower():
            assert is_sqlite() is True
        else:
            assert is_sqlite() is False


class TestModels:
    """Tests for database models."""
    
    def test_conversation_state_enum(self):
        """Test conversation state enum values."""
        assert ConversationState.IDLE.value == "idle"
        assert ConversationState.QUESTION_RAISED.value == "question_raised"
        assert ConversationState.RESOLVED.value == "resolved"
    
    def test_intent_type_enum(self):
        """Test intent type enum values."""
        assert IntentType.QUESTION.value == "question"
        assert IntentType.BUG_REPORT.value == "bug_report"
        assert IntentType.RESOLUTION.value == "resolution"


class TestEventIngestion:
    """Tests for event ingestion."""
    
    def test_slack_event_creation(self):
        """Test creating a Slack event."""
        from app.services.event_ingestion import SlackEvent
        
        event = SlackEvent(
            type="message",
            channel="C123",
            user="U123",
            text="Hello world",
            thread_ts=None,
            message_ts="1234567890.123456",
            event_ts="1234567890.123456",
            raw_data={"type": "message"},
        )
        
        assert event.type == "message"
        assert event.channel == "C123"
        assert event.text == "Hello world"


class TestAgents:
    """Tests for agent components."""
    
    def test_coordination_agent_initialization(self):
        """Test that coordination agent can be initialized."""
        from app.agents.coordinator import CoordinationAgent
        
        agent = CoordinationAgent()
        assert agent is not None
        assert hasattr(agent, 'THRESHOLDS')
    
    def test_assistant_agent_initialization(self):
        """Test that assistant agent can be initialized."""
        from app.agents.assistant import AssistantAgent
        
        agent = AssistantAgent()
        assert agent is not None
    
    def test_understanding_agent_initialization(self):
        """Test that understanding agent can be initialized."""
        from app.agents.understanding import UnderstandingAgent
        
        agent = UnderstandingAgent()
        assert agent is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
