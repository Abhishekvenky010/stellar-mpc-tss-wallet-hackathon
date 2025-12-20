'use client';

import { useState, useEffect } from 'react';
import { TSSWallet } from '@/lib/tss/types';
import { deserializeWallets, serializeWallets } from '@/lib/utils';

interface WalletDashboardProps {
  onWalletSelect: (wallet: TSSWallet) => void;
}

export default function WalletDashboard({ onWalletSelect }: WalletDashboardProps) {
  const [wallets, setWallets] = useState<TSSWallet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load wallets from localStorage for demo
    const savedWallets = localStorage.getItem('tss-wallets');
    if (savedWallets) {
      setWallets(deserializeWallets(savedWallets));
    }
    setLoading(false);
  }, []);

  const saveWallets = (newWallets: TSSWallet[]) => {
    setWallets(newWallets);
    try {
      localStorage.setItem('tss-wallets', serializeWallets(newWallets));
    } catch (error) {
      console.warn('Failed to save wallets to localStorage:', error);
      // For demo, clear old data if quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        localStorage.removeItem('tss-wallets');
        try {
          localStorage.setItem('tss-wallets', serializeWallets(newWallets.slice(-1))); // Save only latest
        } catch (e) {
          console.warn('Still failed to save wallets');
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">Loading wallets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-0">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Your TSS Wallets</h2>
            <p className="text-gray-600 mt-1">Manage your multi-party cryptographic wallets</p>
          </div>
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white border border-gray-200 rounded-2xl p-12 max-w-md mx-auto shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🔐</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No wallets found</h3>
              <p className="text-gray-600">Create your first MPC/TSS wallet to get started with secure distributed cryptography</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {wallets.map((wallet, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer"
                onClick={() => onWalletSelect(wallet)}
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="shrink-0">
                      <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                        <span className="text-white font-bold text-lg">
                          {wallet.config.threshold}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-xl font-semibold text-gray-900">
                        TSS Wallet #{index + 1}
                      </h3>
                      <p className="text-gray-600 text-sm">
                        {wallet.config.threshold}-of-{wallet.participants.length} threshold
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-500 text-sm">Public Key</span>
                      <span className="text-gray-400 font-mono text-sm">
                        {wallet.config.publicKey.toString().slice(0, 8)}...
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-500 text-sm">Network</span>
                      <span className="text-gray-900 text-sm capitalize">{wallet.config.network}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <span className="text-gray-500 text-sm">Participants</span>
                      <span className="text-gray-900 text-sm">{wallet.participants.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-500 text-sm">Transactions</span>
                      <span className="text-gray-900 text-sm">{wallet.transactions.length}</span>
                    </div>

                    {wallet.transactions.length > 0 && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-500 mb-2">Transaction Status</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-yellow-600">
                            Pending: {wallet.transactions.filter(t => t.status === 'pending' || t.status === 'collecting').length}
                          </span>
                          <span className="text-blue-600">
                            Signed: {wallet.transactions.filter(t => t.status === 'signed').length}
                          </span>
                          <span className="text-green-600">
                            Submitted: {wallet.transactions.filter(t => t.status === 'submitted').length}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-between items-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                      Active
                    </span>
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors">
                      View Details →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}