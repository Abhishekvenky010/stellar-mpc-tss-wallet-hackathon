'use client';

import { useState } from 'react';
import { TSSWallet, TSSTransaction } from '@/lib/tss/types';
import { StellarTSSWallet } from '@/lib/tss/wallet';
import { serializeWallets } from '@/lib/utils';

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

      // Update the wallet in localStorage
      const savedWallets = JSON.parse(localStorage.getItem('tss-wallets') || '[]');
      const walletIndex = savedWallets.findIndex((w: TSSWallet) =>
        w.config.publicKey.toString() === wallet.config.publicKey.toString()
      );

      if (walletIndex !== -1) {
        savedWallets[walletIndex] = walletInstance.getWallet();
        try {
          localStorage.setItem('tss-wallets', serializeWallets(savedWallets));
        } catch (error) {
          console.warn('Failed to save wallets to localStorage:', error);
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
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Create Transaction</h2>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Wallet Info */}
          <div className="bg-blue-50 rounded-md p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Wallet Details</h3>
            <div className="text-sm text-blue-700">
              <p>Public Key: {wallet.config.publicKey.toString().slice(0, 12)}...</p>
              <p>Threshold: {wallet.config.threshold}-of-{wallet.participants.length}</p>
              <p>Network: {wallet.config.network}</p>
            </div>
          </div>

          {/* Transaction Form */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Recipient Address *
              </label>
              <input
                type="text"
                value={toAddress}
                onChange={(e) => setToAddress(e.target.value)}
                placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                className="mt-1 block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Amount (XLM) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.0000001"
                min="0"
                className="mt-1 block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder-black"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-700 mb-2">
                Memo (Optional)
              </label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="Transaction description"
                maxLength={28}
                className="mt-1 block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder-black"
              />
            </div>
          </div>

          {/* TSS Info */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Threshold Signature Required
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>This transaction requires {wallet.config.threshold} out of {wallet.participants.length} participants to sign before it can be submitted to the Stellar network.</p>
                  <p className="mt-1">Participants: {wallet.participants.map(p => p.id).join(', ')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <div className="flex justify-end">
            <button
              onClick={handleCreateTransaction}
              disabled={creating || !toAddress || !amount}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create TSS Transaction'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}