// Type declarations for WASM module
// This file provides TypeScript types for the FROST WASM module

declare module 'ed25519_tss_wasm' {
  export function frost_aggregate_signatures(wallet_id: number): Uint8Array;
  export function frost_destroy_wallet(wallet_id: number): void;
  export function frost_dkg_init(num_participants: number, threshold: number): number;
  export function frost_get_key_package(wallet_id: number, participant_id: number): Uint8Array;
  export function frost_get_num_participants(wallet_id: number): number;
  export function frost_get_participant_ids(wallet_id: number): Uint16Array;
  export function frost_get_pubkey_package(wallet_id: number): Uint8Array;
  export function frost_has_participant(wallet_id: number, participant_id: number): boolean;
  export function frost_sign_round1(wallet_id: number, participant_id: number): Uint8Array;
  export function frost_sign_round2(wallet_id: number, participant_id: number, commitments: Uint8Array, message: Uint8Array): Uint8Array;

  type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;
  type SyncInitInput = BufferSource | WebAssembly.Module;

  interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly frost_aggregate_signatures: (a: number) => [number, number];
    readonly frost_destroy_wallet: (a: number) => void;
    readonly frost_dkg_init: (a: number, b: number) => number;
    readonly frost_get_key_package: (a: number, b: number) => [number, number];
    readonly frost_get_num_participants: (a: number) => number;
    readonly frost_get_participant_ids: (a: number) => [number, number];
    readonly frost_get_pubkey_package: (a: number) => [number, number];
    readonly frost_has_participant: (a: number, b: number) => number;
    readonly frost_sign_round1: (a: number, b: number) => [number, number];
    readonly frost_sign_round2: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
  }

  export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;
  export default function __wbg_init(module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
}
