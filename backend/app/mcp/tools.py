"""
MCP Tools Registry.
Whitelisted tools that agents can use.
Based on product analysis section 14.
"""
from typing import Dict, Any, Callable, Optional
from dataclasses import dataclass
from enum import Enum


class ToolCategory(str, Enum):
    SLACK = "slack"
    ANALYTICS = "analytics"
    CONVERSATION = "conversation"
    ASSISTANT = "assistant"


@dataclass
class MCPTool:
    """Definition of an available tool."""
    name: str
    category: ToolCategory
    description: str
    parameters: Dict[str, Any]
    handler: Callable
    rate_limit: int = 10


class MCPToolRegistry:
    """
    Registry of available MCP tools.
    Agents can only use tools from this registry.
    Based on product analysis section 14.
    """
    
    def __init__(self):
        self._tools: Dict[str, MCPTool] = {}
        self._category_tools: Dict[ToolCategory, Dict[str, MCPTool]] = {
            category: {} for category in ToolCategory
        }
    
    def register(self, tool: MCPTool) -> None:
        """Register a new tool."""
        self._tools[tool.name] = tool
        self._category_tools[tool.category][tool.name] = tool
    
    def get(self, name: str) -> Optional[MCPTool]:
        """Get a tool by name."""
        return self._tools.get(name)
    
    def list_by_category(self, category: ToolCategory) -> Dict[str, MCPTool]:
        """List all tools in a category."""
        return self._category_tools.get(category, {})
    
    def list_all(self) -> Dict[str, MCPTool]:
        """List all available tools."""
        return self._tools.copy()
    
    def check_availability(self, name: str) -> bool:
        """Check if a tool is available."""
        return name in self._tools


def create_slack_tools_registry(
    slack_client: Any
) -> MCPToolRegistry:
    """Create registry with Slack tools."""
    registry = MCPToolRegistry()
    
    async def post_message_tool(
        channel: str,
        text: str,
        thread_ts: Optional[str] = None
    ) -> Dict[str, Any]:
        """Post a message to a Slack channel."""
        result = await slack_client.post_message(
            channel=channel,
            text=text,
            thread_ts=thread_ts
        )
        return {
            "success": result.success,
            "message_ts": result.data.get("ts") if result.success else None,
            "error": result.error,
        }
    
    registry.register(MCPTool(
        name="slack.post_message",
        category=ToolCategory.SLACK,
        description="Post a message to a Slack channel or thread",
        parameters={
            "type": "object",
            "properties": {
                "channel": {"type": "string", "description": "Channel ID"},
                "text": {"type": "string", "description": "Message text"},
                "thread_ts": {"type": "string", "description": "Thread timestamp"},
            },
            "required": ["channel", "text"],
        },
        handler=post_message_tool,
        rate_limit=20,
    ))
    
    return registry


def create_analytics_tools_registry(
    analytics_engine: Any
) -> MCPToolRegistry:
    """Create registry with analytics tools."""
    registry = MCPToolRegistry()
    
    def get_team_analytics(
        workspace_id: str,
        start_date: str,
        end_date: str
    ) -> Dict[str, Any]:
        """Get team analytics for a time period."""
        from datetime import datetime
        
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        
        analytics = analytics_engine.compute_team_analytics(
            workspace_id, start, end
        )
        return analytics_engine.to_dict(analytics)
    
    registry.register(MCPTool(
        name="analytics.get_team",
        category=ToolCategory.ANALYTICS,
        description="Get team-level analytics",
        parameters={
            "type": "object",
            "properties": {
                "workspace_id": {"type": "string"},
                "start_date": {"type": "string", "description": "ISO format"},
                "end_date": {"type": "string", "description": "ISO format"},
            },
            "required": ["workspace_id", "start_date", "end_date"],
        },
        handler=get_team_analytics,
        rate_limit=5,
    ))
    
    return registry


def create_assistant_tools_registry(
    assistant_agent: Any
) -> MCPToolRegistry:
    """Create registry with assistant tools."""
    registry = MCPToolRegistry()
    
    async def query_assistant(
        query: str,
        workspace_id: str
    ) -> Dict[str, Any]:
        """Query the assistant for insights."""
        response = await assistant_agent.query(
            user_query=query,
            workspace_id=workspace_id
        )
        return {
            "answer": response.answer,
            "confidence": response.confidence,
            "suggestions": response.suggestions,
        }
    
    registry.register(MCPTool(
        name="assistant.query",
        category=ToolCategory.ASSISTANT,
        description="Query the assistant for coordination insights",
        parameters={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "User question"},
                "workspace_id": {"type": "string"},
            },
            "required": ["query", "workspace_id"],
        },
        handler=query_assistant,
        rate_limit=10,
    ))
    
    return registry
