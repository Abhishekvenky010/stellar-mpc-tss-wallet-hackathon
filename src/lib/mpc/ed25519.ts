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
    // Optional init for wasm-pack bundles
    // @ts-ignore
    if (typeof wasmModule.default === 'function') {
      await wasmModule.default();
    }

    const kp = wasmModule.Keypair.generate();
    const publicKeyBytes = Uint8Array.from(kp.public_key());
    const secretKeyBytes = Uint8Array.from(kp.secret_key());

    // Convert to Stellar public key format (base32 encoded)
    const publicKey = bytesToStellarKey(publicKeyBytes);

    return {
      publicKey,
      secretKey: secretKeyBytes,
      sign: async (message: Uint8Array): Promise<Uint8Array> => {
        const signature = wasmModule.sign(Uint8Array.from(message), Uint8Array.from(secretKeyBytes));
        return Uint8Array.from(signature);
      }
    };
  } catch (error) {
    // Fallback to Stellar SDK for consistent key derivation
    console.warn('❌ WASM module not found, falling back to Stellar SDK:', error);
    const keypair = Keypair.random();
    const secretSeed = StrKey.decodeEd25519SecretSeed(keypair.secret());
    const publicKey = keypair.publicKey();

    return {
      publicKey,
      secretKey: secretSeed,
      sign: async (message: Uint8Array): Promise<Uint8Array> => {
        const signature = keypair.sign(Buffer.from(message));
        return new Uint8Array(signature);
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
    // Optional init for wasm-pack bundles
    // @ts-ignore
    if (typeof wasmModule.default === 'function') {
      await wasmModule.default();
    }

    // Derive public key from provided secret (expect 32-byte seed, normalize if needed)
    const seed32 = secretKeyBytes.length === 32 ? secretKeyBytes : secretKeyBytes.slice(0, 32);
    const naclKeypair = nacl.sign.keyPair.fromSeed(seed32);
    const derivedPublicKey = bytesToStellarKey(naclKeypair.publicKey);

    return {
      publicKey: derivedPublicKey,
      secretKey: seed32,
      sign: async (message: Uint8Array): Promise<Uint8Array> => {
        const signature = wasmModule.sign(Uint8Array.from(message), Uint8Array.from(seed32));
        return Uint8Array.from(signature);
      }
    };
  } catch (error) {
    // Fallback to tweetnacl
    const fullSecret = secretKeyBytes.length === 64
      ? secretKeyBytes
      : nacl.sign.keyPair.fromSeed(secretKeyBytes.length === 32 ? secretKeyBytes : secretKeyBytes.slice(0, 32)).secretKey;
    const keypair = nacl.sign.keyPair.fromSecretKey(fullSecret);
    const publicKey = bytesToStellarKey(keypair.publicKey);

    return {
      publicKey,
      secretKey: fullSecret,
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