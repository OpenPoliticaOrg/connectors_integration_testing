"""
MCP (Model Context Protocol) Clients.
Execution firewall for external calls.
Based on product analysis section 14.
"""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from datetime import datetime
import aiohttp
import json


@dataclass
class MCPResponse:
    """Response from MCP call."""
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    rate_limited: bool = False


class SlackMCPClient:
    """
    MCP client for Slack API calls.
    Agents NEVER call Slack directly.
    Based on product analysis section 14.
    """
    
    def __init__(self, bot_token: str):
        self.bot_token = bot_token
        self.base_url = "https://slack.com/api"
        self.headers = {
            "Authorization": f"Bearer {self.bot_token}",
            "Content-Type": "application/json",
        }
        self._rate_limit_remaining = 100
        self._rate_limit_reset = 0
    
    async def post_message(
        self,
        channel: str,
        text: str,
        thread_ts: Optional[str] = None,
        blocks: Optional[List[Dict]] = None
    ) -> MCPResponse:
        """Post a message to Slack."""
        payload = {
            "channel": channel,
            "text": text,
        }
        
        if thread_ts:
            payload["thread_ts"] = thread_ts
        
        if blocks:
            payload["blocks"] = blocks
        
        return await self._call_api("chat.postMessage", payload)
    
    async def update_message(
        self,
        channel: str,
        timestamp: str,
        text: str,
        blocks: Optional[List[Dict]] = None
    ) -> MCPResponse:
        """Update an existing message."""
        payload = {
            "channel": channel,
            "ts": timestamp,
            "text": text,
        }
        
        if blocks:
            payload["blocks"] = blocks
        
        return await self._call_api("chat.update", payload)
    
    async def getConversationInfo(
        self,
        channel: str
    ) -> MCPResponse:
        """Get information about a conversation."""
        return await self._call_api("conversations.info", {"channel": channel})
    
    async def listConversations(
        self,
        cursor: Optional[str] = None
    ) -> MCPResponse:
        """List conversations the bot is in."""
        payload: Dict[str, Any] = {}
        if cursor:
            payload["cursor"] = cursor
        
        return await self._call_api("conversations.list", payload)
    
    async def users_info(self, user: str) -> MCPResponse:
        """Get user information."""
        return await self._call_api("users.info", {"user": user})
    
    async def _call_api(
        self,
        method: str,
        payload: Dict[str, Any]
    ) -> MCPResponse:
        """Make API call to Slack."""
        url = f"{self.base_url}/{method}"
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    headers=self.headers,
                    json=payload
                ) as response:
                    data = await response.json()
                    
                    if not data.get("ok"):
                        return MCPResponse(
                            success=False,
                            error=data.get("error", "Unknown error")
                        )
                    
                    return MCPResponse(success=True, data=data)
                    
        except Exception as e:
            return MCPResponse(success=False, error=str(e))
    
    def _check_rate_limit(self, headers: Dict[str, str]) -> bool:
        """Check rate limit from response headers."""
        remaining = headers.get("x-ratelimit-remaining", "100")
        reset = headers.get("x-ratelimit-reset", "0")
        
        self._rate_limit_remaining = int(remaining)
        self._rate_limit_reset = int(reset)
        
        return self._rate_limit_remaining > 0


class InternalMCPClient:
    """
    MCP client for internal service calls.
    """
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
    
    async def get_analytics(
        self,
        workspace_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> MCPResponse:
        """Get analytics data."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/api/v1/analytics",
                    params={
                        "workspace_id": workspace_id,
                        "start": start_date.isoformat(),
                        "end": end_date.isoformat(),
                    }
                ) as response:
                    data = await response.json()
                    return MCPResponse(success=True, data=data)
        except Exception as e:
            return MCPResponse(success=False, error=str(e))
    
    async def get_conversation(
        self,
        conversation_id: str
    ) -> MCPResponse:
        """Get conversation data."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.base_url}/api/v1/conversations/{conversation_id}"
                ) as response:
                    data = await response.json()
                    return MCPResponse(success=True, data=data)
        except Exception as e:
            return MCPResponse(success=False, error=str(e))
