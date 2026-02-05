"""
Security utilities for Slack event verification and token handling.
"""
import hmac
import hashlib
import time
from typing import Optional
from cryptography.fernet import Fernet
from fastapi import HTTPException, status


class SecurityManager:
    def __init__(self, signing_secret: str, encryption_key: str):
        self.signing_secret = signing_secret.encode()
        self.encryption_key = encryption_key.encode()
        self.fernet = Fernet(self.encryption_key)
    
    def verify_slack_signature(
        self,
        timestamp: str,
        signature: str,
        body: bytes
    ) -> bool:
        """Verify Slack request signature."""
        if abs(time.time() - int(timestamp)) > 60 * 5:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Request timestamp too old"
            )
        
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
    
    def encrypt_token(self, token: str) -> bytes:
        """Encrypt a token for storage."""
        return self.fernet.encrypt(token.encode())
    
    def decrypt_token(self, encrypted_token: bytes) -> str:
        """Decrypt a stored token."""
        return self.fernet.decrypt(encrypted_token).decode()
