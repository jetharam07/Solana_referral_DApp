# Referral Reward DApp

## Overview

Referral Reward DApp is a Solana-based application that implements a multi-level referral reward system using on-chain accounts and SPL token rewards. The project was built using Rust and the Anchor Framework to explore account management, PDA architecture, token vaults, reward distribution, and frontend-to-blockchain interaction.

Users can register their profile, join through a referral link, build their referral network, and earn rewards based on referral activity. Rewards are distributed through a secure on-chain mechanism and can be claimed directly to the user's token account.

The application includes separate user and admin dashboards for managing referral activity, monitoring protocol statistics, and tracking reward distribution.

#### Project URL: https://solana-referral-d-app-4ktj.vercel.app/?ref=HQpcApEUAMdJNcQ3HGmnzzWNpjJf1DGuAbXXTMXRdX4n

## How It Works

1. The admin initializes the protocol and reward vault.
2. A user connects a wallet and creates an on-chain profile.
3. Users can join with an optional referrer.
4. When a qualifying action is completed, the admin triggers reward distribution.
5. The Level 1 referrer receives 70% of the reward.
6. If a second-level referrer exists, they receive 30% of the reward.
7. Rewards accumulate in the user's account as pending rewards.
8. Users can claim rewards at any time and receive SPL tokens directly in their wallet.

## Features

### User Features

* Connect using Phantom or Solflare wallet
* Create an on-chain user profile
* Register with or without a referrer
* Generate and share referral links
* Track referral network growth
* View pending rewards
* View total rewards earned
* Claim accumulated rewards
* Access profile and referral statistics

### Admin Features

* Initialize protocol configuration
* Manage reward distribution settings
* Trigger reward calculations for completed actions
* Monitor total users in the network
* Monitor total rewards distributed
* View protocol statistics and user activity

### Reward Distribution

* Multi-level referral system
* Level 1 referrer receives 70% of the reward
* Level 2 referrer receives 30% of the reward
* Rewards are accumulated on-chain
* Users can claim rewards directly from the vault
* Claimed rewards are transferred to the user's token account

### On-Chain Data

The application stores and manages:

* User wallet address
* User profile information
* Referrer relationships
* Pending rewards
* Total rewards earned
* Referral count
* Registration timestamp
* Global protocol statistics

## Smart Contract

The smart contract is built using the Anchor Framework and uses Program Derived Addresses (PDAs) to manage protocol data, user accounts, and reward distribution.

### Main Functions

* **initialize()** – Creates the protocol configuration and reward vault.
* **register_user()** – Creates an on-chain user profile and optionally links a referrer.
* **complete_action()** – Calculates and distributes referral rewards.
* **claim_reward()** – Allows users to claim accumulated rewards from the vault.
* **update_reward()** – Allows the admin to update reward settings.

### Reward Logic

* Level 1 referrer receives 70% of the reward.
* Level 2 referrer receives 30% of the reward.
* Rewards are stored on-chain until claimed by the user.

### Security

* One user profile per wallet.
* Admin-only access for protocol management functions.
* PDA-controlled reward vault for secure token distribution.

## Technology Stack

### Blockchain

* Solana
* Rust
* Anchor Framework
* SPL Tokens
* Program Derived Addresses (PDAs)

### Frontend

* Next.js
* TypeScript
* Tailwind CSS

### Wallet & Integration

* Solana Web3.js
* Phantom Wallet
* Solflare Wallet



## 🚀 Getting Started


> ⚠️ Note: All required commands are provided, but depending on your system setup, some steps may need to be re-run or reordered.


Follow the steps below to clone the repository, build the program, and run tests.

---


## 1️⃣ Clone the Repository

```bash
git clone https://github.com/jetharam07/Solana_referral_DApp
cd Solana_referral_DApp
```

```bash
npm install -g yarn
yarn -v
```

### Quick Solana, Anchor set up Installation

```bash
curl --proto '=https' --tlsv1.2 -sSfL https://solana-install.solana.workers.dev | bash
```

### Build Program
```bash
anchor build
```
### Check Program ID
```bash
anchor keys list
```

### Set solana devnet network
```bash
solana config set --url https://api.devnet.solana.com
```
### Create wallet if not exists
```bash
solana-keygen new --outfile wallet.json
solana config set --keypair ./wallet.json
```

### Airdrop sol faucet
```bash
solana airdrop 2
```

### Deploy Program
```bash
anchor deploy
```

### Program Testing
```bash
anchor test
```


## 📚 References & Useful Links

- **Solana Official Documentation**  
  https://docs.solana.com/

- **Solana Toolchain Installation Guide**  
  https://docs.solana.com/cli/install-solana-cli-tools

- **Solana Devnet Faucet**  
  https://faucet.solana.com/

- **Solana Explorer (Devnet)**  
  https://explorer.solana.com/?cluster=devnet

- **Anchor Framework Documentation**  
  https://www.anchor-lang.com/

---

## Note

This project was created to gain hands-on experience with Solana smart contracts, PDA-based account management, SPL token rewards, and referral-based reward systems.
