// Simple JavaScript wrapper for the WASM module
// This provides the same interface as wasm-pack generated code

let wasmInstance = null;

async function loadWasm() {
  if (wasmInstance) return wasmInstance;

  try {
    // Load the WASM file from public directory
    const response = await fetch('/wasm/ed25519_tss_wasm.wasm\\');
    if (!response.ok) {
      throw new Error(`Failed to load WASM file: ${response.status}`);
    }
    const buffer = await response.arrayBuffer();

    // Instantiate the WASM module
    const { instance } = await WebAssembly.instantiate(buffer, {
      env: {
        abort: () => console.error('WASM abort called')
      }
    });

    wasmInstance = instance;
    console.log('✅ WASM module loaded successfully');
    return instance;
  } catch (error) {
    console.warn('❌ Failed to load WASM module:', error);
    throw error;
  }
}

// Export the WASM functions with the same interface
export async function sign(message, secretKey) {
  const instance = await loadWasm();
  // Call the WASM sign function (we'd need to export it from Rust)
  // For now, return a placeholder
  return new Uint8Array(64);
}

export async function aggregate_signatures(partialSignatures, publicKeys, message) {
  const instance = await loadWasm();
  // Call the WASM aggregate_signatures function
  // For now, return a placeholder
  return new Uint8Array(64);
}

export async function aggregate_public_keys(publicKeys) {
  const instance = await loadWasm();
  // Call the WASM aggregate_public_keys function
  // For now, return a placeholder
  return new Uint8Array(32);
}

export async function aggregate_nonces(nonces) {
  const instance = await loadWasm();
  // Call the WASM aggregate_nonces function
  // For now, return a placeholder
  return new Uint8Array(32);
}

// Keypair class (simplified)
export class Keypair {
  constructor(secretSeed, publicKey) {
    this.secretSeed = secretSeed;
    this.publicKey = publicKey;
  }

  static async generate() {
    const instance = await loadWasm();
    // Generate keypair using WASM
    // For now, return a placeholder
    const secretSeed = new Uint8Array(32);
    const publicKey = new Uint8Array(32);
    return new Keypair(secretSeed, publicKey);
  }

  public_key() {
    return Array.from(this.publicKey);
  }

  secret_key() {
    return Array.from(this.secretSeed);
  }
}