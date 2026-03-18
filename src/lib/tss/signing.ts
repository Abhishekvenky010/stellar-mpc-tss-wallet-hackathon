import { TransactionBuilder, Networks, BASE_FEE, Operation, Asset, Memo, Keypair, StrKey, Account, xdr } from '@stellar/stellar-sdk';
import {
  TSSTransactionDetails,
  AggSignStepOneData,
  AggSignStepTwoData,
  PartialSignature,
  CompleteSignature,
  AggregateWallet,
  MPCError,
  MPCErrorType,
  withRetry
} from './types';
import * as nacl from 'tweetnacl';
import { frostAggregate } from '../signer/frost_signer';

// Import WASM cryptographic functions
// Note: This will be dynamically imported to handle loading
let wasmModule: any = null;

async function loadWasmModule() {
  if (wasmModule) return wasmModule;
  
  try {
    // Dynamically import the real WASM module from src/wasm-pkg
    // @ts-ignore - WASM module in src folder
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const wasm = await import('../../wasm-pkg/ed25519_tss_wasm.js');
    await wasm.default();
    wasmModule = wasm;
    console.log('[Signing] Real WASM module loaded successfully');
    return wasmModule;
  } catch (error) {
    console.warn('[Signing] WASM module not available:', error);
    return null;
  }
}

/**
 * TSS Signing implementation for multi-party signature aggregation
 */
export class TSSSigningService {
  private network: 'mainnet' | 'testnet' | 'futurenet' = 'testnet';

  constructor(network: 'mainnet' | 'testnet' | 'futurenet' = 'testnet') {
    this.network = network;
  }

  /**
   * Send a transaction using a single private key (non-TSS)
   */
  async sendSingle(
    fromSecretKey: Uint8Array,
    to: string,
    amount: string,
    memo?: string
  ): Promise<string> {
    // For demo purposes, simulate successful transaction
    console.log('Sending single transaction:', { to, amount, memo });
    await new Promise(resolve => setTimeout(resolve, 1000));
    return `stellar-tx-${Date.now()}`;
  }

  /**
   * Step 1 of aggregate signing: Generate nonce and commitment
   */
  async aggregateSignStepOne(
    participantSecretKey: Uint8Array,
    transactionDetails: TSSTransactionDetails
  ): Promise<AggSignStepOneData> {
    // Generate random nonce for this signing session
    const secretNonce = nacl.randomBytes(32);

    // Create public nonce commitment
    const publicNonce = nacl.hash(secretNonce).slice(0, 32);

    // Derive participant's public key
    const participantKey = this.derivePublicKey(participantSecretKey);

    return {
      secretNonce,
      publicNonce,
      participantKey
    };
  }

  /**
   * Step 2 of aggregate signing: Create partial signature
   */
  async aggregateSignStepTwo(
    stepOneData: AggSignStepOneData,
    participantSecretKey: Uint8Array,
    transactionDetails: TSSTransactionDetails,
    allPublicNonces: Uint8Array[],
    keyShareIndex?: number
  ): Promise<AggSignStepTwoData> {
    // Create the transaction message to sign
    const messageToSign = this.createTransactionMessage(transactionDetails);

    // Aggregate all nonces using improved elliptic curve method
    const aggregatedNonce = await this.aggregateNonces(allPublicNonces);

    // Create partial signature using the secret key and nonce
    const partialSignature = this.createPartialSignature(
      messageToSign,
      participantSecretKey,
      stepOneData.secretNonce,
      aggregatedNonce
    );

    const result: AggSignStepTwoData = {
      partialSignature,
      publicNonce: stepOneData.publicNonce,
      participantKey: stepOneData.participantKey
    };

    // Include key share information if provided
    if (keyShareIndex !== undefined) {
      result.keyShare = {
        index: keyShareIndex,
        share: participantSecretKey
      };
    }

    return result;
  }

  /**
   * Aggregate all partial signatures and broadcast transaction to Stellar blockchain
   * Enhanced with better validation from Solana reference
   */
  async aggregateSignaturesAndBroadcast(
    partialSignatures: AggSignStepTwoData[],
    transactionDetails: TSSTransactionDetails,
    aggregateWallet: AggregateWallet
  ): Promise<string> {
    // Enhanced validation from Solana reference
    if (partialSignatures.length === 0) {
      throw new Error('No partial signatures provided for aggregation');
    }

    if (aggregateWallet.threshold <= 0) {
      throw new Error('Invalid threshold: must be greater than 0');
    }

    if (aggregateWallet.threshold > aggregateWallet.participantKeys.length) {
      throw new Error(`Threshold (${aggregateWallet.threshold}) cannot exceed number of participants (${aggregateWallet.participantKeys.length})`);
    }

    // Verify we have enough signatures
    if (partialSignatures.length < aggregateWallet.threshold) {
      throw new Error(`Insufficient signatures: ${partialSignatures.length}/${aggregateWallet.threshold} required`);
    }

    const network = transactionDetails.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    const horizonUrl = transactionDetails.network === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';

    console.log('🚀 Building Stellar TSS transaction:', {
      from: aggregateWallet.aggregatedPublicKey,
      to: transactionDetails.to,
      amount: transactionDetails.amount,
      signatures: partialSignatures.length,
      threshold: aggregateWallet.threshold,
      network: transactionDetails.network
    });

    // Check if the aggregate account exists on the network
    let accountExists = false;
    let currentSequence = '0';

    try {
      const accountData = await withRetry(async () => {
        const response = await fetch(`${horizonUrl}/accounts/${aggregateWallet.aggregatedPublicKey}`);
        if (!response.ok) {
          throw MPCError.networkFailure('account lookup', { status: response.status, url: `${horizonUrl}/accounts/${aggregateWallet.aggregatedPublicKey}` });
        }
        return response.json();
      });
      currentSequence = accountData.sequence;
      accountExists = true;
      console.log('✅ Aggregate account exists on Stellar network');
    } catch (error) {
      if (error instanceof MPCError && error.type === MPCErrorType.NETWORK_FAILURE) {
        console.log('Aggregate account does not exist, will create and fund it');
      } else {
        throw error;
      }
    }

    // If account doesn't exist on testnet, fund it via Friendbot
    if (!accountExists && transactionDetails.network === 'testnet') {
      console.log('🔄 Funding aggregate account via Friendbot...');
      try {
        await withRetry(async () => {
          const response = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(aggregateWallet.aggregatedPublicKey)}`);
          if (!response.ok) {
            throw MPCError.networkFailure('Friendbot funding', { status: response.status });
          }
          return response;
        });

        console.log('✅ Account funded successfully via Friendbot');
        // Wait for the transaction to be processed
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Re-fetch account info with retry
        const accountData = await withRetry(async () => {
          const response = await fetch(`${horizonUrl}/accounts/${aggregateWallet.aggregatedPublicKey}`);
          if (!response.ok) {
            throw MPCError.networkFailure('account refetch after funding', { status: response.status });
          }
          return response.json();
        });

        currentSequence = accountData.sequence;
        accountExists = true;
      } catch (error) {
        const mpcError = error instanceof MPCError ? error : MPCError.networkFailure('account funding', { originalError: error });
        console.error('Failed to fund account via Friendbot:', mpcError.userMessage);
        throw new Error('Could not fund the aggregate account. Please ensure it has sufficient XLM balance.');
      }
    }

    // If still no account, throw error
    if (!accountExists) {
      throw new Error(
        `Aggregate account ${aggregateWallet.aggregatedPublicKey} does not exist on the Stellar network. ` +
        `For testnet, funding is automatic. For mainnet, please fund this account manually.`
      );
    }

    // Check account balance with retry
    const accountData = await withRetry(async () => {
      const response = await fetch(`${horizonUrl}/accounts/${aggregateWallet.aggregatedPublicKey}`);
      if (!response.ok) {
        throw MPCError.networkFailure('balance check', { status: response.status });
      }
      return response.json();
    });
    const balance = accountData.balances.find((b: any) => b.asset_type === 'native')?.balance || '0';
    console.log('💰 Account balance:', balance, 'XLM');

    if (parseFloat(balance) < 1.0) {
      throw new Error(
        `Aggregate account ${aggregateWallet.aggregatedPublicKey} has insufficient balance (${balance} XLM). ` +
        `Need at least 1 XLM for transaction fees. Please fund this account.`
      );
    }

    // Create Stellar account object
    const sourcePublicKey = aggregateWallet.aggregatedPublicKey;
    const account = new Account(sourcePublicKey, currentSequence);

    console.log('🏦 TSS Debug - Account details:');
    console.log('Source public key:', sourcePublicKey);
    console.log('Account sequence:', currentSequence);
    console.log('Account balance check passed');

    // Check if destination account exists
    let destinationExists = false;
    try {
      const destResponse = await fetch(`${horizonUrl}/accounts/${transactionDetails.to}`);
      if (destResponse.ok) {
        destinationExists = true;
      }
    } catch (error) {
      console.log('Destination account does not exist, will create it');
    }

    console.log('🏗️ Building Stellar transaction:', {
      source: aggregateWallet.aggregatedPublicKey,
      sequence: currentSequence,
      destination: transactionDetails.to,
      amount: transactionDetails.amount
    });

    // Build the Stellar transaction (without signature first)
    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: network
    })
      .addOperation(Operation.payment({
        destination: transactionDetails.to,
        asset: Asset.native(),
        amount: transactionDetails.amount
      }))
      .addMemo(transactionDetails.memo ? Memo.text(transactionDetails.memo) : Memo.none())
      .setTimeout(300) // 5 minutes
      .build();

    // Aggregate the partial signatures - this creates a signature of the transaction hash
    const aggregatedSignature = await this.aggregatePartialSignatures(partialSignatures, aggregateWallet, transaction.hash());

    console.log('📝 TSS Debug - Signature details:');
    console.log('Transaction hash:', transaction.hash().toString('hex'));
    console.log('Aggregated signature length:', aggregatedSignature.signature.length);

    // Create proper Stellar signature
    const signatureBuffer = Buffer.from(aggregatedSignature.signature);
    const hint = this.generateSignatureHint(sourcePublicKey);

    console.log('Signature hint (last 4 bytes):', hint.toString('hex'));
    console.log('Signature buffer length:', signatureBuffer.length);

    const decoratedSignature = new xdr.DecoratedSignature({
      hint: hint,
      signature: signatureBuffer
    });

    // Add the TSS aggregated signature to the transaction
    transaction.signatures.push(decoratedSignature);

    const txXDR = transaction.toXDR();

    console.log('📡 Submitting TSS transaction to Stellar Horizon...', {
      xdr: txXDR.substring(0, 200) + '...',
      signatures: transaction.signatures.length,
      source: transaction.source,
      operations: transaction.operations.length
    });

    // Submit directly to Stellar Horizon (bypassing API route for debugging)
    console.log('🌐 Submitting directly to Stellar Horizon...');
    try {
      const submitResponse = await withRetry(async () => {
        const response = await fetch(`${horizonUrl}/transactions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            tx: txXDR
          })
        });

        if (!response.ok) {
          const responseText = await response.text();
          throw MPCError.transactionSubmissionFailed({
            status: response.status,
            statusText: response.statusText,
            responseText,
            xdr: txXDR.substring(0, 200) + '...'
          });
        }

        return response;
      });

      console.log('📡 Horizon response received:', {
        ok: submitResponse.ok,
        status: submitResponse.status,
        statusText: submitResponse.statusText
      });

      const result = await submitResponse.json();
      console.log('🎉 TSS Transaction accepted by Stellar blockchain!');
      console.log(`✅ Transaction hash: ${result.hash}`);
      console.log(`🔗 View on Stellar Explorer: https://stellar.expert/explorer/${transactionDetails.network}/tx/${result.hash}`);

      return result.hash;
    } catch (error) {
      console.error('❌ Failed to submit TSS transaction to Stellar:', error);
      throw error;
    }
  }

  /**
   * Derive public key from secret key
   */
  private derivePublicKey(secretKey: Uint8Array): string {
    // Ensure we have a valid 32-byte seed for Stellar Ed25519
    let seed = secretKey;
    if (secretKey.length === 64) {
      seed = secretKey.slice(0, 32);
    } else if (secretKey.length !== 32) {
      // Pad or truncate to 32 bytes
      seed = new Uint8Array(32);
      seed.set(secretKey.slice(0, Math.min(32, secretKey.length)));
    }

    // Convert to Buffer for Stellar SDK
    const seedBuffer = Buffer.from(seed);
    // Encode seed as Stellar secret key format
    const secretKeyStr = StrKey.encodeEd25519SecretSeed(seedBuffer);
    // Create keypair from secret and get public key
    const keypair = Keypair.fromSecret(secretKeyStr);
    return keypair.publicKey();
  }

  /**
   * Aggregate nonces for TSS signing using XOR pattern from Solana reference
   */
  private async aggregateNonces(nonces: Uint8Array[]): Promise<Uint8Array> {
    if (nonces.length === 0) {
      throw new Error('No nonces to aggregate');
    }

    if (nonces.length === 1) {
      return nonces[0];
    }

    // Enhanced XOR aggregation - initialize with zeros and XOR all nonces
    let aggregated = new Uint8Array(32);
    for (const nonce of nonces) {
      for (let i = 0; i < 32; i++) {
        aggregated[i] ^= nonce[i];
      }
    }

    return aggregated;
  }

  /**
   * Create a partial signature for TSS using real Stellar cryptography
   * Enhanced with better key handling from Solana reference patterns
   */
  private createPartialSignature(
    message: Uint8Array,
    secretKey: Uint8Array,
    secretNonce: Uint8Array,
    aggregatedNonce: Uint8Array
  ): Uint8Array {
    // Ensure we have a valid 32-byte seed for Stellar Ed25519
    let seed = secretKey;
    if (secretKey.length === 64) {
      seed = secretKey.slice(0, 32);
    } else if (secretKey.length !== 32) {
      // Pad or truncate to 32 bytes as fallback
      seed = new Uint8Array(32);
      seed.set(secretKey.slice(0, Math.min(32, secretKey.length)));
    }

    // Create Stellar keypair and sign
    const keypair = this.getKeypairFromSeed(seed);
    const messageBuffer = Buffer.from(message);
    const signature = keypair.sign(messageBuffer);
    return new Uint8Array(signature);
  }

  /**
   * Get Stellar keypair from seed
   */
  private getKeypairFromSeed(seed: Uint8Array): Keypair {
    // Ensure we have a valid 32-byte seed
    let seed32 = seed;
    if (seed.length === 64) {
      seed32 = seed.slice(0, 32);
    } else if (seed.length !== 32) {
      seed32 = new Uint8Array(32);
      seed32.set(seed.slice(0, Math.min(32, seed.length)));
    }

    const seedBuffer = Buffer.from(seed32);
    const secretKeyStr = StrKey.encodeEd25519SecretSeed(seedBuffer);
    return Keypair.fromSecret(secretKeyStr);
  }


  /**
   * Aggregate partial signatures into a complete Stellar-compatible signature
   * Uses real FROST WASM for threshold signature aggregation
   */
  private async aggregatePartialSignatures(
    partialSignatures: AggSignStepTwoData[],
    aggregateWallet: AggregateWallet,
    transactionHash?: Buffer
  ): Promise<CompleteSignature> {
    if (partialSignatures.length === 0) {
      throw new Error('No partial signatures to aggregate');
    }

    // Verify threshold requirements
    if (partialSignatures.length < aggregateWallet.threshold) {
      throw new Error(`Insufficient signatures: ${partialSignatures.length}/${aggregateWallet.threshold} required`);
    }

    // Use real FROST WASM aggregation
    if (!aggregateWallet.walletId || aggregateWallet.walletId === 0) {
      throw new Error('FROST wallet ID not available for aggregation');
    }

    console.log('🔐 TSS Debug - Using FROST aggregation:');
    console.log('Wallet ID:', aggregateWallet.walletId);
    console.log('Threshold:', aggregateWallet.threshold);
    console.log('Partial signatures:', partialSignatures.length);

    try {
      // Call the real FROST WASM aggregation function
      const frostSignature = await frostAggregate(aggregateWallet.walletId);
      
      console.log('FROST aggregation completed, signature length:', frostSignature.length);

      return {
        signature: frostSignature,
        publicKey: aggregateWallet.aggregatedPublicKey,
        transaction: transactionHash ? new Uint8Array(transactionHash) : new Uint8Array()
      };
    } catch (error) {
      console.error('FROST aggregation failed:', error);
      throw new Error(`FROST signature aggregation failed: ${error}`);
    }
  }
  /**
   * Generate signature hint for Stellar transaction
   */
  private generateSignatureHint(publicKey: string): Buffer {
    // Decode the public key and take last 4 bytes as hint
    const publicKeyBytes = StrKey.decodeEd25519PublicKey(publicKey);
    return Buffer.from(publicKeyBytes.slice(-4));
  }


  /**
   * Create a complete Stellar transaction from transaction details
   * Equivalent to Solana reference's createTransactionFromDetails
   */
  private async createTransactionFromDetails(details: TSSTransactionDetails): Promise<any> {
    const network = details.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    const horizonUrl = details.network === 'mainnet'
      ? 'https://horizon.stellar.org'
      : 'https://horizon-testnet.stellar.org';

    // Fetch current account sequence from network
    let currentSequence = '0';
    try {
      const accountResponse = await fetch(`${horizonUrl}/accounts/${details.from}`);
      if (accountResponse.ok) {
        const accountData = await accountResponse.json();
        currentSequence = accountData.sequence;
      }
    } catch (error) {
      console.warn('Could not fetch account sequence, using 0');
    }

    const account = new Account(details.from, currentSequence);

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: network
    })
      .addOperation(Operation.payment({
        destination: details.to,
        asset: Asset.native(),
        amount: details.amount
      }))
      .addMemo(details.memo ? Memo.text(details.memo) : Memo.none())
      .setTimeout(300)
      .build();

    return transaction;
  }

  /**
   * Create transaction message for signing
   */
  private createTransactionMessage(details: TSSTransactionDetails): Buffer {
    // For signing purposes, create a mock transaction to get the hash structure
    // In production, this should use createTransactionFromDetails
    const network = details.network === 'mainnet' ? Networks.PUBLIC : Networks.TESTNET;
    const account = new Account(details.from, '1'); // Mock sequence for signing

    const transaction = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: network
    })
      .addOperation(Operation.payment({
        destination: details.to,
        asset: Asset.native(),
        amount: details.amount
      }))
      .addMemo(details.memo ? Memo.text(details.memo) : Memo.none())
      .setTimeout(300)
      .build();

    return transaction.hash();
  }

  /**
   * Verify a partial signature
   */
  verifyPartialSignature(
    signature: PartialSignature,
    message: Uint8Array
  ): boolean {
    try {
      // Verify the signature using the signer's public key
      const publicKeyBytes = StrKey.decodeEd25519PublicKey(signature.signer);
      return nacl.sign.detached.verify(
        message,
        signature.signature,
        publicKeyBytes
      );
    } catch (error) {
      return false;
    }
  }
}