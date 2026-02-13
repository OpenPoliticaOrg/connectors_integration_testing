/**
 * Slack token encryption utilities
 * 
 * Slack bot tokens must be encrypted before storage in the database
 * This module provides encryption/decryption utilities following the same
 * pattern as Linear token encryption
 */

import { db, schema } from "@backend/db";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "./encryption";

const { slackConnections } = schema;

/**
 * Encrypt a Slack bot token before storage
 * 
 * @param botToken - The plain-text bot token (xoxb-...)
 * @returns Encrypted token string
 */
export function encryptSlackToken(botToken: string): string {
  if (!botToken) {
    throw new Error("Bot token is required");
  }
  
  // Validate token format (should start with xoxb-)
  if (!botToken.startsWith("xoxb-")) {
    console.warn("Token does not appear to be a Slack bot token (should start with xoxb-)");
  }
  
  return encrypt(botToken);
}

/**
 * Decrypt a Slack bot token from storage
 * 
 * @param encryptedToken - The encrypted token from database
 * @returns Plain-text bot token
 */
export function decryptSlackToken(encryptedToken: string): string {
  if (!encryptedToken) {
    throw new Error("Encrypted token is required");
  }
  
  return decrypt(encryptedToken);
}

/**
 * Get the decrypted bot token for a user's Slack connection
 * 
 * @param userId - The user ID
 * @returns The decrypted bot token, or null if no active connection
 */
export async function getSlackBotToken(userId: string): Promise<string | null> {
  const connection = await db.query.slackConnections.findFirst({
    where: eq(slackConnections.userId, userId),
  });
  
  if (!connection || !connection.isActive) {
    return null;
  }
  
  try {
    return decryptSlackToken(connection.botToken);
  } catch (error) {
    console.error("Failed to decrypt Slack bot token:", error);
    // Token might be stored unencrypted (legacy), try returning as-is
    // but log a warning for migration
    console.warn("Slack token may be stored unencrypted. Migration needed.");
    return connection.botToken;
  }
}

/**
 * Get the decrypted bot token for a team's Slack connection
 * 
 * @param teamId - The Slack team ID
 * @returns The decrypted bot token, or null if no active connection
 */
export async function getSlackBotTokenByTeam(teamId: string): Promise<string | null> {
  const connection = await db.query.slackConnections.findFirst({
    where: eq(slackConnections.teamId, teamId),
  });
  
  if (!connection || !connection.isActive) {
    return null;
  }
  
  try {
    return decryptSlackToken(connection.botToken);
  } catch (error) {
    console.error("Failed to decrypt Slack bot token:", error);
    console.warn("Slack token may be stored unencrypted. Migration needed.");
    return connection.botToken;
  }
}

/**
 * Store a new Slack connection with encrypted token
 * 
 * @param userId - The user ID
 * @param botToken - The plain-text bot token
 * @param metadata - Additional connection metadata
 * @returns The created connection
 */
export async function createSlackConnection(
  userId: string,
  botToken: string,
  metadata: {
    botUserId?: string;
    teamId: string;
    teamName?: string;
    scopes: string[];
  }
) {
  const encryptedToken = encryptSlackToken(botToken);
  
  // Check if connection already exists for this team
  const existing = await db.query.slackConnections.findFirst({
    where: eq(slackConnections.teamId, metadata.teamId),
  });
  
  if (existing) {
    // Update existing connection
    const [updated] = await db
      .update(slackConnections)
      .set({
        botToken: encryptedToken,
        botUserId: metadata.botUserId,
        teamName: metadata.teamName,
        scopes: metadata.scopes,
        isActive: true,
        updatedAt: new Date(),
      })
      .where(eq(slackConnections.id, existing.id))
      .returning();
    
    return updated;
  }
  
  // Create new connection
  const [connection] = await db
    .insert(slackConnections)
    .values({
      userId,
      botToken: encryptedToken,
      botUserId: metadata.botUserId,
      teamId: metadata.teamId,
      teamName: metadata.teamName,
      scopes: metadata.scopes,
      isActive: true,
    })
    .returning();
  
  return connection;
}
