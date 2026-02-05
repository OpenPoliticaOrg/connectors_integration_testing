"""
Conversation state machine for behavior modeling.
Based on product analysis section 10.
"""
from enum import Enum
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import uuid


class ConversationState(Enum):
    IDLE = "idle"
    QUESTION_RAISED = "question_raised"
    CLARIFYING = "clarifying"
    OWNER_ASSIGNED = "owner_assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


@dataclass
class StateTransition:
    id: str
    from_state: ConversationState
    to_state: ConversationState
    trigger: str
    timestamp: datetime
    metadata: Dict = field(default_factory=dict)


class BehaviorStateMachine:
    """
    Deterministic state machine for conversation behavior tracking.
    Maps extracted intents to state transitions.
    """
    
    VALID_TRANSITIONS: Dict[ConversationState, List[ConversationState]] = {
        ConversationState.IDLE: [
            ConversationState.QUESTION_RAISED,
            ConversationState.CLARIFYING,
        ],
        ConversationState.QUESTION_RAISED: [
            ConversationState.CLARIFYING,
            ConversationState.OWNER_ASSIGNED,
            ConversationState.RESOLVED,
        ],
        ConversationState.CLARIFYING: [
            ConversationState.QUESTION_RAISED,
            ConversationState.OWNER_ASSIGNED,
            ConversationState.RESOLVED,
        ],
        ConversationState.OWNER_ASSIGNED: [
            ConversationState.IN_PROGRESS,
            ConversationState.CLARIFYING,
            ConversationState.RESOLVED,
        ],
        ConversationState.IN_PROGRESS: [
            ConversationState.RESOLVED,
            ConversationState.CLARIFYING,
        ],
        ConversationState.RESOLVED: [
            ConversationState.IDLE,
            ConversationState.QUESTION_RAISED,
        ],
    }
    
    def __init__(self):
        self.current_state = ConversationState.IDLE
        self.transitions: List[StateTransition] = []
        self.state_timestamps: Dict[ConversationState, datetime] = {}
    
    def can_transition(self, new_state: ConversationState) -> bool:
        """Check if transition to new_state is valid."""
        return new_state in self.VALID_TRANSITIONS.get(self.current_state, [])
    
    def transition_to(
        self,
        new_state: ConversationState,
        trigger: str,
        metadata: Optional[Dict] = None
    ) -> Optional[StateTransition]:
        """
        Transition to a new state if valid.
        Returns StateTransition if successful, None otherwise.
        """
        if not self.can_transition(new_state):
            return None
        
        transition = StateTransition(
            id=str(uuid.uuid4()),
            from_state=self.current_state,
            to_state=new_state,
            trigger=trigger,
            timestamp=datetime.utcnow(),
            metadata=metadata or {}
        )
        
        self.transitions.append(transition)
        self.current_state = new_state
        self.state_timestamps[new_state] = datetime.utcnow()
        
        return transition
    
    def get_time_in_state(self, state: Optional[ConversationState] = None) -> float:
        """Get time spent in current or specified state (in seconds)."""
        target_state = state or self.current_state
        entry_time = self.state_timestamps.get(target_state)
        
        if not entry_time:
            return 0.0
        
        return (datetime.utcnow() - entry_time).total_seconds()
    
    def get_state_history(self) -> List[Dict]:
        """Get readable state history."""
        return [
            {
                "from": t.from_state.value,
                "to": t.to_state.value,
                "trigger": t.trigger,
                "timestamp": t.timestamp.isoformat(),
            }
            for t in self.transitions
        ]
