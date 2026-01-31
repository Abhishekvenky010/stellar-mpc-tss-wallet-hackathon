// Jest setup for MPC tests
import { TextEncoder, TextDecoder } from 'util';

// Polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock crypto.getRandomValues for deterministic tests
const mockGetRandomValues = (array: Uint8Array) => {
  // Use a simple deterministic pattern for testing
  for (let i = 0; i < array.length; i++) {
    array[i] = (i * 7 + 13) % 256; // Deterministic but varied values
  }
  return array;
};

Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: mockGetRandomValues,
    subtle: undefined, // Not needed for these tests
  },
});

// Mock fetch for network tests
global.fetch = jest.fn();

// Mock Buffer for tests
global.Buffer = require('buffer').Buffer;