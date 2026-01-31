/**
 * Deterministic MPC/TSS Integration Tests
 *
 * These tests verify that the MPC implementation works correctly by testing:
 * - Successful 2-of-3 signing
 * - Round 1, Round 2, and Aggregation functionality
 */

import { TransactionBuilder, Networks, BASE_FEE, Operation, Asset } from '@stellar/stellar-sdk';
import { mpcSignAndSubmit } from '../src/app/sign/rounds';
import { MPCError, MPCErrorType } from '../src/lib/tss/types';

// Mock data for deterministic testing
const MOCK_TRANSACTION_XDR = 'AAAAAgAAAAA...'; // Mock XDR for testing
const MOCK_SIGNATURE = 'signature123';
const MOCK_TRANSACTION_HASH = 'hash123';

// Mock the WASM functions for deterministic testing
jest.mock('../src/lib/signer/frost_signer', () => ({
  frostDkgInit: jest.fn().mockResolvedValue({
    participants: [0, 1, 2],
    threshold: 2,
    pubkey: new Uint8Array(32).fill(1),
    keyShares: [
      { participant_id: 0, key_share: new Uint8Array(32).fill(10) },
      { participant_id: 1, key_share: new Uint8Array(32).fill(11) },
      { participant_id: 2, key_share: new Uint8Array(32).fill(12) },
    ],
    walletId: 1
  }),
  frostSignRound1: jest.fn().mockResolvedValue({
    participantId: 0,
    nonceId: 0,
    commitment: new Uint8Array(64).fill(2),
    nonces: new Uint8Array(64).fill(3)
  }),
  frostSignRound2: jest.fn().mockResolvedValue({
    participantId: 0,
    signature: new Uint8Array(64).fill(4),
    index: 0,
    shareId: 0
  }),
  frostAggregate: jest.fn().mockResolvedValue(new Uint8Array(64).fill(5))
}));

// Mock fetch for transaction submission
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
mockFetch.mockResolvedValue({
  ok: true,
  json: async () => ({ hash: MOCK_TRANSACTION_HASH }),
  text: async () => '',
  status: 200,
  statusText: 'OK'
} as Response);

describe('MPC/TSS Deterministic Tests', () => {
  let mockTransaction: any;
  let mockMPCWallet: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    mockFetch.mockClear();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ hash: MOCK_TRANSACTION_HASH }),
      text: async () => '',
      status: 200,
      statusText: 'OK'
    } as Response);

    // Create mock transaction
    mockTransaction = {
      hash: () => new Uint8Array(32).fill(6),
      toXDR: () => MOCK_TRANSACTION_XDR,
      networkPassphrase: 'Test SDF Network ; September 2015'
    };

    // Create mock MPC wallet with proper structure
    mockMPCWallet = {
      participants: [0, 1, 2],
      keyShares: new Map([
        [0, new Uint8Array(32).fill(10)],
        [1, new Uint8Array(32).fill(11)],
        [2, new Uint8Array(32).fill(12)]
      ]),
      groupPublicKey: new Uint8Array(32).fill(1),
      pubkeyPackage: new Uint8Array(32).fill(1)
    };
  });

  describe('Successful 2-of-3 MPC Signing', () => {
    test('should have properly structured mock wallet', () => {
      expect(mockMPCWallet.participants).toEqual([0, 1, 2]);
      expect(mockMPCWallet.participants.length).toBe(3);
      expect(mockMPCWallet.groupPublicKey).toBeInstanceOf(Uint8Array);
    });

    test('should successfully complete MPC signing with 2-of-3 participants', async () => {
      const result = await mpcSignAndSubmit(mockMPCWallet, mockTransaction, 1);

      expect(result).toBe(MOCK_TRANSACTION_HASH);
      expect(mockFetch).toHaveBeenCalledWith('/api/submit-transaction', expect.any(Object));
    });

    test('should call all required FROST functions in correct order', async () => {
      const { frostSignRound1, frostSignRound2, frostAggregate } = require('../src/lib/signer/frost_signer');

      await mpcSignAndSubmit(mockMPCWallet, mockTransaction, 1);

      // Verify Round 1 was called 3 times (once per participant)
      expect(frostSignRound1).toHaveBeenCalledTimes(3);

      // Verify Round 2 was called 3 times (once per participant)
      expect(frostSignRound2).toHaveBeenCalledTimes(3);

      // Verify aggregation was called
      expect(frostAggregate).toHaveBeenCalledWith(1);
    });
  });

  describe('Round Functionality', () => {
    test('should generate commitments for all participants using 1-based IDs', async () => {
      const { frostSignRound1 } = require('../src/lib/signer/frost_signer');

      await mpcSignAndSubmit(mockMPCWallet, mockTransaction, 1);

      // Verify Round 1 was called 3 times (once per participant)
      expect(frostSignRound1).toHaveBeenCalledTimes(3);
      
      // Verify each call uses correct wallet ID and participant IDs
      expect(frostSignRound1).toHaveBeenCalledWith(1, 1); // participant 1 (0+1)
      expect(frostSignRound1).toHaveBeenCalledWith(1, 2); // participant 2 (1+1)
      expect(frostSignRound1).toHaveBeenCalledWith(1, 3); // participant 3 (2+1)
    });

    test('should generate signature shares for all participants', async () => {
      const { frostSignRound2 } = require('../src/lib/signer/frost_signer');

      await mpcSignAndSubmit(mockMPCWallet, mockTransaction, 1);

      // Verify Round 2 was called 3 times (once per participant)
      expect(frostSignRound2).toHaveBeenCalledTimes(3);
    });

    test('should aggregate signatures correctly', async () => {
      const { frostAggregate } = require('../src/lib/signer/frost_signer');

      await mpcSignAndSubmit(mockMPCWallet, mockTransaction, 1);

      // Verify aggregation was called with correct wallet ID
      expect(frostAggregate).toHaveBeenCalledWith(1);
    });
  });

  describe('MPC Signing Flow', () => {
    test('should complete full MPC signing flow', async () => {
      const { frostSignRound1, frostSignRound2, frostAggregate } = require('../src/lib/signer/frost_signer');

      const result = await mpcSignAndSubmit(mockMPCWallet, mockTransaction, 1);

      // Verify the result
      expect(result).toBe(MOCK_TRANSACTION_HASH);

      // Verify all FROST functions were called
      expect(frostSignRound1).toHaveBeenCalled();
      expect(frostSignRound2).toHaveBeenCalled();
      expect(frostAggregate).toHaveBeenCalled();
    });

    test('should use provided wallet ID', async () => {
      const { frostSignRound1, frostAggregate } = require('../src/lib/signer/frost_signer');

      await mpcSignAndSubmit(mockMPCWallet, mockTransaction, 42);

      // Verify wallet ID was used
      expect(frostSignRound1).toHaveBeenCalledWith(42, expect.any(Number));
      expect(frostAggregate).toHaveBeenCalledWith(42);
    });
  });
});
