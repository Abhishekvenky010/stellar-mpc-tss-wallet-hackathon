#!/bin/bash
# Build the FROST WASM module for MPC wallet

set -e

echo "=== Building FROST WASM Module ==="

# Navigate to WASM directory
cd wasm

# Build with wasm-pack
echo "Building WASM module..."
wasm-pack build --target web --out-dir pkg

# Create symlink in public directory for Next.js
echo "Creating symlink in public directory..."
cd ..
mkdir -p public/wasm
cd public/wasm
if [ ! -e pkg ]; then
    ln -s ../../wasm/pkg pkg
fi

echo "=== WASM Build Complete ==="
echo ""
echo "To run the development server:"
echo "  npm run dev"
echo ""
echo "To rebuild WASM after changes:"
echo "  ./scripts/build-wasm.sh"
