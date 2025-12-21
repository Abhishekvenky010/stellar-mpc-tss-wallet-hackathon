'use client';

import { useState, useEffect } from 'react';
import { createMPCSigner } from '@/lib/mpc/ed25519';

export default function TestWasmPage() {
  const [testResult, setTestResult] = useState<string>('Testing WASM...');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function testWasm() {
      try {
        console.log('🧪 Testing WASM MPC Signer...');

        // Test 1: Create MPC signer
        const signer = await createMPCSigner();
        console.log('✅ MPC Signer created:', {
          publicKey: signer.publicKey,
          secretKeyLength: signer.secretKey.length
        });

        // Test 2: Test signing
        const message = new Uint8Array([1, 2, 3, 4, 5]);
        const signature = await signer.sign(message);
        console.log('✅ Signature created:', {
          signatureLength: signature.length,
          signature: Array.from(signature).slice(0, 10).join(',')
        });

        setTestResult(`✅ WASM Test Successful!\n\nPublic Key: ${signer.publicKey}\nSecret Key Length: ${signer.secretKey.length} bytes\nSignature Length: ${signature.length} bytes`);

      } catch (error) {
        console.error('❌ WASM Test Failed:', error);
        setTestResult(`❌ WASM Test Failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsLoading(false);
      }
    }

    testWasm();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-0">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">WASM Test Page</h1>
          <p className="text-gray-600">Testing WebAssembly Ed25519 TSS functionality</p>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-8 border border-gray-200">
          <div className="text-center">
            {isLoading ? (
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            ) : null}

            <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono bg-gray-50 p-4 rounded-lg">
              {testResult}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}