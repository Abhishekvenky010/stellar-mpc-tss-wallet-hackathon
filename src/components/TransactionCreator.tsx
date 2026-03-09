'use client';

import { useState } from 'react';
import { TSSWallet, TSSTransaction } from '@/lib/tss/types';
import { StellarTSSWallet } from '@/lib/tss/wallet';
import { storeWallets, loadWallets } from '@/lib/storage';

interface TransactionCreatorProps {
  wallet: TSSWallet;
  onTransactionCreated: () => void;
}

export default function TransactionCreator({ wallet, onTransactionCreated }: TransactionCreatorProps) {
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateTransaction = async () => {
    if (!toAddress || !amount) {
      alert('Please fill in all required fields');
      return;
    }

    setCreating(true);

    try {
      const walletInstance = new StellarTSSWallet(wallet.config.network);
      walletInstance.loadWallet(wallet);

      const transaction = await walletInstance.createTransaction(toAddress, amount, memo);

      // Update the wallet in secure storage
      const existingWallets = await loadWallets();
      const walletIndex = existingWallets.findIndex((w: TSSWallet) =>
        w.config.publicKey.toString() === wallet.config.publicKey.toString()
      );

      if (walletIndex !== -1) {
        const updatedWallet = walletInstance.getWallet();
        if (updatedWallet) {
          existingWallets[walletIndex] = updatedWallet;
          try {
            await storeWallets(existingWallets);
          } catch (error) {
            console.warn('Failed to save wallets:', error);
          }
        }
      }

      alert(`Transaction created! ID: ${transaction.id}\nWaiting for ${wallet.config.threshold} signatures...`);
      onTransactionCreated();
    } catch (error) {
      console.error('Failed to create transaction:', error);
      alert('Failed to create transaction. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold gradient-text text-glow mb-2">Create Transaction</h2>
          <p className="text-gray-600">Send funds using your TSS wallet</p>
        </div>

        <div className="card shadow-lg rounded-xl p-8 space-y-8">
          {/* Wallet Info */}
          <div className="bg-gradient-to-br from-gray/5 to-gray/10 rounded-lg p-6 border border-gray/20">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Wallet Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Public Key:</span>
                <span className="text-gray-700 font-mono">{wallet.config.publicKey.toString().slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Threshold:</span>
                <span className="text-gray-800">{wallet.config.threshold}-of-{wallet.participants.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Network:</span>
                <span className="text-gray-800 capitalize">{wallet.config.network}</span>
              </div>
            </div>
          </div>

          {/* Transaction Form */}
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Recipient Address *
              </label>
              <input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="w-full px-4 py-3 bg-white/5 border border-gray/20 rounded-lg text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 input-field"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Amount (XLM) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.0000001"
                  min="0"
                  className="w-full px-4 py-3 bg-white/5 border border-gray/20 rounded-lg text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 input-field"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">XLM</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Memo (Optional)
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Transaction description"
                maxLength={28}
                className="w-full px-4 py-3 bg-white/5 border border-gray/20 rounded-lg text-gray-800 placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 input-field"
              />
            </div>
          </div>

          {/* TSS Info */}
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <span className="text-amber-600 text-xl">⚠️</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-amber-600 mb-2">
                  Threshold Signature Required
                </h3>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>This transaction requires <span className="text-gray-800 font-medium">{wallet.config.threshold}</span> out of <span className="text-gray-800 font-medium">{wallet.participants.length}</span> participants to sign before it can be submitted to the Stellar network.</p>
                  <p className="text-gray-500 text-xs mt-2">Participants: {wallet.participants.map(p => p.id).join(', ')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleCreateTransaction}
              disabled={creating || !toAddress || !amount}
              className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-xl text-white btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none shadow-lg"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Creating...
                </>
              ) : (
                '📤 Create TSS Transaction'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
