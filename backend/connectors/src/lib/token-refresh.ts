/**
 * Token refresh utility for OAuth providers
 * 
 * Automatically refreshes expired access tokens
 */

import { db, schema } from "@backend/db";
import { eq } from "drizzle-orm";
import { decrypt, encrypt } from "./encryption";

const { linearConnections } = schema;

/**
 * Linear token response
 */
interface LinearTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}

/**
 * Check if a token is expired or about to expire (within 5 minutes)
 */
export function isTokenExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    // No expiration = treat as expired to be safe
    return true;
  }
  
  const bufferMs = 5 * 60 * 1000; // 5 minute buffer
  return new Date().getTime() + bufferMs >= expiresAt.getTime();
}

/**
 * Refresh Linear OAuth token
 */
export async function refreshLinearToken(
  connectionId: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt: Date | null }> {
  const connection = await db.query.linearConnections.findFirst({
    where: eq(linearConnections.id, connectionId),
  });
  
  if (!connection) {
    throw new Error("Connection not found");
  }
  
  if (!connection.refreshToken) {
    throw new Error("No refresh token available");
  }
  
  // Decrypt refresh token
  const refreshToken = decrypt(connection.refreshToken);
  
  // Call Linear token endpoint
  const response = await fetch("https://api.linear.app/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: process.env.LINEAR_CLIENT_ID,
      client_secret: process.env.LINEAR_CLIENT_SECRET,
      refresh_token: refreshToken,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token refresh failed: ${error}`);
  }
  
  const data: LinearTokenResponse = await response.json();
  
  // Calculate new expiration
  const expiresAt = data.expires_in
    ? new Date(Date.now() + data.expires_in * 1000)
    : null;
  
  // Encrypt new tokens
  const encryptedAccessToken = encrypt(data.access_token);
  const encryptedRefreshToken = data.refresh_token
    ? encrypt(data.refresh_token)
    : undefined;
  
  // Update database
  await db
    .update(linearConnections)
    .set({
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken || connection.refreshToken,
      tokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(linearConnections.id, connectionId));
  
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
  };
}

/**
 * Get a valid access token for a connection
 * Automatically refreshes if expired
 */
export async function getValidLinearToken(connectionId: string): Promise<string> {
  const connection = await db.query.linearConnections.findFirst({
    where: eq(linearConnections.id, connectionId),
  });
  
  if (!connection) {
    throw new Error("Linear connection not found");
  }
  
  if (!connection.isActive) {
    throw new Error("Linear connection is inactive");
  }
  
  // Check if token needs refresh
  if (isTokenExpired(connection.tokenExpiresAt)) {
    console.log(`🔄 Refreshing expired Linear token for connection ${connectionId}`);
    const refreshed = await refreshLinearToken(connectionId);
    return refreshed.accessToken;
  }
  
  // Decrypt and return existing token
  return decrypt(connection.accessToken);
}

/**
 * Get valid token by user ID
 * Returns the first active connection for the user
 */
export async function getValidLinearTokenByUser(userId: string): Promise<{
  token: string;
  connectionId: string;
  scopes: string[];
}> {
  const connection = await db.query.linearConnections.findFirst({
    where: eq(linearConnections.userId, userId),
  });
  
  if (!connection) {
    throw new Error("No Linear connection found for user");
  }
  
  if (!connection.isActive) {
    throw new Error("Linear connection is inactive");
  }
  
  // Get valid token (refresh if needed)
  const token = await getValidLinearToken(connection.id);
  
  return {
    token,
    connectionId: connection.id,
    scopes: connection.scopes,
  };
}

/**
 * Refresh all expired tokens (for cron job)
 */
export async function refreshAllExpiredTokens(): Promise<{
  refreshed: number;
  failed: number;
}> {
  const connections = await db.query.linearConnections.findMany({
    where: eq(linearConnections.isActive, true),
  });
  
  let refreshed = 0;
  let failed = 0;
  
  for (const connection of connections) {
    if (isTokenExpired(connection.tokenExpiresAt)) {
      try {
        await refreshLinearToken(connection.id);
        refreshed++;
      } catch (error) {
        console.error(`Failed to refresh token for ${connection.id}:`, error);
        failed++;
      }
    }
  }
  
  return { refreshed, failed };
}
