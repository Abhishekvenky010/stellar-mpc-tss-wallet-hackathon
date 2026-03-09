/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const frost_aggregate_signatures: (a: number) => [number, number];
export const frost_destroy_wallet: (a: number) => void;
export const frost_dkg_init: (a: number, b: number) => number;
export const frost_get_key_package: (a: number, b: number) => [number, number];
export const frost_get_num_participants: (a: number) => number;
export const frost_get_participant_ids: (a: number) => [number, number];
export const frost_get_pubkey_package: (a: number) => [number, number];
export const frost_has_participant: (a: number, b: number) => number;
export const frost_sign_round1: (a: number, b: number) => [number, number];
export const frost_sign_round2: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number];
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
