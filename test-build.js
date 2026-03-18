
const fs = require('fs');
const path = require('path');

const wasmPath = path.join(__dirname, 'public', 'wasm', 'pkg', 'ed25519_tss_wasm_bg.wasm');

if (fs.existsSync(wasmPath)) {
  console.log('✅ WebAssembly file found');
  console.log(`File size: ${(fs.statSync(wasmPath).size / 1024).toFixed(2)} KB`);
} else {
  console.error('❌ WebAssembly file not found');
  process.exit(1);
}

console.log('✅ Build process should now work on Vercel');
