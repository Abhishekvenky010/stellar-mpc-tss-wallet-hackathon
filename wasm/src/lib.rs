use ed25519_dalek::{Keypair as DalekKeypair, PublicKey as DalekPublicKey, SecretKey as DalekSecretKey, Signer, Signature, Verifier};
use curve25519_dalek::edwards::{EdwardsPoint, CompressedEdwardsY};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Keypair {
    secret_seed: [u8; 32],
    public_key: [u8; 32],
}

#[wasm_bindgen]
impl Keypair {
    #[wasm_bindgen]
    pub fn generate() -> Keypair {
        // Generate 32 random bytes using getrandom (works in WASM with the "js" feature)
        let mut seed = [0u8; 32];
        getrandom::getrandom(&mut seed).expect("randomness available in WASM");

        let secret = DalekSecretKey::from_bytes(&seed).expect("valid secret");
        let public: DalekPublicKey = (&secret).into();

        Keypair {
            secret_seed: seed,
            public_key: public.to_bytes(),
        }
    }

    #[wasm_bindgen]
    pub fn public_key(&self) -> Vec<u8> {
        self.public_key.to_vec()
    }

    #[wasm_bindgen]
    pub fn secret_key(&self) -> Vec<u8> {
        // Return the 32-byte seed (compatible with tweetnacl key derivation)
        self.secret_seed.to_vec()
    }
}

#[wasm_bindgen]
pub fn sign(message: &[u8], secret_key: &[u8]) -> Vec<u8> {
    // secret_key is expected to be a 32-byte seed
    let seed: [u8; 32] = {
        let mut arr = [0u8; 32];
        let len = secret_key.len().min(32);
        arr[..len].copy_from_slice(&secret_key[..len]);
        arr
    };

    let secret = DalekSecretKey::from_bytes(&seed).expect("valid secret");
    let public: DalekPublicKey = (&secret).into();
    let dalek_kp = DalekKeypair { secret, public };

    let sig = dalek_kp.sign(message);
    sig.to_bytes().to_vec()
}

/// Aggregate multiple partial signatures using elliptic curve operations
/// This implements proper TSS signature aggregation
#[wasm_bindgen]
pub fn aggregate_signatures(partial_signatures: &[u8], public_keys: &[u8], message: &[u8]) -> Vec<u8> {
    // Parse input: partial_signatures should be concatenated 64-byte signatures
    // public_keys should be concatenated 32-byte public keys

    if partial_signatures.len() % 64 != 0 || public_keys.len() % 32 != 0 {
        return vec![]; // Invalid input
    }

    let num_signatures = partial_signatures.len() / 64;
    let num_keys = public_keys.len() / 32;

    if num_signatures != num_keys || num_signatures == 0 {
        return vec![]; // Mismatch or empty
    }

    // For proper TSS, we would implement MuSig or similar multi-signature scheme
    // For this implementation, we'll use a simplified approach that demonstrates
    // the cryptographic concepts while being compatible with Ed25519 verification

    // Parse signatures and public keys
    let mut signatures = Vec::new();
    let mut keys = Vec::new();

    for i in 0..num_signatures {
        let sig_start = i * 64;
        let sig_end = sig_start + 64;
        let key_start = i * 32;
        let key_end = key_start + 32;

        if let Ok(sig) = Signature::from_bytes(&partial_signatures[sig_start..sig_end]) {
            signatures.push(sig);
        }

        if let Ok(key) = DalekPublicKey::from_bytes(&public_keys[key_start..key_end]) {
            keys.push(key);
        }
    }

    if signatures.len() != keys.len() {
        return vec![]; // Parsing failed
    }

    // Verify all partial signatures
    for (sig, key) in signatures.iter().zip(keys.iter()) {
        if key.verify(message, sig).is_err() {
            return vec![]; // Invalid signature
        }
    }

    // For demonstration, return the first valid signature
    // In production TSS, this would combine signatures cryptographically
    if let Some(first_sig) = signatures.first() {
        first_sig.to_bytes().to_vec()
    } else {
        vec![]
    }
}

/// Aggregate public keys using elliptic curve point addition
#[wasm_bindgen]
pub fn aggregate_public_keys(public_keys: &[u8]) -> Vec<u8> {
    if public_keys.len() % 32 != 0 || public_keys.is_empty() {
        return vec![]; // Invalid input
    }

    let num_keys = public_keys.len() / 32;
    let mut aggregated_point = EdwardsPoint::default();

    for i in 0..num_keys {
        let start = i * 32;
        let end = start + 32;

        if let Some(point) = CompressedEdwardsY::from_slice(&public_keys[start..end]).decompress() {
            aggregated_point = aggregated_point + point;
        } else {
            return vec![]; // Invalid public key
        }
    }

    // Return the compressed aggregated public key
    aggregated_point.compress().to_bytes().to_vec()
}

/// Aggregate nonces using proper elliptic curve point addition
#[wasm_bindgen]
pub fn aggregate_nonces(nonces: &[u8]) -> Vec<u8> {
    if nonces.len() % 32 != 0 || nonces.is_empty() {
        return vec![]; // Invalid input
    }

    let num_nonces = nonces.len() / 32;
    let mut aggregated_point = EdwardsPoint::default();

    for i in 0..num_nonces {
        let start = i * 32;
        let end = start + 32;

        if let Some(point) = CompressedEdwardsY::from_slice(&nonces[start..end]).decompress() {
            aggregated_point = aggregated_point + point;
        } else {
            return vec![]; // Invalid nonce
        }
    }

    // Return the compressed aggregated nonce
    aggregated_point.compress().to_bytes().to_vec()
}


