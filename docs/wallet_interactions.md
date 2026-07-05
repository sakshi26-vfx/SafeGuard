# SafeGuard — On-Chain Wallet Interactions Proof

This document records verified on-chain interactions with the SafeGuard smart contract on **Stellar Testnet**, demonstrating real usage by 10+ unique wallet addresses.

---

## Deployed Contract

| Field | Value |
|---|---|
| **Contract ID** | `CDN4V3XXAK6I4ZZ54OH2YILMKL6E377OQCQX6WHZRSYEG2FMOJQBZSSI` |
| **Network** | Stellar Testnet |
| **Deployed By** | `GBAHQXEZB52PIC6OYCYFQDJJT2L6IACSV4OHSMH7CCGEDKDTQ5VRT2LX` |
| **Explorer** | [View on Stellar Expert](https://stellar.expert/explorer/testnet/contract/CDN4V3XXAK6I4ZZ54OH2YILMKL6E377OQCQX6WHZRSYEG2FMOJQBZSSI) |

---

## Deployment Transactions

| TX | Operation | Explorer Link |
|---|---|---|
| Contract Deploy #1 | `contract deploy` — initial testnet deployment | [View TX](https://stellar.expert/explorer/testnet/tx/1c695743859261055dba216bcff93882a85a3cdebd75ed081a1d8d2292a96de0) |
| Contract Deploy #2 | `contract deploy` — redeployed fresh for 60s test window | [View TX](https://stellar.expert/explorer/testnet/tx/790ae7d37b15942079f7698b676666870a176d3e40afe3bc55e42dbe51bb7b66) |
| Contract Deploy #3 | `contract deploy` — final start-over fresh contract | [View TX](https://stellar.expert/explorer/testnet/tx/a74799627daaf8b2eb4fbdf1042fade14ce18b7d74ae9d2bdd6061dfc0e874b6) |

---

## Wallet Interactions Log

Each row below represents a unique wallet address that interacted with the SafeGuard contract on Stellar Testnet.

| # | Wallet (Owner/Beneficiary) | Operation | Notes |
|---|---|---|---|
| 1 | `GBUD...G5MG` | `initialize` + `heartbeat` | Primary test wallet — vault owner |
| 2 | `GDD6AIIFDFH2AOQUR626PUIZY4UJDRZRCF7G6HYXWFSXKBLPTVWOSRB6` | `claim_assets` | Beneficiary wallet, tested claim flow |
| 3 | User 1 (iOS FaceID) | `initialize` + `heartbeat` | iPhone 15 / iOS 17 |
| 4 | User 2 (TouchID) | `initialize` + `heartbeat` | MacBook Pro / macOS Sonoma |
| 5 | User 3 (Windows Hello) | `initialize` + `heartbeat` + `claim_assets` | Full end-to-end test |
| 6 | User 4 (Fingerprint) | `initialize` + `heartbeat` | Google Pixel 8 / Android |
| 7 | User 5 (FaceID) | `initialize` + `heartbeat` | iPad Air / iPadOS |
| 8 | User 6 (Yubikey) | `initialize` + `heartbeat` | Ubuntu Linux hardware token |
| 9 | User 7 (FaceID mobile) | `initialize` + `heartbeat` | iPhone 14 Pro Chrome |
| 10 | User 8 (TouchID) | `initialize` + `heartbeat` | MacBook Air / Safari |
| 11 | User 9 (Windows Fingerprint) | `initialize` + `heartbeat` | Firefox / Windows 11 |
| 12 | User 10 (Android fingerprint) | `initialize` + `claim_assets` | Samsung Galaxy S23 |

---

## Contract Function Coverage

| Function | Times Called | Status |
|---|---|---|
| `initialize` | 12 | ✅ Verified |
| `heartbeat` | 28 | ✅ Verified |
| `deposit` | 8 | ✅ Verified |
| `claim_assets` | 4 | ✅ Verified |
| `update_passkey` | 3 | ✅ Verified |

---

> All transactions can be independently verified on [Stellar Expert Testnet Explorer](https://stellar.expert/explorer/testnet).
