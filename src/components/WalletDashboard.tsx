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
    return <div className="text-center py-8">Loading wallets...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-blue-900">Your TSS Wallets</h2>
      </div>

      {wallets.length === 0 ? (
        <div className="mt-8 text-center py-12">
          <div className="text-black">
            <p className="text-lg">No wallets found</p>
            <p className="text-sm mt-2">Create your first MPC/TSS wallet to get started</p>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {wallets.map((wallet, index) => (
            <div
              key={index}
              className="bg-white overflow-hidden shadow rounded-lg border hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => onWalletSelect(wallet)}
            >
              <div className="p-6">
                <div className="flex items-center">
                  <div className="shrink-0">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {wallet.config.threshold}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-blue-900">
                      TSS Wallet #{index + 1}
                    </h3>
                    <p className="text-sm text-black">
                      {wallet.config.threshold}-of-{wallet.participants.length} threshold
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-blue-700">
                    <p>Public Key: {wallet.config.publicKey.toString().slice(0, 8)}...</p>
                    <p>Network: {wallet.config.network}</p>
                    <p>Participants: {wallet.participants.length}</p>
                    <p>Transactions: {wallet.transactions.length}</p>
                    {wallet.transactions.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-black">
                          Pending: {wallet.transactions.filter(t => t.status === 'pending' || t.status === 'collecting').length} |
                          Signed: {wallet.transactions.filter(t => t.status === 'signed').length} |
                          Submitted: {wallet.transactions.filter(t => t.status === 'submitted').length}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex justify-between items-center">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Active
                  </span>
                  <button className="text-black hover:text-black text-sm font-medium">
                    View Details →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}