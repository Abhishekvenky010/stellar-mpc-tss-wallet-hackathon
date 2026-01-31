'use client';

import { useState } from 'react';
import { StellarTSSWallet } from '@/lib/tss/wallet';
import { TSSWallet } from '@/lib/tss/types';
import { storeWallets, loadWallets } from '@/lib/storage';

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
    console.log('=== handleCreateWallet clicked ===');
    console.log('Participants:', participantIds);
    console.log('Threshold:', threshold);
    console.log('Network:', network);

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

      // Save to secure storage
      const existingWallets = await loadWallets();
      const updatedWallets = [...existingWallets, wallet];
      try {
        await storeWallets(updatedWallets);
      } catch (error) {
        console.warn('Failed to save wallet:', error);
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
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold gradient-text text-glow mb-2">Create TSS Wallet</h2>
          <p className="text-gray-400">Set up your multi-party cryptographic wallet</p>
        </div>

        <div className="card shadow-lg rounded-xl p-8 space-y-8">
          {/* Network Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as any)}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 input-field"
            >
              <option value="testnet" className="bg-gray-800">Testnet</option>
              <option value="mainnet" className="bg-gray-800">Mainnet</option>
              <option value="futurenet" className="bg-gray-800">Futurenet</option>
            </select>
          </div>

          {/* Threshold */}
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Signature Threshold ({threshold}-of-{participantIds.length})
            </label>
            <div className="relative">
              <input
                type="range"
                min="1"
                max={participantIds.length}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value))}
                className="w-full h-3 bg-white/10 rounded-lg appearance-none cursor-pointer slider-thumb"
                style={{
                  background: `linear-gradient(to right, #667eea 0%, #667eea ${((threshold - 1) / (participantIds.length - 1)) * 100}%, rgba(255,255,255,0.1) ${((threshold - 1) / (participantIds.length - 1)) * 100}%, rgba(255,255,255,0.1) 100%)`
                }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>1</span>
              <span className="text-white font-medium">{threshold} required</span>
              <span>{participantIds.length}</span>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-300 uppercase tracking-wide">
                Participants
              </label>
              <button
                onClick={addParticipant}
                className="btn-accent inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg"
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
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 input-field"
                    />
                  </div>
                  {participantIds.length > 2 && (
                    <button
                      onClick={() => removeParticipant(index)}
                      className="inline-flex items-center px-3 py-3 border border-red-500/30 text-red-400 hover:text-red-300 hover:border-red-500/50 rounded-lg transition-all duration-200"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center glow">
                  <span className="text-white text-xl">🔐</span>
                </div>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-white mb-3">
                  MPC/TSS Wallet Features
                </h3>
                <div className="text-sm text-gray-400 space-y-2">
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>Distributed key generation with secret sharing</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>Threshold signatures ({threshold}-of-{participantIds.length} required)</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
                    <span>No single point of failure</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-400 mr-2">✓</span>
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
              className="inline-flex items-center px-8 py-4 border border-transparent text-base font-semibold rounded-xl text-white btn-primary disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none shadow-lg"
            >
              {creating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                  Creating...
                </>
              ) : (
                '✨ Create TSS Wallet'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
