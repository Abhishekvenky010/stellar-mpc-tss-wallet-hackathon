'use client';

import { useState } from 'react';
import { TSSWallet, TSSParticipant } from '@/lib/tss/types';
import { 
  ParticipantSharePackage, 
  exportParticipantShare, 
  exportParticipantShareAsString,
  generateShareableLink,
  downloadSharePackage,
  copySharePackageToClipboard 
} from '@/lib/participant-share';

interface ParticipantShareExportProps {
  wallet: TSSWallet;
  onClose: () => void;
}

export default function ParticipantShareExport({ wallet, onClose }: ParticipantShareExportProps) {
  const [selectedParticipant, setSelectedParticipant] = useState<string>('');
  const [sharePackage, setSharePackage] = useState<ParticipantSharePackage | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  const handleExport = () => {
    if (!selectedParticipant) return;
    
    const sharePackage = exportParticipantShare(wallet, selectedParticipant);
    if (sharePackage) {
      setSharePackage(sharePackage);
    } else {
      alert('Failed to export participant share. Make sure the participant has a key share.');
    }
  };

  const handleCopy = async () => {
    if (!sharePackage) return;
    
    const success = await copySharePackageToClipboard(sharePackage);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!sharePackage) return;
    downloadSharePackage(sharePackage);
  };

  const handleGenerateLink = () => {
    if (!sharePackage) return;
    const link = generateShareableLink(sharePackage);
    navigator.clipboard.writeText(link).then(() => {
      alert('Shareable link copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy link');
    });
  };

  const participantsWithShares = wallet.participants.filter(p => p.keyShare);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="card rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-white/10">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold gradient-text">Participant Share Management</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-3xl transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Tabs */}
          <div className="flex space-x-2 mb-6">
            <button
              onClick={() => setActiveTab('export')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'export'
                  ? 'btn-primary text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              📤 Export Share
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'import'
                  ? 'btn-primary text-white'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              📥 Import Share
            </button>
          </div>

          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Participant Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-3">
                  Select Participant to Export
                </label>
                <select
                  value={selectedParticipant}
                  onChange={(e) => {
                    setSelectedParticipant(e.target.value);
                    setSharePackage(null);
                  }}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white input-field"
                >
                  <option value="" className="bg-gray-800">Choose a participant...</option>
                  {participantsWithShares.map((participant) => (
                    <option 
                      key={participant.id} 
                      value={participant.id}
                      className="bg-gray-800"
                    >
                      {participant.id} (Share #{participant.keyShare?.index})
                    </option>
                  ))}
                </select>
              </div>

              {/* Export Button */}
              <button
                onClick={handleExport}
                disabled={!selectedParticipant}
                className="btn-primary px-6 py-3 text-white rounded-lg w-full disabled:opacity-50"
              >
                Generate Share Package
              </button>

              {/* Share Package Display */}
              {sharePackage && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-xl p-6">
                    <div className="flex items-center mb-4">
                      <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                        <span className="text-green-400 text-xl">✓</span>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-lg font-semibold text-green-400">Share Package Ready</h3>
                        <p className="text-sm text-gray-400">
                          Valid until: {new Date(sharePackage.expiresAt).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-lg p-4 mb-4">
                      <div className="text-sm text-gray-400 space-y-2">
                        <p><span className="text-gray-500">Participant:</span> <span className="text-white">{sharePackage.participantId}</span></p>
                        <p><span className="text-gray-500">Wallet:</span> <span className="text-white font-mono">{sharePackage.walletPublicKey.slice(0, 16)}...</span></p>
                        <p><span className="text-gray-500">Share Index:</span> <span className="text-white">{sharePackage.keyShareIndex}</span></p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={handleCopy}
                        className="btn-secondary px-4 py-2 text-white rounded-lg flex items-center space-x-2"
                      >
                        <span>{copied ? '✓ Copied!' : '📋 Copy'}</span>
                      </button>
                      <button
                        onClick={handleDownload}
                        className="btn-accent px-4 py-2 text-white rounded-lg flex items-center space-x-2"
                      >
                        <span>💾 Download</span>
                      </button>
                      <button
                        onClick={handleGenerateLink}
                        className="btn-primary px-4 py-2 text-white rounded-lg flex items-center space-x-2"
                      >
                        <span>🔗 Copy Link</span>
                      </button>
                    </div>
                  </div>

                  {/* Raw JSON */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Raw Share Package (JSON)
                    </label>
                    <textarea
                      readOnly
                      value={JSON.stringify(sharePackage, null, 2)}
                      className="w-full h-48 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-xs input-field"
                    />
                  </div>
                </div>
              )}

              {/* Info */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-amber-400 text-sm">
                  ⚠️ <strong>Security Warning:</strong> This share package contains cryptographic key material.
                  Share it only through secure channels (encrypted messaging, secure email, or in-person).
                  The package expires in 24 hours for added security.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div>
              <p className="text-gray-400 mb-4">
                Import a participant share package to enable signing from this device.
              </p>
              <ParticipantShareImportWrapper wallet={wallet} onClose={onClose} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Wrapper component for import functionality
function ParticipantShareImportWrapper({ 
  wallet, 
  onClose 
}: { 
  wallet: TSSWallet; 
  onClose: () => void;
}) {
  const [importedParticipants, setImportedParticipants] = useState<TSSParticipant[]>([]);

  const handleImported = (participant: TSSParticipant) => {
    setImportedParticipants([...importedParticipants, participant]);
  };

  return (
    <div className="space-y-4">
      <div className="card rounded-xl p-4 bg-white/5">
        <textarea
          id="import-textarea"
          placeholder="Paste participant share JSON here..."
          className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 input-field font-mono text-sm"
        />
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              const textarea = document.getElementById('import-textarea') as HTMLTextAreaElement;
              if (textarea?.value) {
                try {
                  const packageData = JSON.parse(textarea.value);
                  const { importParticipantShare } = require('@/lib/participant-share');
                  const participant = importParticipantShare(packageData, wallet.config.publicKey);
                  if (participant) {
                    handleImported(participant);
                    alert(`Successfully imported: ${participant.id}`);
                  } else {
                    alert('Failed to import participant');
                  }
                } catch (error) {
                  alert('Invalid JSON format');
                }
              }
            }}
            className="btn-primary px-6 py-2 text-white rounded-lg"
          >
            Import
          </button>
        </div>
      </div>

      {importedParticipants.length > 0 && (
        <div className="card rounded-xl p-4 bg-green-500/10 border border-green-500/20">
          <h4 className="text-green-400 font-semibold mb-2">Imported Participants:</h4>
          <ul className="text-sm text-gray-300">
            {importedParticipants.map((p) => (
              <li key={p.id}>✓ {p.id}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
