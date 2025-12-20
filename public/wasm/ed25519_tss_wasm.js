// WASM module interface for ed25519_tss_wasm
// This provides the interface expected by the MPC signer

let wasmInstance = null;
let wasmExports = null;

async function loadWasm() {
  if (wasmInstance) return { instance: wasmInstance, exports: wasmExports };

  try {
    // Load the WASM file
    const response = await fetch('/wasm/ed25519_tss_wasm.wasm');
    const buffer = await response.arrayBuffer();

    // Instantiate the WASM module
    const { instance } = await WebAssembly.instantiate(buffer, {
      // No imports needed for this WASM module
    });

    wasmInstance = instance;
    wasmExports = instance.exports;

    return { instance, exports: wasmExports };
  } catch (error) {
    console.error('Failed to load WASM module:', error);
    throw error;
  }
}

// Export the WASM functions with the expected interface
export async function sign(message, secretKey) {
  const { exports } = await loadWasm();

  // Convert inputs to Uint8Arrays
  const msgArray = new Uint8Array(message);
  const keyArray = new Uint8Array(secretKey);

  // Call the WASM sign function
  const signature = exports.sign(msgArray, keyArray);
  return signature;
}

export async function aggregate_signatures(partialSignatures, publicKeys, message) {
  const { exports } = await loadWasm();

  // Convert inputs
  const sigArray = new Uint8Array(partialSignatures);
  const keyArray = new Uint8Array(publicKeys);
  const msgArray = new Uint8Array(message);

  // Call WASM function
  const result = exports.aggregate_signatures(sigArray, keyArray, msgArray);
  return result;
}

export async function aggregate_public_keys(publicKeys) {
  const { exports } = await loadWasm();

  const keyArray = new Uint8Array(publicKeys);
  const result = exports.aggregate_public_keys(keyArray);
  return result;
}

export async function aggregate_nonces(nonces) {
  const { exports } = await loadWasm();

  const nonceArray = new Uint8Array(nonces);
  const result = exports.aggregate_nonces(nonceArray);
  return result;
}

// Keypair class that uses WASM
export class Keypair {
  constructor(secretSeed, publicKey) {
    this.secretSeed = secretSeed;
    this.publicKey = publicKey;
  }

  static async generate() {
    const { exports } = await loadWasm();

    const keypair = exports.Keypair.generate();
    const secretSeed = keypair.secret_key();
    const publicKey = keypair.public_key();
    return new Keypair(secretSeed, publicKey);
  }

  public_key() {
    return Array.from(this.publicKey);
  }

  secret_key() {
    return Array.from(this.secretSeed);
  }
}