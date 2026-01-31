# 🔐 Striver's Wallet - Stellar MPC-TSS Next.js Application

[![Next.js](https://img.shields.io/badge/Next.js-14.0+-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Enabled-blue.svg)](https://webassembly.org/)
[![Stellar](https://img.shields.io/badge/Stellar-Blockchain-blue.svg)](https://stellar.org/)
[![FROST](https://img.shields.io/badge/FROST-Protocol-purple.svg)](https://github.com/ZcashFoundation/frost)

**Striver's Wallet** is a modern, secure web application for multi-party computation (MPC) and threshold signature schemes (TSS) on the Stellar blockchain. Built with Next.js 14+ and WebAssembly cryptographic acceleration, this application provides a user-friendly interface for distributed transaction signing with the FROST (Flexible Round-Optimized Schnorr Threshold) protocol.

## 🚀 Features

### 🔐 **Advanced Cryptography**
- **FROST Protocol**: Modern, secure threshold signature scheme
- **Multi-Party Computation (MPC)**: Zero private key exposure during signing
- **Threshold Signature Schemes (TSS)**: Configurable m-of-n signature requirements
- **WebAssembly Acceleration**: Native Rust-based cryptographic operations (10-100x faster)
- **Ed25519 Signatures**: Strong, quantum-resistant elliptic curve cryptography

### 🖥️ **User Interface**
- **Modern Next.js 14+**: App Router with client components
- **TypeScript**: Full type safety and excellent developer experience
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Feedback**: Live status updates during cryptographic operations
- **Dark Theme**: Modern, sleek interface with smooth animations

### 🔗 **Blockchain Integration**
- **Stellar Testnet/Mainnet**: Support for both networks
- **Automatic Account Funding**: Friendbot integration for testnet
- **Transaction Monitoring**: Real-time transaction status and explorer links
- **Horizon API**: Direct integration with Stellar's API
- **Transaction Submission**: Full support for Stellar payment operations

## 🛠️ **Technology Stack**

- **Frontend**: Next.js 14+, React 18, TypeScript
- **Cryptography**: WebAssembly (Rust), FROST Protocol, Ed25519
- **Blockchain**: Stellar SDK, Horizon API
- **Styling**: Tailwind CSS with custom animations
- **Storage**: Secure browser local storage with encryption
- **Testing**: Jest, React Testing Library
- **Deployment**: Vercel/Netlify ready

## 🚀 **Quick Start**

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd stellar-mpc-tss-next

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 📋 **User Flow**

### 🏠 **Dashboard**
- Auto-creates a demo wallet on first load (2-of-3 with Alice, Bob, Charlie)
- View all your TSS wallets with key metrics
- See wallet status, threshold, and transaction counts
- Fund testnet wallets with one click using Friendbot

### 🔐 **Create MPC Wallet**
1. **Choose Network**: Select testnet (recommended) or mainnet
2. **Set Threshold**: Choose m-of-n signature requirement (e.g., 2-of-3)
3. **Add Participants**: Name your signing participants (Alice, Bob, Charlie)
4. **Generate Keys**: System creates distributed key shares automatically
5. **View Results**: See your group public key and participant details

### 💰 **Fund Wallet**
- **Testnet**: Click "Fund with Friendbot" for instant XLM funding
- **Mainnet**: Manually send XLM to the group public key address
- **Status**: Check account balance in wallet details

### 💸 **Create Transaction**
1. **Recipient**: Enter Stellar address (G... format)
2. **Amount**: Specify XLM amount to send
3. **Memo**: Optional transaction description
4. **Submit**: Creates pending transaction waiting for signatures

### ✍️ **Sign with Participants**
1. **Select Transaction**: Choose from pending transactions
2. **Choose Participant**: Select your participant identity
3. **Sign**: Add your partial signature to the transaction
4. **Status Indicators**: Real-time progress tracking of signature collection

### 📡 **Submit & Monitor**
- **Automatic Submission**: When threshold is met, transaction submits automatically
- **Explorer Links**: View transaction on Stellar Expert or Horizon
- **Status Tracking**: Real-time updates on transaction confirmation
- **Transaction Hash**: Copy TX ID for external verification

## 🎯 **Key Components**

- **WalletDashboard**: Overview of all TSS wallets with metrics
- **WalletCreator**: Interface for creating new MPC wallets
- **TransactionCreator**: Form for creating Stellar payment transactions
- **TransactionSigner**: Signature collection and aggregation interface
- **ParticipantShareExport/Import**: Secure key share management
- **DeviceManager**: Device management for multi-device support
- **MPCSimulator**: Simulation of MPC protocol execution

## 🔒 **Security & Persistence Features**

### **Cryptographic Security**
- **Zero Private Key Exposure**: Keys never exist in plaintext
- **WebAssembly Isolation**: Cryptographic operations in secure WASM environment
- **Threshold Security**: Configurable signature requirements
- **FROST Protocol**: Modern, round-optimized Schnorr threshold signatures
- **Ed25519 Signatures**: Strong, quantum-resistant cryptography

### **Data Persistence**
- **Secure Local Storage**: Encrypted wallet data storage in browser
- **Backup & Restore**: Export/import wallet configurations
- **Data Integrity**: Automatic validation of stored data
- **Migration Support**: Seamless upgrades from previous versions

## 🏗️ **Architecture**

```
stellar-mpc-tss-next/
├── src/app/                 # Next.js App Router
│   ├── api/                # API routes for blockchain interaction
│   ├── components/         # React components
│   ├── page.tsx           # Main application page
│   └── globals.css        # Global styles
├── src/lib/                # Business logic
│   ├── tss/               # TSS cryptographic operations
│   │   ├── wallet.ts      # Wallet management
│   │   ├── signing.ts     # Signature collection and aggregation
│   │   ├── device-management.ts # Device management
│   │   └── types.ts       # Type definitions
│   ├── mpc/               # MPC utilities
│   │   ├── Signer.ts      # Generic signer interface
│   │   └── ed25519.ts     # Ed25519 operations
│   ├── signer/            # FROST protocol implementation
│   │   └── frost_signer.ts # FROST signer
│   ├── storage.ts         # Browser storage utilities
│   ├── crypto.ts          # Cryptographic helpers
│   └── utils.ts           # Utility functions
├── src/types/             # TypeScript type definitions
├── public/wasm/           # WebAssembly cryptographic modules
├── frost-main/            # FROST protocol implementation (Rust)
└── tests/                 # Test files
```

## 🧪 **Testing**

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test -- --coverage

# Run specific test file
npm run test tests/wasm-test.js
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📚 **Documentation**

- **FROST Protocol**: [FROST Documentation](https://zcash.github.io/frost/)
- **Stellar SDK**: [Stellar JavaScript SDK](https://stellar.github.io/js-stellar-sdk/)
- **Horizon API**: [Stellar Horizon API](https://developers.stellar.org/docs/data/horizon/api-reference/)

**Built with ❤️ using FROST protocol for the Stellar ecosystem**
