# 🔐 Stellar MPC-TSS - Next.js Web Application

[![Next.js](https://img.shields.io/badge/Next.js-14.0+-black.svg)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Enabled-blue.svg)](https://webassembly.org/)
[![Stellar](https://img.shields.io/badge/Stellar-Blockchain-blue.svg)](https://stellar.org/)

**Stellar MPC-TSS** is the web interface for multi-party computation (MPC) and threshold signature schemes (TSS) on the Stellar blockchain. This Next.js application provides a user-friendly interface for secure, distributed transaction signing with WebAssembly cryptographic acceleration.

## 🚀 Features

### 🔐 **Advanced Cryptography**
- **Multi-Party Computation (MPC)**: Zero private key exposure during signing
- **Threshold Signature Schemes (TSS)**: Configurable m-of-n signature requirements
- **WebAssembly Acceleration**: Native elliptic curve operations (10-100x faster)
- **Real Stellar Integration**: Actual blockchain transaction submission and validation

### 🖥️ **User Interface**
- **Modern Next.js 14+**: App Router with server components
- **TypeScript**: Full type safety and excellent developer experience
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Feedback**: Live status updates during cryptographic operations

### 🔗 **Blockchain Integration**
- **Stellar Testnet/Mainnet**: Support for both networks
- **Automatic Account Funding**: Friendbot integration for testnet
- **Transaction Monitoring**: Real-time transaction status and explorer links
- **Horizon API**: Direct integration with Stellar's API

## 🛠️ **Technology Stack**

- **Frontend**: Next.js 14+, React 19, TypeScript
- **Cryptography**: WebAssembly (Rust), Ed25519, Elliptic Curves
- **Blockchain**: Stellar SDK, Horizon API
- **Styling**: Tailwind CSS
- **Database**: Prisma (optional for transaction history)
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

## 📋 **Usage**

### 1. **Create TSS Wallet**
- Generate participant keys
- Set threshold requirements (e.g., 2-of-3)
- Create aggregate wallet

### 2. **Fund Account**
- Automatic funding via Stellar Friendbot (testnet)
- Manual funding for mainnet deployment

### 3. **Multi-Party Signing**
- Distribute signing requests to participants
- Collect partial signatures
- Aggregate signatures using WASM cryptography
- Submit to Stellar blockchain

### 4. **Transaction Monitoring**
- Real-time transaction status
- Stellar Explorer integration
- Transaction history and audit trail

## 🔒 **Security Features**

- **Zero Private Key Exposure**: Keys never exist in plaintext
- **WebAssembly Isolation**: Cryptographic operations in secure WASM environment
- **Threshold Security**: Configurable signature requirements
- **Network Encryption**: All communications encrypted
- **Audit Trail**: Complete transaction logging

## 🏗️ **Architecture**

```
stellar-mpc-tss-next/
├── app/                    # Next.js App Router
│   ├── api/               # API routes for blockchain interaction
│   ├── components/        # React components
│   └── page.tsx          # Main application page
├── lib/                   # Business logic
│   ├── tss/              # TSS cryptographic operations
│   └── mpc/              # MPC utilities
├── public/wasm/          # WebAssembly cryptographic modules
└── prisma/               # Database schema (optional)
```

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request


<<<<<<< HEAD

## 🌟 **Hackathon Recognition**

**StellarGuard TSS** was built for blockchain hackathons, demonstrating:
- Cutting-edge cryptographic techniques
- Real-world blockchain integration
- Enterprise-grade security architecture
- Modern web development practices
- Innovative use of WebAssembly in blockchain applications

---
=======
>>>>>>> 9dfbd7dd691910c97f16e2cec335311aa43b796d

**Built with ❤️ for the Stellar ecosystem and blockchain security**
