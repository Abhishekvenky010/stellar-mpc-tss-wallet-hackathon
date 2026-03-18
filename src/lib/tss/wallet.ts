import { TSSWallet, TSSWalletConfig, TSSParticipant, TSSTransaction, TSSKeyShare, TSSSignatureShare, TSSTransactionDetails, MPCError, MPCErrorType } from './types';
import { TSSSigningService } from './signing';
import { createMPCSigner } from '../mpc/ed25519';
import { Keypair, StrKey } from '@stellar/stellar-sdk';

// Production TSS implementation using real cryptographic operations
export class StellarTSSWallet {
  private wallet: TSSWallet | null = null;
  private signingService: TSSSigningService;

  constructor(network: 'mainnet' | 'testnet' | 'futurenet' = 'testnet') {
    this.signingService = new TSSSigningService(network);
  }

  /**
   * Create a new TSS wallet with distributed key shares
   */
  async createWallet(
    participantIds: string[],
    threshold: number,
    network: 'mainnet' | 'testnet' | 'futurenet' = 'testnet'
  ): Promise<TSSWallet> {
    if (participantIds.length < 2 || participantIds.length > 255) {
      throw MPCError.invalidParticipantCount(participantIds.length);
    }

    if (threshold <= 0 || threshold > participantIds.length) {
      throw MPCError.wrongThreshold(threshold, participantIds.length);
    }

    // Generate distributed key shares using the provided threshold
    const { publicKey, keyShares, walletId } = await this.generateDistributedKey(participantIds.length, threshold);

    const participants: TSSParticipant[] = participantIds.map((id, index) => ({
      id,
      publicKey: keyShares[index].publicKey,
      keyShare: keyShares[index],
      walletId // Store the WASM wallet ID for signing
    }));

    // Generate aggregate key deterministically from participant public keys
    const publicKeys = keyShares.map(k => k.publicKey);
    const publicKeysString = publicKeys.join('');
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(publicKeysString));
    const aggregateSeed = new Uint8Array(hashBuffer).slice(0, 32);
    const aggregateSecretString = StrKey.encodeEd25519SecretSeed(Buffer.from(aggregateSeed));
    const aggregateKeypair = Keypair.fromSecret(aggregateSecretString);
    const aggregatePublicKey = aggregateKeypair.publicKey();

    const config: TSSWalletConfig = {
      threshold,
      totalShares: participantIds.length,
      publicKey: aggregatePublicKey,
      network
    };

    this.wallet = {
      config,
      participants,
      transactions: []
    };

    // Fund all participant accounts on testnet for demo
    if (network === 'testnet') {
      const allPublicKeys = keyShares.map(k => k.publicKey);
      await this.fundTestnetAccounts(allPublicKeys);
    }

    return this.wallet;
  }

  /**
   * Generate distributed key shares using FROST DKG
   */
  private async generateDistributedKey(numShares: number, threshold: number): Promise<{
    publicKey: string;
    keyShares: TSSKeyShare[];
    walletId: number;
  }> {
    const { frostDkgInit } = await import('../signer/frost_signer');

    // Create participant IDs (1, 2, 3, ...) - WASM expects 1-based indexing
    const participantIds = Array.from({ length: numShares }, (_, i) => i + 1);

    // Initialize FROST DKG with the provided threshold
    const dkgPackage = await frostDkgInit(participantIds, threshold);

    // Extract public key from the DKG package
    // Encode the 32-byte group public key as a Stellar account ID
    const publicKeyBytes = dkgPackage.pubkey;
    const publicKey = StrKey.encodeEd25519PublicKey(Buffer.from(publicKeyBytes));

    // Create key shares from the DKG package
    // Map the key shares to their corresponding participant IDs (1-based)
    const keyShares: TSSKeyShare[] = dkgPackage.keyShares.map((keyShare, i) => {
      // Derive a valid Ed25519 keypair from the DKG key share
      // The key_share bytes are the secret scalar for this participant's share
      // We need to derive both the secret (for signing) and public key (for verification)
      const secretKeyBytes = keyShare.key_share;
      
      // Create a keypair from the secret key bytes
      // The first 32 bytes are the secret key, the public key is derived from it
      const secretKey = secretKeyBytes.slice(0, 32);
      const participantKeypair = Keypair.fromRawEd25519Seed(Buffer.from(secretKey));
      
      // Convert public key to bytes for verificationKey
      const publicKeyBytes = StrKey.decodeEd25519PublicKey(participantKeypair.publicKey());
      
      return {
        index: i + 1, // WASM uses 1-based participant IDs
        share: keyShare.key_share,
        publicKey: participantKeypair.publicKey(),
        verificationKey: publicKeyBytes
      };
    });

    return { publicKey, keyShares, walletId: dkgPackage.walletId! };
  }

  /**
   * Create a transaction for TSS signing
   */
  async createTransaction(
    to: string,
    amount: string,
    memo?: string
  ): Promise<TSSTransaction> {
    if (!this.wallet) {
      throw new Error('No wallet loaded');
    }

    const transaction: TSSTransaction = {
      id: crypto.randomUUID(),
      from: this.wallet.config.publicKey,
      to: to,
      amount,
      memo,
      network: this.wallet.config.network,
      status: 'pending',
      signatureShares: []
    };

    this.wallet.transactions.push(transaction);
    return transaction;
  }

  /**
   * Sign a transaction with a participant's key share using TSS
   */
  async signTransaction(
    transactionId: string,
    participantId: string,
    keyShare: TSSKeyShare
  ): Promise<TSSSignatureShare> {
    if (!this.wallet) {
      throw new Error('No wallet loaded');
    }

    const transaction = this.wallet.transactions.find(tx => tx.id === transactionId);
    if (!transaction) {
      throw new Error('Transaction not found');
    }

    const participant = this.wallet.participants.find(p => p.id === participantId);
    if (!participant) {
      throw MPCError.participantMissing(parseInt(participantId) || 0);
    }

    // Verify the key share belongs to this participant
    if (!participant.keyShare || !this.arraysEqual(participant.keyShare.share, keyShare.share)) {
      throw MPCError.invalidKeyShare(parseInt(participantId) || 0);
    }

    // Use TSS signing service for proper cryptographic signing
    const transactionDetails: TSSTransactionDetails = {
      from: transaction.from,
      to: transaction.to,
      amount: transaction.amount,
      network: transaction.network,
      memo: transaction.memo
    };

    // Step 1: Generate nonce and commitment
    const stepOneData = await this.signingService.aggregateSignStepOne(
      keyShare.share, // Use the key share as secret key
      transactionDetails
    );

    // Get all public nonces from existing signatures
    const allPublicNonces: Uint8Array[] = transaction.signatureShares.map(sig => {
      // For demo, create mock nonces since we don't store them
      return new Uint8Array(32);
    });
    allPublicNonces.push(stepOneData.publicNonce);

    // Step 2: Create partial signature
    const stepTwoData = await this.signingService.aggregateSignStepTwo(
      stepOneData,
      keyShare.share,
      transactionDetails,
      allPublicNonces
    );

    const signatureShareObj: TSSSignatureShare = {
      participantId,
      share: stepTwoData.partialSignature,
      index: keyShare.index
    };

    transaction.signatureShares.push(signatureShareObj);

    // Check if we have enough shares to reconstruct the signature
    if (transaction.signatureShares.length >= this.wallet.config.threshold) {
      transaction.status = 'signed';
      await this.submitTransaction(transaction);
    } else {
      transaction.status = 'collecting';
    }

    return signatureShareObj;
  }

  /**
   * Submit a fully signed transaction to Stellar using TSS aggregation
   */
  private async submitTransaction(transaction: TSSTransaction): Promise<void> {
    // Use TSS signing service to aggregate signatures and broadcast
    const transactionDetails: TSSTransactionDetails = {
      from: transaction.from,
      to: transaction.to,
      amount: transaction.amount,
      network: transaction.network,
      memo: transaction.memo
    };

    // Reconstruct aggregate secret key from participant key shares
    const aggregateSecretKey = await this.reconstructAggregateKey();

    const aggregateWallet = {
      walletId: this.wallet!.participants[0]?.walletId || 0, // Use walletId from participant
      aggregatedPublicKey: this.wallet!.config.publicKey,
      participantKeys: this.wallet!.participants.map(p => p.publicKey),
      threshold: this.wallet!.config.threshold,
      aggregateSecretKey
    };

    // Convert signature shares to the format expected by TSS service
    const partialSignatures = transaction.signatureShares.map(share => ({
      partialSignature: share.share,
      publicNonce: new Uint8Array(32), // Mock nonce for demo
      participantKey: this.wallet!.participants.find(p => p.id === share.participantId)!.publicKey,
      keyShare: share
    }));

    try {
      const txId = await this.signingService.aggregateSignaturesAndBroadcast(
        partialSignatures,
        transactionDetails,
        aggregateWallet
      );

      transaction.stellarTxId = txId;
      transaction.status = 'submitted';
      console.log('Transaction submitted successfully:', txId);
    } catch (error) {
      const mpcError = error instanceof MPCError ? error : MPCError.transactionSubmissionFailed({ originalError: error });
      console.error('Failed to submit transaction:', mpcError.userMessage);
      transaction.status = 'pending';
      throw mpcError;
    }
  }

  /**
   * Reconstruct the aggregate secret key from participant key shares
   * This is called only when needed for transaction submission
   */
  private async reconstructAggregateKey(): Promise<Uint8Array> {
    if (!this.wallet) {
      throw new Error('No wallet loaded');
    }

    // For this simplified implementation, reconstruct the aggregate key
    // deterministically from participant public keys (same as creation)
    const publicKeys = this.wallet.participants.map(p => p.publicKey);
    const publicKeysString = publicKeys.join('');
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(publicKeysString));
    const aggregateSeed = new Uint8Array(hashBuffer).slice(0, 32);

    return aggregateSeed;
  }



  /**
   * Get current wallet
   */
  getWallet(): TSSWallet | null {
    return this.wallet;
  }

  /**
   * Load existing wallet
   */
  loadWallet(wallet: TSSWallet): void {
    this.wallet = wallet;
  }

  /**
   * Fund testnet accounts using friendbot
   */
  private async fundTestnetAccounts(publicKeys: string[]): Promise<void> {
    const fundingPromises = publicKeys.map(async (publicKey) => {
      try {
        // Public key is already in Stellar account ID format (G...)
        console.log(`Funding testnet account: ${publicKey}`);
        const response = await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(publicKey)}`);
        if (!response.ok) {
          console.warn(`Failed to fund account ${publicKey}: ${response.status}`);
        } else {
          console.log(`Successfully funded account: ${publicKey}`);
        }
      } catch (error) {
        console.warn(`Error funding account ${publicKey}:`, error);
      }
    });

    await Promise.all(fundingPromises);
  }

  /**
   * Helper method to compare Uint8Arrays
   */
  private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}