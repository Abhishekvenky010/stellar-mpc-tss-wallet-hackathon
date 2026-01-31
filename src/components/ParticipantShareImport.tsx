'use client';

import { useState, useEffect } from 'react';
import { TSSParticipant } from '@/lib/tss/types';
import { 
  ParticipantSharePackage, 
  importParticipantShare, 
  validateSharePackage,
  getSharePackageFromURL,
  downloadSharePackage,
  copySharePackageToClipboard 
} from '@/lib/participant-share';

interface ParticipantShareImportProps {
  onParticipantImported: (participant: TSSParticipant) => void;
  expectedWalletPublicKey?: string;
}

export default function ParticipantShareImport({ 
  onParticipantImported, 
  expectedWalletPublicKey 
}: ParticipantShareImportProps) {
  const [importData, setImportData] = useState<string>('');
  const [importResult, setImportResult] = useState<{ success: boolean; message: string; participant?: TSSParticipant } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [urlPackage, setUrlPackage] = useState<ParticipantSharePackage | null>(null);

  // Check for share package in URL on mount
  useEffect(() => {
    const packageFromUrl = getSharePackageFromURL();
    if (packageFromUrl) {
      setUrlPackage(packageFromUrl);
      // Optionally auto-import
      handleImportFromUrl(packageFromUrl);
    }
  }, []);

  const handleImportFromUrl = (packageData: ParticipantSharePackage) => {
    setIsLoading(true);
    try {
      const participant = importParticipantShare(packageData, expectedWalletPublicKey);
      if (participant) {
        setImportResult({
          success: true,
          message: `Successfully imported participant: ${participant.id}`,
          participant
        });
        onParticipantImported(participant);
      } else {
        setImportResult({
          success: false,
          message: 'Failed to import participant share. Please check the data and try again.'
        });
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextImport = () => {
    if (!importData.trim()) return;
    
    setIsLoading(true);
    setImportResult(null);

    try {
      const packageData = JSON.parse(importData);
      const validation = validateSharePackage(packageData, expectedWalletPublicKey);
      
      if (!validation.valid) {
        setImportResult({
          success: false,
          message: `Validation failed: ${validation.error}`
        });
        setIsLoading(false);
        return;
      }

      const participant = importParticipantShare(packageData, expectedWalletPublicKey);
      if (participant) {
        setImportResult({
          success: true,
          message: `Successfully imported participant: ${participant.id}`,
          participant
        });
        onParticipantImported(participant);
      } else {
        setImportResult({
          success: false,
          message: 'Failed to import participant share. Invalid key share data.'
        });
      }
    } catch (error) {
      setImportResult({
        success: false,
        message: `Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyToClipboard = async (sharePackage: ParticipantSharePackage) => {
    const success = await copySharePackageToClipboard(sharePackage);
    if (success) {
      alert('Share package copied to clipboard!');
    } else {
      alert('Failed to copy to clipboard');
    }
  };

  const handleDownload = (sharePackage: ParticipantSharePackage) => {
    downloadSharePackage(sharePackage);
  };

  return (
    <div className="space-y-6">
      {/* URL Package Detected */}
      {urlPackage && (
        <div className="card rounded-xl p-6 border border-green-500/30">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 gradient-bg rounded-full flex items-center justify-center glow">
                <span className="text-white text-xl">🔗</span>
              </div>
            </div>
            <div className="ml-4 flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">
                Participant Share Detected
              </h3>
              <p className="text-gray-400 text-sm mb-4">
                A participant share package was found in the URL. Click below to import it.
              </p>
              <div className="bg-white/5 rounded-lg p-4 mb-4">
                <div className="text-sm text-gray-400">
                  <p><span className="text-gray-500">Participant:</span> <span className="text-white">{urlPackage.participantId}</span></p>
                  <p><span className="text-gray-500">Wallet:</span> <span className="text-white font-mono">{urlPackage.walletPublicKey.slice(0, 12)}...</span></p>
                  <p><span className="text-gray-500">Created:</span> <span className="text-white">{new Date(urlPackage.createdAt).toLocaleString()}</span></p>
                  <p><span className="text-gray-500">Expires:</span> <span className="text-white">{new Date(urlPackage.expiresAt).toLocaleString()}</span></p>
                </div>
              </div>
              <button
                onClick={() => handleImportFromUrl(urlPackage)}
                disabled={isLoading}
                className="btn-primary px-6 py-2 text-white rounded-lg"
              >
                {isLoading ? 'Importing...' : 'Import Participant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Result */}
      {importResult && (
        <div className={`card rounded-xl p-6 ${
          importResult.success 
            ? 'border border-green-500/30 bg-green-500/10' 
            : 'border border-red-500/30 bg-red-500/10'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                importResult.success ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                <span className={importResult.success ? 'text-green-400' : 'text-red-400'}>
                  {importResult.success ? '✓' : '✕'}
                </span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className={`text-lg font-semibold ${importResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {importResult.success ? 'Import Successful' : 'Import Failed'}
              </h3>
              <p className="text-gray-300 mt-1">{importResult.message}</p>
              {importResult.participant && (
                <div className="mt-3 text-sm text-gray-400">
                  <p>Participant ID: <span className="text-white">{importResult.participant.id}</span></p>
                  <p>Key Share Index: <span className="text-white">{importResult.participant.keyShare?.index}</span></p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual Import */}
      <div className="card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          📥 Import Participant Share Manually
        </h3>
        <p className="text-gray-400 text-sm mb-4">
          Paste a participant share package JSON below to import their key share.
          This allows a participant to sign from a different device.
        </p>
        
        <textarea
          value={importData}
          onChange={(e) => setImportData(e.target.value)}
          placeholder={`Paste participant share JSON here...\n\nExample:
{
  "version": "1.0",
  "walletPublicKey": "...",
  "participantId": "alice",
  ...
}`}
          className="w-full h-40 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 input-field font-mono text-sm"
        />
        
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleTextImport}
            disabled={isLoading || !importData.trim()}
            className="btn-primary px-6 py-2 text-white rounded-lg disabled:opacity-50"
          >
            {isLoading ? 'Importing...' : 'Import'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="card rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          📋 How to Use Multi-Device Signing
        </h3>
        <div className="text-sm text-gray-400 space-y-3">
          <div className="flex items-start">
            <span className="text-blue-400 font-bold mr-2">1.</span>
            <p>On the main device, go to wallet details and export your participant share</p>
          </div>
          <div className="flex items-start">
            <span className="text-blue-400 font-bold mr-2">2.</span>
            <p>Share the exported data securely with the participant (via secure messaging, QR code, or file transfer)</p>
          </div>
          <div className="flex items-start">
            <span className="text-blue-400 font-bold mr-2">3.</span>
            <p>The participant opens this page on their device and imports the share</p>
          </div>
          <div className="flex items-start">
            <span className="text-blue-400 font-bold mr-2">4.</span>
            <p>Once imported, the participant can sign transactions from their device</p>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-amber-400 text-sm">
            ⚠️ <strong>Security Note:</strong> Key shares are cryptographic secrets. 
            Share them only through secure channels. The share package expires after 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
