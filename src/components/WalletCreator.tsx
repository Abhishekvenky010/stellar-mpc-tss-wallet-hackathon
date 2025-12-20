'use client';

import { useState } from 'react';
import { StellarTSSWallet } from '@/lib/tss/wallet';
import { TSSWallet } from '@/lib/tss/types';
import { serializeWallets } from '@/lib/utils';

interface WalletCreatorProps {
  onWalletCreated: (wallet: TSSWallet) => void;
}

export default function WalletCreator({ onWalletCreated }: WalletCreatorProps) {
  const [participantIds, setParticipantIds] = useState<string[]>(['alice', 'bob', 'charlie']);
  const [threshold, setThreshold] = useState<number>(2);
  const [network, setNetwork] = useState<'mainnet' | 'testnet' | 'futurenet'>('testnet');
  const [creating, setCreating] = useState(false);

  const addParticipant = () => {
    setParticipantIds([...participantIds, `participant${participantIds.length + 1}`]);
  };

  const removeParticipant = (index: number) => {
    if (participantIds.length > 2) {
      setParticipantIds(participantIds.filter((_, i) => i !== index));
    }
  };

  const updateParticipant = (index: number, value: string) => {
    const newParticipants = [...participantIds];
    newParticipants[index] = value;
    setParticipantIds(newParticipants);
  };

  const handleCreateWallet = async () => {
    if (participantIds.length < 2) {
      alert('Need at least 2 participants');
      return;
    }

    if (threshold > participantIds.length) {
      alert('Threshold cannot be greater than number of participants');
      return;
    }

    setCreating(true);

    try {
      const walletInstance = new StellarTSSWallet(network);
      const wallet = await walletInstance.createWallet(participantIds, threshold, network);

      // Save to localStorage for demo
      const savedWallets = JSON.parse(localStorage.getItem('tss-wallets') || '[]');
      savedWallets.push(wallet);
      try {
        localStorage.setItem('tss-wallets', serializeWallets(savedWallets));
      } catch (error) {
        console.warn('Failed to save wallets to localStorage:', error);
      }

      onWalletCreated(wallet);
    } catch (error) {
      console.error('Failed to create wallet:', error);
      alert('Failed to create wallet. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-0">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Create TSS Wallet</h2>
          <p className="text-gray-600">Set up your multi-party cryptographic wallet</p>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-8 space-y-8 border border-gray-200">
          {/* Network Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as any)}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
              <option value="futurenet">Futurenet</option>
            </select>
          </div>

          {/* Threshold */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Signature Threshold ({threshold}-of-{participantIds.length})
            </label>
            <input
              type="range"
              min="1"
              max={participantIds.length}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full h-3 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb"
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>1</span>
              <span>{participantIds.length}</span>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-700 uppercase tracking-wide">
                Participants
              </label>
              <button
                onClick={addParticipant}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-gray-50 hover:bg-gray-100 transition-all duration-200"
              >
                + Add Participant
              </button>
            </div>

            <div className="space-y-3">
              {participantIds.map((participant, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={participant}
                      onChange={(e) => updateParticipant(index, e.target.value)}
                      placeholder={`Participant ${index + 1}`}
                      className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                  {participantIds.length > 2 && (
                    <button
                      onClick={() => removeParticipant(index)}
                      className="inline-flex items-center px-3 py-3 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-gray-50 hover:bg-gray-100 transition-all duration-200"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 text-lg">🔐</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  MPC/TSS Wallet Features
                </h3>
                <div className="text-sm text-gray-600 space-y-2">
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span>Distributed key generation with secret sharing</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span>Threshold signatures ({threshold}-of-{participantIds.length} required)</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span>No single point of failure</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-600 mr-2">✓</span>
                    <span>Secure key share distribution</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleCreateWallet}
              disabled={creating}
              className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 transition-all duration-200 shadow-lg"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Creating...
                </>
              ) : (
                'Create TSS Wallet'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}