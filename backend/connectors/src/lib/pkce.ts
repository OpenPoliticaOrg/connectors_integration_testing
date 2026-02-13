/**
 * PKCE (Proof Key for Code Exchange) utility
 * 
 * PKCE is required for OAuth 2.1 and MCP specification
 * Prevents authorization code interception attacks
 */

import { createHash, randomBytes } from "crypto";
import { db, schema } from "@backend/db";
import { eq, lt } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";

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
 * Database-backed PKCE store
 * Production-ready - works with multiple server instances
 */

/**
 * Store PKCE verifier in database
 * The verifier is encrypted before storage for security
 */
export async function storePkceChallenge(
  state: string,
  codeVerifier: string,
  provider: string = "linear",
  userId?: string,
  ttlMs: number = 600000 // 10 minutes default
): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  
  // Encrypt the code verifier before storing
  const encryptedVerifier = encrypt(codeVerifier);
  
  await db.insert(schema.pkceChallenges).values({
    state,
    codeVerifier: encryptedVerifier,
    provider,
    userId: userId || null,
    expiresAt,
  });
}

/**
 * Retrieve and delete PKCE verifier (one-time use)
 * Automatically cleans up expired challenges
 */
export async function getPkceVerifier(state: string): Promise<{
  codeVerifier: string;
  provider: string;
  userId: string | null;
} | null> {
  // Clean up expired challenges first
  await cleanupExpiredChallenges();
  
  const challenge = await db.query.pkceChallenges.findFirst({
    where: eq(schema.pkceChallenges.state, state),
  });
  
  if (!challenge) {
    return null;
  }
  
  // Check if expired
  if (new Date() > challenge.expiresAt) {
    await db.delete(schema.pkceChallenges)
      .where(eq(schema.pkceChallenges.id, challenge.id));
    return null;
  }
  
  // Delete after retrieval (one-time use)
  await db.delete(schema.pkceChallenges)
    .where(eq(schema.pkceChallenges.id, challenge.id));
  
  // Decrypt the code verifier
  const codeVerifier = decrypt(challenge.codeVerifier);
  
  return {
    codeVerifier,
    provider: challenge.provider,
    userId: challenge.userId,
  };
}

/**
 * Clean up expired PKCE challenges
 */
async function cleanupExpiredChallenges(): Promise<void> {
  try {
    await db.delete(schema.pkceChallenges)
      .where(lt(schema.pkceChallenges.expiresAt, new Date()));
  } catch (error) {
    // Don't fail the request if cleanup fails
    console.error("Failed to cleanup expired PKCE challenges:", error);
  }
}
