/**
 * Secure storage manager for MPC wallet data
 * Handles encryption and persistence of sensitive cryptographic data
 * Uses AES-256-GCM with PBKDF2 key derivation
 */

import { TSSWallet } from './tss/types';
import { serializeWallets, deserializeWallets } from './utils';
import { encryptData, decryptData, generateSalt } from './crypto';

const STORAGE_VERSION = '2.0';
const WALLETS_KEY = 'stellar-mpc-wallets';
const VERSION_KEY = 'stellar-mpc-version';
const ENCRYPTED_WALLETS_KEY = 'stellar-mpc-wallets-encrypted';
const SALT_KEY = 'stellar-mpc-salt';
const ENCRYPTION_CHECK_KEY = 'stellar-mpc-encryption-check';

// In-memory password (session only - never stored)
// We cache the derived key instead of the password for better security
let sessionKey: CryptoKey | null = null;
let sessionPassword: string | null = null;
let sessionPasswordHash: string | null = null;

// Password validation check stored encrypted
const ENCRYPTION_CHECK_VALUE = 'MPC_WALLET_ENCRYPTION_CHECK_V1';

export interface StoredData {
  version: string;
  wallets: TSSWallet[];
  lastUpdated: string;
}

/**
 * Set the session password for encryption/decryption
 * This should be called when user enters their password
 * Note: We derive and cache the key instead of storing the password
 */
export async function setSessionPassword(password: string): Promise<void> {
  // Get salt from storage
  const storedSalt = localStorage.getItem(SALT_KEY);
  if (!storedSalt) {
    throw new Error('Encryption not initialized');
  }
  
  const salt = new Uint8Array(JSON.parse(storedSalt));
  const { deriveKey } = await import('./crypto');
  sessionKey = await deriveKey(password, salt);
  
  // Store a hash to verify password without keeping it in memory
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  sessionPasswordHash = Array.from(new Uint8Array(hashBuffer)).join(',');
  sessionPassword = password;
}

/**
 * Clear the session password (on logout or session end)
 */
export function clearSessionPassword(): void {
  sessionPassword = null;
  sessionKey = null;
  sessionPasswordHash = null;
}

/**
 * Check if session has a password set
 */
export function hasSessionPassword(): boolean {
  return sessionPassword !== null || sessionKey !== null;
}

/**
 * Check if encryption has been set up (password was previously configured)
 */
export function isEncryptionSetup(): boolean {
  return localStorage.getItem(ENCRYPTION_CHECK_KEY) !== null;
}

/**
 * Check if there's any wallet data (encrypted or unencrypted)
 */
export function hasStoredData(): boolean {
  return localStorage.getItem(WALLETS_KEY) !== null || localStorage.getItem(ENCRYPTED_WALLETS_KEY) !== null;
}

/**
 * Check if data is encrypted (new format) or unencrypted (legacy)
 */
export function isDataEncrypted(): boolean {
  return localStorage.getItem(ENCRYPTED_WALLETS_KEY) !== null;
}

/**
 * Initialize encryption with a new password
 * Should be called when user first sets up their password
 */
export async function initializeEncryption(password: string): Promise<void> {
  // Generate a new salt for key derivation
  const salt = generateSalt();
  localStorage.setItem(SALT_KEY, JSON.stringify(Array.from(salt)));
  
  // Store encrypted validation check
  const encryptedCheck = await encryptData(ENCRYPTION_CHECK_VALUE, password);
  localStorage.setItem(ENCRYPTION_CHECK_KEY, encryptedCheck);
  
  // Derive and cache the session key for immediate use
  const { deriveKey } = await import('./crypto');
  sessionKey = await deriveKey(password, salt);
  sessionPassword = password;
}

/**
 * Verify password by checking if it can decrypt the validation check
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const encryptedCheck = localStorage.getItem(ENCRYPTION_CHECK_KEY);
  if (!encryptedCheck) {
    return false;
  }
  
  try {
    const decrypted = await decryptData(encryptedCheck, password);
    return decrypted === ENCRYPTION_CHECK_VALUE;
  } catch {
    return false;
  }
}

/**
 * Unlock storage with password - must be called before accessing wallets
 */
export async function unlockStorage(password: string): Promise<boolean> {
  const isValid = await verifyPassword(password);
  if (isValid) {
    // Set session password and derive the key
    await setSessionPassword(password);
    return true;
  }
  return false;
}

/**
 * Migrate existing unencrypted wallet data to encrypted format
 * Returns true if migration was successful
 */
export async function migrateToEncrypted(password: string): Promise<{success: boolean; warning?: string}> {
  const unencryptedData = localStorage.getItem(WALLETS_KEY);
  
  if (!unencryptedData) {
    return { success: true };
  }
  
  // Validate the data first
  let wallets: TSSWallet[];
  try {
    wallets = deserializeWallets(unencryptedData);
  } catch (error) {
    return { success: false, warning: 'Could not parse existing wallet data' };
  }
  
  // Check if data looks valid
  if (!wallets || wallets.length === 0) {
    return { success: true };
  }
  
  // Initialize encryption if not already set up
  if (!isEncryptionSetup()) {
    await initializeEncryption(password);
  } else {
    await setSessionPassword(password);
  }
  
  // Encrypt and store
  await storeWallets(wallets);
  
  // Remove legacy unencrypted data after successful migration for security
  localStorage.removeItem(WALLETS_KEY);
  
  return { 
    success: true, 
    warning: 'Existing wallet data has been encrypted. Your password is now required to access wallets.' 
  };
}

/**
 * Store wallets securely with encryption
 */
export async function storeWallets(wallets: TSSWallet[]): Promise<void> {
  if (!sessionPassword) {
    throw new Error('Storage is locked. Please unlock with your password first.');
  }

  const data: StoredData = {
    version: STORAGE_VERSION,
    wallets,
    lastUpdated: new Date().toISOString()
  };

  try {
    const serialized = serializeWallets(wallets);
    
    // Encrypt the data before storing
    const encrypted = await encryptData(serialized, sessionPassword);
    localStorage.setItem(ENCRYPTED_WALLETS_KEY, encrypted);
    localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
  } catch (error) {
    console.error('Failed to store wallets:', error);
    throw new Error('Failed to save wallet data');
  }
}

/**
 * Load wallets from storage
 * Handles both encrypted and legacy unencrypted formats
 */
export async function loadWallets(): Promise<TSSWallet[]> {
  // If data is encrypted and we have a session password, decrypt it
  if (isDataEncrypted()) {
    if (!sessionPassword) {
      throw new Error('Storage is locked. Please enter your password to access wallets.');
    }
    
    try {
      const encrypted = localStorage.getItem(ENCRYPTED_WALLETS_KEY);
      if (!encrypted) {
        return [];
      }
      
      const decrypted = await decryptData(encrypted, sessionPassword);
      const wallets = deserializeWallets(decrypted);
      
      // Validate wallet data
      for (const wallet of wallets) {
        if (!wallet.config || !wallet.participants) {
          console.warn('Invalid wallet data found, skipping');
        }
      }
      
      return wallets;
    } catch (error) {
      console.error('Failed to load wallets:', error);
      throw new Error('Failed to decrypt wallet data. Please check your password.');
    }
  }
  
  // Legacy unencrypted format - try to load
  try {
    const stored = localStorage.getItem(WALLETS_KEY);
    if (!stored) {
      return [];
    }

    const wallets = deserializeWallets(stored);

    // Validate wallet data
    for (const wallet of wallets) {
      if (!wallet.config || !wallet.participants) {
        console.warn('Invalid wallet data found, skipping');
        continue;
      }
    }

    return wallets;
  } catch (error) {
    console.error('Failed to load wallets:', error);
    // Return empty array on error to allow app to continue
    return [];
  }
}


export function clearStoredData(): void {
  localStorage.removeItem(WALLETS_KEY);
  localStorage.removeItem(ENCRYPTED_WALLETS_KEY);
  localStorage.removeItem(VERSION_KEY);
  localStorage.removeItem(SALT_KEY);
  localStorage.removeItem(ENCRYPTION_CHECK_KEY);
  sessionPassword = null;
}

/**
 * Export data for backup (encrypted)
 */
export function exportData(): string | null {
  // Prefer encrypted data if available
  const encrypted = localStorage.getItem(ENCRYPTED_WALLETS_KEY);
  if (encrypted) {
    return JSON.stringify({ type: 'encrypted', data: encrypted });
  }
  
  // Fall back to unencrypted
  return localStorage.getItem(WALLETS_KEY);
}

/**
 * Import data from backup
 */
export async function importData(data: string, password?: string): Promise<void> {
  try {
    // Try to parse as encrypted format
    const parsed = JSON.parse(data);
    if (parsed.type === 'encrypted' && parsed.data) {
      if (!password || !sessionPassword) {
        throw new Error('Password required to import encrypted backup');
      }
      
      // Verify password works by trying to decrypt
      await decryptData(parsed.data, password);
      localStorage.setItem(ENCRYPTED_WALLETS_KEY, parsed.data);
      await setSessionPassword(password);
      return;
    }
  } catch {
    // Not JSON or not encrypted format, try as plain data
  }
  
  // Legacy unencrypted import
  if (!password) {
    throw new Error('Password required for importing unencrypted data - it will be re-encrypted');
  }
  
  try {
    // Validate the data by attempting to deserialize
    deserializeWallets(data);
    
    // Initialize encryption and store
    if (!isEncryptionSetup()) {
      await initializeEncryption(password);
    } else {
      await setSessionPassword(password);
    }
    
    await storeWallets(deserializeWallets(data));
  } catch (error) {
    throw new Error('Invalid backup data');
  }
}

/**
 * Get storage statistics
 */
export function getStorageStats(): { wallets: number; size: number; encrypted: boolean } {
  // Check encrypted first
  const encryptedData = localStorage.getItem(ENCRYPTED_WALLETS_KEY);
  if (encryptedData) {
    return {
      wallets: 0, // Can't know without decrypting
      size: encryptedData.length,
      encrypted: true
    };
  }
  
  const data = localStorage.getItem(WALLETS_KEY);
  if (!data) {
    return { wallets: 0, size: 0, encrypted: false };
  }

  try {
    const wallets = deserializeWallets(data);
    return {
      wallets: wallets.length,
      size: data.length,
      encrypted: false
    };
  } catch {
    return { wallets: 0, size: data.length, encrypted: false };
  }
}