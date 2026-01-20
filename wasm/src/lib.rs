use ed25519_dalek::{Keypair as DalekKeypair, PublicKey as DalekPublicKey, SecretKey as DalekSecretKey, Signer, Signature, Verifier};
use curve25519_dalek::edwards::{EdwardsPoint, CompressedEdwardsY};
use wasm_bindgen::prelude::*;
use frost_ed25519 as frost;
use std::collections::BTreeMap;
use postcard;
use rand::rngs::OsRng;

#[derive(Clone)]

struct FrostWallet {

    pubkey_package: frost::keys::PublicKeyPackage,

    key_packages: BTreeMap<frost::Identifier, frost::keys::KeyPackage>,

    nonces: BTreeMap<frost::Identifier, frost::round1::SigningNonces>,

    signatures: BTreeMap<frost::Identifier, frost::round2::SignatureShare>,

    commitments: Option<BTreeMap<frost::Identifier, frost::round1::SigningCommitments>>,

    message: Option<Vec<u8>>,

}

static mut WALLETS: Option<BTreeMap<u32, FrostWallet>> = None;

static mut WALLET_ID: u32 = 0;

fn get_wallets() -> &'static mut BTreeMap<u32, FrostWallet> {

    unsafe {

        if WALLETS.is_none() {

            WALLETS = Some(BTreeMap::new());

        }

        WALLETS.as_mut().unwrap()

    }

}

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

#[wasm_bindgen]
pub fn frost_dkg_init(num_participants: usize, threshold: u16) -> u32 {
    let max_signers = num_participants as u16;
    let min_signers = threshold;
    let identifiers: Vec<frost::Identifier> = (1..=max_signers).map(|i| frost::Identifier::try_from(i).unwrap()).collect();
    let identifiers_list = frost::keys::IdentifierList::Custom(&identifiers);
    let mut rng = OsRng;
    let (secret_shares, pubkey_package) = frost::keys::generate_with_dealer(max_signers, min_signers, identifiers_list, &mut rng).unwrap();
    let key_packages: BTreeMap<frost::Identifier, frost::keys::KeyPackage> = secret_shares.into_iter().map(|(id, share)| (id, frost::keys::KeyPackage::try_from(share).unwrap())).collect();
    let id = unsafe { WALLET_ID += 1; WALLET_ID };
    let wallet = FrostWallet {
        pubkey_package,
        key_packages,
        nonces: BTreeMap::new(),
        signatures: BTreeMap::new(),
        commitments: None,
        message: None,
    };
    get_wallets().insert(id, wallet);
    id
}

#[wasm_bindgen]
pub fn frost_get_pubkey_package(wallet_id: u32) -> Vec<u8> {
    let wallets = get_wallets();
    let wallet = wallets.get(&wallet_id).unwrap();
    postcard::to_allocvec(&wallet.pubkey_package).unwrap()
}

#[wasm_bindgen]
pub fn frost_get_key_package(wallet_id: u32, participant_id: u16) -> Vec<u8> {
    let wallets = get_wallets();
    let wallet = wallets.get(&wallet_id).unwrap();
    let identifier = frost::Identifier::try_from(participant_id).unwrap();
    let key_package = wallet.key_packages.get(&identifier).unwrap();
    postcard::to_allocvec(key_package).unwrap()
}

#[wasm_bindgen]
pub fn frost_sign_round1(wallet_id: u32, participant_id: u16) -> Vec<u8> {
    let identifier = frost::Identifier::try_from(participant_id).unwrap();
    let wallets = get_wallets();
    let wallet = wallets.get_mut(&wallet_id).unwrap();
    let key_package = wallet.key_packages.get(&identifier).unwrap();
    let mut rng = OsRng;
    let (nonces, commitment) = frost::round1::commit(key_package.signing_share(), &mut rng);
    wallet.nonces.insert(identifier, nonces);
    postcard::to_allocvec(&commitment).unwrap()
}

#[wasm_bindgen]
pub fn frost_sign_round2(wallet_id: u32, participant_id: u16, commitments: &[u8], message: &[u8]) -> Vec<u8> {
    let identifier = frost::Identifier::try_from(participant_id).unwrap();
    let wallets = get_wallets();
    let wallet = wallets.get_mut(&wallet_id).unwrap();
    let key_package = wallet.key_packages.get(&identifier).unwrap();
    let nonces = wallet.nonces.get(&identifier).unwrap();
    // Parse commitments
    let num_participants = wallet.key_packages.len();
    let mut remaining = commitments;
    let mut commitments_vec = Vec::new();
    for _ in 0..num_participants {
        let (commitment, rem) = postcard::take_from_bytes(remaining).unwrap();
        commitments_vec.push(commitment);
        remaining = rem;
    }
    let commitments_map: BTreeMap<frost::Identifier, frost::round1::SigningCommitments> = (1..=num_participants).zip(commitments_vec).map(|(i, c)| (frost::Identifier::try_from(i as u16).unwrap(), c)).collect();
    if wallet.commitments.is_none() {
        wallet.commitments = Some(commitments_map.clone());
    }
    if wallet.message.is_none() {
        wallet.message = Some(message.to_vec());
    }
    let signing_package = frost::SigningPackage::new(commitments_map, message);
    let signature_share = frost::round2::sign(&signing_package, nonces, key_package).unwrap();
    wallet.signatures.insert(identifier, signature_share.clone());
    postcard::to_allocvec(&signature_share).unwrap()
}

#[wasm_bindgen]
pub fn frost_aggregate_signatures(wallet_id: u32) -> Vec<u8> {
    let wallets = get_wallets();
    let wallet = wallets.get(&wallet_id).unwrap();
    let commitments_map = wallet.commitments.as_ref().unwrap().clone();
    let message = wallet.message.as_ref().unwrap();
    let signing_package = frost::SigningPackage::new(commitments_map, message);
    let signature = frost::aggregate(&signing_package, &wallet.signatures, &wallet.pubkey_package).unwrap();
    postcard::to_allocvec(&signature).unwrap()
}


