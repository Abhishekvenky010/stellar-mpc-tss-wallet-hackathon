
const fs = require('fs');
const path = require('path');

const wasmPath = path.join(__dirname, 'public', 'wasm', 'pkg', 'ed25519_tss_wasm_bg.wasm');

if (fs.existsSync(wasmPath)) {
  console.log('✅ WebAssembly files already exist, skipping build');
} else {
  console.log('❌ WebAssembly files not found, running build:wasm');
  const { execSync } = require('child_process');
  execSync('npm run build:wasm', { stdio: 'inherit' });
}
