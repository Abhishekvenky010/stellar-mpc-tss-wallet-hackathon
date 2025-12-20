/**
 * Utility functions for serializing and deserializing TSS wallet data
 * Handles Uint8Array conversion to/from base64 for localStorage compatibility
 */

import { TSSWallet, TSSKeyShare, TSSSignatureShare } from './tss/types';

/**
 * Convert Uint8Array to base64 string
 */
export function uint8ArrayToBase64(array: Uint8Array): string {
  // Browser-compatible base64 encoding
  const bytes = Array.from(array);
  const binary = bytes.map(byte => String.fromCharCode(byte)).join('');
  return btoa(binary);
}

/**
 * Convert base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  // Browser-compatible base64 decoding
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Deserialize Uint8Array from either base64 string or object format
 */
export function deserializeUint8Array(data: any): Uint8Array {
  if (typeof data === 'string') {
    // New format: base64 string
    return base64ToUint8Array(data);
  } else if (data && typeof data === 'object' && !Array.isArray(data)) {
    // Old format: object with numeric string keys from JSON.stringify(Uint8Array)
    const keys = Object.keys(data).filter(k => !isNaN(Number(k))).map(Number).sort((a, b) => a - b);
    if (keys.length === 0) {
      throw new Error('Empty Uint8Array data');
    }
    const length = Math.max(...keys) + 1;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      bytes[i] = data[i] || 0;
    }
    return bytes;
  } else {
    throw new Error('Invalid Uint8Array data format');
  }
}

/**
 * Serialize a TSSKeyShare for storage
 */
export function serializeKeyShare(keyShare: TSSKeyShare): any {
  return {
    ...keyShare,
    share: uint8ArrayToBase64(keyShare.share),
    verificationKey: uint8ArrayToBase64(keyShare.verificationKey)
  };
}

/**
 * Deserialize a TSSKeyShare from storage
 */
export function deserializeKeyShare(data: any): TSSKeyShare {
  return {
    ...data,
    share: deserializeUint8Array(data.share),
    verificationKey: deserializeUint8Array(data.verificationKey)
  };
}

/**
 * Serialize a TSSSignatureShare for storage
 */
export function serializeSignatureShare(sigShare: TSSSignatureShare): any {
  return {
    ...sigShare,
    share: uint8ArrayToBase64(sigShare.share)
  };
}

/**
 * Deserialize a TSSSignatureShare from storage
 */
export function deserializeSignatureShare(data: any): TSSSignatureShare {
  return {
    ...data,
    share: deserializeUint8Array(data.share)
  };
}

/**
 * Serialize a TSSWallet for storage
 */
export function serializeWallet(wallet: TSSWallet): any {
  return {
    ...wallet,
    participants: wallet.participants.map(p => ({
      ...p,
      keyShare: p.keyShare ? serializeKeyShare(p.keyShare) : null
    })),
    transactions: wallet.transactions.map(t => ({
      ...t,
      signatureShares: t.signatureShares.map(serializeSignatureShare)
    }))
  };
}

/**
 * Deserialize a TSSWallet from storage
 */
export function deserializeWallet(data: any): TSSWallet {
  return {
    ...data,
    participants: data.participants.map((p: any) => ({
      ...p,
      keyShare: p.keyShare ? deserializeKeyShare(p.keyShare) : null
    })),
    transactions: data.transactions.map((t: any) => ({
      ...t,
      signatureShares: t.signatureShares.map(deserializeSignatureShare)
    }))
  };
}

/**
 * Serialize wallets array for localStorage
 */
export function serializeWallets(wallets: TSSWallet[]): string {
  return JSON.stringify(wallets.map(serializeWallet));
}

/**
 * Deserialize wallets array from localStorage
 */
export function deserializeWallets(data: string): TSSWallet[] {
  return JSON.parse(data).map(deserializeWallet);
}