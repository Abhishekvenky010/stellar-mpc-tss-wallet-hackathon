/**
 * Network configuration for Stellar TSS operations
 */
export type StellarNetwork = 'mainnet' | 'testnet' | 'futurenet';

/**
 * TSS Keypair structure
 */
export interface TSSKeypair {
  publicKey: string;
  secretKey: Uint8Array;
}

/**
 * Partial signature for TSS aggregation
 */
export interface PartialSignature {
  signer: string;
  signature: Uint8Array;
  nonce: Uint8Array;
}

/**
 * TSS wallet aggregate data
 */
export interface AggregateWallet {
  walletId: number; // FROST wallet ID for aggregation
  aggregatedPublicKey: string;
  participantKeys: string[];
  threshold: number;
  aggregateSecretKey?: Uint8Array;
}

/**
 * Step 1 data for aggregate signing
 */
export interface AggSignStepOneData {
  secretNonce: Uint8Array;
  publicNonce: Uint8Array;
  participantKey: string;
}

/**
 * Step 2 data for aggregate signing
 */
export interface AggSignStepTwoData {
  partialSignature: Uint8Array;
  publicNonce: Uint8Array;
  participantKey: string;
  keyShare?: {
    index: number;
    share: Uint8Array;
  };
}

/**
 * Transaction details for TSS signing
 */
export interface TSSTransactionDetails {
  amount: string;
  to: string;
  from: string;
  network: StellarNetwork;
  memo?: string;
  recentBlockhash?: string;
}

/**
 * Complete TSS signature ready for broadcast
 */
export interface CompleteSignature {
  signature: Uint8Array;
  publicKey: string;
  transaction: Uint8Array;
}

/**
 * TSS Wallet Configuration
 */
export interface TSSWalletConfig {
  threshold: number;
  totalShares: number;
  publicKey: string;
  network: StellarNetwork;
}

/**
 * TSS Participant
 */
export interface TSSParticipant {
  id: string;
  publicKey: string;
  keyShare?: TSSKeyShare;
  walletId?: number; // WASM wallet ID for FROST operations
}

/**
 * TSS Key Share
 */
export interface TSSKeyShare {
  index: number;
  share: Uint8Array;
  publicKey: string;
  verificationKey: Uint8Array;
}

/**
 * TSS Signature Share
 */
export interface TSSSignatureShare {
  participantId: string;
  share: Uint8Array;
  index: number;
}

/**
 * TSS Transaction
 */
export interface TSSTransaction {
  id: string;
  from: string;
  to: string;
  amount: string;
  memo?: string;
  network: StellarNetwork;
  status: 'pending' | 'collecting' | 'signed' | 'submitted';
  signatureShares: TSSSignatureShare[];
  stellarTxId?: string;
}

/**
 * TSS Wallet
 */
export interface TSSWallet {
  config: TSSWalletConfig;
  participants: TSSParticipant[];
  transactions: TSSTransaction[];
}

/**
 * FROST DKG Package
 */
export interface DkgPackage {
  participants: number[];
  threshold: number;
  pubkey: Uint8Array;
  keyShares: KeyShare[];
  walletId?: number;
}

/**
 * FROST Key Share
 */
export interface KeyShare {
  participant_id: number;
  key_share: Uint8Array;
}

/**
 * FROST Round 1 Commitment
 */
export interface Round1Commitment {
  participantId: number;
  nonceId: number;
  commitment: Uint8Array;
  nonces: Uint8Array;
}

/**
 * FROST Round 2 Signature
 */
export interface Round2Signature {
  participantId: number;
  signature: Uint8Array;
  index: number;
  shareId: number;
}

/**
 * MPC Session types for distributed signing coordination
 */
export interface MPCSession {
  id: string;
  walletId: string;
  transactionId: string;
  status: 'waiting' | 'round1' | 'round2' | 'aggregating' | 'completed' | 'failed';
  participants: ParticipantSession[];
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantSession {
  id: string;
  name: string;
  publicKey: string;
  round1Complete: boolean;
  round2Complete: boolean;
  lastActivity: string;
}

/**
 * Custom error types for MPC/TSS operations
 */
export enum MPCErrorType {
  PARTICIPANT_MISSING = 'PARTICIPANT_MISSING',
  NONCE_REUSED = 'NONCE_REUSED',
  WRONG_THRESHOLD = 'WRONG_THRESHOLD',
  INVALID_SIGNATURE_SHARE = 'INVALID_SIGNATURE_SHARE',
  NETWORK_FAILURE = 'NETWORK_FAILURE',
  WASM_MODULE_ERROR = 'WASM_MODULE_ERROR',
  INVALID_KEY_SHARE = 'INVALID_KEY_SHARE',
  SIGNATURE_AGGREGATION_FAILED = 'SIGNATURE_AGGREGATION_FAILED',
  TRANSACTION_SUBMISSION_FAILED = 'TRANSACTION_SUBMISSION_FAILED',
  INSUFFICIENT_PARTICIPANTS = 'INSUFFICIENT_PARTICIPANTS',
  INVALID_PARTICIPANT_COUNT = 'INVALID_PARTICIPANT_COUNT'
}

export class MPCError extends Error {
  public readonly type: MPCErrorType;
  public readonly retryable: boolean;
  public readonly userMessage: string;
  public readonly details?: any;

  constructor(
    type: MPCErrorType,
    message: string,
    userMessage: string,
    retryable: boolean = false,
    details?: any
  ) {
    super(message);
    this.name = 'MPCError';
    this.type = type;
    this.userMessage = userMessage;
    this.retryable = retryable;
    this.details = details;
  }

  static participantMissing(participantId: number): MPCError {
    return new MPCError(
      MPCErrorType.PARTICIPANT_MISSING,
      `Participant ${participantId} is missing or not found`,
      `Unable to find participant ${participantId}. Please ensure all participants are available.`,
      false,
      { participantId }
    );
  }

  static nonceReused(participantId: number): MPCError {
    return new MPCError(
      MPCErrorType.NONCE_REUSED,
      `Nonce has been reused for participant ${participantId}`,
      `Security error: Nonce reuse detected for participant ${participantId}. Please restart the signing process.`,
      false,
      { participantId }
    );
  }

  static wrongThreshold(actual: number, expected: number): MPCError {
    return new MPCError(
      MPCErrorType.WRONG_THRESHOLD,
      `Wrong threshold: got ${actual}, expected ${expected}`,
      `Invalid threshold configuration. Expected ${expected} but got ${actual}.`,
      false,
      { actual, expected }
    );
  }

  static invalidSignatureShare(participantId: number): MPCError {
    return new MPCError(
      MPCErrorType.INVALID_SIGNATURE_SHARE,
      `Invalid signature share from participant ${participantId}`,
      `The signature share from participant ${participantId} is invalid. Please try again.`,
      true,
      { participantId }
    );
  }

  static networkFailure(operation: string, details?: any): MPCError {
    return new MPCError(
      MPCErrorType.NETWORK_FAILURE,
      `Network failure during ${operation}`,
      `Network connection failed during ${operation}. Please check your internet connection and try again.`,
      true,
      details
    );
  }

  static wasmModuleError(operation: string, details?: any): MPCError {
    return new MPCError(
      MPCErrorType.WASM_MODULE_ERROR,
      `WASM module error during ${operation}`,
      `Cryptographic operation failed. Please refresh the page and try again.`,
      true,
      details
    );
  }

  static invalidKeyShare(participantId: number): MPCError {
    return new MPCError(
      MPCErrorType.INVALID_KEY_SHARE,
      `Invalid key share for participant ${participantId}`,
      `The key share for participant ${participantId} is invalid. Please recreate the wallet.`,
      false,
      { participantId }
    );
  }

  static signatureAggregationFailed(reason?: string): MPCError {
    return new MPCError(
      MPCErrorType.SIGNATURE_AGGREGATION_FAILED,
      `Signature aggregation failed: ${reason || 'Unknown reason'}`,
      `Failed to combine signature shares. Please try the signing process again.`,
      true,
      { reason }
    );
  }

  static transactionSubmissionFailed(details?: any): MPCError {
    return new MPCError(
      MPCErrorType.TRANSACTION_SUBMISSION_FAILED,
      'Transaction submission to Stellar network failed',
      'Failed to submit transaction to Stellar network. Please check your account balance and network status.',
      true,
      details
    );
  }

  static insufficientParticipants(actual: number, required: number): MPCError {
    return new MPCError(
      MPCErrorType.INSUFFICIENT_PARTICIPANTS,
      `Insufficient participants: ${actual}/${required} required`,
      `Not enough participants available. Need at least ${required} participants but only ${actual} are available.`,
      false,
      { actual, required }
    );
  }

  static invalidParticipantCount(count: number): MPCError {
    return new MPCError(
      MPCErrorType.INVALID_PARTICIPANT_COUNT,
      `Invalid participant count: ${count}`,
      `Invalid number of participants: ${count}. Must be between 2 and 255.`,
      false,
      { count }
    );
  }
}

/**
 * Retry utility for network operations and recoverable errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
  backoffMultiplier: number = 2
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's not a retryable error
      if (error instanceof MPCError && !error.retryable) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      const delay = delayMs * Math.pow(backoffMultiplier, attempt);
      console.warn(`Operation failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error instanceof MPCError ? error.userMessage : error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

/**
 * Structured logging utility for MPC operations
 */
export class MPCLogger {
  private static formatLog(level: string, operation: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      operation,
      message,
      ...(data && { data })
    };

    console.log(`[MPC:${operation}] ${message}`, data ? data : '');
  }

  static info(operation: string, message: string, data?: any): void {
    this.formatLog('INFO', operation, message, data);
  }

  static warn(operation: string, message: string, data?: any): void {
    this.formatLog('WARN', operation, message, data);
  }

  static error(operation: string, message: string, data?: any): void {
    this.formatLog('ERROR', operation, message, data);
  }

  static debug(operation: string, message: string, data?: any): void {
    this.formatLog('DEBUG', operation, message, data);
  }

  // Specific MPC operation loggers
  static dkg(message: string, data?: any): void {
    this.info('DKG', message, data);
  }

  static round1(message: string, data?: any): void {
    this.info('Round1', message, data);
  }

  static round2(message: string, data?: any): void {
    this.info('Round2', message, data);
  }

  static aggregation(message: string, data?: any): void {
    this.info('Aggregation', message, data);
  }

  static submission(message: string, data?: any): void {
    this.info('Submission', message, data);
  }
}