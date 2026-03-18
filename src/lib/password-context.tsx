'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  isEncryptionSetup,
  isDataEncrypted,
  hasStoredData,
  unlockStorage,
  initializeEncryption,
  migrateToEncrypted,
  setSessionPassword,
  clearSessionPassword,
  hasSessionPassword,
  loadWallets
} from '@/lib/storage';

interface PasswordContextType {
  isLocked: boolean;
  isEncrypted: boolean;
  hasExistingData: boolean;
  needsMigration: boolean;
  isLoading: boolean;
  error: string | null;
  unlock: (password: string) => Promise<boolean>;
  setupPassword: (password: string) => Promise<boolean>;
  lock: () => void;
  clearError: () => void;
}

const PasswordContext = createContext<PasswordContextType | undefined>(undefined);

export function PasswordProvider({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(true);
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [hasExistingData, setHasExistingData] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check initial state on mount
  useEffect(() => {
    const checkState = async () => {
      setIsLoading(true);
      
      const encrypted = isDataEncrypted();
      const encryptionSetup = isEncryptionSetup();
      const hasData = hasStoredData();
      
      setIsEncrypted(encrypted);
      setHasExistingData(hasData);
      
      // Need migration if there's data but it's not encrypted
      setNeedsMigration(hasData && !encrypted && !encryptionSetup);
      
      // If data is encrypted but no session, we're locked
      setIsLocked(encrypted && !hasSessionPassword());
      
      setIsLoading(false);
    };
    
    checkState();
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    
    try {
      const success = await unlockStorage(password);
      if (success) {
        setIsLocked(false);
        setIsLoading(false);
        return true;
      } else {
        setError('Invalid password');
        setIsLoading(false);
        return false;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlock');
      setIsLoading(false);
      return false;
    }
  }, []);

  const setupPassword = useCallback(async (password: string): Promise<boolean> => {
    setError(null);
    setIsLoading(true);
    
    try {
      // If there's existing data, migrate it
      if (hasExistingData && !isDataEncrypted()) {
        const migrationResult = await migrateToEncrypted(password);
        if (!migrationResult.success) {
          setError(migrationResult.warning || 'Failed to migrate data');
          setIsLoading(false);
          return false;
        }
        if (migrationResult.warning) {
          setError(migrationResult.warning);
        }
      } else {
        // Just initialize encryption
        await initializeEncryption(password);
      }
      
      setIsEncrypted(true);
      setNeedsMigration(false);
      setIsLocked(false);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup password');
      setIsLoading(false);
      return false;
    }
  }, [hasExistingData]);

  const lock = useCallback(() => {
    clearSessionPassword();
    setIsLocked(true);
  }, []);

  return (
    <PasswordContext.Provider
      value={{
        isLocked,
        isEncrypted,
        hasExistingData,
        needsMigration,
        isLoading,
        error,
        unlock,
        setupPassword,
        lock,
        clearError
      }}
    >
      {children}
    </PasswordContext.Provider>
  );
}

export function usePassword() {
  const context = useContext(PasswordContext);
  if (context === undefined) {
    throw new Error('usePassword must be used within a PasswordProvider');
  }
  return context;
}
