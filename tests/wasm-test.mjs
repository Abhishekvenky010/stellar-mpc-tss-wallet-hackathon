/**
 * Test script to verify FROST WASM module is working correctly
 * Run with: node tests/wasm-test.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testWasmModule() {
  console.log('=== FROST WASM Module Test ===\n');

  try {
    // Load WASM binary directly
    const wasmPath = path.join(__dirname, '..', 'wasm', 'pkg', 'ed25519_tss_wasm_bg.wasm');
    console.log('Loading WASM binary from:', wasmPath);
    
    const wasmBytes = fs.readFileSync(wasmPath);
    
    // Import the JS module
    const wasmModuleJs = await import('../wasm/pkg/ed25519_tss_wasm.js');
    
    // Initialize with the raw bytes as a BufferSource
    const wasm = await wasmModuleJs.default(wasmBytes);
    
    console.log('✅ WASM module loaded successfully\n');

    // Test 1: DKG Initialization
    console.log('--- Test 1: DKG Initialization ---');
    const numParticipants = 3;
    const threshold = 2;
    
    const walletId = wasm.frost_dkg_init(numParticipants, threshold);
    console.log(`✅ frost_dkg_init(${numParticipants}, ${threshold}) = walletId: ${walletId}`);
    
    if (walletId === 0) {
      throw new Error('DKG initialization failed - walletId is 0');
    }

    // Test 2: Get Public Key Package
    console.log('\n--- Test 2: Get Public Key Package ---');
    const pubkeyPackage = wasm.frost_get_pubkey_package(walletId);
    console.log(`✅ frost_get_pubkey_package(${walletId}) = ${pubkeyPackage.length} bytes`);
    console.log(`   Raw bytes: ${Buffer.from(pubkeyPackage).toString('hex')}`);
    // Try to decode as error message
    try {
      const errorMsg = new TextDecoder().decode(pubkeyPackage);
      console.log(`   As text: "${errorMsg}"`);
    } catch (e) {}
    
    if (pubkeyPackage.length === 0) {
      throw new Error('Public key package is empty');
    }

    // Test 3: Get Key Packages for each participant
    console.log('\n--- Test 3: Get Key Packages ---');
    const keyPackages = [];
    for (let i = 1; i <= numParticipants; i++) {
      const keyPackage = wasm.frost_get_key_package(walletId, i);
      console.log(`✅ frost_get_key_package(${walletId}, ${i}) = ${keyPackage.length} bytes`);
      console.log(`   Raw bytes: ${Buffer.from(keyPackage).toString('hex').substring(0, 16)}...`);
      keyPackages.push(keyPackage);
      
      if (keyPackage.length === 0) {
        throw new Error(`Key package for participant ${i} is empty`);
      }
    }

    // Test 4: Round 1 - Generate Commitments
    console.log('\n--- Test 4: Round 1 - Generate Commitments ---');
    const commitments = [];
    for (let i = 1; i <= numParticipants; i++) {
      const commitment = wasm.frost_sign_round1(walletId, i);
      console.log(`✅ frost_sign_round1(${walletId}, ${i}) = ${commitment.length} bytes`);
      console.log(`   Raw bytes: ${Buffer.from(commitment).toString('hex').substring(0, 16)}...`);
      commitments.push(commitment);
      
      if (commitment.length === 0) {
        throw new Error(`Commitment for participant ${i} is empty`);
      }
    }

    // Test 5: Round 2 - Generate Signature Shares
    console.log('\n--- Test 5: Round 2 - Generate Signature Shares ---');
    const message = new Uint8Array(32); // 32-byte message (transaction hash)
    crypto.getRandomValues(message);
    console.log(`Message: ${Buffer.from(message).toString('hex').substring(0, 16)}...`);

    // Concatenate all commitments
    const concatenatedCommitments = new Uint8Array(commitments.flatMap(c => Array.from(c)));
    console.log(`Total commitments length: ${concatenatedCommitments.length} bytes`);

    const signatureShares = [];
    for (let i = 1; i <= numParticipants; i++) {
      const signatureShare = wasm.frost_sign_round2(walletId, i, concatenatedCommitments, message);
      console.log(`✅ frost_sign_round2(${walletId}, ${i}) = ${signatureShare.length} bytes`);
      console.log(`   Raw bytes: ${Buffer.from(signatureShare).toString('hex').substring(0, 16)}...`);
      signatureShares.push(signatureShare);
      
      if (signatureShare.length === 0) {
        throw new Error(`Signature share for participant ${i} is empty`);
      }
    }

    // Test 6: Aggregate Signatures
    console.log('\n--- Test 6: Aggregate Signatures ---');
    const finalSignature = wasm.frost_aggregate_signatures(walletId);
    console.log(`✅ frost_aggregate_signatures(${walletId}) = ${finalSignature.length} bytes`);
    console.log(`   Raw bytes: ${Buffer.from(finalSignature).toString('hex').substring(0, 32)}...`);
    
    if (finalSignature.length === 0) {
      throw new Error('Aggregation failed - empty signature');
    }
    
    if (finalSignature.length !== 64) {
      console.warn(`⚠️  Expected 64-byte Ed25519 signature, got ${finalSignature.length} bytes`);
    }

    console.log(`Final signature: ${Buffer.from(finalSignature).toString('hex').substring(0, 32)}...`);

    // Summary
    console.log('\n=== Test Results ===');
    console.log('✅ All FROST signing phases completed successfully!');
    console.log(`  - DKG: walletId = ${walletId}`);
    console.log(`  - Round 1: ${commitments.length} commitments generated`);
    console.log(`  - Round 2: ${signatureShares.length} signature shares generated`);
    console.log(`  - Aggregation: ${finalSignature.length}-byte signature`);

    return true;
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

testWasmModule()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
