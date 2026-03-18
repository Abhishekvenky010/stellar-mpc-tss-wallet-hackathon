/* tslint:disable */
/* eslint-disable */

export function frost_aggregate_signatures(wallet_id: number): Uint8Array;

/**
 * Clean up wallet storage
 */
export function frost_destroy_wallet(wallet_id: number): void;

export function frost_dkg_init(num_participants: number, threshold: number): number;

export function frost_get_key_package(wallet_id: number, participant_id: number): Uint8Array;

/**
 * Get the number of key packages in a wallet
 */
export function frost_get_num_participants(wallet_id: number): number;

/**
 * Get all participant IDs in a wallet (returns array of u16)
 */
export function frost_get_participant_ids(wallet_id: number): Uint16Array;

export function frost_get_pubkey_package(wallet_id: number): Uint8Array;

/**
 * Check if a participant exists in a wallet
 */
export function frost_has_participant(wallet_id: number, participant_id: number): boolean;

export function frost_sign_round1(wallet_id: number, participant_id: number): Uint8Array;

export function frost_sign_round2(wallet_id: number, participant_id: number, commitments: Uint8Array, message: Uint8Array): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
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
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
