"""
Understanding Agent using DSPy.
Based on product analysis section 9.
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
import dspy
import logging

logger = logging.getLogger(__name__)


class IntentType(str, Enum):
    QUESTION = "question"
    BUG_REPORT = "bug_report"
    UPDATE = "update"
    RESOLUTION = "resolution"


@dataclass
class BehavioralSignal:
    """Structured output from understanding layer."""
    intent: IntentType
    topic: str
    needs_owner: bool
    uncertainty: float
    confidence: float
    entities: List[str]
    implied_action: Optional[str]


class AnalyzeMessage(dspy.Signature):
    """Analyze a Slack message and extract behavioral signals.
    
    Extract the intent, topic, entities, and ownership needs from a message.
    Consider the conversation context if provided.
    """
    message: str = dspy.InputField(desc="The message to analyze")
    context: str = dspy.InputField(desc="Recent conversation context (if any)", default="")
    intent: str = dspy.OutputField(desc="One of: question, bug_report, update, resolution")
    confidence: float = dspy.OutputField(desc="Confidence score between 0.0 and 1.0")
    topic: str = dspy.OutputField(desc="One word topic: auth, infra, payments, api, ui, unknown")
    entities: List[str] = dspy.OutputField(desc="List of named entities (users, IDs, PRs, etc)")
    needs_owner: bool = dspy.OutputField(desc="True if this message requires an owner")
    implied_action: str = dspy.OutputField(desc="Suggested action: assign_owner, acknowledge, investigate, resolve")


class UnderstandingAgent:
    """
    Converts human language into structured behavioral signals.
    Uses DSPy for declarative reasoning.
    Based on product analysis section 9.
    """
    
    def __init__(self, lm: Optional[dspy.LM] = None):
        self.lm = lm or dspy.LM("openai/gpt-4o-mini")
        dspy.settings.configure(lm=self.lm)
        self.analyzer = dspy.Predict(AnalyzeMessage)
        logger.info("UnderstandingAgent initialized with LM: %s", self.lm.model)
    
    def analyze_message(
        self,
        message: str,
        conversation_history: Optional[List[str]] = None
    ) -> BehavioralSignal:
        """
        Main entry point for message analysis.
        Returns structured behavioral signal.
        """
        context = ""
        if conversation_history:
            context = "Recent messages:\n" + "\n".join(
                f"- {m[:200]}" for m in conversation_history[-5:]
            )
        
        try:
            result = self.analyzer(message=message, context=context)
            
            confidence = self._parse_float(result.confidence, default=0.5)
            confidence = max(0.0, min(1.0, confidence))
            
            entities = self._parse_list(result.entities)
            needs_owner = self._parse_bool(result.needs_owner)
            
            signal = BehavioralSignal(
                intent=self._parse_intent(result.intent),
                topic=result.topic.lower().strip() if result.topic else "unknown",
                needs_owner=needs_owner,
                uncertainty=1.0 - confidence,
                confidence=confidence,
                entities=entities,
                implied_action=result.implied_action if result.implied_action else None,
            )
            
            logger.debug("Analyzed message: intent=%s, topic=%s, confidence=%.2f",
                        signal.intent.value, signal.topic, signal.confidence)
            
            return signal
            
        except Exception as e:
            logger.error("Failed to analyze message: %s", str(e), exc_info=True)
            return BehavioralSignal(
                intent=IntentType.UPDATE,
                topic="unknown",
                needs_owner=False,
                uncertainty=1.0,
                confidence=0.5,
                entities=[],
                implied_action=None,
            )
    
    def _parse_float(self, value: Any, default: float = 0.5) -> float:
        """Safely parse a float value."""
        if value is None:
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            logger.warning("Failed to parse float: %s, using default %s", value, default)
            return default
    
    def _parse_bool(self, value: Any) -> bool:
        """Safely parse a boolean value."""
        if value is None:
            return False
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.lower() in ('true', '1', 'yes', 'y')
        return bool(value)
    
    def _parse_list(self, value: Any) -> List[str]:
        """Safely parse a list value."""
        if value is None:
            return []
        if isinstance(value, list):
            return [str(item) for item in value if item]
        if isinstance(value, str):
            import json
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item) for item in parsed if item]
            except json.JSONDecodeError:
                return [value] if value.strip() else []
        return []
    
    def _parse_intent(self, intent_str: str) -> IntentType:
        """Parse intent string to enum."""
        intent_lower = intent_str.lower().strip()
        
        if "question" in intent_lower:
            return IntentType.QUESTION
        elif "bug" in intent_lower or "issue" in intent_lower:
            return IntentType.BUG_REPORT
        elif "fix" in intent_lower or "resolve" in intent_lower or "done" in intent_lower:
            return IntentType.RESOLUTION
        else:
            return IntentType.UPDATE
    
    def batch_analyze(
        self,
        messages: List[Dict[str, Any]]
    ) -> List[BehavioralSignal]:
        """Analyze multiple messages.
        
        Args:
            messages: List of dicts with keys:
                - content (str): The message content
                - history (Optional[List[str]]): Previous messages for context
        """
        results = []
        for msg in messages:
            history = msg.get("history")
            if history is not None and not isinstance(history, list):
                logger.warning("Invalid history type for message, expected list got %s", type(history))
                history = None
            results.append(
                self.analyze_message(
                    msg["content"],
                    history
                )
            )
        return results
