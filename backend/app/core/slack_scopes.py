"""
Slack OAuth Scopes Configuration.
Based on product analysis - minimum required permissions.
"""
from typing import List


class SlackScopes:
    """
    Slack OAuth scopes for the Coordination Intelligence Platform.
    Following principle of least privilege from product analysis section 5.
    """
    
    # Bot Token Scopes (for reading messages and posting)
    BOT_SCOPES: List[str] = [
        # Message reading - only where bot is added
        "channels:history",        # Read channel messages where bot is
        "groups:history",          # Read private channel messages
        "im:history",              # Read DMs
        "mpim:history",           # Read group DMs
        
        # Channel info
        "channels:read",          # Get channel list
        "groups:read",            # Get private channel list
        "conversations:read",      # Get conversation list
        
        # User info
        "users:read",              # Get user info
        "users:read.email",        # Get user email
        
        # App interactions
        "app_mentions:read",      # Read when bot is mentioned
        
        # Message posting (for assistant responses)
        "chat:write",              # Post messages
        "chat:write.public",       # Post to public channels (optional)
    ]
    
    # User Token Scopes (for user-level data)
    USER_SCOPES: List[str] = [
        "identity.basic",
        "identity.email",
        "identity.avatar",
    ]
    
    # Shortcut scopes
    SHORTcut_SCOPES: List[str] = [
        "commands:read",
        "commands:write",
    ]
    
    @classmethod
    def get_bot_scopes_string(cls) -> str:
        """Get space-separated scope string for OAuth URL."""
        return " ".join(cls.BOT_SCOPES)
    
    @classmethod
    def get_user_scopes_string(cls) -> str:
        """Get space-separated user scope string."""
        return " ".join(cls.USER_SCOPES)
    
    @classmethod
    def required_scopes(cls) -> List[str]:
        """List of truly required scopes (minimal)."""
        # Note: assistant:write removed as it requires special permissions
        # Note: conversations:read is not a valid scope - using specific channel scopes instead
        # Using only standard bot scopes that work with all Slack apps
        return [
            "channels:history",
            "groups:history", 
            "im:history",
            "channels:read",
            "groups:read",
            "users:read",
            "app_mentions:read",
            "chat:write",
        ]
    
    @classmethod
    def get_required_scopes_string(cls) -> str:
        """Get minimal required scopes as string."""
        return " ".join(cls.required_scopes())


class SlackOAuthConfig:
    """Slack OAuth configuration."""
    
    # OAuth URLs
    AUTHORIZATION_URL = "https://slack.com/oauth/v2/authorize"
    TOKEN_URL = "https://slack.com/api/oauth.v2.access"
    REVOKE_URL = "https://slack.com/api/auth.revoke"
    
    @classmethod
    def get_install_url(cls, client_id: str, redirect_uri: str, state: str = "") -> str:
        """Generate Slack OAuth install URL."""
        scopes = SlackScopes.get_required_scopes_string()
        
        params = {
            "client_id": client_id,
            "scope": scopes,
            "redirect_uri": redirect_uri,
        }
        
        if state:
            params["state"] = state
        
        param_string = "&".join(f"{k}={v}" for k, v in params.items())
        
        return f"{cls.AUTHORIZATION_URL}?{param_string}"
    
    @classmethod
    def get_install_url_with_user_auth(cls, client_id: str, redirect_uri: str, state: str = "") -> str:
        """Generate Slack OAuth install URL with user identity scope."""
        scopes = SlackScopes.get_bot_scopes_string()
        user_scopes = SlackScopes.get_user_scopes_string()
        all_scopes = f"{scopes} {user_scopes}"
        
        params = {
            "client_id": client_id,
            "scope": all_scopes,
            "redirect_uri": redirect_uri,
            "user_scope": user_scopes,
        }
        
        if state:
            params["state"] = state
        
        param_string = "&".join(f"{k}={v}" for k, v in params.items())
        
        return f"{cls.AUTHORIZATION_URL}?{param_string}"
