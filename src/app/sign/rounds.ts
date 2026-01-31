import { Transaction } from '@stellar/stellar-sdk';
import { frostSignRound1, frostSignRound2, frostAggregate } from '@/lib/signer/frost_signer';
import { Round1Commitment, Round2Signature, MPCError, MPCLogger } from '@/lib/tss/types';

/**
 * MPC Wallet structure containing participant key shares and group public key
 */
export interface MPCWallet {
  participants: number[];  // Array of participant IDs (0-based indices)
  keyShares: Map<number, Uint8Array>;  // Map of participant ID to key share
  groupPublicKey: Uint8Array;            // Group public key
  pubkeyPackage: Uint8Array;              // Public key package for verification
}

/**
 * Orchestrates the complete MPC signing process and submits the transaction
 * This function handles the multi-round FROST signing protocol
 */
export async function mpcSignAndSubmit(
  mpcWallet: MPCWallet,
  transaction: Transaction,
  walletId?: number,
  privateKey?: Uint8Array
): Promise<string> {
  MPCLogger.info('MPC', 'Starting MPC signing process', {
    participantCount: mpcWallet.participants.length,
    transactionHash: transaction.hash().toString('hex')
  });

  // Use the provided wallet ID or default to 1 for backward compatibility
  const actualWalletId = walletId || 1;

  // Round 1: Each participant generates commitments (nonces)
  MPCLogger.round1('Starting Round 1: Generating commitments', {
    participantCount: mpcWallet.participants.length,
    walletId: actualWalletId
  });

  const round1Commitments: Round1Commitment[] = [];
  const nonceIds: number[] = [];

  // For each participant, generate their commitment
  // WASM uses 1-based participant IDs, so we add 1 to the index
  for (const participantIndex of mpcWallet.participants) {
    try {
      // Convert 0-based index to 1-based ID for WASM
      const wasmParticipantId = participantIndex + 1;
      const commitment = await frostSignRound1(actualWalletId, wasmParticipantId);
      round1Commitments.push(commitment);
      nonceIds.push(commitment.nonceId); // Use the actual nonce ID returned by WASM
      MPCLogger.round1('Commitment generated for participant', {
        participantIndex,
        nonceId: commitment.nonceId,
        commitmentLength: commitment.commitment.length
      });
    } catch (error) {
      const mpcError = error instanceof MPCError ? error : MPCError.wasmModuleError('commitment generation', { participantIndex, originalError: error });
      MPCLogger.error('Round1', `Failed to generate commitment for participant ${participantIndex}`, { error: mpcError.userMessage });
      throw mpcError;
    }
  }

  MPCLogger.round1('Round 1 completed', {
    totalCommitments: round1Commitments.length,
    totalCommitmentBytes: round1Commitments.reduce((sum, c) => sum + c.commitment.length, 0)
  });

  // Prepare message hash - Sign tx.hash() as Stellar expects
  const messageHash = new Uint8Array(transaction.hash());
  MPCLogger.info('MPC', 'Message hash prepared', {
    messageHashHex: Buffer.from(messageHash).toString('hex')
  });

  // Round 2: Each participant generates their signature share
  MPCLogger.round2('Starting Round 2: Generating signature shares', {
    participantCount: mpcWallet.participants.length,
    messageHashLength: messageHash.length
  });

  const round2Signatures: Round2Signature[] = [];
  const shareIds: number[] = [];

  for (let i = 0; i < mpcWallet.participants.length; i++) {
    const participantIndex = mpcWallet.participants[i];
    try {
      // Convert 0-based index to 1-based ID for WASM
      const wasmParticipantId = participantIndex + 1;
      const signatureShare = await frostSignRound2(
        actualWalletId,
        wasmParticipantId,
        round1Commitments,
        messageHash
      );

      round2Signatures.push(signatureShare);
      shareIds.push(signatureShare.shareId);

      MPCLogger.round2('Signature share generated for participant', {
        participantIndex,
        signatureLength: signatureShare.signature.length
      });
    } catch (error) {
      const mpcError = error instanceof MPCError ? error : MPCError.invalidSignatureShare(participantIndex);
      MPCLogger.error('Round2', `Failed to generate signature share for participant ${participantIndex}`, { error: mpcError.userMessage });
      throw mpcError;
    }
  }

  MPCLogger.round2('Round 2 completed', {
    totalSignatures: round2Signatures.length,
    totalSignatureBytes: round2Signatures.reduce((sum, s) => sum + s.signature.length, 0)
  });

  // Aggregate all signature shares into final signature
  MPCLogger.aggregation('Starting signature aggregation', { walletId: actualWalletId });
  try {
    const finalSignature = await frostAggregate(actualWalletId);

    MPCLogger.aggregation('Signature aggregation successful', {
      messageHashHex: Buffer.from(messageHash).toString('hex'),
      signatureHex: Buffer.from(finalSignature).toString('hex'),
      signatureLength: finalSignature.length
    });

    // Use the actual FROST signature
    const signatureHex = Buffer.from(finalSignature).toString('base64');
    MPCLogger.submission('Prepared signature for transaction submission', {
      signatureBase64Length: signatureHex.length
    });

    // Submit the transaction to Stellar network with the final signature
    MPCLogger.submission('Submitting transaction to Stellar network', {
      network: transaction.networkPassphrase?.includes('Test') ? 'testnet' : 'mainnet',
      transactionXDRLength: transaction.toXDR().length
    });

    const response = await fetch('/api/submit-transaction', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transactionXDR: transaction.toXDR(),
        signature: signatureHex, // FROST signature as base64
        network: transaction.networkPassphrase?.includes('Test') ? 'testnet' : 'mainnet'
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const mpcError = MPCError.transactionSubmissionFailed({ status: response.status, errorText });
      MPCLogger.error('Submission', 'Transaction submission failed', { error: mpcError.userMessage, status: response.status });
      throw mpcError;
    }

    const result = await response.json();
    MPCLogger.submission('Transaction submitted successfully', {
      transactionHash: result.hash,
      network: transaction.networkPassphrase?.includes('Test') ? 'testnet' : 'mainnet'
    });

    return result.hash;

  } catch (error) {
    const mpcError = error instanceof MPCError ? error : MPCError.signatureAggregationFailed(error instanceof Error ? error.message : 'Unknown error');
    MPCLogger.error('MPC', 'MPC signing process failed', { error: mpcError.userMessage });
    throw mpcError;
  }
}

/**
 * Helper function to simulate the MPC signing process for testing
 * This can be used when WASM functions are not yet implemented
 */
export async function simulateMpcSignAndSubmit(
  mpcWallet: MPCWallet,
  transaction: Transaction
): Promise<string> {
  console.warn('Using simulated MPC signing - replace with real implementation');

  // Simulate the signing process
  const simulatedSignature = new Uint8Array(64);
  crypto.getRandomValues(simulatedSignature);

  // Submit to Stellar network with simulated signature
  const response = await fetch('/api/submit-transaction', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transactionXDR: transaction.toXDR(),
      signature: Buffer.from(simulatedSignature).toString('base64'),
      network: transaction.networkPassphrase
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Transaction submission failed: ${errorText}`);
  }

  const result = await response.json();
  return result.transactionId;
}