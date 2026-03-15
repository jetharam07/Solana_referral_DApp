
## 🚀 Getting Started


> ⚠️ Note: All required commands are provided, but depending on your system setup, some steps may need to be re-run or reordered.


Follow the steps below to clone the repository, build the program, and run tests.

---


## 1️⃣ Clone the Repository

```bash
git clone https://github.com/jetharam07/NFT-Triggered-Token-Unlock-from-vesting
cd NFT-Triggered-Token-Unlock-from-vesting
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
