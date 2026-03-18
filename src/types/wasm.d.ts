/**
 * Type declarations for the FROST-Ed25519 WASM module
 */

declare module '/wasm/pkg/ed25519_tss_wasm.js' {
  export default function init(
    module_or_path?: RequestInfo | URL | Response | BufferSource | WebAssembly.Module
  ): Promise<any>;

  export function frost_dkg_init(num_participants: number, threshold: number): number;
  export function frost_get_pubkey_package(wallet_id: number): Uint8Array;
  export function frost_get_key_package(wallet_id: number, participant_id: number): Uint8Array;
  export function frost_sign_round1(wallet_id: number, participant_id: number): Uint8Array;
  export function frost_sign_round2(
    wallet_id: number,
    participant_id: number,
    commitments: Uint8Array,
    message: Uint8Array
  ): Uint8Array;
  export function frost_aggregate_signatures(wallet_id: number): Uint8Array;
  export function frost_get_num_participants(wallet_id: number): number;
  export function frost_get_participant_ids(wallet_id: number): Uint16Array;
  export function frost_has_participant(wallet_id: number, participant_id: number): boolean;
  export function frost_destroy_wallet(wallet_id: number): void;
}
