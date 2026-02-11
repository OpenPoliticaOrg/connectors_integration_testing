/**
 * PKCE (Proof Key for Code Exchange) utility
 * 
 * PKCE is required for OAuth 2.1 and MCP specification
 * Prevents authorization code interception attacks
 */

import { createHash, randomBytes } from "crypto";

/**
 * Generate a code verifier (random string)
 * Must be between 43-128 characters
 */
export function generateCodeVerifier(): string {
  // Generate 32 bytes = 256 bits of entropy
  // Base64url encode to get ~43 characters
  return randomBytes(32)
    .toString("base64url")
    .replace(/=/g, "");
}

/**
 * Generate code challenge from verifier using S256 method
 * code_challenge = BASE64URL(SHA256(code_verifier))
 */
export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256")
    .update(verifier)
    .digest("base64url")
    .replace(/=/g, "");
}

/**
 * Verify that a code challenge matches a verifier
 */
export function verifyCodeChallenge(
  verifier: string,
  challenge: string
): boolean {
  const computedChallenge = generateCodeChallenge(verifier);
  // Use timing-safe comparison
  return timingSafeEqual(computedChallenge, challenge);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * PKCE pair for OAuth flow
 */
export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

/**
 * Generate complete PKCE pair
 */
export function generatePKCE(): PKCEPair {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: "S256",
  };
}

/**
 * Store PKCE verifier temporarily (in-memory with expiration)
 * In production, use Redis or database with TTL
 */
class PKCEStore {
  private store = new Map<string, { verifier: string; expires: number }>();
  
  /**
   * Store verifier with state key
   */
  set(state: string, verifier: string, ttlMs: number = 600000): void {
    // Default 10 minute expiration
    this.store.set(state, {
      verifier,
      expires: Date.now() + ttlMs,
    });
    
    // Clean up expired entries periodically
    this.cleanup();
  }
  
  /**
   * Get and delete verifier (one-time use)
   */
  get(state: string): string | null {
    const entry = this.store.get(state);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expires) {
      this.store.delete(state);
      return null;
    }
    
    // Delete after retrieval (one-time use)
    this.store.delete(state);
    return entry.verifier;
  }
  
  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [state, entry] of this.store.entries()) {
      if (now > entry.expires) {
        this.store.delete(state);
      }
    }
  }
}

// Singleton instance
export const pkceStore = new PKCEStore();
