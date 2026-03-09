/**
 * Test for real FROST implementation (using the TypeScript API)
 * This test verifies that the real FROST implementation is working correctly
 * by testing the complete signing workflow.
 */

import { frostDkgInit, frostSignRound1, frostSignRound2, frostAggregate } from '../src/lib/signer/frost_signer';

describe('Real FROST Implementation Tests', () => {
  
  describe('DKG Process', () => {
    test('should initialize DKG with 3 participants and threshold 2', async () => {
      const participants = [1, 2, 3];
      const threshold = 2;
      
      const dkgResult = await frostDkgInit(participants, threshold);
      
      expect(dkgResult).toBeDefined();
      expect(dkgResult.participants).toEqual(participants);
      expect(dkgResult.threshold).toBe(threshold);
      expect(dkgResult.pubkey).toBeInstanceOf(Uint8Array);
      expect(dkgResult.pubkey.length).toBeGreaterThan(0);
      expect(dkgResult.keyShares).toHaveLength(participants.length);
      expect(dkgResult.walletId).toBeGreaterThan(0);
      
      // Verify key shares
      dkgResult.keyShares.forEach(keyShare => {
        expect(keyShare.participant_id).toBeGreaterThan(0);
        expect(keyShare.key_share).toBeInstanceOf(Uint8Array);
        expect(keyShare.key_share.length).toBeGreaterThan(0);
      });
    });

    test('should generate unique key shares for each participant', async () => {
      const participants = [1, 2, 3];
      const threshold = 2;
      
      const dkgResult = await frostDkgInit(participants, threshold);
      
      const keyShareBytes = dkgResult.keyShares.map(ks => ks.key_share.toString());
      const uniqueKeyShares = new Set(keyShareBytes);
      
      expect(uniqueKeyShares.size).toBe(participants.length);
    });
  });

  describe('Signing Process', () => {
    let walletId: number;
    let message: Uint8Array;

    beforeEach(async () => {
      // Initialize DKG before each signing test
      const participants = [1, 2, 3];
      const threshold = 2;
      const dkgResult = await frostDkgInit(participants, threshold);
      walletId = dkgResult.walletId!;
      
      // Generate a random message to sign
      message = new Uint8Array(32);
      crypto.getRandomValues(message);
    });

    test('should complete Round 1 commitment generation', async () => {
      const commitments = [];
      for (let i = 1; i <= 3; i++) {
        const commitment = await frostSignRound1(walletId, i);
        expect(commitment).toBeDefined();
        expect(commitment.participantId).toBe(i);
        expect(commitment.commitment).toBeInstanceOf(Uint8Array);
        expect(commitment.commitment.length).toBeGreaterThan(0);
        commitments.push(commitment);
      }
      
      expect(commitments).toHaveLength(3);
    });

    test('should complete Round 2 signature share generation', async () => {
      // Round 1
      const commitments = [];
      for (let i = 1; i <= 3; i++) {
        commitments.push(await frostSignRound1(walletId, i));
      }

      // Round 2
      const signatureShares = [];
      for (let i = 1; i <= 3; i++) {
        const signatureShare = await frostSignRound2(walletId, i, commitments, message);
        expect(signatureShare).toBeDefined();
        expect(signatureShare.participantId).toBe(i);
        expect(signatureShare.signature).toBeInstanceOf(Uint8Array);
        expect(signatureShare.signature.length).toBeGreaterThan(0);
        signatureShares.push(signatureShare);
      }

      expect(signatureShares).toHaveLength(3);
    });

    test('should aggregate signatures', async () => {
      // Round 1
      const commitments = [];
      for (let i = 1; i <= 3; i++) {
        commitments.push(await frostSignRound1(walletId, i));
      }

      // Round 2
      for (let i = 1; i <= 3; i++) {
        await frostSignRound2(walletId, i, commitments, message);
      }

      // Aggregation
      const finalSignature = await frostAggregate(walletId);
      expect(finalSignature).toBeInstanceOf(Uint8Array);
      expect(finalSignature.length).toBeGreaterThan(0);
    });
  });

  describe('Threshold Tests', () => {
    test('should handle 2-of-2 configuration', async () => {
      const participants = [1, 2];
      const threshold = 2;
      
      const dkgResult = await frostDkgInit(participants, threshold);
      expect(dkgResult.participants).toEqual(participants);
      expect(dkgResult.threshold).toBe(threshold);
      expect(dkgResult.keyShares).toHaveLength(2);
    });

    test('should handle 3-of-5 configuration', async () => {
      const participants = [1, 2, 3, 4, 5];
      const threshold = 3;
      
      const dkgResult = await frostDkgInit(participants, threshold);
      expect(dkgResult.participants).toEqual(participants);
      expect(dkgResult.threshold).toBe(threshold);
      expect(dkgResult.keyShares).toHaveLength(5);
    });
  });
});
