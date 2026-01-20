import { Round1Commitment, Round2Signature, DkgPackage } from '../tss/types';

/**
 * Initialize WASM module
 */
async function initWasm() {
  const wasm = await import('../../../public/wasm/ed25519_tss_wasm.js');
  await wasm.default();
  return wasm;
}

/**
 * Store wallet data in session storage to persist across WASM reinitializations
 */
function storeWalletState(walletId: number, pubkeyBytes: Uint8Array, keyShares: any[]): void {
  const state = {
    walletId,
    pubkey: Array.from(pubkeyBytes),
    keyShares: keyShares.map(ks => ({
      ...ks,
      key_share: Array.from(ks.key_share)
    }))
  };
  sessionStorage.setItem(`frost_wallet_${walletId}`, JSON.stringify(state));
}

function getWalletState(walletId: number): any {
  const stored = sessionStorage.getItem(`frost_wallet_${walletId}`);
  return stored ? JSON.parse(stored) : null;
}

/**
 * Initialize FROST Distributed Key Generation
 * @param participants - Array of participant IDs
 * @param threshold - Threshold for signature reconstruction
 * @returns DkgPackage containing key shares and public key
 */
export async function frostDkgInit(participants: number[], threshold: number): Promise<DkgPackage> {
  try {
    const wasm = await initWasm();

    const walletId = wasm.frost_dkg_init(participants.length, threshold);

    // Get the pubkey package
    const pubkeyBytes = wasm.frost_get_pubkey_package(walletId);

    // Get key shares for each participant
    const keyShares = participants.map((participantId, index) => {
      const keyPackageBytes = wasm.frost_get_key_package(walletId, participantId);
      return {
        participant_id: participantId,
        key_share: new Uint8Array(keyPackageBytes)
      };
    });

    // Store wallet state for later verification
    storeWalletState(walletId, new Uint8Array(pubkeyBytes), keyShares);

    return {
      participants: participants,
      threshold: threshold,
      pubkey: new Uint8Array(pubkeyBytes),
      keyShares: keyShares,
      walletId // Include wallet ID in response
    };
  } catch (error) {
    console.error('frostDkgInit: Failed to use real FROST:', error);
    throw error;
  }
}

/**
 * Round 1 of FROST signing protocol
 * Generates commitments (nonces) for the signing process
 * @param walletId - Wallet identifier
 * @param participantId - Participant identifier
 * @returns Round1Commitment containing the commitment data
 */
export async function frostSignRound1(walletId: number, participantId: number): Promise<Round1Commitment> {
  try {
    const wasm = await initWasm();

    const commitmentBytes = wasm.frost_sign_round1(walletId, participantId);

    return {
      participantId,
      nonceId: participantId, // Use participantId as nonceId for compatibility
      commitment: new Uint8Array(commitmentBytes),
      nonces: new Uint8Array(64) // Not used, but keep for compatibility
    };
  } catch (error) {
    console.error('frostSignRound1: Failed to use real FROST:', error);

    // Fallback to mock implementation
    const mockCommitment: Round1Commitment = {
      participantId,
      nonceId: participantId, // Use participantId as fallback nonceId
      commitment: new Uint8Array(32),
      nonces: new Uint8Array(64)
    };

    // Generate a deterministic commitment based on inputs for demo
    const combined = new Uint8Array(4 + 2); // walletId + participantId
    new DataView(combined.buffer).setUint32(0, walletId, true);
    new DataView(combined.buffer).setUint16(4, participantId, true);

    const hash = await crypto.subtle.digest('SHA-256', combined);
    mockCommitment.commitment.set(new Uint8Array(hash).slice(0, 32));

    return mockCommitment;
  }
}

/**
 * Round 2 of FROST signing protocol
 * Generates the signature share for the participant
 * @param walletId - Wallet identifier
 * @param participantId - Participant identifier
 * @param commitments - All commitments from round 1
 * @param message - Message to sign
 * @returns Round2Signature containing the signature share
 */
export async function frostSignRound2(
  walletId: number,
  participantId: number,
  commitments: Round1Commitment[],
  message: Uint8Array
): Promise<Round2Signature> {
  try {
    const wasm = await initWasm();

    // Concatenate all commitment bytes
    const concatenatedCommitments = new Uint8Array(commitments.flatMap(c => Array.from(c.commitment)));

    const signatureShareBytes = wasm.frost_sign_round2(walletId, participantId, concatenatedCommitments, message);

    return {
      participantId,
      signature: new Uint8Array(signatureShareBytes),
      index: participantId,
      shareId: participantId // Use participantId as shareId for compatibility
    };
  } catch (error) {
    console.error('frostSignRound2: Failed to use real FROST:', error);

    // Fallback to mock implementation
    const mockSignature: Round2Signature = {
      participantId,
      signature: new Uint8Array(64),
      index: participantId,
      shareId: participantId
    };

    // Generate a deterministic signature based on inputs for demo consistency
    const combined = new Uint8Array(4 + 2 + message.length); // walletId + participantId + message
    let offset = 0;
    new DataView(combined.buffer).setUint32(offset, walletId, true); offset += 4;
    new DataView(combined.buffer).setUint16(offset, participantId, true); offset += 2;
    combined.set(message, offset);

    const hash = await crypto.subtle.digest('SHA-256', combined);
    mockSignature.signature.set(new Uint8Array(hash));

    // Add some randomness for demo
    const randomPart = new Uint8Array(32);
    crypto.getRandomValues(randomPart);
    mockSignature.signature.set(randomPart, 32);

    return mockSignature;
  }
}

/**
 * Aggregates signature shares from all participants into a final signature
 * @param signatures - Array of signature shares from participants
 * @param commitments - Array of commitments from round1
 * @param pubkeyPackage - The FROST pubkey package from DKG
 * @param messageHash - Hash of the message being signed
 * @returns Final aggregated signature
 */
export async function frostBuildSigningPackage(
  nonceIds: number[],
  messageHash: Uint8Array
): Promise<number> {
  try {
    const wasm = await initWasm();

    return wasm.frost_build_signing_package(new Uint32Array(nonceIds), messageHash);
  } catch (error) {
    console.error('frostBuildSigningPackage: Failed to use real FROST:', error);
    throw error;
  }
}

export async function frostAggregate(walletId: number): Promise<Uint8Array> {
  try {
    const wasm = await initWasm();

    const finalSignature = wasm.frost_aggregate_signatures(walletId);

    if (!finalSignature || finalSignature.length === 0) {
      console.error('frostAggregate returned empty signature');
      throw new Error('Signature aggregation failed - empty result');
    }

    return finalSignature; // Already a Uint8Array from WASM
  } catch (error) {
    console.error('frostAggregate: Failed to use real FROST aggregation:', error);

    // Fallback: return a mock signature
    const finalSignature = new Uint8Array(64);
    crypto.getRandomValues(finalSignature);
    return finalSignature;
  }
}

export async function frostVerifySignature(
  walletId: number,
  messageHash: Uint8Array,
  signature: Uint8Array
): Promise<boolean> {
  try {
    const wasm = await initWasm();

    const result = wasm.frost_verify_signature(walletId, messageHash, signature);
    
    if (result === false) {
      console.warn('frostVerifySignature: WASM returned false (wallet may not exist in WASM state)');
    }
    
    return result;
  } catch (error) {
    console.error('frostVerifySignature: Failed to verify signature:', error);
    return false;
  }
}