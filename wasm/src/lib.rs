use wasm_bindgen::prelude::*;
use frost_ed25519 as frost;
use std::collections::BTreeMap;
use rand::rngs::OsRng;

#[wasm_bindgen]
pub fn frost_dkg_init(num_participants: usize, threshold: u16) -> u32 {
    let max_signers = num_participants as u16;
    let min_signers = threshold;
    let identifiers: Vec<frost::Identifier> = (1..=max_signers)
        .map(|i| frost::Identifier::try_from(i).unwrap())
        .collect();
    let identifiers_list = frost::keys::IdentifierList::Custom(&identifiers);
    let mut rng = OsRng;
    let (secret_shares, pubkey_package) = frost::keys::generate_with_dealer(
        max_signers,
        min_signers,
        identifiers_list,
        &mut rng,
    )
    .unwrap();

    let key_packages: BTreeMap<frost::Identifier, frost::keys::KeyPackage> = secret_shares
        .into_iter()
        .map(|(id, share)| (id, frost::keys::KeyPackage::try_from(share).unwrap()))
        .collect();

    let wallet_data = WalletData {
        pubkey_package,
        key_packages,
        nonces: BTreeMap::new(),
        signatures: BTreeMap::new(),
        signing_package: None,
    };

    let id = next_wallet_id();
    WALLET_STORAGE.lock().unwrap().insert(id, wallet_data);
    id
}

#[wasm_bindgen]
pub fn frost_get_pubkey_package(wallet_id: u32) -> Vec<u8> {
    let storage = WALLET_STORAGE.lock().unwrap();
    match storage.get(&wallet_id) {
        Some(wallet) => {
            match wallet.pubkey_package.verifying_key().serialize() {
                Ok(data) => data.to_vec(),
                Err(_) => vec![0u8; 32]
            }
        }
        None => vec![0u8; 32]
    }
}

#[wasm_bindgen]
pub fn frost_get_key_package(wallet_id: u32, participant_id: u16) -> Vec<u8> {
    let storage = WALLET_STORAGE.lock().unwrap();
    match storage.get(&wallet_id) {
        Some(wallet) => {
            let identifier = frost::Identifier::try_from(participant_id).unwrap();
            match wallet.key_packages.get(&identifier) {
                Some(key_package) => {
                    match key_package.verifying_share().serialize() {
                        Ok(data) => data.to_vec(),
                        Err(_) => vec![0u8; 32]
                    }
                }
                None => vec![0u8; 32]
            }
        }
        None => vec![0u8; 32]
    }
}

#[wasm_bindgen]
pub fn frost_sign_round1(wallet_id: u32, participant_id: u16) -> Vec<u8> {
    let identifier = frost::Identifier::try_from(participant_id).unwrap();
    let mut storage = WALLET_STORAGE.lock().unwrap();
    
    let wallet = match storage.get_mut(&wallet_id) {
        Some(w) => w,
        None => return vec![0u8; 64]
    };
    
    let key_package = match wallet.key_packages.get(&identifier) {
        Some(kp) => kp,
        None => return vec![0u8; 64]
    };
    
    let mut rng = OsRng;
    let (nonces, commitment) = frost::round1::commit(key_package.signing_share(), &mut rng);
    wallet.nonces.insert(identifier, nonces);
    
    let hiding_bytes = commitment.hiding().serialize().unwrap_or(vec![0u8; 32]);
    let binding_bytes = commitment.binding().serialize().unwrap_or(vec![0u8; 32]);
    
    let mut result = Vec::with_capacity(64);
    result.extend_from_slice(&hiding_bytes);
    result.extend_from_slice(&binding_bytes);
    result
}

#[wasm_bindgen]
pub fn frost_sign_round2(
    wallet_id: u32,
    participant_id: u16,
    commitments: &[u8],
    message: &[u8],
) -> Vec<u8> {
    let identifier = frost::Identifier::try_from(participant_id).unwrap();
    let mut storage = WALLET_STORAGE.lock().unwrap();
    
    let wallet = match storage.get_mut(&wallet_id) {
        Some(w) => w,
        None => return vec![0u8; 32]
    };
    
    let key_package = match wallet.key_packages.get(&identifier) {
        Some(kp) => kp,
        None => return vec![0u8; 32]
    };
    
    let nonces = match wallet.nonces.get(&identifier) {
        Some(n) => n,
        None => return vec![0u8; 32]
    };

    let num_participants = wallet.key_packages.len();
    
    let commitment_size = 64;
    if commitments.len() != num_participants * commitment_size {
        return vec![0u8; 32];
    }
    
    let mut commitments_vec = Vec::new();
    for i in 0..num_participants {
        let start = i * commitment_size;
        
        let hiding_bytes = &commitments[start..start+32];
        let hiding = match frost::round1::NonceCommitment::deserialize(hiding_bytes) {
            Ok(nc) => nc,
            Err(_) => return vec![0u8; 32]
        };
        
        let binding_start = start + 32;
        let binding_bytes = &commitments[binding_start..binding_start+32];
        let binding = match frost::round1::NonceCommitment::deserialize(binding_bytes) {
            Ok(nc) => nc,
            Err(_) => return vec![0u8; 32]
        };
        
        let commitment = frost::round1::SigningCommitments::new(hiding, binding);
        commitments_vec.push(commitment);
    }

    let commitments_map: BTreeMap<frost::Identifier, frost::round1::SigningCommitments> =
        (1..=num_participants)
            .zip(commitments_vec)
            .map(|(i, c)| (frost::Identifier::try_from(i as u16).unwrap(), c))
            .collect();

    let signing_package = frost::SigningPackage::new(commitments_map, message);
    let signature_share = match frost::round2::sign(&signing_package, nonces, key_package) {
        Ok(ss) => ss,
        Err(_) => return vec![0u8; 32]
    };

    if wallet.signing_package.is_none() {
        wallet.signing_package = Some(signing_package.clone());
    }
    wallet.signatures.insert(identifier, signature_share.clone());
    
    signature_share.serialize()
}

#[wasm_bindgen]
pub fn frost_aggregate_signatures(wallet_id: u32) -> Vec<u8> {
    let storage = WALLET_STORAGE.lock().unwrap();
    
    let wallet = match storage.get(&wallet_id) {
        Some(w) => w,
        None => return vec![0u8; 64]
    };

    let signing_package = match &wallet.signing_package {
        Some(sp) => sp.clone(),
        None => return vec![0u8; 64]
    };

    let signature_shares = wallet.signatures.clone();
    let pubkey_package = &wallet.pubkey_package;

    match frost::aggregate(&signing_package, &signature_shares, pubkey_package) {
        Ok(signature) => {
            match signature.serialize() {
                Ok(data) => data.to_vec(),
                Err(_) => vec![0u8; 64]
            }
        }
        Err(_) => vec![0u8; 64],
    }
}

/// Get the number of key packages in a wallet
#[wasm_bindgen]
pub fn frost_get_num_participants(wallet_id: u32) -> usize {
    let storage = WALLET_STORAGE.lock().unwrap();
    match storage.get(&wallet_id) {
        Some(wallet) => wallet.key_packages.len(),
        None => 0
    }
}

/// Get all participant IDs in a wallet (returns array of u16)
#[wasm_bindgen]
pub fn frost_get_participant_ids(wallet_id: u32) -> Vec<u16> {
    let storage = WALLET_STORAGE.lock().unwrap();
    match storage.get(&wallet_id) {
        Some(wallet) => wallet.key_packages
            .keys()
            .filter_map(|id| u16::try_from(*id).ok())
            .collect(),
        None => vec![]
    }
}

/// Check if a participant exists in a wallet
#[wasm_bindgen]
pub fn frost_has_participant(wallet_id: u32, participant_id: u16) -> bool {
    let storage = WALLET_STORAGE.lock().unwrap();
    match storage.get(&wallet_id) {
        Some(wallet) => {
            let identifier = frost::Identifier::try_from(participant_id).unwrap();
            wallet.key_packages.contains_key(&identifier)
        }
        None => false
    }
}

/// Clean up wallet storage
#[wasm_bindgen]
pub fn frost_destroy_wallet(wallet_id: u32) {
    WALLET_STORAGE.lock().unwrap().remove(&wallet_id);
}

// Simple wallet storage
struct WalletData {
    pubkey_package: frost::keys::PublicKeyPackage,
    key_packages: BTreeMap<frost::Identifier, frost::keys::KeyPackage>,
    nonces: BTreeMap<frost::Identifier, frost::round1::SigningNonces>,
    signatures: BTreeMap<frost::Identifier, frost::round2::SignatureShare>,
    signing_package: Option<frost::SigningPackage>,
}

use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref WALLET_STORAGE: Mutex<BTreeMap<u32, WalletData>> = Mutex::new(BTreeMap::new());
}

static mut NEXT_WALLET_ID: u32 = 0;

fn next_wallet_id() -> u32 {
    unsafe {
        NEXT_WALLET_ID += 1;
        NEXT_WALLET_ID
    }
}

// Re-export frost types
pub use frost::{
    Ciphersuite, Error, Field, Group, Identifier, SigningKey, VerifyingKey,
};
pub use frost::keys::{KeyPackage, PublicKeyPackage, SecretShare};
pub use frost::round1::{SigningCommitments, SigningNonces};
pub use frost::round2::SignatureShare;
pub use frost::SigningPackage;
