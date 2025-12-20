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
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-blue-900 mb-6">Create TSS Wallet</h2>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Network Selection */}
          <div>
            <label className="block text-sm font-medium text-blue-700 mb-2">
              Network
            </label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value as any)}
              className="mt-1 block w-full rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-black"
            >
              <option value="testnet">Testnet</option>
              <option value="mainnet">Mainnet</option>
              <option value="futurenet">Futurenet</option>
            </select>
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-sm font-medium text-blue-700 mb-2">
              Signature Threshold ({threshold}-of-{participantIds.length})
            </label>
            <input
              type="range"
              min="1"
              max={participantIds.length}
              value={threshold}
              onChange={(e) => setThreshold(parseInt(e.target.value))}
              className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-black mt-1">
              <span>1</span>
              <span>{participantIds.length}</span>
            </div>
          </div>

          {/* Participants */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-blue-700">
                Participants
              </label>
              <button
                onClick={addParticipant}
                className="inline-flex items-center px-3 py-1 border border-transparent text-sm font-medium rounded-md text-black bg-gray-100 hover:bg-gray-200"
              >
                + Add Participant
              </button>
            </div>

            <div className="space-y-2">
              {participantIds.map((participant, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={participant}
                    onChange={(e) => updateParticipant(index, e.target.value)}
                    placeholder={`Participant ${index + 1}`}
                    className="flex-1 rounded-md border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 placeholder-black"
                  />
                  {participantIds.length > 2 && (
                    <button
                      onClick={() => removeParticipant(index)}
                      className="inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  MPC/TSS Wallet Features
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Distributed key generation with secret sharing</li>
                    <li>Threshold signatures ({threshold}-of-{participantIds.length} required)</li>
                    <li>No single point of failure</li>
                    <li>Secure key share distribution</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Create Button */}
          <div className="flex justify-end">
            <button
              onClick={handleCreateWallet}
              disabled={creating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? 'Creating...' : 'Create TSS Wallet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}