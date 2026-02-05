"""
Coordination Agent.
Based on product analysis section 13.
"""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime
import json


@dataclass
class CoordinationDecision:
    """Decision from coordination agent."""
    action: str
    reason: str
    priority: str
    metadata: Dict[str, Any]


class CoordinationAgent:
    """
    Determines if intervention is needed.
    Rule-based decision making.
    Based on product analysis section 13.
    """
    
    THRESHOLDS = {
        "ownership_timeout_hours": 24,
        "clarification_max_loops": 3,
        "response_timeout_hours": 4,
        "resolution_stall_hours": 48,
    }
    
    def __init__(self):
        self.decision_history: List[CoordinationDecision] = []
    
    def evaluate(
        self,
        conversation_state: str,
        time_in_state: float,
        signal_intent: str,
        signal_needs_owner: bool,
        gap_severities: List[float],
        clarification_count: int,
        last_activity_at: datetime
    ) -> Optional[CoordinationDecision]:
        """
        Evaluate conversation and decide if intervention needed.
        Returns None if no action needed.
        """
        now = datetime.utcnow()
        hours_since_activity = (
            now - last_activity_at
        ).total_seconds() / 3600
        
        if conversation_state == "question_raised":
            if signal_needs_owner:
                if time_in_state > self.THRESHOLDS["ownership_timeout_hours"] * 3600:
                    return CoordinationDecision(
                        action="prompt_ownership",
                        reason=f"No owner assigned after {self.THRESHOLDS['ownership_timeout_hours']} hours",
                        priority="high",
                        metadata={"hours_elapsed": time_in_state / 3600},
                    )
        
        if conversation_state in ["question_raised", "clarifying"]:
            if clarification_count >= self.THRESHOLDS["clarification_max_loops"]:
                return CoordinationDecision(
                    action="suggest_context",
                    reason=f"{clarification_count} clarification loops detected",
                    priority="medium",
                    metadata={"clarification_count": clarification_count},
                )
        
        if signal_intent == "question":
            if hours_since_activity > self.THRESHOLDS["response_timeout_hours"]:
                return CoordinationDecision(
                    action="nudge_response",
                    reason=f"Unanswered question for {hours_since_activity:.1f} hours",
                    priority="medium",
                    metadata={"hours_since_activity": hours_since_activity},
                )
        
        if gap_severities:
            max_severity = max(gap_severities)
            if max_severity > 0.7:
                return CoordinationDecision(
                    action="flag_gap",
                    reason=f"High severity gap detected: {max_severity:.2f}",
                    priority="high",
                    metadata={"max_severity": max_severity},
                )
        
        return None
    
    def should_intervene(
        self,
        conversation_metrics: Dict[str, Any]
    ) -> bool:
        """Quick check if conversation needs attention."""
        time_in_state = conversation_metrics.get("time_in_state_seconds", 0)
        state = conversation_metrics.get("current_state", "idle")
        
        if state == "question_raised" and time_in_state > 86400:
            return True
        
        if state == "in_progress" and time_in_state > 172800:
            return True
        
        return False
