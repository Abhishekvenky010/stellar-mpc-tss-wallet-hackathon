/**
 * MPC Signer interface for secure cryptographic operations
 */
export interface MPCSigner {
  publicKey: string;
  secretKey: Uint8Array;
  sign(data: Uint8Array): Promise<Uint8Array>;
}

/**
 * MPC Keypair interface extending Stellar Keypair with MPC security
 */
export interface MPCKeypair {
  publicKey: string;
  sign(data: Uint8Array): Promise<Uint8Array>;
}