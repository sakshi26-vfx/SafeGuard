# SafeGuard Testnet Verification and Deployment Guide

This guide details the step-by-step process of building, testing, deploying, and validating the SafeGuard Smart Contract on the Stellar Testnet.

---

## 1. Prerequisites

Ensure you have the following installed:
- [Rust & Cargo](https://rustup.rs/) (edition 2021)
- [Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)
- Node.js (v18+) & npm

---

## 2. Running Automated Unit Tests

Before deploying, verify that all contract logic and test assertions pass. Run the following command in the workspace root:

```bash
cargo test
```

This tests:
- Contract initialization and double-init guards.
- Cryptographic WebAuthn signature verification using mock inputs.
- SafeGuard deposit flows (transferring mock tokens to the contract escrow).
- Heartbeat check-in timestamp updates.
- Expired claim execution (transferring 100% of escrowed tokens to the beneficiary).
- Premature claim rejection (asserting panic when claiming before expiration).
- Post-claim operation locks (preventing actions after a claim is finalized).

---

## 3. Building the Smart Contract

Build the contract optimized for production. This generates a `.wasm` binary in `target/wasm32-unknown-unknown/release/safeguard.wasm`:

```bash
stellar contract build
```

To optimize the WASM file further for rent-efficiency and size limits, use the Soroban optimizer (optional but recommended for mainnet):

```bash
stellar contract optimize --wasm target/wasm32-unknown-unknown/release/safeguard.wasm
```
The optimized WASM will be generated at `cargo-target/wasm32-unknown-unknown/release/safeguard.optimized.wasm`.

---

## 4. Deploying to Stellar Testnet

### Step A: Configure Stellar Network Settings
Add the Stellar Testnet network to your Stellar CLI configurations:

```bash
stellar network add --rpc-url "https://soroban-testnet.stellar.org:443" --network-passphrase "Test SDF Network ; September 2015" testnet
```

### Step B: Create deployment keys
Generate a funded keypair on testnet for the owner:

```bash
stellar keys generate --network testnet owner
```

This funder command automatically fetches testnet XLM via Friendbot.

### Step C: Deploy the WASM contract
Deploy the compiled, optimized WASM binary to Testnet:

```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/safeguard.wasm \
  --source owner \
  --network testnet
```

This returns a unique **Contract ID** (e.g., `CD...`). Save this ID.

---

## 5. Contract Initialization

To initialize the SafeGuard vault, invoke the `initialize` function.
You will need:
- `--owner`: The owner Address.
- `--passkey_bytes`: The 65-byte uncompressed P-256 public key (as hex).
- `--beneficiary`: The beneficiary Address.
- `--window`: Countdown window in seconds (e.g. `86400` for 24 hours).
- `--token`: The Stellar Asset Contract (SAC) Address of the token to escrow.

Example CLI invocation:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source owner \
  --network testnet \
  -- \
  initialize \
  --owner <OWNER_ADDRESS> \
  --passkey_bytes <PUBLIC_KEY_HEX> \
  --beneficiary <BENEFICIARY_ADDRESS> \
  --window 86400 \
  --token <SAC_CONTRACT_ID>
```

---

## 6. Verification and Maintenance

### Triggering Heartbeat
The owner can check in by providing the P-256 signature, client data JSON, and authenticator data:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source owner \
  --network testnet \
  -- \
  heartbeat \
  --signature <SIGNATURE_HEX> \
  --client_data_json <CLIENT_DATA_JSON_HEX> \
  --authenticator_data <AUTHENTICATOR_DATA_HEX>
```

### Executing Inheritance Claim
If the heartbeat window expires, the beneficiary or any account can trigger the asset claim:

```bash
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source beneficiary \
  --network testnet \
  -- \
  claim_assets
```

---

## 7. Frontend Integration

Copy the `<CONTRACT_ID>` and set it as an environment variable in your frontend project's `.env.local` or configuration file:

```env
NEXT_PUBLIC_CONTRACT_ID=<CONTRACT_ID>
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC=https://soroban-testnet.stellar.org:443
```
