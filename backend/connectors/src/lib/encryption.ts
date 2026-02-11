/**
 * Encryption utility for sensitive data (OAuth tokens)
 * 
 * Uses AES-256-GCM for authenticated encryption
 * Industry standard for token storage
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

// Get encryption key from environment
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/**
 * Derive a key from the master key and salt
 */
function deriveKey(salt: Buffer): Buffer {
  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY not set in environment");
  }
  return scryptSync(ENCRYPTION_KEY, salt, 32);
}

/**
 * Encrypt sensitive text (tokens, secrets)
 * Returns base64 encoded string with salt:iv:authTag:ciphertext
 */
export function encrypt(text: string): string {
  if (!text) return text;
  
  try {
    // Generate random salt and IV
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    
    // Derive key
    const key = deriveKey(salt);
    
    // Create cipher
    const cipher = createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    
    // Get auth tag
    const authTag = cipher.getAuthTag();
    
    // Combine: salt:iv:authTag:encrypted
    const result = Buffer.concat([
      salt,
      iv,
      authTag,
      Buffer.from(encrypted, "hex")
    ]).toString("base64");
    
    return result;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw new Error("Failed to encrypt sensitive data");
  }
}

/**
 * Decrypt encrypted text
 * Expects base64 encoded string with format: salt:iv:authTag:ciphertext
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return encryptedData;
  
  try {
    // Decode base64
    const data = Buffer.from(encryptedData, "base64");
    
    // Extract components
    const salt = data.subarray(0, SALT_LENGTH);
    const iv = data.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = data.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
    
    // Derive key
    const key = deriveKey(salt);
    
    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString("utf8");
  } catch (error) {
    console.error("Decryption failed:", error);
    throw new Error("Failed to decrypt sensitive data");
  }
}

/**
 * Encrypt an object (for JSON data)
 */
export function encryptObject<T>(obj: T): string {
  return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt to object
 */
export function decryptObject<T>(encryptedData: string): T {
  const decrypted = decrypt(encryptedData);
  return JSON.parse(decrypted) as T;
}

/**
 * Generate a secure encryption key
 * Run this once and save the output to your .env file
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("base64");
}

/**
 * Check if encryption is properly configured
 */
export function isEncryptionConfigured(): boolean {
  return !!ENCRYPTION_KEY && ENCRYPTION_KEY.length >= 32;
}

/**
 * Safely decrypt with fallback for unencrypted data (migration helper)
 * Use this during transition period when some data might not be encrypted yet
 */
export function decryptSafe(encryptedData: string | null): string | null {
  if (!encryptedData) return null;
  
  // Check if data looks encrypted (base64 and long enough)
  const isEncrypted = encryptedData.length > 100 && 
    /^[A-Za-z0-9+/=]+$/.test(encryptedData);
  
  if (!isEncrypted) {
    // Data is not encrypted (legacy), return as-is
    return encryptedData;
  }
  
  try {
    return decrypt(encryptedData);
  } catch (error) {
    // If decryption fails, might be legacy data
    console.warn("Decryption failed, treating as plaintext:", error);
    return encryptedData;
  }
}
