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