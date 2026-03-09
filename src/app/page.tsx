'use client';

import { useState, useEffect } from 'react';
import WalletDashboard from '@/components/WalletDashboard';
import WalletCreator from '@/components/WalletCreator';
import TransactionCreator from '@/components/TransactionCreator';
import TransactionSigner from '@/components/TransactionSigner';
import { StellarTSSWallet } from '@/lib/tss/wallet';

export default function Home() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'transaction' | 'sign'>('dashboard');
  const [selectedWallet, setSelectedWallet] = useState<any>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  return (
    <div className="min-h-screen">
      {/* Header with gradient border */}
      <header className="relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg: var(--primary-gradient)"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-xl gradient-bg flex items-center justify-center glow">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text text-glow">
                  Striver's Wallet
                </h1>
                <p className="text-sm text-gray-400">Stellar MPC TSS</p>
              </div>
            </div>
            <nav className="flex space-x-2">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
                { id: 'create', label: 'Create Wallet', icon: '✨' },
                { id: 'transaction', label: 'New Transaction', icon: '📤', disabled: !selectedWallet },
                { id: 'sign', label: 'Sign Transactions', icon: '✍️', disabled: !selectedWallet },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setCurrentView(item.id as any)}
                  disabled={item.disabled}
                  className={`nav-link px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 flex items-center space-x-2 ${
                    currentView === item.id
                      ? 'btn-primary text-white shadow-lg'
                      : item.disabled
                      ? 'text-gray-500 cursor-not-allowed'
                      : 'hover:bg-white/10 text-gray-200'
                  }`}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Debug Information */}
      {debugInfo && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className={`p-4 rounded-lg ${
            debugInfo.status === 'success' ? 'bg-green-900/30 border border-green-500' : 'bg-red-900/30 border border-red-500'
          }`}>
            <h3 className="font-semibold text-lg mb-2">{debugInfo.status === 'success' ? '✅ Debug Success' : '❌ Debug Error'}</h3>
            <p className="text-sm">{debugInfo.message}</p>
            {debugInfo.error && (
              <div className="mt-2 p-2 bg-red-900/50 rounded text-xs">
                <pre>{debugInfo.error.stack}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === 'dashboard' && (
          <WalletDashboard onWalletSelect={setSelectedWallet} />
        )}
        {currentView === 'create' && (
          <WalletCreator onWalletCreated={(wallet) => {
            setSelectedWallet(wallet);
            setCurrentView('dashboard');
          }} />
        )}
        {currentView === 'transaction' && selectedWallet && (
          <TransactionCreator
            wallet={selectedWallet}
            onTransactionCreated={() => setCurrentView('dashboard')}
          />
        )}
        {currentView === 'sign' && selectedWallet && (
          <TransactionSigner
            wallet={selectedWallet}
            onTransactionSigned={() => setCurrentView('dashboard')}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-16 py-8 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-gray-500 text-sm">
              Powered by Threshold Signature Scheme (TSS)
            </p>
            <div className="flex space-x-4">
              <span className="text-gray-500 text-sm">Built with ❤️ for Stellar</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
