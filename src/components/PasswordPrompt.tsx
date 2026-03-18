'use client';

import { useState, useEffect } from 'react';
import { usePassword } from '@/lib/password-context';

interface PasswordPromptProps {
  onSuccess?: () => void;
}

export default function PasswordPrompt({ onSuccess }: PasswordPromptProps) {
  const { 
    isLocked, 
    isEncrypted, 
    hasExistingData, 
    needsMigration,
    isLoading, 
    error, 
    unlock, 
    setupPassword,
    clearError 
  } = usePassword();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Determine if this is first-time setup or unlock
  const isFirstTime = !isEncrypted && !needsMigration;
  const isMigrating = needsMigration;
  
  // Reset form when state changes
  useEffect(() => {
    if (error) {
      setLocalError(error);
    }
  }, [error]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearError();
    
    if (!password) {
      setLocalError('Please enter a password');
      return;
    }
    
    // Validation for first-time setup or migration
    if (isFirstTime || isMigrating) {
      if (password.length < 8) {
        setLocalError('Password must be at least 8 characters');
        return;
      }
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match');
        return;
      }
    }
    
    setIsSubmitting(true);
    
    try {
      let success: boolean;
      
      if (isFirstTime || isMigrating) {
        success = await setupPassword(password);
      } else {
        success = await unlock(password);
      }
      
      if (success && onSuccess) {
        onSuccess();
      }
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading secure storage...</p>
        </div>
      </div>
    );
  }
  
  // Don't show if not locked
  if (!isLocked && !isFirstTime && !needsMigration) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isFirstTime || needsMigration ? 'Set Up Security' : 'Unlock Wallet'}
          </h2>
          <p className="text-gray-400 text-sm">
            {isFirstTime || needsMigration 
              ? 'Create a password to encrypt your wallet data. This password cannot be recovered!'
              : 'Enter your password to access your encrypted wallet data.'
            }
          </p>
        </div>
        
        {/* Warning for migration */}
        {needsMigration && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-600 rounded-lg">
            <p className="text-yellow-200 text-sm">
              ⚠️ Your wallet data needs to be encrypted. Please set a password to continue.
            </p>
          </div>
        )}
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              {isFirstTime || needsMigration ? 'Create Password' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          {(isFirstTime || needsMigration) && (
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Confirm password"
                disabled={isSubmitting}
              />
            </div>
          )}
          
          {/* Error display */}
          {(localError || error) && (
            <div className="p-3 bg-red-900/30 border border-red-600 rounded-lg">
              <p className="text-red-300 text-sm">{localError || error}</p>
            </div>
          )}
          
          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                {isFirstTime || needsMigration ? 'Setting up...' : 'Unlocking...'}
              </>
            ) : (
              isFirstTime || needsMigration ? 'Set Password & Encrypt' : 'Unlock'
            )}
          </button>
        </form>
        
        {/* Important notice */}
        <div className="mt-6 p-3 bg-gray-800/50 rounded-lg">
          <p className="text-gray-400 text-xs">
            <strong className="text-yellow-400">Important:</strong> Your password is used to encrypt your wallet keys. 
            If you forget your password, your funds cannot be recovered. There is no password reset option.
          </p>
        </div>
      </div>
    </div>
  );
}
