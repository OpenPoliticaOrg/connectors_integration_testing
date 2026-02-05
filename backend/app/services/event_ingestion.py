"""
Event Ingestion Pipeline.
Based on product analysis section 7.
"""
from datetime import datetime
from typing import Dict, Any, Optional, Callable
from dataclasses import dataclass
import asyncio
import hashlib
import hmac
import time
import json


@dataclass
class SlackEvent:
    """Validated Slack event."""
    type: str
    channel: str
    user: Optional[str]
    text: str
    thread_ts: Optional[str]
    message_ts: str
    event_ts: str
    raw_data: Dict[str, Any]


class EventIngestionService:
    """
    Receives and processes Slack events.
    Must ACK within 3 seconds. No AI here.
    """
    
    def __init__(
        self,
        signing_secret: str,
        on_event_callback: Optional[Callable[[SlackEvent], None]] = None
    ):
        self.signing_secret = signing_secret.encode()
        self.on_event = on_event_callback
        self._event_queue: asyncio.Queue = asyncio.Queue()
        self._running = False
    
    async def verify_signature(
        self,
        timestamp: str,
        signature: str,
        body: bytes
    ) -> bool:
        """Verify Slack request signature."""
        if abs(time.time() - int(timestamp)) > 60 * 5:
            return False
        
        sig_basestring = f"v0:{timestamp}".encode() + body
        my_signature = (
            "v0=" +
            hmac.new(
                self.signing_secret,
                sig_basestring,
                hashlib.sha256
            ).hexdigest()
        )
        
        return hmac.compare_digest(my_signature, signature)
    
    async def handle_slack_event(
        self,
        event_data: Dict[str, Any],
        timestamp: str,
        signature: str,
        body: bytes
    ) -> Dict[str, Any]:
        """
        Main entry point for Slack events.
        Returns ACK immediately.
        """
        is_valid = await self.verify_signature(timestamp, signature, body)
        if not is_valid:
            raise ValueError("Invalid Slack signature")
        
        event_type = event_data.get("type")
        
        if event_type == "url_verification":
            return {"challenge": event_data.get("challenge")}
        
        if event_type == "event_callback":
            await self._process_event_callback(event_data.get("event", {}))
        
        return {"ok": True}
    
    async def _process_event_callback(self, event: Dict[str, Any]) -> None:
        """Parse and queue event for async processing."""
        validated_event = self._parse_event(event)
        
        if validated_event:
            await self._event_queue.put(validated_event)
            
            if self.on_event:
                self.on_event(validated_event)
    
    def _parse_event(self, event: Dict[str, Any]) -> Optional[SlackEvent]:
        """Parse raw event into structured SlackEvent."""
        event_type = event.get("type")
        
        if event_type not in ["message", "app_mention"]:
            return None
        
        channel = event.get("channel") or ""
        message_ts = event.get("ts") or ""
        event_ts = event.get("event_ts") or message_ts
        
        return SlackEvent(
            type=event_type,
            channel=channel,
            user=event.get("user"),
            text=event.get("text", ""),
            thread_ts=event.get("thread_ts"),
            message_ts=message_ts,
            event_ts=event_ts,
            raw_data=event,
        )
    
    async def start_processing(self) -> None:
        """Start consuming events from queue."""
        self._running = True
        while self._running:
            try:
                event = await self._event_queue.get()
                await self._process_queued_event(event)
            except Exception as e:
                print(f"Error processing event: {e}")
    
    async def _process_queued_event(self, event: SlackEvent) -> None:
        """Process a single queued event. Override in subclass."""
        pass
    
    async def stop_processing(self) -> None:
        """Stop consuming events."""
        self._running = False
