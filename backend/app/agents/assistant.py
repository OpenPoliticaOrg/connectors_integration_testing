"""
Assistant Agent - Query Interface.
Based on product analysis section 15.
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import datetime
import json


@dataclass
class AssistantResponse:
    """Response from assistant agent."""
    answer: str
    sources: List[str]
    confidence: float
    suggestions: List[str]
    streaming: bool = False


class AssistantAgent:
    """
    Answers user queries about coordination insights.
    Streams responses back to user.
    Based on product analysis section 15.
    """
    
    def __init__(self, llm: Any = None):
        self.llm = llm
        self.conversation_history: List[Dict[str, str]] = []
    
    async def query(
        self,
        user_query: str,
        workspace_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AssistantResponse:
        """
        Process a user query and return an explanation.
        """
        self.conversation_history.append({
            "role": "user",
            "content": user_query,
            "timestamp": datetime.utcnow().isoformat(),
        })
        
        if "why" in user_query.lower() and "unresolved" in user_query.lower():
            return self._explain_unresolved(workspace_id, context)
        
        if "summarize" in user_query.lower() or "what's happening" in user_query.lower():
            return self._summarize_status(workspace_id, context)
        
        if "block" in user_query.lower() or "blocking" in user_query.lower():
            return self._identify_blocks(workspace_id, context)
        
        return self._general_query(user_query, workspace_id, context)
    
    def _explain_unresolved(
        self,
        workspace_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AssistantResponse:
        """Explain why something is unresolved."""
        explanation = (
            "This conversation appears unresolved because:\n"
            "1. No owner was explicitly assigned\n"
            "2. The last message is a question that hasn't been answered\n"
            "3. Multiple clarification loops suggest missing context\n\n"
            "Recommended: Assign an owner or provide the missing context."
        )
        
        return AssistantResponse(
            answer=explanation,
            sources=["state_transitions", "message_history", "gap_detection"],
            confidence=0.85,
            suggestions=[
                "Assign an owner to this conversation",
                "Provide the missing context",
                "Mark as resolved if complete",
            ],
        )
    
    def _summarize_status(
        self,
        workspace_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AssistantResponse:
        """Summarize current status."""
        summary = (
            "**Team Status Overview**\n\n"
            "• Active conversations: [count]\n"
            "• Avg time to ownership: [time]\n"
            "• Avg time to resolution: [time]\n"
            "• Clarification loops this week: [count]\n\n"
            "Key insights:\n"
            "- [insight 1]\n"
            "- [insight 2]"
        )
        
        return AssistantResponse(
            answer=summary,
            sources=["team_metrics", "active_conversations"],
            confidence=0.9,
            suggestions=[
                "View detailed analytics",
                "Check ownership gaps",
                "See response times",
            ],
        )
    
    def _identify_blocks(
        self,
        workspace_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AssistantResponse:
        """Identify what is blocking progress."""
        blocks = (
            "**Blocking Issues**\n\n"
            "1. [Ownership Gap] - No owner assigned for 24+\n"
            "2. [Context Gap] - Similar questions repeated 3+\n"
            "3. [Response Gap] - Question unanswered for 8+\n\n"
            "Actions needed:\n"
            "- Assign owners to stalled conversations\n"
            "- Create documentation for repeated questions"
        )
        
        return AssistantResponse(
            answer=blocks,
            sources=["communication_gaps", "conversation_state"],
            confidence=0.8,
            suggestions=[
                "Assign owners to blocked items",
                "Review context gaps",
                "Check response times",
            ],
        )
    
    def _general_query(
        self,
        user_query: str,
        workspace_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AssistantResponse:
        """Handle general queries."""
        return AssistantResponse(
            answer=f"I can help with that. Let me analyze your coordination data for: {user_query}",
            sources=[],
            confidence=0.5,
            suggestions=[
                "Try asking about specific conversations",
                "Ask about team metrics",
                "Ask what is blocking progress",
            ],
        )
    
    async def stream_response(
        self,
        user_query: str,
        workspace_id: str,
        context: Optional[Dict[str, Any]] = None
    ) -> AssistantResponse:
        """Stream a response (placeholder for streaming implementation)."""
        response = await self.query(user_query, workspace_id, context)
        response.streaming = True
        return response
    
    def collect_feedback(
        self,
        query: str,
        response: str,
        rating: int,
        feedback_text: Optional[str] = None
    ) -> Dict[str, Any]:
        """Collect feedback on assistant response."""
        return {
            "query": query,
            "response": response,
            "rating": rating,
            "feedback_text": feedback_text,
            "timestamp": datetime.utcnow().isoformat(),
        }
