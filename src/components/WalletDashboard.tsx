'use client';

import { useState, useEffect } from 'react';
import { TSSWallet } from '@/lib/tss/types';
import { loadWallets, storeWallets, exportData, importData, clearStoredData } from '@/lib/storage';
import ParticipantShareExport from '@/components/ParticipantShareExport';
import ParticipantShareImport from '@/components/ParticipantShareImport';
import NetworkConnection from '@/components/NetworkConnection';
import DeviceManager from '@/components/DeviceManager';

interface WalletDashboardProps {
  onWalletSelect: (wallet: TSSWallet) => void;
}

export default function WalletDashboard({ onWalletSelect }: WalletDashboardProps) {
  const [wallets, setWallets] = useState<TSSWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWalletDetails, setSelectedWalletDetails] = useState<TSSWallet | null>(null);
  const [showShareExport, setShowShareExport] = useState<TSSWallet | null>(null);
  const [showShareImport, setShowShareImport] = useState(false);
  const [showDeviceManager, setShowDeviceManager] = useState(false);
  const [deviceManagerWallet, setDeviceManagerWallet] = useState<TSSWallet | null>(null);

  useEffect(() => {
    // Load wallets from secure storage
    loadWallets().then(loadedWallets => {
      setWallets(loadedWallets);
      setLoading(false);
    }).catch(error => {
      console.error('Failed to load wallets:', error);
      setLoading(false);
    });
  }, []);

  const saveWallets = async (newWallets: TSSWallet[]) => {
    setWallets(newWallets);
    try {
      await storeWallets(newWallets);
    } catch (error) {
      console.warn('Failed to save wallets:', error);
      // For demo, try to save just the latest wallet if storage fails
      if (newWallets.length > 0) {
        try {
          await storeWallets(newWallets.slice(-1));
        } catch (e) {
          console.warn('Still failed to save wallets');
        }
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-300 text-lg">Loading wallets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-4xl font-bold gradient-text text-glow mb-2">Your TSS Wallets</h2>
            <p className="text-gray-400 mt-1">Manage your multi-party cryptographic wallets</p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowShareImport(true)}
              className="btn-accent px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center space-x-2"
            >
              <span>🔗</span>
              <span>Import Share</span>
            </button>
            <button
              onClick={() => {
                const data = exportData();
                if (data) {
                  const blob = new Blob([data], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `stellar-mpc-backup-${new Date().toISOString().split('T')[0]}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }
              }}
              className="btn-secondary px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center space-x-2"
            >
              <span>📤</span>
              <span>Export</span>
            </button>
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) {
                    try {
                      const text = await file.text();
                      importData(text);
                      // Reload wallets
                      const loadedWallets = await loadWallets();
                      setWallets(loadedWallets);
                    } catch (error) {
                      alert('Failed to import backup: ' + (error as Error).message);
                    }
                  }
                };
                input.click();
              }}
              className="btn-accent px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center space-x-2"
            >
              <span>📥</span>
              <span>Import</span>
            </button>
          </div>
        </div>

        {wallets.length === 0 ? (
          <div className="text-center py-16">
            <div className="card rounded-2xl p-12 max-w-md mx-auto">
              <div className="w-20 h-20 gradient-bg rounded-full flex items-center justify-center mx-auto mb-6 glow">
                <span className="text-4xl">🔐</span>
              </div>
              <h3 className="text-2xl font-bold gradient-text mb-4">No wallets found</h3>
              <p className="text-gray-400 mb-8">Create your first MPC/TSS wallet to get started with secure distributed cryptography</p>
              <button className="btn-primary px-8 py-3 text-white font-medium rounded-lg text-lg">
                Create Your First Wallet
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {wallets.map((wallet, index) => (
              <div
                key={index}
                className="wallet-card rounded-xl overflow-hidden cursor-pointer"
                onClick={() => setSelectedWalletDetails(wallet)}
              >
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <div className="shrink-0">
                      <div className="w-14 h-14 gradient-bg rounded-xl flex items-center justify-center shadow-lg glow">
                        <span className="text-white font-bold text-xl">
                          {wallet.config.threshold}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-xl font-semibold text-white">
                        TSS Wallet #{index + 1}
                      </h3>
                      <p className="text-gray-400 text-sm">
                        {wallet.config.threshold}-of-{wallet.participants.length} threshold
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400 text-sm">Public Key</span>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500 font-mono text-sm">
                          {wallet.config.publicKey.toString().slice(0, 8)}...
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(wallet.config.publicKey.toString());
                          }}
                          className="text-gray-500 hover:text-white transition-colors text-xs"
                          title="Copy full public key"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400 text-sm">Network</span>
                      <span className="text-white text-sm capitalize">{wallet.config.network}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-white/10">
                      <span className="text-gray-400 text-sm">Participants</span>
                      <span className="text-white text-sm">{wallet.participants.length}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-gray-400 text-sm">Transactions</span>
                      <span className="text-white text-sm">{wallet.transactions.length}</span>
                    </div>

                    {wallet.transactions.length > 0 && (
                      <div className="mt-4 p-3 bg-white/5 rounded-lg">
                        <p className="text-xs text-gray-500 mb-2">Transaction Status</p>
                        <div className="flex justify-between text-xs">
                          <span className="text-yellow-400">
                            Pending: {wallet.transactions.filter(t => t.status === 'pending' || t.status === 'collecting').length}
                          </span>
                          <span className="text-blue-400">
                            Signed: {wallet.transactions.filter(t => t.status === 'signed').length}
                          </span>
                          <span className="text-green-400">
                            Submitted: {wallet.transactions.filter(t => t.status === 'submitted').length}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex justify-between items-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                      <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
                      Active
                    </span>
                    <div className="flex space-x-3">
                      {wallet.config.network === 'testnet' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const friendbotUrl = `https://friendbot.stellar.org?addr=${encodeURIComponent(wallet.config.publicKey.toString())}`;
                            window.open(friendbotUrl, '_blank');
                          }}
                          className="text-orange-400 hover:text-orange-300 text-sm font-medium transition-colors"
                          title="Fund with Friendbot (Testnet only)"
                        >
                          💰 Fund
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowShareExport(wallet);
                        }}
                        className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                        title="Export participant shares for multi-device signing"
                      >
                        🔗 Share
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWalletDetails(wallet);
                        }}
                        className="text-blue-400 hover:text-blue-300 text-sm font-medium transition-colors"
                      >
                        View Details →
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeviceManagerWallet(wallet);
                          setShowDeviceManager(true);
                        }}
                        className="text-green-400 hover:text-green-300 text-sm font-medium transition-colors"
                        title="Manage devices and refresh shares"
                      >
                        📱 Devices
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Wallet Details Modal/View */}
        {selectedWalletDetails && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="card rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold gradient-text">Wallet Details</h2>
                  <button
                    onClick={() => setSelectedWalletDetails(null)}
                    className="text-gray-400 hover:text-white text-3xl transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Wallet Overview */}
                <div className="card rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-3xl font-bold gradient-text">{selectedWalletDetails.config.threshold}</div>
                      <div className="text-sm text-gray-400 mt-1">Threshold</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-3xl font-bold gradient-text-secondary">{selectedWalletDetails.participants.length}</div>
                      <div className="text-sm text-gray-400 mt-1">Participants</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-3xl font-bold gradient-text-accent">{selectedWalletDetails.transactions.length}</div>
                      <div className="text-sm text-gray-400 mt-1">Transactions</div>
                    </div>
                    <div className="text-center p-4 bg-white/5 rounded-lg">
                      <div className="text-3xl font-bold text-green-400 capitalize">{selectedWalletDetails.config.network}</div>
                      <div className="text-sm text-gray-400 mt-1">Network</div>
                    </div>
                  </div>
                </div>

                {/* Public Key */}
                <div className="card rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Group Public Key</h3>
                  <div className="bg-white/5 border border-white/10 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <code className="text-sm text-gray-300 font-mono break-all">
                        {selectedWalletDetails.config.publicKey.toString()}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(selectedWalletDetails.config.publicKey.toString());
                        }}
                        className="ml-4 text-gray-400 hover:text-white transition-colors"
                        title="Copy public key"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  {selectedWalletDetails.config.network === 'testnet' && (
                    <div className="mt-4">
                      <button
                        onClick={() => {
                          const friendbotUrl = `https://friendbot.stellar.org?addr=${encodeURIComponent(selectedWalletDetails.config.publicKey.toString())}`;
                          window.open(friendbotUrl, '_blank');
                        }}
                        className="btn-secondary inline-flex items-center px-4 py-2 text-white text-sm font-medium rounded-lg"
                      >
                        💰 Fund with Friendbot
                      </button>
                    </div>
                  )}
                </div>

                {/* Participants */}
                <div className="card rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Participants</h3>
                  <div className="space-y-3">
                    {selectedWalletDetails.participants.map((participant, index) => (
                      <div key={participant.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-blue-500/50 transition-colors">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium text-white">{participant.id}</div>
                            <div className="text-sm text-gray-500">
                              Share #{participant.keyShare?.index ?? 'Not assigned'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Public Key</div>
                            <div className="text-xs text-gray-400 font-mono">
                              {participant.publicKey.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() => setSelectedWalletDetails(null)}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      onWalletSelect(selectedWalletDetails);
                      setSelectedWalletDetails(null);
                    }}
                    className="btn-primary px-6 py-2 text-white rounded-lg"
                  >
                    Use This Wallet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Participant Share Export Modal */}
        {showShareExport && (
          <ParticipantShareExport
            wallet={showShareExport}
            onClose={() => setShowShareExport(null)}
          />
        )}

        {/* Participant Share Import Modal */}
        {showShareImport && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold gradient-text">Import Participant Share</h2>
                  <button
                    onClick={() => setShowShareImport(false)}
                    className="text-gray-400 hover:text-white text-3xl transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="p-6">
                <ParticipantShareImport
                  onParticipantImported={(participant) => {
                    console.log('Imported participant:', participant);
                    setShowShareImport(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Device Management Modal */}
        {showDeviceManager && deviceManagerWallet && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="card rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-white/10">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-2xl font-bold gradient-text">Device Management</h2>
                    <p className="text-gray-400 text-sm mt-1">
                      Manage devices and refresh shares for {deviceManagerWallet.participants.length}-participant wallet
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDeviceManager(false);
                      setDeviceManagerWallet(null);
                    }}
                    className="text-gray-400 hover:text-white text-3xl transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="p-6">
                <DeviceManager
                  walletId={`wallet_${deviceManagerWallet.config.publicKey.slice(0, 16)}`}
                  currentDeviceId={`device_${Date.now()}`}
                  currentParticipantId={1}
                  mpcManager={new (require('@/lib/mpc-communication').MPC通信管理器)()}
                  onDeviceAdded={(device) => {
                    console.log('Device added:', device);
                  }}
                  onDeviceRemoved={(deviceId) => {
                    console.log('Device removed:', deviceId);
                  }}
                  onRefreshCompleted={() => {
                    console.log('Share refresh completed');
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
