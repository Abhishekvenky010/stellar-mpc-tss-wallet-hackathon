import { Transaction } from '@stellar/stellar-sdk';
import { frostSignRound1, frostSignRound2, frostBuildSigningPackage, frostAggregate, frostVerifySignature } from '@/lib/signer/frost_signer';
import { Round1Commitment, Round2Signature } from '@/lib/tss/types';

/**
 * MPC Wallet structure containing participant key shares and group public key
 */
export interface MPCWallet {
  participants: Map<number, Uint8Array>;  // Map of participant index to key share
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
  console.log('Starting MPC signing process for transaction');

  // Use the provided wallet ID or default to 1 for backward compatibility
  const actualWalletId = walletId || 1;

  // Round 1: Each participant generates commitments (nonces)
  console.log('Round 1: Generating commitments');
  const round1Commitments: Round1Commitment[] = [];
  const nonceIds: number[] = [];

  // For each participant, generate their commitment
  const participantEntries = Array.from(mpcWallet.participants.entries());
  for (const [participantIndex, keyShare] of participantEntries) {
    try {
      const commitment = await frostSignRound1(actualWalletId, participantIndex);
      round1Commitments.push(commitment);
      nonceIds.push(commitment.nonceId); // Use the actual nonce ID returned by WASM
      console.log(`Participant ${participantIndex}: Generated commitment with nonceId ${commitment.nonceId}`);
    } catch (error) {
      console.error(`Participant ${participantIndex}: Failed to generate commitment`, error);
      throw new Error(`MPC Round 1 failed for participant ${participantIndex}: ${error}`);
    }
  }

  // Build signing package - Sign tx.hash() as Stellar expects
  console.log('Building signing package');
  const messageHash = new Uint8Array(transaction.hash());
  const signingPkgId = await frostBuildSigningPackage(nonceIds, messageHash);

  // Round 2: Each participant generates their signature share
  console.log('Round 2: Generating signature shares');
  const round2Signatures: Round2Signature[] = [];
  const shareIds: number[] = [];

  for (let i = 0; i < participantEntries.length; i++) {
    const [participantIndex, keyShare] = participantEntries[i];
    try {
      const signatureShare = await frostSignRound2(
        actualWalletId,
        participantIndex,
        round1Commitments,
        messageHash
      );


      console.log(`Participant ${participantIndex}: Generated signature share`);
    } catch (error) {
      console.error(`Participant ${participantIndex}: Failed to generate signature share`, error);
      throw new Error(`MPC Round 2 failed for participant ${participantIndex}: ${error}`);
    }
  }

  // Aggregate all signature shares into final signature
  console.log('Aggregating signature shares');
  try {
    const finalSignature = await frostAggregate(actualWalletId);

    console.group("✍️ AGGREGATED SIGNATURE");
    console.log("MESSAGE HASH (hex):", Buffer.from(messageHash).toString('hex'));
    console.log("FROST SIGNATURE (hex):", Buffer.from(finalSignature).toString('hex'));
    console.log("Signature length:", finalSignature.length);

    // Verify the signature before submitting
    console.log('Verifying FROST signature...');
    const isValid = await frostVerifySignature(actualWalletId, messageHash, finalSignature);
    console.log('Signature verification result:', isValid);

    if (!isValid) {
      throw new Error('FROST signature verification failed - signature is invalid');
    }

    console.groupEnd();

    console.log('Successfully aggregated and verified signature');

    // Use the actual FROST signature
    console.log('Using FROST signature for transaction');
    const signatureHex = Buffer.from(finalSignature).toString('base64');

    // Submit the transaction to Stellar network with the final signature
    console.log('Submitting transaction to Stellar network');

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
      console.error('Transaction submission failed:', errorText);
      throw new Error(`Transaction submission failed: ${errorText}`);
    }

    const result = await response.json();
    console.log('Transaction submitted successfully:', result.hash);

    return result.hash;

  } catch (error) {
    console.error('Failed to aggregate signatures or submit transaction:', error);
    throw new Error(`MPC signing failed: ${error}`);
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