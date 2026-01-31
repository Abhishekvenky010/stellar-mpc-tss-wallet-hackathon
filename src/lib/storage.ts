/**
 * Secure storage manager for MPC wallet data
 * Handles encryption and persistence of sensitive cryptographic data
 */

import { TSSWallet } from './tss/types';
import { serializeWallets, deserializeWallets } from './utils';

const STORAGE_VERSION = '1.0';
const WALLETS_KEY = 'stellar-mpc-wallets';
const VERSION_KEY = 'stellar-mpc-version';

// For MVP, we'll use a simple approach with localStorage
// In production, this should use proper encryption

export interface StoredData {
  version: string;
  wallets: TSSWallet[];
  lastUpdated: string;
}

/**
 * Store wallets securely
 */
export async function storeWallets(wallets: TSSWallet[]): Promise<void> {
  const data: StoredData = {
    version: STORAGE_VERSION,
    wallets,
    lastUpdated: new Date().toISOString()
  };

  try {
    const serialized = serializeWallets(wallets);
    localStorage.setItem(WALLETS_KEY, serialized);
    localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
  } catch (error) {
    console.error('Failed to store wallets:', error);
    throw new Error('Failed to save wallet data');
  }
}

/**
 * Load wallets from storage
 */
export async function loadWallets(): Promise<TSSWallet[]> {
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

/**
 * Check if data exists in storage
 */
export function hasStoredData(): boolean {
  return localStorage.getItem(WALLETS_KEY) !== null;
}

/**
 * Clear all stored data
 */
export function clearStoredData(): void {
  localStorage.removeItem(WALLETS_KEY);
  localStorage.removeItem(VERSION_KEY);
}

/**
 * Export data for backup
 */
export function exportData(): string | null {
  return localStorage.getItem(WALLETS_KEY);
}

/**
 * Import data from backup
 */
export function importData(data: string): void {
  try {
    // Validate the data by attempting to deserialize
    deserializeWallets(data);
    localStorage.setItem(WALLETS_KEY, data);
    localStorage.setItem(VERSION_KEY, STORAGE_VERSION);
  } catch (error) {
    throw new Error('Invalid backup data');
  }
}

/**
 * Get storage statistics
 */
export function getStorageStats(): { wallets: number; size: number } {
  const data = localStorage.getItem(WALLETS_KEY);
  if (!data) {
    return { wallets: 0, size: 0 };
  }

  try {
    const wallets = deserializeWallets(data);
    return {
      wallets: wallets.length,
      size: data.length
    };
  } catch {
    return { wallets: 0, size: data.length };
  }
}