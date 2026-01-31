# Threat Model

This document describes the security properties of the MPC-TSS system and what happens under various compromise scenarios.

## Core Security Properties

### Private Key Never Exists
In a Threshold Signature Scheme (TSS), the master private key **never exists in any single location**. The key is split into shares using Shamir's Secret Sharing combined with FROST (Flexible Round-Optimized Threshold Signatures).

- During DKG (Distributed Key Generation), each participant receives a **key share**
- No participant ever sees the full private key
- The master key is computed **ephemerally** during signing operations but never stored

### Threshold Protection
The system uses a (t, n) threshold scheme where:
- **n** = total number of participants
- **t** = minimum participants required to sign (typically t = ceil(n/2))

With a 2-of-3 threshold:
- Any 2 participants can create a valid signature
- No single participant can sign alone
- Even if 1 participant is completely compromised, funds remain secure

### No Single Signer Can Steal Funds
Because threshold signatures require collaboration:
- A single compromised participant cannot produce a valid signature alone
- Attackers would need to compromise **t** participants simultaneously
- This dramatically increases the difficulty of theft

---

## Compromise Scenarios

### 1. Single Participant Hacked

**Scenario:** One participant's device is compromised by malware, giving an attacker access to their key share.

**Impact:**
- **LOW RISK** for theft
- Attacker gains access to **one** key share
- Cannot sign transactions alone (need t participants)
- **No immediate fund theft possible**

**Mitigations:**
- Threshold requirement prevents single-point compromise
- Participants can initiate key refreshment protocol
- Compromised participant can be rotated out via DKG re-run

**What the attacker can do:**
- See their own key share (useless alone)
- Attempt to collude with other compromised participants
- Cannot move funds without meeting threshold

---

### 2. Frontend Compromised

**Scenario:** The web application's frontend is hacked, either through:
- XSS (Cross-Site Scripting) attack
- Compromised CDN or dependencies
- Malicious browser extension

**Impact:**
- **MEDIUM RISK** for metadata leakage
- Attacker can observe user interactions
- Can modify transaction details before signing

**What the attacker CANNOT do:**
- Access WASM memory directly
- Extract key shares from the browser's WebWorker sandbox
- Sign transactions without participant cooperation

**What the attacker CAN do:**
- Intercept transaction details (to, amount)
- Attempt to trick users into signing malicious transactions
- Display fake transaction confirmations

**Mitigations:**
- Use hardware security modules (HSMs) for critical operations
- Implement transaction verification on air-gapped devices
- Use secure coding practices to prevent XSS
- Show transaction hashes for verification

---

### 3. Backend Compromised

**Scenario:** The backend server is hacked, giving attackers access to:
- Server code and configuration
- Database of public keys and metadata
- Session storage
- API endpoints

**Impact:**
- **LOW RISK** for fund theft
- Backend **never** has access to key shares
- Backend only stores public information

**What the attacker CANNOT do:**
- Access private keys (they don't exist on backend)
- Sign transactions (requires participant shares)
- Decrypt sensitive participant data

**What the attacker CAN do:**
- Access public keys and metadata
- Monitor transaction metadata (who signed, when)
- Attempt to disrupt service (DoS)
- Modify non-critical configuration

**Mitigations:**
- Backend follows zero-trust principles
- All cryptographic operations happen client-side
- Regular security audits and penetration testing
- Infrastructure hardening

---

## Defense-in-Depth Strategy

| Layer | Protection |
|-------|------------|
| **Cryptographic** | Threshold signatures, Shamir's Secret Sharing |
| **Browser** | WebWorker isolation, WASM sandbox |
| **Network** | TLS encryption, API authentication |
| **Infrastructure** | Server hardening, monitoring, backups |
| **Operational** | Key rotation, incident response plan |

---

## Key Refreshment

The system supports **key share refreshment** without changing the master public key:

1. Participants run a new DKG round
2. New key shares are distributed
3. Old shares become invalid
4. Master key remains the same

This allows recovery from compromise:
- Detected compromised participant can be rotated out
- All participants receive new shares
- No need to move funds to a new wallet

---

## Summary

| Attack Vector | Risk Level | Reason |
|--------------|------------|--------|
| Single participant hacked | **LOW** | Threshold requires multiple participants |
| Frontend compromised | **MEDIUM** | Can observe/modify but can't access keys |
| Backend compromised | **LOW** | Backend never has private key access |

The MPC-TSS architecture ensures that **no single point of failure** exists for key management, providing strong security guarantees against both external attackers and insider threats.
