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
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-0">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign Transactions</h2>
          <p className="text-gray-600">Add your signature to pending TSS transactions</p>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-8 space-y-8 border border-gray-200">
          {/* Wallet Info */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Wallet Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Public Key:</span>
                <span className="text-gray-400 font-mono">{wallet.config.publicKey.toString().slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Threshold:</span>
                <span className="text-gray-900">{wallet.config.threshold}-of-{wallet.participants.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Network:</span>
                <span className="text-gray-900 capitalize">{wallet.config.network}</span>
              </div>
            </div>
          </div>

          {/* Transaction List */}
          <div>
            <h3 className="text-xl font-semibold text-gray-900 mb-6">Pending Transactions</h3>
            {wallet.transactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">📝</span>
                </div>
                <p className="text-gray-500 text-lg">No transactions to sign</p>
                <p className="text-gray-400 text-sm mt-1">Transactions will appear here when created</p>
              </div>
            ) : (
              <div className="space-y-4">
                {wallet.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                      selectedTransaction?.id === transaction.id
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    }`}
                    onClick={() => setSelectedTransaction(transaction)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <span className="text-base font-semibold text-gray-900">
                            To: {transaction.to.slice(0, 8)}...
                          </span>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-400">Amount: <span className="text-gray-600 font-medium">{transaction.amount} XLM</span></p>
                          {transaction.memo && <p className="text-gray-400">Memo: <span className="text-gray-600">{transaction.memo}</span></p>}
                          <p className="text-gray-400">Signatures: <span className="text-gray-900 font-medium">{transaction.signatureShares.length}/{wallet.config.threshold}</span></p>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-xs text-gray-500">ID: {transaction.id.slice(0, 8)}...</p>
                        {transaction.stellarTxId && (
                          <p className="text-xs text-green-600 font-medium">Stellar TX: {transaction.stellarTxId.slice(0, 8)}...</p>
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
            <div className="border-t border-gray-200 pt-8">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Sign Selected Transaction</h3>

              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Transaction Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 block mb-1">To:</span>
                    <span className="text-gray-400 font-mono break-all">{selectedTransaction.to}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block mb-1">Amount:</span>
                    <span className="text-gray-400 font-medium">{selectedTransaction.amount} XLM</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block mb-1">Memo:</span>
                    <span className="text-gray-900">{selectedTransaction.memo || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600 block mb-1">Status:</span>
                    <span className="text-gray-900 capitalize">{selectedTransaction.status}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-600 block mb-1">Signatures:</span>
                    <span className="text-gray-900 font-medium">{selectedTransaction.signatureShares.length}/{wallet.config.threshold}</span>
                  </div>
                </div>
              </div>

              {/* Participant Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Select Your Participant *
                </label>
                <select
                  value={selectedParticipant?.id || ''}
                  onChange={(e) => {
                    const participant = wallet.participants.find(p => p.id === e.target.value);
                    setSelectedParticipant(participant || null);
                  }}
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                >
                  <option value="" className="text-gray-500">Choose your participant...</option>
                  {wallet.participants.filter(p => p.keyShare).map((participant) => (
                    <option key={participant.id} value={participant.id} className="text-gray-900">
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
                  className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-xl text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600 transition-all duration-200 shadow-lg"
                >
                  {signing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Signing...
                    </>
                  ) : (
                    'Sign Transaction'
                  )}
                </button>
              </div>

              {selectedTransaction.status === 'signed' && (
                <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-green-600 text-lg">✓</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-green-800 mb-2">
                        Transaction Signed!
                      </h3>
                      <div className="text-sm text-green-700">
                        <p>This transaction has enough signatures and will be submitted to the Stellar network automatically.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedTransaction.status === 'submitted' && (
                <div className="mt-6 bg-purple-50 border border-purple-200 rounded-xl p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-purple-600 text-lg">🚀</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-purple-800 mb-2">
                        Transaction Submitted!
                      </h3>
                      <div className="text-sm text-purple-700">
                        <p>Transaction has been submitted to Stellar. TX ID: <span className="font-mono text-purple-900">{selectedTransaction.stellarTxId}</span></p>
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