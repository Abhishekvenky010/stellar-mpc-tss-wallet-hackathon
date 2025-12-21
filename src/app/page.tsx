'use client';

import { useState } from 'react';
import WalletDashboard from '@/components/WalletDashboard';
import WalletCreator from '@/components/WalletCreator';
import TransactionCreator from '@/components/TransactionCreator';
import TransactionSigner from '@/components/TransactionSigner';

export default function Home() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'create' | 'transaction' | 'sign'>('dashboard');
  const [selectedWallet, setSelectedWallet] = useState<any>(null);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-black">
                Stellar MPC/TSS Wallet
              </h1>
              <a
                href="/test-wasm"
                className="text-sm text-blue-600 hover:text-blue-800 underline"
                target="_blank"
              >
                Test WASM
              </a>
            </div>
            <nav className="flex space-x-4">
              <button
               onClick={() => setCurrentView('dashboard')}
               className={`px-3 py-2 rounded-md text-sm font-medium ${
                 currentView === 'dashboard'
                   ? 'bg-blue-100 text-blue-700'
                   : 'text-black hover:text-black'
               }`}
             >
               Dashboard
             </button>
             <button
               onClick={() => setCurrentView('create')}
               className={`px-3 py-2 rounded-md text-sm font-medium ${
                 currentView === 'create'
                   ? 'bg-blue-100 text-blue-700'
                   : 'text-black hover:text-black'
               }`}
             >
               Create Wallet
             </button>
             <button
               onClick={() => setCurrentView('transaction')}
               className={`px-3 py-2 rounded-md text-sm font-medium ${
                 currentView === 'transaction'
                   ? 'bg-blue-100 text-blue-700'
                   : 'text-black hover:text-black'
               }`}
               disabled={!selectedWallet}
             >
               New Transaction
             </button>
             <button
               onClick={() => setCurrentView('sign')}
               className={`px-3 py-2 rounded-md text-sm font-medium ${
                 currentView === 'sign'
                   ? 'bg-blue-100 text-blue-700'
                   : 'text-black hover:text-black'
               }`}
               disabled={!selectedWallet}
             >
               Sign Transactions
             </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
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
    </div>
  );
}
