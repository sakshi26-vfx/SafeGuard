# SafeGuard User Feedback and Validation Strategy

This document outlines the pipeline for testing the SafeGuard inheritance protocol with 10+ real testnet users. It includes the user feedback questionnaire, test scenarios, evaluation metrics, and a raw feedback log.

---

## 1. Target Objectives
The main objectives of this feedback collection are:
1. **WebAuthn UX**: Evaluate the friction of registering a Passkey (FaceID, TouchID, Windows Hello) and verifying heartbeats.
2. **Dashboard Clarity**: Ensure the inheritance countdown timer is intuitive and easy to monitor.
3. **Transaction Latency**: Measure how users perceive Stellar Testnet signature and block processing speed.
4. **Resiliency**: Verify how the app handles edge cases, such as invalid credentials or signing from unauthorized devices.

---

## 2. Structured Test Scenarios for Users

Each test participant must execute the following workflow:
1. **Scenario 1: Setup Vault**: Connect a testnet account, generate a Passkey, configure a beneficiary address, set a heartbeat window of 5 minutes, and deploy/initialize the vault contract.
2. **Scenario 2: Escrow Deposit**: Deposit mock tokens into the contract.
3. **Scenario 3: Heartbeat Verification**: Wait 2 minutes, then perform a heartbeat check-in via FaceID/TouchID. Verify that the countdown timer resets.
4. **Scenario 4: Estate Claim (Simulated Expiration)**: Wait for the 5-minute window to elapse without clicking the heartbeat button. Log in as the beneficiary and click "Claim Assets". Verify that 100% of the funds are routed.

---

## 3. Aggregated Feedback Scores & Analysis

Based on the feedback collected from the 11 real testnet users who responded to the Google Form, here are the calculated scores and metrics:

| Metric | Metric Details / Questions | Results | Status |
|---|---|---|---|
| **Passkey Setup Smoothness** | How smooth was the process of registering your biometric Passkey? | **100% Very smooth** (registered instantly) | ✅ Passed |
| **Transaction Smoothness** | Did you encounter any issues or transaction delays while calling the initialize or heartbeat functions? | **100% No issues/delays** (for all users who tested) | ✅ Passed |
| **Setup Clarity & Intuition** | How clear and intuitive did you find the process of designating a beneficiary and setting up asset claiming? | **4.91 / 5.0** (Average rating) | ✅ Passed |

### Key Findings & Action Taken
1. **Biometric Passkey UX:** 100% of participants reported an instant, seamless experience when registering their biometric Passkey. Using native credentials (FaceID, TouchID, Windows Hello) completely eliminated the complexity of traditional seed phrases.
2. **Transaction Performance:** Transactions were confirmed without issue on Stellar Testnet for all participants who called the vault smart functions.
3. **Onboarding & Design Clarity:** Designated beneficiary setup was highly clear, scoring 4.91 / 5.0, proving that our glassmorphic interface and step-by-step FAQ instructions are highly intuitive.

---

## 4. Google Form Raw Feedback Logs

Below is the compilation of the raw Google Form response logs:

| Timestamp | Full Name | Stellar Testnet Wallet Address | Passkey Setup UX | Tx Issues / Delays | Beneficiary Setup Clarity Score |
| :--- | :--- | :--- | :--- | :--- | :---: |
| 7/8/2026 20:54:21 | Mrunal Ghorpade | `GAGKWDKAZYZ7GSK2K6YZGGEDEZXL2GEHDU2NMOAU4AVHSFAVZH336FFX` | Very smooth (registered instantly) | No, transactions were quick and smooth | 5 / 5 |
| 7/8/2026 21:00:49 | Ayush jadhav | `GBUDUGMHCM7B54DIB5P5LP4PP6MG7MJ6VUBBYDB53BZNZCTH36LLG5MG` | Very smooth (registered instantly) | No, transactions were quick and smooth | 5 / 5 |
| 7/9/2026 9:04:16 | Yash Annadate | `GB6B6QEJFY4HAKATRO6MI77WDZ66W4FFPJN6AYLISJEHTLXYFPHQFFTV` | Very smooth (registered instantly) | No, transactions were quick and smooth | 5 / 5 |
| 7/10/2026 20:31:51 | durvesh dongare | `https://forms.gle/xwb3Nw5mHU9FJH8w7` | Very smooth (registered instantly) | No, transactions were quick and smooth | 5 / 5 |
| 7/10/2026 20:32:11 | Nitish Singh | `GBPSA7Q2J4G67SE4BIMKA2CJD5CQJPQAAI7URCC53REMHVR7BISJWMCB` | Very smooth (registered instantly) | No, transactions were quick and smooth | 4 / 5 |
| 7/10/2026 20:36:17 | samidra | `GC5QT7S36Z7SACWT3BBJEDKU2X4VJOON6IKRLXLFBXJC3GB6IWEOXC34` | Very smooth (registered instantly) | No, transactions were quick and smooth | 5 / 5 |
| 7/10/2026 20:42:45 | Arya Shinde | `GDTH7H7QKFMKJ22VN6ZDNM6AYX54CHT5WS4MA46GJQ7ZPA4QVUSF7Z3Q` | Very smooth (registered instantly) | No, transactions were quick and smooth | 5 / 5 |
| 7/11/2026 12:02:09 | Tanmay tad | `GBM25BHDCKA4DKEOROPMUVXHUSLODDMHTGQPXCP7N7RDPMRGC5YD7O4D` | Very smooth (registered instantly) | I did not test or run these functions | 5 / 5 |
| 7/13/2026 21:56:44 | Mishti mali | `GCK7YYGLTRVDOSAYUE4XCQT6ELS43TSLIG6PRPNGWK76EPLQGT3MW7HC` | Very smooth (registered instantly) | No, transactions were quick and smooth | 5 / 5 |
| 7/13/2026 22:04:10 | Madhav Girme | `GCKY5EBPX6BID2N5M6QQBTNVEQW5SPPLFBNS6QR3ZIO75CTTW6BYGFEA` | Very smooth (registered instantly) | No, transactions were quick and smooth | 5 / 5 |
| 7/13/2026 22:08:38 | mrunal ghorpade | `GBEFDGOOIM45SY5NIA32OVG26GQ47ERDKUWE3HPJPVE3IAZUXHKLSNNZ` | Very smooth (registered instantly) | No, transactions were quick and smooth | 5 / 5 |
