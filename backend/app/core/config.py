"""
Configuration management for the Coordination Intelligence Platform.
Supports SQLite for development and PostgreSQL for production.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    app_name: str = "Coordination Intelligence Platform"
    debug: bool = False
    secret_key: str = "dev-secret-key-change-in-production"
    slack_signing_secret: str = "dev-signing-secret"
    slack_bot_token: str = "xoxb-dev-token"
    slack_app_token: str = "xapp-dev-token"
    
    # Slack OAuth Credentials (from https://api.slack.com/apps > Basic Information)
    # These are DIFFERENT from bot/app tokens - needed for OAuth flow
    slack_client_id: str = ""  # Client ID from Slack app Basic Info page
    slack_client_secret: str = ""  # Client Secret from Slack app Basic Info page
    
    database_url: str = "sqlite:///./dev.db"
    database_type: str = "sqlite"
    
    redis_url: Optional[str] = None
    
    openai_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    
    encryption_key: str = "dev-encryption-key-32-bytes!"
    
    # Allowed OAuth Redirect URLs (comma-separated)
    # SECURITY: Only these URLs are allowed for OAuth callbacks
    # Format: http://localhost:8000/oauth/callback,https://yourdomain.com/oauth/callback
    allowed_redirect_urls: str = "http://localhost:8000/oauth/callback"
    
    # Ngrok configuration
    ngrok_authtoken: Optional[str] = None
    ngrok_domain: Optional[str] = None
    public_url: str = "http://localhost:8000"
    
    log_level: str = "INFO"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"  # Ignore extra env vars not defined in Settings


@lru_cache()
def get_settings() -> Settings:
    env_db_url = os.getenv("DATABASE_URL")
    env_db_type = os.getenv("DATABASE_TYPE", "sqlite")
    
    settings = Settings()
    
    if env_db_url:
        settings.database_url = env_db_url
        settings.database_type = env_db_type
    
    if settings.database_type == "sqlite":
        db_path = settings.database_url.replace("sqlite:///", "")
        if not os.path.exists(db_path):
            os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)
    
    return settings


def get_database_url() -> str:
    return get_settings().database_url


def is_sqlite() -> bool:
    return "sqlite" in get_settings().database_url.lower()
