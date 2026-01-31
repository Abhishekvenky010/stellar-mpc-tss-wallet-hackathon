// Type declarations for WASM FROST functions
declare module '*/ed25519_tss_wasm.js' {
  // Initialize WASM module
  export default function init(module_or_path?: string): Promise<void>;

  // Existing functions
  export function sign(message: Uint8Array, secret_key: Uint8Array): Uint8Array;
  export function aggregate_signatures(partial_signatures: Uint8Array, public_keys: Uint8Array, message: Uint8Array): Uint8Array;
  export function aggregate_public_keys(public_keys: Uint8Array): Uint8Array;
  export function aggregate_nonces(nonces: Uint8Array): Uint8Array;

  // FROST DKG functions
  export function frost_dkg_init(num_participants: number, threshold: number): number;
  export function frost_get_pubkey_package(wallet_id: number): Uint8Array;
  export function frost_get_key_package(wallet_id: number, participant_id: number): Uint8Array;

  // FROST signing functions
  export function frost_sign_round1(wallet_id: number, participant_id: number): Uint8Array;
  export function frost_sign_round2(wallet_id: number, participant_id: number, commitments: Uint8Array, message: Uint8Array): Uint8Array;
  export function frost_aggregate_signatures(wallet_id: number): Uint8Array;
}