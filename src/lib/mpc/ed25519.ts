import { MPCSigner } from './Signer';
import * as nacl from 'tweetnacl';
import { Keypair, StrKey } from '@stellar/stellar-sdk';

/**
 * Initialize the WASM module and create an MPC signer
 * @returns Promise resolving to an MPCSigner instance
 */
export async function createMPCSigner(): Promise<MPCSigner> {
  console.log('🔐 Attempting to load WASM MPC module...');
  try {
    // Try to import WASM module if available
    // @ts-ignore - WASM module may not exist, fallback to tweetnacl
    const wasmPath = '/wasm/ed25519_tss_wasm.js';
    console.log('📦 Loading WASM from:', wasmPath);
    // Use computed specifier to avoid bundlers from trying to bundle the wasm at build time
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const wasmModule: any = await (Function('p', 'return import(p)'))(wasmPath);

    // Initialize the WASM module
    await wasmModule.default();

    const kp = wasmModule.Keypair.generate();
    const publicKeyBytes = kp.public_key();
    const secretKeyBytes = kp.secret_key();

    // Convert to Stellar public key format (base32 encoded)
    const publicKey = bytesToStellarKey(publicKeyBytes);

    return {
      publicKey,
      secretKey: secretKeyBytes,
      sign: async (message: Uint8Array): Promise<Uint8Array> => {
        const signature = wasmModule.sign(message, secretKeyBytes);
        return signature;
      }
    };
  } catch (error) {
    // Fallback to compatible Ed25519 implementation
    console.warn('❌ WASM module not found, falling back to compatible Ed25519:', error);

    // Generate a 32-byte seed (compatible with WASM ed25519-dalek)
    const seed = new Uint8Array(32);
    crypto.getRandomValues(seed);

    // Derive keypair using tweetnacl (same as WASM)
    const keypair = nacl.sign.keyPair.fromSeed(seed);
    const publicKey = bytesToStellarKey(keypair.publicKey);

    return {
      publicKey,
      secretKey: seed,
      sign: async (message: Uint8Array): Promise<Uint8Array> => {
        const signature = nacl.sign.detached(message, keypair.secretKey);
        return signature;
      }
    };
  }
}

/**
 * Create an MPC signer from existing secret key bytes
 * @param secretKeyBytes The secret key bytes
 * @returns Promise resolving to an MPCSigner instance
 */
export async function createMPCSignerFromSecretKey(secretKeyBytes: Uint8Array): Promise<MPCSigner> {
  try {
    // @ts-ignore - WASM module may not exist, fallback to tweetnacl
    const wasmPath = '/wasm/ed25519_tss_wasm.js';
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const wasmModule: any = await (Function('p', 'return import(p)'))(wasmPath);
    // Initialize the WASM module
    await wasmModule.default();

    // Derive public key from provided secret (expect 32-byte seed, normalize if needed)
    const seed32 = secretKeyBytes.length === 32 ? secretKeyBytes : secretKeyBytes.slice(0, 32);
    const naclKeypair = nacl.sign.keyPair.fromSeed(seed32);
    const derivedPublicKey = bytesToStellarKey(naclKeypair.publicKey);

    return {
      publicKey: derivedPublicKey,
      secretKey: seed32,
      sign: async (message: Uint8Array): Promise<Uint8Array> => {
        const signature = wasmModule.sign(message, seed32);
        return signature;
      }
    };
  } catch (error) {
    // Fallback to compatible Ed25519 implementation
    console.warn('❌ WASM module not found in fromSecretKey, falling back to tweetnacl:', error);

    // Ensure we have a 32-byte seed
    const seed = secretKeyBytes.length === 32 ? secretKeyBytes : secretKeyBytes.slice(0, 32);

    // Derive keypair using tweetnacl (compatible with WASM)
    const keypair = nacl.sign.keyPair.fromSeed(seed);
    const publicKey = bytesToStellarKey(keypair.publicKey);

    return {
      publicKey,
      secretKey: seed,
      sign: async (message: Uint8Array): Promise<Uint8Array> => {
        const signature = nacl.sign.detached(message, keypair.secretKey);
        return signature;
      }
    };
  }
}

/**
 * Convert ed25519 public key bytes to Stellar public key format
 */
function bytesToStellarKey(bytes: Uint8Array): string {
  return StrKey.encodeEd25519PublicKey(Buffer.from(bytes));
}