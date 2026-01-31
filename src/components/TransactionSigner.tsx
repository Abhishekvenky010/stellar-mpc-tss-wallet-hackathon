'use client';

import { useState } from 'react';
import { TSSWallet, TSSTransaction, TSSParticipant } from '@/lib/tss/types';
import { StellarTSSWallet } from '@/lib/tss/wallet';
import { storeWallets, loadWallets } from '@/lib/storage';
import MPCSimulator from './MPCSimulator';

interface TransactionSignerProps {
  wallet: TSSWallet;
  onTransactionSigned: () => void;
}

export default function TransactionSigner({ wallet, onTransactionSigned }: TransactionSignerProps) {
  const [selectedTransaction, setSelectedTransaction] = useState<TSSTransaction | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<TSSParticipant | null>(null);
  const [signing, setSigning] = useState(false);
  const [signingMode, setSigningMode] = useState<'traditional' | 'mpc'>('traditional');

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
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      case 'collecting': return 'bg-blue-500/20 text-blue-400 border border-blue-500/30';
      case 'signed': return 'bg-green-500/20 text-green-400 border border-green-500/30';
      case 'submitted': return 'bg-purple-500/20 text-purple-400 border border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold gradient-text text-glow mb-2">Sign Transactions</h2>
          <p className="text-gray-400">Add your signature to pending TSS transactions</p>
        </div>

        <div className="card shadow-lg rounded-xl p-8 space-y-8">
          {/* Wallet Info */}
          <div className="bg-gradient-to-br from-white/5 to-white/10 rounded-lg p-6 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Wallet Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Public Key:</span>
                <span className="text-gray-300 font-mono">{wallet.config.publicKey.toString().slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Threshold:</span>
                <span className="text-white">{wallet.config.threshold}-of-{wallet.participants.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network:</span>
                <span className="text-white capitalize">{wallet.config.network}</span>
              </div>
            </div>
          </div>

          {/* Signing Mode Selection */}
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Choose Signing Method</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setSigningMode('traditional')}
                className={`p-4 border-2 rounded-xl text-left transition-all duration-300 ${
                  signingMode === 'traditional'
                    ? 'border-blue-500 bg-blue-500/20 glow'
                    : 'border-white/10 hover:border-white/30 bg-white/5'
                }`}
              >
                <div className="font-semibold text-white text-lg">🔐 Traditional Signing</div>
                <div className="text-sm text-gray-400 mt-1">
                  Sign as a single participant using your key share
                </div>
              </button>
              <button
                onClick={() => setSigningMode('mpc')}
                className={`p-4 border-2 rounded-xl text-left transition-all duration-300 ${
                  signingMode === 'mpc'
                    ? 'border-purple-500 bg-purple-500/20 glow'
                    : 'border-white/10 hover:border-white/30 bg-white/5'
                }`}
              >
                <div className="font-semibold text-white text-lg">🚀 MPC Simulation</div>
                <div className="text-sm text-gray-400 mt-1">
                  Experience real multi-party computation across browser tabs
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Rendering Based on Mode */}
          {signingMode === 'mpc' && selectedTransaction ? (
            <MPCSimulator
              wallet={wallet}
              transaction={selectedTransaction}
              onSigningComplete={onTransactionSigned}
            />
          ) : (
            <>

          {/* Transaction List */}
          <div>
            <h3 className="text-xl font-semibold text-white mb-6">Pending Transactions</h3>
            {wallet.transactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-20 h-20 gradient-bg rounded-full flex items-center justify-center mx-auto mb-4 glow">
                  <span className="text-4xl">📝</span>
                </div>
                <p className="text-gray-300 text-lg">No transactions to sign</p>
                <p className="text-gray-500 text-sm mt-1">Transactions will appear here when created</p>
              </div>
            ) : (
              <div className="space-y-4">
                {wallet.transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-300 ${
                      selectedTransaction?.id === transaction.id
                        ? 'border-blue-500 bg-blue-500/10 shadow-lg glow'
                        : 'border-white/10 hover:border-white/30 bg-white/5 hover:bg-white/10'
                    }`}
                    onClick={() => setSelectedTransaction(transaction)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <span className="text-base font-semibold text-white">
                            To: {transaction.to.slice(0, 8)}...
                          </span>
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                            {transaction.status}
                          </span>
                        </div>
                        <div className="space-y-1 text-sm">
                          <p className="text-gray-400">Amount: <span className="text-white font-medium">{transaction.amount} XLM</span></p>
                          {transaction.memo && <p className="text-gray-400">Memo: <span className="text-gray-300">{transaction.memo}</span></p>}
                          <p className="text-gray-400">Signatures: <span className="text-white font-medium">{transaction.signatureShares.length}/{wallet.config.threshold}</span></p>
                          {/* Status indicators */}
                          <div className="flex items-center space-x-4 mt-2">
                            <div className="flex items-center space-x-1">
                              <div className={`w-2 h-2 rounded-full ${transaction.signatureShares.length > 0 ? 'bg-green-400 animate-pulse' : 'bg-gray-600'}`}></div>
                              <span className="text-xs text-gray-500">Round 1</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className={`w-2 h-2 rounded-full ${transaction.signatureShares.length >= wallet.config.threshold ? 'bg-green-400 animate-pulse' : transaction.signatureShares.length > 0 ? 'bg-yellow-400 animate-pulse' : 'bg-gray-600'}`}></div>
                              <span className="text-xs text-gray-500">Round 2</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <div className={`w-2 h-2 rounded-full ${transaction.status === 'submitted' ? 'bg-green-400 animate-pulse' : transaction.status === 'signed' ? 'bg-blue-400 animate-pulse' : 'bg-gray-600'}`}></div>
                              <span className="text-xs text-gray-500">Done</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right space-y-1">
                        <p className="text-xs text-gray-500">ID: {transaction.id.slice(0, 8)}...</p>
                        {transaction.stellarTxId && (
                          <p className="text-xs text-green-400 font-medium">Stellar TX: {transaction.stellarTxId.slice(0, 8)}...</p>
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
            <div className="border-t border-white/10 pt-8">
              <h3 className="text-xl font-semibold text-white mb-6">Sign Selected Transaction</h3>

              <div className="bg-gradient-to-br from-white/5 to-white/10 rounded-xl p-6 mb-6 border border-white/10">
                <h4 className="text-lg font-semibold text-white mb-4">Transaction Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400 block mb-1">To:</span>
                    <span className="text-gray-300 font-mono break-all">{selectedTransaction.to}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-1">Amount:</span>
                    <span className="text-white font-medium">{selectedTransaction.amount} XLM</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-1">Memo:</span>
                    <span className="text-gray-300">{selectedTransaction.memo || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block mb-1">Status:</span>
                    <span className="text-white capitalize">{selectedTransaction.status}</span>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-400 block mb-1">Signatures:</span>
                    <span className="text-white font-medium">{selectedTransaction.signatureShares.length}/{wallet.config.threshold}</span>
                  </div>
                </div>
              </div>

              {/* Participant Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Select Your Participant *
                </label>
                <select
                  value={selectedParticipant?.id || ''}
                  onChange={(e) => {
                    const participant = wallet.participants.find(p => p.id === e.target.value);
                    setSelectedParticipant(participant || null);
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 input-field"
                >
                  <option value="" className="text-gray-500 bg-gray-800">Choose your participant...</option>
                  {wallet.participants.filter(p => p.keyShare).map((participant) => (
                    <option key={participant.id} value={participant.id} className="text-white bg-gray-800">
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
                  className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-xl text-white btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none shadow-lg"
                >
                  {signing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Signing...
                    </>
                  ) : (
                    '✍️ Sign Transaction'
                  )}
                </button>
              </div>

              {selectedTransaction.status === 'signed' && (
                <div className="mt-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <span className="text-green-400 text-xl">✓</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-green-400 mb-2">
                        Transaction Signed!
                      </h3>
                      <div className="text-sm text-gray-400">
                        <p>This transaction has enough signatures and will be submitted to the Stellar network automatically.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedTransaction.status === 'submitted' && (
                <div className="mt-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-6">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <span className="text-purple-400 text-xl">🚀</span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-purple-400 mb-2">
                        Transaction Submitted!
                      </h3>
                      <div className="text-sm text-gray-400">
                        <p>Transaction has been submitted to Stellar.</p>
                        <p className="mt-2">
                          TX ID: <span className="font-mono text-purple-300">{selectedTransaction.stellarTxId}</span>
                        </p>
                        <div className="mt-3 flex space-x-2">
                          <a
                            href={`https://stellar.expert/explorer/${wallet.config.network}/tx/${selectedTransaction.stellarTxId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1 text-xs font-medium text-purple-400 bg-purple-500/20 rounded-md hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                          >
                            View on Stellar Expert →
                          </a>
                          {wallet.config.network === 'testnet' && (
                            <a
                              href={`https://horizon-testnet.stellar.org/transactions/${selectedTransaction.stellarTxId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1 text-xs font-medium text-purple-400 bg-purple-500/20 rounded-md hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                            >
                              View on Horizon →
                            </a>
                          )}
                          {wallet.config.network === 'mainnet' && (
                            <a
                              href={`https://horizon.stellar.org/transactions/${selectedTransaction.stellarTxId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-3 py-1 text-xs font-medium text-purple-400 bg-purple-500/20 rounded-md hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                            >
                              View on Horizon →
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
