/**
 * Cryptographic utilities for secure data storage
 * Uses Web Crypto API for encryption/decryption of sensitive MPC data
 */

const STORAGE_KEY = 'stellar-mpc-data';
const SALT_KEY = 'stellar-mpc-salt';

/**
 * Derive encryption key from password using PBKDF2
 */
export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Create a new Uint8Array to ensure proper typing
  const saltBuffer = new Uint8Array(salt);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Generate a random salt for key derivation
 */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

/**
 * Encrypt data using AES-GCM
 */
export async function encryptData(data: string, password: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  // Get or create salt
  let salt: Uint8Array;
  const storedSalt = localStorage.getItem(SALT_KEY);
  if (storedSalt) {
    salt = new Uint8Array(JSON.parse(storedSalt));
  } else {
    salt = generateSalt();
    localStorage.setItem(SALT_KEY, JSON.stringify(Array.from(salt)));
  }

  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    dataBuffer
  );

  // Combine salt + iv + encrypted data
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(encrypted), salt.length + iv.length);

  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt data using AES-GCM
 */
export async function decryptData(encryptedData: string, password: string): Promise<string> {
  try {
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));

    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

    const key = await deriveKey(password, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    throw new Error('Failed to decrypt data. Please check your password.');
  }
}

/**
 * Check if encrypted data exists
 */
export function hasStoredData(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

/**
 * Store encrypted data
 */
export async function storeEncryptedData(data: any, password: string): Promise<void> {
  const jsonData = JSON.stringify(data);
  const encrypted = await encryptData(jsonData, password);
  localStorage.setItem(STORAGE_KEY, encrypted);
}

/**
 * Load and decrypt data
 */
export async function loadEncryptedData(password: string): Promise<any> {
  const encrypted = localStorage.getItem(STORAGE_KEY);
  if (!encrypted) {
    throw new Error('No stored data found');
  }

  const jsonData = await decryptData(encrypted, password);
  return JSON.parse(jsonData);
}

/**
 * Clear all stored data
 */
export function clearStoredData(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
}

/**
 * Export data for backup (returns encrypted string)
 */
export function exportEncryptedData(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Import data from backup
 */
export function importEncryptedData(encryptedData: string): void {
  localStorage.setItem(STORAGE_KEY, encryptedData);
}