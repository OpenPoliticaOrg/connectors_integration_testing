"""
Analytics Engine.
Based on product analysis section 12.
"""
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_


@dataclass
class TeamAnalytics:
    """Aggregated team-level analytics."""
    workspace_id: str
    period_start: datetime
    period_end: datetime
    
    avg_time_to_clarity: Optional[float]
    avg_time_to_ownership: Optional[float]
    avg_time_to_resolution: Optional[float]
    clarification_loops: int
    drop_off_rate: float
    
    total_conversations: int
    resolved_conversations: int
    
    ownership_gaps: int
    context_gaps: int
    response_gaps: int
    resolution_gaps: int


@dataclass
class UserAnalytics:
    """User-level private analytics."""
    user_id: str
    response_latency_avg: Optional[float]
    issues_unblocked: int
    context_contributions: int


class AnalyticsEngine:
    """
    Computes metrics from behavioral data.
    Based on product analysis section 12.
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def compute_team_analytics(
        self,
        workspace_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> TeamAnalytics:
        """Compute team-level analytics for a time period."""
        from app.models.database import (
            Conversation, StateTransition, CommunicationGap,
            ConversationState, ConversationType
        )
        
        conversations = self.db.query(Conversation).filter(
            Conversation.workspace_id == workspace_id,
            Conversation.created_at >= start_date,
            Conversation.created_at <= end_date,
        ).all()
        
        total = len(conversations)
        resolved = len([c for c in conversations 
                       if c.current_state == ConversationState.RESOLVED])
        
        time_to_clarity = []
        time_to_ownership = []
        time_to_resolution = []
        clarification_loops = 0
        
        for conv in conversations:
            transitions = self.db.query(StateTransition).filter(
                StateTransition.conversation_id == conv.id
            ).order_by(StateTransition.timestamp).all()
            
            clarify_count = sum(
                1 for t in transitions 
                if t.to_state == ConversationState.CLARIFYING
            )
            clarification_loops += clarify_count
            
            if transitions:
                first_ts = transitions[0].timestamp
                last_ts = transitions[-1].timestamp
                
                clarity_transitions = [
                    t for t in transitions
                    if t.to_state in [ConversationState.QUESTION_RAISED]
                ]
                if clarity_transitions:
                    time_to_clarity.append(
                        (clarity_transitions[0].timestamp - first_ts).total_seconds()
                    )
                
                ownership_transitions = [
                    t for t in transitions
                    if t.to_state == ConversationState.OWNER_ASSIGNED
                ]
                if ownership_transitions:
                    time_to_ownership.append(
                        (ownership_transitions[0].timestamp - first_ts).total_seconds()
                    )
                
                if conv.current_state == ConversationState.RESOLVED:
                    time_to_resolution.append(
                        (last_ts - first_ts).total_seconds()
                    )
        
        gaps = self.db.query(CommunicationGap).filter(
            CommunicationGap.conversation_id.in_([c.id for c in conversations]),
            CommunicationGap.detected_at >= start_date,
            CommunicationGap.detected_at <= end_date,
        ).all()
        
        ownership_gaps = len([g for g in gaps if g.gap_type.value == "ownership"])
        context_gaps = len([g for g in gaps if g.gap_type.value == "context"])
        response_gaps = len([g for g in gaps if g.gap_type.value == "response"])
        resolution_gaps = len([g for g in gaps if g.gap_type.value == "resolution"])
        
        return TeamAnalytics(
            workspace_id=workspace_id,
            period_start=start_date,
            period_end=end_date,
            avg_time_to_clarity=(
                sum(time_to_clarity) / len(time_to_clarity) 
                if time_to_clarity else None
            ),
            avg_time_to_ownership=(
                sum(time_to_ownership) / len(time_to_ownership) 
                if time_to_ownership else None
            ),
            avg_time_to_resolution=(
                sum(time_to_resolution) / len(time_to_resolution) 
                if time_to_resolution else None
            ),
            clarification_loops=clarification_loops,
            drop_off_rate=(
                (total - resolved) / total if total > 0 else 0.0
            ),
            total_conversations=total,
            resolved_conversations=resolved,
            ownership_gaps=ownership_gaps,
            context_gaps=context_gaps,
            response_gaps=response_gaps,
            resolution_gaps=resolution_gaps,
        )
    
    def compute_user_analytics(
        self,
        user_id: str,
        workspace_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> UserAnalytics:
        """Compute user-level private analytics."""
        from app.models.database import (
            Message, Ownership, Conversation
        )
        
        messages = self.db.query(Message).join(Conversation).filter(
            Message.user_id == user_id,
            Conversation.workspace_id == workspace_id,
            Message.timestamp >= start_date,
            Message.timestamp <= end_date,
        ).all()
        
        response_times = []
        for msg in messages:
            if msg.extracted_intent and "question" in msg.extracted_intent.value:
                pass
        
        active_ownerships = self.db.query(Ownership).filter(
            Ownership.owner_id == user_id,
            Ownership.is_active == True,
            Ownership.assigned_at >= start_date,
            Ownership.assigned_at <= end_date,
        ).count()
        
        return UserAnalytics(
            user_id=user_id,
            response_latency_avg=None,
            issues_unblocked=active_ownerships,
            context_contributions=len(messages),
        )
    
    def detect_gaps(
        self,
        conversation_id: str
    ) -> List[Dict[str, Any]]:
        """Detect communication gaps in a conversation."""
        from app.models.database import (
            Conversation, StateTransition, Message, CommunicationGap,
            ConversationState, GapType
        )
        import uuid
        
        conversation = self.db.query(Conversation).filter(
            Conversation.id == conversation_id
        ).first()
        
        if not conversation:
            return []
        
        gaps = []
        now = datetime.utcnow()
        
        transitions = self.db.query(StateTransition).filter(
            StateTransition.conversation_id == conversation_id
        ).order_by(StateTransition.timestamp).all()
        
        messages = self.db.query(Message).filter(
            Message.conversation_id == conversation_id
        ).order_by(Message.timestamp).all()
        
        if (
            conversation.current_state == ConversationState.QUESTION_RAISED
            and not any(t.to_state == ConversationState.OWNER_ASSIGNED 
                       for t in transitions)
        ):
            time_since_question = (
                now - transitions[-1].timestamp
            ).total_seconds() / 3600 if transitions else 0
            
            if time_since_question > 24:
                gaps.append({
                    "id": str(uuid.uuid4()),
                    "gap_type": GapType.OWNERSHIP,
                    "severity": min(1.0, time_since_question / 72),
                    "description": "No owner assigned within 24+ hours",
                    "detected_at": now,
                })
        
        similar_questions = 0
        for i, msg1 in enumerate(messages[:10]):
            if msg1.extracted_intent and "question" in msg1.extracted_intent.value:
                for msg2 in messages[i+1:]:
                    if msg2.extracted_intent and "question" in msg2.extracted_intent.value:
                        if msg1.content[:100] == msg2.content[:100]:
                            similar_questions += 1
        
        if similar_questions >= 2:
            gaps.append({
                "id": str(uuid.uuid4()),
                "gap_type": GapType.CONTEXT,
                "severity": 0.6,
                "description": f"Similar questions asked {similar_questions + 1} times",
                "detected_at": now,
            })
        
        if gaps:
            for gap_data in gaps:
                gap = CommunicationGap(
                    id=gap_data["id"],
                    conversation_id=conversation_id,
                    gap_type=gap_data["gap_type"],
                    detected_at=gap_data["detected_at"],
                    severity=gap_data["severity"],
                    description=gap_data["description"],
                )
                self.db.add(gap)
            
            self.db.commit()
        
        return gaps
    
    def to_dict(self, analytics: TeamAnalytics) -> Dict[str, Any]:
        """Convert analytics to dictionary."""
        return {
            "workspace_id": analytics.workspace_id,
            "period_start": analytics.period_start.isoformat(),
            "period_end": analytics.period_end.isoformat(),
            "metrics": {
                "avg_time_to_clarity_hours": (
                    analytics.avg_time_to_clarity / 3600 
                    if analytics.avg_time_to_clarity else None
                ),
                "avg_time_to_ownership_hours": (
                    analytics.avg_time_to_ownership / 3600 
                    if analytics.avg_time_to_ownership else None
                ),
                "avg_time_to_resolution_hours": (
                    analytics.avg_time_to_resolution / 3600 
                    if analytics.avg_time_to_resolution else None
                ),
                "clarification_loops": analytics.clarification_loops,
                "drop_off_rate": analytics.drop_off_rate,
            },
            "totals": {
                "conversations": analytics.total_conversations,
                "resolved": analytics.resolved_conversations,
            },
            "gaps": {
                "ownership": analytics.ownership_gaps,
                "context": analytics.context_gaps,
                "response": analytics.response_gaps,
                "resolution": analytics.resolution_gaps,
            },
        }
