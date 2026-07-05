#![no_std]
#[cfg(test)]
extern crate std;

use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Bytes, BytesN, Env};

mod test;

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Owner,
    MasterPasskey,
    Beneficiary,
    LastHeartbeat,
    HeartbeatWindow,
    AssetToken,
    IsClaimed,
}

// Threshold for TTL extension: if TTL < 10 days (in ledgers), extend to 30 days.
// Stellar ledger closes ~every 5 seconds. 10 days = 172800s → 34560 ledgers; 30 days = 518400s → 103680 ledgers.
const TTL_THRESHOLD: u32 = 34_560;
const TTL_TARGET: u32 = 103_680;

#[contract]
pub struct SafeGuardContract;

#[contractimpl]
impl SafeGuardContract {
    /// Initialize the vault. Must be called once. Panics if already initialized.
    pub fn initialize(
        env: Env,
        owner: Address,
        passkey_bytes: BytesN<65>,
        beneficiary: Address,
        window: u64,
        token: Address,
    ) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("Already initialized");
        }
        owner.require_auth();

        env.storage().instance().set(&DataKey::Owner, &owner);
        env.storage().instance().set(&DataKey::MasterPasskey, &passkey_bytes);
        env.storage().instance().set(&DataKey::Beneficiary, &beneficiary);
        env.storage().instance().set(&DataKey::HeartbeatWindow, &window);
        env.storage().instance().set(&DataKey::AssetToken, &token);

        let now = env.ledger().timestamp();
        env.storage().persistent().set(&DataKey::LastHeartbeat, &now);
        env.storage().persistent().set(&DataKey::IsClaimed, &false);

        Self::extend_ttl(&env);
    }

    /// Heartbeat: owner proves liveness using a WebAuthn P-256 signature.
    /// The signature is over SHA-256(authenticator_data || SHA-256(client_data_json)).
    pub fn heartbeat(
        env: Env,
        signature: BytesN<64>,
        client_data_json: Bytes,
        authenticator_data: Bytes,
    ) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        let is_claimed: bool = env
            .storage()
            .persistent()
            .get(&DataKey::IsClaimed)
            .unwrap_or(false);
        if is_claimed {
            panic!("Contract already claimed");
        }

        let master_passkey: BytesN<65> =
            env.storage().instance().get(&DataKey::MasterPasskey).unwrap();

        // Step 1: SHA-256(client_data_json)
        let client_data_hash = env.crypto().sha256(&client_data_json);

        // Step 2: Concatenate authenticator_data || client_data_hash
        let mut message = Bytes::new(&env);
        message.append(&authenticator_data);
        message.append(&client_data_hash.into());

        // Step 3: message_digest = SHA-256(authenticator_data || client_data_hash)
        let message_digest = env.crypto().sha256(&message);

        // Step 4: Verify secp256r1 signature using native host primitive
        env.crypto()
            .secp256r1_verify(&master_passkey, &message_digest, &signature);

        // Update last heartbeat timestamp
        let now = env.ledger().timestamp();
        env.storage().persistent().set(&DataKey::LastHeartbeat, &now);

        Self::extend_ttl(&env);
    }

    /// Update the master passkey. Owner-only. Allows re-linking a new browser passkey
    /// without redeploying the contract. The owner must authenticate via Freighter.
    pub fn update_passkey(env: Env, new_passkey_bytes: BytesN<65>) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        let is_claimed: bool = env
            .storage()
            .persistent()
            .get(&DataKey::IsClaimed)
            .unwrap_or(false);
        if is_claimed {
            panic!("Contract already claimed");
        }

        env.storage()
            .instance()
            .set(&DataKey::MasterPasskey, &new_passkey_bytes);

        Self::extend_ttl(&env);
    }

    /// Deposit tokens into the vault escrow. Called by the owner.
    pub fn deposit(env: Env, amount: i128) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
        owner.require_auth();

        let is_claimed: bool = env
            .storage()
            .persistent()
            .get(&DataKey::IsClaimed)
            .unwrap_or(false);
        if is_claimed {
            panic!("Contract already claimed");
        }

        let asset_token: Address = env.storage().instance().get(&DataKey::AssetToken).unwrap();
        let client = token::Client::new(&env, &asset_token);

        // Transfer tokens from owner → this contract (escrow)
        client.transfer(&owner, &env.current_contract_address(), &amount);

        Self::extend_ttl(&env);
    }

    /// Claim escrowed assets. Callable by anyone once heartbeat window has elapsed.
    /// Transfers 100% of vault token balance to the beneficiary and locks the contract.
    pub fn claim_assets(env: Env) {
        let is_claimed: bool = env
            .storage()
            .persistent()
            .get(&DataKey::IsClaimed)
            .unwrap_or(false);
        if is_claimed {
            panic!("Contract already claimed");
        }

        let last_heartbeat: u64 = env
            .storage()
            .persistent()
            .get(&DataKey::LastHeartbeat)
            .unwrap();
        let window: u64 = env
            .storage()
            .instance()
            .get(&DataKey::HeartbeatWindow)
            .unwrap();
        let now = env.ledger().timestamp();

        if now <= last_heartbeat + window {
            panic!("Heartbeat window has not expired yet");
        }

        let beneficiary: Address = env
            .storage()
            .instance()
            .get(&DataKey::Beneficiary)
            .unwrap();
        let asset_token: Address = env.storage().instance().get(&DataKey::AssetToken).unwrap();

        let client = token::Client::new(&env, &asset_token);
        let balance = client.balance(&env.current_contract_address());

        if balance > 0 {
            client.transfer(&env.current_contract_address(), &beneficiary, &balance);
        }

        // Finalize: set claimed flag to lock contract permanently
        env.storage().persistent().set(&DataKey::IsClaimed, &true);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::IsClaimed, TTL_THRESHOLD, TTL_TARGET);
    }

    // ─── Read-only Getters ──────────────────────────────────────────────────────

    pub fn get_last_heartbeat(env: Env) -> u64 {
        env.storage()
            .persistent()
            .get(&DataKey::LastHeartbeat)
            .unwrap_or(0)
    }

    pub fn get_heartbeat_window(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::HeartbeatWindow)
            .unwrap_or(0)
    }

    pub fn get_beneficiary(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Beneficiary).unwrap()
    }

    pub fn get_owner(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Owner).unwrap()
    }

    pub fn is_claimed(env: Env) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::IsClaimed)
            .unwrap_or(false)
    }

    // ─── Internal Helpers ───────────────────────────────────────────────────────

    fn extend_ttl(env: &Env) {
        env.storage()
            .instance()
            .extend_ttl(TTL_THRESHOLD, TTL_TARGET);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::LastHeartbeat, TTL_THRESHOLD, TTL_TARGET);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::IsClaimed, TTL_THRESHOLD, TTL_TARGET);
    }
}
