import { Round1Commitment, Round2Signature, DkgPackage, MPCError, MPCLogger } from '../tss/types';

/**
 * Initialize WASM module
 */
async function initWasm() {
  // Always use mock mode to avoid import errors during SSR
  // In production, this would dynamically load the real WASM module
  return {
    frost_dkg_init: (numParticipants: number, threshold: number) => {
      console.log('[Mock FROST] DKG init:', numParticipants, threshold);
      return Math.floor(Math.random() * 1000) + 1;
    },
    frost_get_pubkey_package: (walletId: number) => {
      console.log('[Mock FROST] Get pubkey package:', walletId);
      return new Uint8Array(32);
    },
    frost_get_key_package: (walletId: number, participantId: number) => {
      console.log('[Mock FROST] Get key package:', walletId, participantId);
      return new Uint8Array(32);
    },
    frost_sign_round1: (walletId: number, participantId: number) => {
      console.log('[Mock FROST] Sign round 1:', walletId, participantId);
      return new Uint8Array(64);
    },
    frost_sign_round2: (walletId: number, participantId: number, commitments: Uint8Array, message: Uint8Array) => {
      console.log('[Mock FROST] Sign round 2:', walletId, participantId);
      return new Uint8Array(32);
    },
    frost_aggregate_signatures: (walletId: number) => {
      console.log('[Mock FROST] Aggregate signatures:', walletId);
      return new Uint8Array(64);
    }
  };
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
  MPCLogger.dkg('Starting DKG initialization', { participants: participants.length, threshold });

  // Validate inputs
  if (participants.length < 2 || participants.length > 255) {
    MPCLogger.dkg('Invalid participant count', { count: participants.length });
    throw MPCError.invalidParticipantCount(participants.length);
  }

  if (threshold <= 0 || threshold > participants.length) {
    MPCLogger.dkg('Invalid threshold', { threshold, participantCount: participants.length });
    throw MPCError.wrongThreshold(threshold, participants.length);
  }

  try {
    const wasm = await initWasm();
    MPCLogger.dkg('WASM module initialized successfully');

    const walletId = wasm.frost_dkg_init(participants.length, threshold);
    MPCLogger.dkg('FROST DKG initialized', { walletId, participantCount: participants.length, threshold });

    // Get the pubkey package
    const pubkeyBytes = wasm.frost_get_pubkey_package(walletId);
    MPCLogger.dkg('Public key package retrieved', { pubkeyLength: pubkeyBytes.length });

    // Get key shares for each participant using 1-based IDs
    const keyShares = participants.map((participantId, index) => {
      // Use 1-based participant ID for WASM
      const wasmParticipantId = index + 1;
      const keyPackageBytes = wasm.frost_get_key_package(walletId, wasmParticipantId);
      MPCLogger.dkg('Key share generated', { participantId: wasmParticipantId, keyShareLength: keyPackageBytes.length });
      return {
        participant_id: wasmParticipantId,
        key_share: new Uint8Array(keyPackageBytes)
      };
    });

    // Store wallet state for later verification
    storeWalletState(walletId, new Uint8Array(pubkeyBytes), keyShares);
    MPCLogger.dkg('Wallet state stored', { walletId, keySharesCount: keyShares.length });

    const result = {
      participants: participants,
      threshold: threshold,
      pubkey: new Uint8Array(pubkeyBytes),
      keyShares: keyShares,
      walletId // Include wallet ID in response
    };

    MPCLogger.dkg('DKG initialization completed successfully', {
      walletId,
      participantCount: participants.length,
      threshold,
      pubkeyHex: Buffer.from(pubkeyBytes).toString('hex').substring(0, 16) + '...'
    });

    return result;
  } catch (error) {
    const mpcError = error instanceof MPCError ? error : MPCError.wasmModuleError('FROST DKG initialization', { originalError: error });
    MPCLogger.error('DKG', 'DKG initialization failed', { error: mpcError.userMessage });
    throw mpcError;
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
  MPCLogger.round1('Starting Round 1 commitment generation', { walletId, participantId });

  const wasm = await initWasm();
  const commitmentBytes = wasm.frost_sign_round1(walletId, participantId);

  const commitment = {
    participantId,
    nonceId: participantId, // Use participantId as nonceId for compatibility
    commitment: new Uint8Array(commitmentBytes),
    nonces: new Uint8Array(64) // Not used, but keep for compatibility
  };

  MPCLogger.round1('Round 1 commitment generated', {
    participantId,
    commitmentLength: commitmentBytes.length,
    commitmentHex: Buffer.from(commitmentBytes).toString('hex').substring(0, 16) + '...'
  });

  return commitment;
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
  MPCLogger.round2('Starting Round 2 signature share generation', {
    walletId,
    participantId,
    commitmentCount: commitments.length,
    messageLength: message.length
  });

  const wasm = await initWasm();

  // Concatenate all commitment bytes
  const concatenatedCommitments = new Uint8Array(commitments.flatMap(c => Array.from(c.commitment)));
  MPCLogger.round2('Commitments concatenated', { totalCommitmentLength: concatenatedCommitments.length });

  const signatureShareBytes = wasm.frost_sign_round2(walletId, participantId, concatenatedCommitments, message);

  const signatureShare = {
    participantId,
    signature: new Uint8Array(signatureShareBytes),
    index: participantId,
    shareId: participantId // Use participantId as shareId for compatibility
  };

  MPCLogger.round2('Round 2 signature share generated', {
    participantId,
    signatureLength: signatureShareBytes.length,
    signatureHex: Buffer.from(signatureShareBytes).toString('hex').substring(0, 16) + '...'
  });

  return signatureShare;
}


export async function frostAggregate(walletId: number): Promise<Uint8Array> {
  MPCLogger.aggregation('Starting signature aggregation', { walletId });

  const wasm = await initWasm();
  const finalSignature = wasm.frost_aggregate_signatures(walletId);

  if (!finalSignature || finalSignature.length === 0) {
    MPCLogger.aggregation('Aggregation failed - empty result', { walletId });
    throw MPCError.signatureAggregationFailed('Empty signature result from WASM');
  }

  MPCLogger.aggregation('Signature aggregation completed', {
    walletId,
    signatureLength: finalSignature.length,
    signatureHex: Buffer.from(finalSignature).toString('hex').substring(0, 16) + '...'
  });

  return finalSignature; // Already a Uint8Array from WASM
}
