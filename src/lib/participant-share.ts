/**
 * Participant Key Share Import/Export utilities for multi-device MPC signing
 * Allows participants to securely share their key shares across different devices
 */

import { TSSParticipant, TSSKeyShare, TSSWallet } from './tss/types';
import { uint8ArrayToBase64, base64ToUint8Array } from './utils';

export interface ParticipantSharePackage {
  version: '1.0';
  walletPublicKey: string;
  participantId: string;
  participantName: string;
  publicKey: string;
  keyShareIndex: number;
  // Key share data is encoded as base64 for easy transfer
  keyShareData: string;
  verificationKey: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Export a participant's key share as a shareable package
 */
export function exportParticipantShare(
  wallet: TSSWallet,
  participantId: string
): ParticipantSharePackage | null {
  const participant = wallet.participants.find(p => p.id === participantId);
  
  if (!participant || !participant.keyShare) {
    console.error('Participant or key share not found');
    return null;
  }

  const keyShare = participant.keyShare;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours expiry

  return {
    version: '1.0',
    walletPublicKey: wallet.config.publicKey,
    participantId: participant.id,
    participantName: participant.id, // Using id as name for now
    publicKey: participant.publicKey,
    keyShareIndex: keyShare.index,
    keyShareData: uint8ArrayToBase64(keyShare.share),
    verificationKey: uint8ArrayToBase64(keyShare.verificationKey),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString()
  };
}

/**
 * Export a participant's key share as a JSON string for sharing
 */
export function exportParticipantShareAsString(
  wallet: TSSWallet,
  participantId: string
): string | null {
  const sharePackage = exportParticipantShare(wallet, participantId);
  if (!sharePackage) return null;
  return JSON.stringify(sharePackage);
}

/**
 * Validate an imported participant share package
 */
export function validateSharePackage(
  packageData: ParticipantSharePackage,
  expectedWalletPublicKey?: string
): { valid: boolean; error?: string } {
  // Check version
  if (packageData.version !== '1.0') {
    return { valid: false, error: 'Invalid package version' };
  }

  // Check expiry
  const expiresAt = new Date(packageData.expiresAt);
  if (expiresAt < new Date()) {
    return { valid: false, error: 'Share package has expired' };
  }

  // Check wallet public key if provided
  if (expectedWalletPublicKey && packageData.walletPublicKey !== expectedWalletPublicKey) {
    return { valid: false, error: 'Share package is from a different wallet' };
  }

  // Validate required fields
  if (!packageData.participantId || !packageData.keyShareData) {
    return { valid: false, error: 'Invalid share package structure' };
  }

  return { valid: true };
}

/**
 * Import a participant's key share from a share package
 */
export function importParticipantShare(
  packageData: string | ParticipantSharePackage,
  expectedWalletPublicKey?: string
): TSSParticipant | null {
  try {
    // Parse if string
    let sharePackage: ParticipantSharePackage;
    if (typeof packageData === 'string') {
      sharePackage = JSON.parse(packageData);
    } else {
      sharePackage = packageData;
    }

    // Validate
    const validation = validateSharePackage(sharePackage, expectedWalletPublicKey);
    if (!validation.valid) {
      console.error('Share package validation failed:', validation.error);
      return null;
    }

    // Deserialize key share
    const keyShareData = base64ToUint8Array(sharePackage.keyShareData);
    const verificationKey = base64ToUint8Array(sharePackage.verificationKey);

    if (!keyShareData || !verificationKey) {
      console.error('Failed to deserialize key share data');
      return null;
    }

    // Create participant with imported key share
    const participant: TSSParticipant = {
      id: sharePackage.participantId,
      publicKey: sharePackage.publicKey,
      keyShare: {
        index: sharePackage.keyShareIndex,
        share: keyShareData,
        publicKey: sharePackage.publicKey,
        verificationKey: verificationKey
      }
    };

    return participant;
  } catch (error) {
    console.error('Failed to import participant share:', error);
    return null;
  }
}

/**
 * Generate a shareable link for participant key share
 * For production, this would use a signaling server or P2P connection
 */
export function generateShareableLink(
  sharePackage: ParticipantSharePackage
): string {
  const encodedPackage = encodeURIComponent(JSON.stringify(sharePackage));
  return `${window.location.origin}/import-participant?data=${encodedPackage}`;
}

/**
 * Parse a shareable link to extract the share package
 */
export function parseShareableLink(url: string): ParticipantSharePackage | null {
  try {
    const urlObj = new URL(url);
    const encodedData = urlObj.searchParams.get('data');
    if (!encodedData) return null;
    return JSON.parse(decodeURIComponent(encodedData));
  } catch (error) {
    console.error('Failed to parse shareable link:', error);
    return null;
  }
}

/**
 * Check if current URL contains a share package
 */
export function getSharePackageFromURL(): ParticipantSharePackage | null {
  if (typeof window === 'undefined') return null;
  
  const url = window.location.href;
  return parseShareableLink(url);
}

/**
 * Create a QR code data for sharing
 * This returns the data that can be used with QR code generators
 */
export function getQRCodeData(sharePackage: ParticipantSharePackage): string {
  // Return the JSON data that can be encoded into a QR code
  return JSON.stringify(sharePackage);
}

/**
 * Utility to convert share package to a compact format for easy copying
 */
export function toCompactFormat(sharePackage: ParticipantSharePackage): string {
  // Create a compact representation
  const compact = {
    w: sharePackage.walletPublicKey.slice(0, 8),
    p: sharePackage.participantId,
    i: sharePackage.keyShareIndex,
    d: sharePackage.keyShareData.slice(0, 16) + '...'
  };
  return JSON.stringify(compact);
}

/**
 * Download share package as a file
 */
export function downloadSharePackage(
  sharePackage: ParticipantSharePackage,
  filename?: string
): void {
  const dataStr = JSON.stringify(sharePackage, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `participant-share-${sharePackage.participantId}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Copy share package to clipboard
 */
export async function copySharePackageToClipboard(
  sharePackage: ParticipantSharePackage
): Promise<boolean> {
  try {
    const dataStr = JSON.stringify(sharePackage, null, 2);
    await navigator.clipboard.writeText(dataStr);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
