#![cfg(test)]

use crate::{SafeGuardContract, SafeGuardContractClient};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, Bytes, BytesN, Env,
};

// ─── Pre-computed P-256 / WebAuthn test vectors ──────────────────────────────
// Generated via Node.js crypto with prime256v1 keypair.
// Public key (65-byte uncompressed SEC1: 0x04 || X || Y)
const MASTER_PASSKEY_BYTES: &[u8; 65] = &[
    0x04, 0xbd, 0xe2, 0xd0, 0x99, 0x2e, 0x31, 0xdb,
    0xbb, 0xfd, 0x32, 0xe8, 0xba, 0x25, 0x21, 0xb7,
    0xba, 0x5b, 0x32, 0x3d, 0x19, 0x48, 0x0a, 0x5f,
    0x2d, 0x88, 0x38, 0x40, 0xef, 0x34, 0x4f, 0x00,
    0xb9, 0x79, 0x2f, 0xab, 0x84, 0xc5, 0x9e, 0x3e,
    0x04, 0x00, 0x78, 0x95, 0xbc, 0x90, 0x2d, 0x90,
    0x13, 0x3e, 0xf3, 0x7f, 0xc3, 0xe8, 0xa1, 0x31,
    0xe8, 0xfd, 0xc4, 0xef, 0x10, 0x8a, 0x2f, 0x41,
    0x9c,
];

// authenticator_data bytes: "auth_data_mock_bytes" as UTF-8
const MOCK_AUTHENTICATOR_DATA: &[u8; 20] = &[
    0x61, 0x75, 0x74, 0x68, 0x5f, 0x64, 0x61, 0x74,
    0x61, 0x5f, 0x6d, 0x6f, 0x63, 0x6b, 0x5f, 0x62,
    0x79, 0x74, 0x65, 0x73,
];

// client_data_json: {"type":"webauthn.get","challenge":"Y2hhbGxlbmdl"}
const MOCK_CLIENT_DATA_JSON: &[u8; 50] = &[
    0x7b, 0x22, 0x74, 0x79, 0x70, 0x65, 0x22, 0x3a,
    0x22, 0x77, 0x65, 0x62, 0x61, 0x75, 0x74, 0x68,
    0x6e, 0x2e, 0x67, 0x65, 0x74, 0x22, 0x2c, 0x22,
    0x63, 0x68, 0x61, 0x6c, 0x6c, 0x65, 0x6e, 0x67,
    0x65, 0x22, 0x3a, 0x22, 0x59, 0x32, 0x68, 0x68,
    0x62, 0x47, 0x78, 0x6c, 0x62, 0x6d, 0x64, 0x6c,
    0x22, 0x7d,
];

// Raw 64-byte (r||s) signature over SHA256(authenticator_data || SHA256(client_data_json))
const MOCK_SIGNATURE: &[u8; 64] = &[
    0x72, 0x96, 0x25, 0x01, 0xea, 0xbd, 0x0e, 0xa6,
    0x4c, 0xbd, 0xec, 0x89, 0xc9, 0xe7, 0xce, 0x34,
    0x39, 0x93, 0x91, 0xad, 0x57, 0x9a, 0xfc, 0xbb,
    0x25, 0xce, 0x9d, 0xa8, 0x24, 0x1d, 0x92, 0x9c,
    0x7f, 0xeb, 0x96, 0xdb, 0x92, 0xd1, 0x18, 0x1a,
    0x9b, 0xa6, 0x92, 0x8a, 0x78, 0xd7, 0x0f, 0xb2,
    0x44, 0xad, 0xf0, 0xd9, 0x6c, 0x5f, 0xd4, 0x2d,
    0x34, 0xcf, 0x78, 0x2b, 0x8e, 0x04, 0x7d, 0xc2,
];

// ─── Test Harness ─────────────────────────────────────────────────────────────

fn make_passkey(env: &Env) -> BytesN<65> {
    BytesN::from_array(env, MASTER_PASSKEY_BYTES)
}

fn make_signature(env: &Env) -> BytesN<64> {
    BytesN::from_array(env, MOCK_SIGNATURE)
}

fn make_client_data_json(env: &Env) -> Bytes {
    Bytes::from_slice(env, MOCK_CLIENT_DATA_JSON)
}

fn make_authenticator_data(env: &Env) -> Bytes {
    Bytes::from_slice(env, MOCK_AUTHENTICATOR_DATA)
}

fn setup_env<'a>() -> (
    Env,
    SafeGuardContractClient<'a>,
    Address, // owner
    Address, // beneficiary
    Address, // token contract
    token::Client<'a>,
) {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy SafeGuard
    let contract_id = env.register_contract(None, SafeGuardContract);
    let client = SafeGuardContractClient::new(&env, &contract_id);

    // Deploy mock SAC token
    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::Client::new(&env, &token_id);

    // Mint 1000 tokens to owner
    let owner = Address::generate(&env);
    let beneficiary = Address::generate(&env);

    let sac = token::StellarAssetClient::new(&env, &token_id);
    sac.mint(&owner, &1000);

    (env, client, owner, beneficiary, token_id, token_client)
}

// ─── Tests ────────────────────────────────────────────────────────────────────

#[test]
fn test_initialize_sets_all_state() {
    let (env, client, owner, beneficiary, token_id, _) = setup_env();

    // Set a non-zero ledger timestamp so last_heartbeat is verifiably positive
    env.ledger().set_timestamp(1_000_000u64);

    client.initialize(
        &owner,
        &make_passkey(&env),
        &beneficiary,
        &3600u64,
        &token_id,
    );

    assert_eq!(client.get_owner(), owner);
    assert_eq!(client.get_beneficiary(), beneficiary);
    assert_eq!(client.get_heartbeat_window(), 3600u64);
    assert!(!client.is_claimed());
    assert_eq!(client.get_last_heartbeat(), 1_000_000u64);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_double_initialize_panics() {
    let (env, client, owner, beneficiary, token_id, _) = setup_env();
    let pk = make_passkey(&env);
    client.initialize(&owner, &pk, &beneficiary, &3600u64, &token_id);
    // Second call must panic
    client.initialize(&owner, &pk, &beneficiary, &3600u64, &token_id);
}

#[test]
fn test_deposit_moves_tokens_to_contract() {
    let (env, client, owner, beneficiary, token_id, token_client) = setup_env();
    client.initialize(&owner, &make_passkey(&env), &beneficiary, &3600u64, &token_id);

    assert_eq!(token_client.balance(&client.address), 0);
    client.deposit(&500i128);
    assert_eq!(token_client.balance(&client.address), 500);
    assert_eq!(token_client.balance(&owner), 500);
}

#[test]
fn test_heartbeat_resets_countdown() {
    let (env, client, owner, beneficiary, token_id, _) = setup_env();
    client.initialize(&owner, &make_passkey(&env), &beneficiary, &3600u64, &token_id);

    let initial_heartbeat = client.get_last_heartbeat();

    // Advance ledger time by 100 seconds
    env.ledger().set_timestamp(initial_heartbeat + 100);

    client.heartbeat(
        &make_signature(&env),
        &make_client_data_json(&env),
        &make_authenticator_data(&env),
    );

    // last_heartbeat should now equal the new ledger time
    assert_eq!(client.get_last_heartbeat(), initial_heartbeat + 100);
}

#[test]
fn test_heartbeat_reset_prevents_claim_within_new_window() {
    let (env, client, owner, beneficiary, token_id, _) = setup_env();
    client.initialize(&owner, &make_passkey(&env), &beneficiary, &3600u64, &token_id);

    let initial_heartbeat = client.get_last_heartbeat();

    // Check in at t=3500 (just before expiry)
    env.ledger().set_timestamp(initial_heartbeat + 3500);
    client.heartbeat(
        &make_signature(&env),
        &make_client_data_json(&env),
        &make_authenticator_data(&env),
    );

    // Now at t=4000: still inside the NEW 3600s window (4000 < 3500 + 3600 = 7100)
    // So claim must fail
    env.ledger().set_timestamp(initial_heartbeat + 4000);
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        client.claim_assets();
    }));
    assert!(result.is_err(), "Claim should have panicked inside the new window");
}

#[test]
#[should_panic(expected = "Heartbeat window has not expired yet")]
fn test_premature_claim_panics() {
    let (env, client, owner, beneficiary, token_id, _) = setup_env();
    client.initialize(&owner, &make_passkey(&env), &beneficiary, &3600u64, &token_id);
    client.deposit(&500i128);

    // No time has elapsed — window not expired
    client.claim_assets();
}

#[test]
fn test_expired_claim_transfers_full_balance_to_beneficiary() {
    let (env, client, owner, beneficiary, token_id, token_client) = setup_env();
    client.initialize(&owner, &make_passkey(&env), &beneficiary, &3600u64, &token_id);
    client.deposit(&1000i128);

    // Advance past the window
    let last_hb = client.get_last_heartbeat();
    env.ledger().set_timestamp(last_hb + 3601);

    client.claim_assets();

    // All tokens go to beneficiary, contract emptied, is_claimed = true
    assert_eq!(token_client.balance(&client.address), 0);
    assert_eq!(token_client.balance(&beneficiary), 1000);
    assert!(client.is_claimed());
}

#[test]
#[should_panic(expected = "Contract already claimed")]
fn test_post_claim_deposit_panics() {
    let (env, client, owner, beneficiary, token_id, _) = setup_env();
    client.initialize(&owner, &make_passkey(&env), &beneficiary, &3600u64, &token_id);
    client.deposit(&500i128);

    let last_hb = client.get_last_heartbeat();
    env.ledger().set_timestamp(last_hb + 3601);
    client.claim_assets();

    // Owner tries to deposit after finalization — must panic
    client.deposit(&100i128);
}

#[test]
#[should_panic(expected = "Contract already claimed")]
fn test_double_claim_panics() {
    let (env, client, owner, beneficiary, token_id, _) = setup_env();
    client.initialize(&owner, &make_passkey(&env), &beneficiary, &3600u64, &token_id);
    client.deposit(&500i128);

    let last_hb = client.get_last_heartbeat();
    env.ledger().set_timestamp(last_hb + 3601);
    client.claim_assets();

    // Second claim must panic
    client.claim_assets();
}
