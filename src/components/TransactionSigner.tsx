'use client';

import { useState } from 'react';
import { TSSWallet, TSSTransaction, TSSParticipant } from '@/lib/tss/types';
import { StellarTSSWallet } from '@/lib/tss/wallet';
import { serializeWallets } from '@/lib/utils';

interface TransactionSignerProps {
  wallet: TSSWallet;
  onTransactionSigned: () => void;
}

export default function TransactionSigner({ wallet, onTransactionSigned }: TransactionSignerProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<TSSTransaction | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<TSSParticipant | null>(null);
  const [signing, setSigning] = useState(false);

  const handleSignTransaction = async () => {
    if (!selectedTransaction || !selectedParticipant) {
      alert('Please select a transaction and participant');
      return;
    }

    setSigning(true);

    try {
      const walletInstance = new StellarTSSWallet(wallet.config.network);
      walletInstance.loadWallet(wallet);

      if (!selectedParticipant.keyShare) {
        throw new Error('Key share not available for participant');
      }

      await walletInstance.signTransaction(
        selectedTransaction.id,
        selectedParticipant.id,
        selectedParticipant.keyShare
      );

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

      alert(`Signature added! Transaction status: ${selectedTransaction.status}`);
      setSelectedTransaction(null);
      setSelectedParticipant(null);
      onTransactionSigned();
    } catch (error) {
      console.error('Failed to sign transaction:', error);
      alert('Failed to sign transaction. Please try again.');
    } finally {
      setSigning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'collecting': return 'bg-blue-100 text-blue-800';
      case 'signed': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-purple-100 text-purple-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Sign Transactions</h2>

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

          {/* Transaction List */}
          <div>
            <h3 className="text-lg font-medium text-blue-900 mb-4">Pending Transactions</h3>
            {wallet.transactions.length === 0 ? (
              <p className="text-black">No transactions to sign</p>
            ) : (
              <div className="space-y-3">
                {wallet.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedTransaction?.id === transaction.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-blue-200 hover:border-blue-300'
                    }`}
                    onClick={() => setSelectedTransaction(transaction)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-blue-900">
                            To: {transaction.to.slice(0, 8)}...
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </div>
                        <div className="mt-1 text-sm text-blue-700">
                          <p>Amount: {transaction.amount} XLM</p>
                          {transaction.memo && <p>Memo: {transaction.memo}</p>}
                          <p>Signatures: {transaction.signatureShares.length}/{wallet.config.threshold}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-black">ID: {transaction.id.slice(0, 8)}...</p>
                        {transaction.stellarTxId && (
                          <p className="text-xs text-green-600">Stellar TX: {transaction.stellarTxId.slice(0, 8)}...</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Signing Interface */}
          {selectedTransaction && (
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-blue-900 mb-4">Sign Selected Transaction</h3>

              <div className="bg-blue-50 rounded-md p-4 mb-4">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Transaction Details</h4>
                <div className="text-sm text-blue-700">
                  <p><strong>To:</strong> {selectedTransaction.to}</p>
                  <p><strong>Amount:</strong> {selectedTransaction.amount} XLM</p>
                  <p><strong>Memo:</strong> {selectedTransaction.memo || 'None'}</p>
                  <p><strong>Status:</strong> {selectedTransaction.status}</p>
                  <p><strong>Signatures:</strong> {selectedTransaction.signatureShares.length}/{wallet.config.threshold}</p>
                </div>
              </div>

              {/* Participant Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-blue-700 mb-2">
                  Select Participant *
                </label>
                <select
                  value={selectedParticipant?.id || ''}
                  onChange={(e) => {
                    const participant = wallet.participants.find(p => p.id === e.target.value);
                    setSelectedParticipant(participant || null);
                  }}
                  className="mt-1 block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-black"
                >
                  <option value="">Choose a participant...</option>
                  {wallet.participants.filter(p => p.keyShare).map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.id} (Share #{participant.keyShare!.index})
                    </option>
                  ))}
                </select>
              </div>

              {/* Sign Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleSignTransaction}
                  disabled={signing || !selectedParticipant || selectedTransaction.status === 'signed' || selectedTransaction.status === 'submitted'}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {signing ? 'Signing...' : 'Sign Transaction'}
                </button>
              </div>

              {selectedTransaction.status === 'signed' && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-md p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-green-800">
                        Transaction Signed!
                      </h3>
                      <div className="mt-2 text-sm text-green-700">
                        <p>This transaction has enough signatures and will be submitted to the Stellar network automatically.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedTransaction.status === 'submitted' && (
                <div className="mt-4 bg-purple-50 border border-purple-200 rounded-md p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-purple-800">
                        Transaction Submitted!
                      </h3>
                      <div className="mt-2 text-sm text-purple-700">
                        <p>Transaction has been submitted to Stellar. TX ID: {selectedTransaction.stellarTxId}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}