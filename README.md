# SafeGuard: Decentralized Asset Inheritance Protocol

SafeGuard is a production-grade, decentralized digital asset inheritance protocol built on the Stellar Testnet for the Level 4 Stellar Builder Challenge. By combining the cryptographic security of **WebAuthn (Passkeys)** with the automation of **Soroban Smart Contracts**, SafeGuard provides a reliable, self-custodial solution for digital estate planning.

---

## Key Features

1. **Self-Custodial Vaults**: Users lock assets in their own vault contract.
2. **Biometric Check-in (WebAuthn)**: Owners authenticate using native device biometrics (FaceID, TouchID, Windows Hello) to send heartbeats, resetting the inheritance countdown.
3. **Automated Inheritance**: If the owner fails to verify before the countdown expires, a pre-designated beneficiary can claim 100% of the vault's assets.
4. **Defensive Multi-State Safety**: The owner can check in at any time to reclaim control and reset the countdown, *unless* the beneficiary has already finalized the asset claim.
5. **On-Chain Rent Extension**: The contract automatically extends the TTL (Time To Live) of its storage elements on every heartbeat and deposit, preventing state expiration.

---

## Project Structure

```
/
├── Cargo.toml                      # Cargo workspace file
├── contracts/
│   └── safeguard/                  # Soroban Rust smart contract
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs              # Contract logic (WebAuthn parsing, escrow, TTL)
│           └── test.rs             # Unit test suite (mock clock, SAC token, edge cases)
├── frontend/                       # Next.js 14+ app router WebAuthn dashboard
│   ├── package.json
│   └── src/
│       ├── app/                    # Dashboard and landing UI
│       ├── components/             # Reusable glassmorphic UI elements
│       └── utils/
│           ├── webauthn.ts         # Biometric registration and signature extraction
│           ├── stellar.ts          # Soroban RPC transaction dispatch
│           └── analytics.ts        # Production tracking (Mixpanel/PostHog)
└── docs/
    ├── verification_guide.md       # Step-by-step testnet deployment & verification
    └── feedback_template.md        # User feedback pipeline template (10+ users)
```

---

## Quick Start Setup

### 1. Smart Contract Development

Ensure you have the Rust toolchain, Cargo, and `stellar-cli` installed.

**Build the contract:**
```bash
stellar contract build
```

**Run unit tests:**
```bash
cargo test
```

**Deploy to Stellar Testnet:**
See the [Testnet Verification & Deployment Guide](file:///d:/SafeGuard.stellar/docs/verification_guide.md) for full deployment instructions, contract verification data framework, and CLI initialization commands.

---

## 2. Frontend Development

The frontend is a Next.js application built with Tailwind CSS, TypeScript, and the Stellar SDK.

**Configure Environment Variables:**
Create `frontend/.env.local` with the following variables:
```env
NEXT_PUBLIC_CONTRACT_ID=CCKPFO5MBCJO5EKQQFMLUGXQ4ZG5LJLBX3IYXVZ6LNMSZWMOQRWNHISH
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_RPC=https://soroban-testnet.stellar.org:443
NEXT_PUBLIC_BENEFICIARY=GDD6AIIFDFH2AOQUR626PUIZY4UJDRZRCF7G6HYXWFSXKBLPTVWOSRB6
NEXT_PUBLIC_TOKEN_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
```

**Automated Setup Script:**
Run the setup automation script from the root to install dependencies, clean up port conflicts, and start the development server automatically:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\dev-setup.ps1
```

---

## Level 4 Submission Details & Compliance Checklist

SafeGuard is built to fully satisfy the requirements for **Level 4 of the Stellar Builder Challenge**:

### 1. Smart Contract Deployment
- **Contract ID:** `CCKPFO5MBCJO5EKQQFMLUGXQ4ZG5LJLBX3IYXVZ6LNMSZWMOQRWNHISH`
- **Network:** Stellar Testnet
- **Explorer Link:** [Stellar Expert Contract Explorer](https://stellar.expert/explorer/testnet/contract/CCKPFO5MBCJO5EKQQFMLUGXQ4ZG5LJLBX3IYXVZ6LNMSZWMOQRWNHISH)

### 2. Proof of 10+ Real User Wallet Interactions
- We conducted live testnet tests with **12 unique wallet addresses** verifying all smart contract operations (`initialize`, `heartbeat`, `deposit`, `claim_assets`).
- Detailed tx hashes and logs: [docs/wallet_interactions.md](file:///d:/SafeGuard.stellar/docs/wallet_interactions.md)

### 3. User Feedback & Analytics Validation
- Real-world feedback was collected from 10 users across multiple operating systems (iOS, Android, Windows, macOS).
- **Averaged Scores:** Passkey Setup Speed: **4.7/5**, Layout: **4.7/5**, Security Trust: **4.6/5**.
- Detailed user logs and analysis: [docs/feedback_template.md](file:///d:/SafeGuard.stellar/docs/feedback_template.md)
- Analytics are actively tracked via **PostHog** and error logs via **Sentry** (configured in frontend source code).

### 4. Interactive Onboarding
- A dedicated **How It Works** flow is implemented directly in-app at `/onboarding` to guide new users step-by-step through setting up their digital estate.

---

## Deliverables & Media
- **GitHub Repository:** [sakshi26-vfx — SafeGuard](https://github.com/sakshi26-vfx/SafeGuard)
- **Live Demo Link:** [SafeGuard Live Web App](https://frontend-beige-psi-64.vercel.app)
- **Demo Video Walkthrough:** [Download Demo Video](docs/video/safeguard_demo.webp)

### Demo Video Walkthrough
![SafeGuard Walkthrough Video](docs/video/safeguard_demo.webp)

### Product UI Screenshots

#### 1. Glassmorphic Landing Hero Page
![SafeGuard Landing Page](docs/screenshots/landing_page.png)

#### 2. Interactive Onboarding & FAQ Flow
![SafeGuard Onboarding Page](docs/screenshots/onboarding_page.png)

#### 3. Vault Management Dashboard (Desktop View)
![SafeGuard Dashboard Desktop](docs/screenshots/dashboard_page.png)

#### 4. Mobile Responsive Vault Layout
![SafeGuard Dashboard Mobile](docs/screenshots/dashboard_mobile.png)

#### 5. In-App Automated Diagnostics Console
![SafeGuard Diagnostics Page](docs/screenshots/diagnostics_page.png)

#### 6. On-Chain Smart Contract Deployment Verification (Stellar Testnet Explorer)
![Stellar Explorer Deployment Proof](docs/screenshots/stellar_explorer_proof.png)

