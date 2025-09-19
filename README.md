# DAO Project

A Solidity + Next.js DAO demo project built with Hardhat and TypeScript.

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and private key
   ```

3. Compile contracts:
   ```bash
   npm run compile
   ```

4. Run tests:
   ```bash
   npm run test
   ```

5. Start local development:
   ```bash
   npm run dev
   ```

## Project Structure

- `/contracts` - Solidity smart contracts
- `/scripts` - Deployment scripts
- `/test` - Contract tests
- `/frontend` - Next.js frontend application

## Available Scripts

- `npm run compile` - Compile smart contracts
- `npm run test` - Run contract tests
- `npm run coverage` - Generate test coverage report
- `npm run deploy` - Deploy contracts
- `npm run start:frontend` - Start frontend development server

## Testing

**Run all tests:**
```bash
npx hardhat test
```

**Run specific test file:**
```bash
npx hardhat test test/token.test.ts
npx hardhat test test/staking.test.ts
npx hardhat test test/governance.test.ts
```

**Run tests with gas reporting:**
```bash
REPORT_GAS=true npx hardhat test
```

**Run tests with coverage:**
```bash
npx hardhat coverage
```

**Run tests on specific network:**
```bash
npx hardhat test --network localhost
```

## Deployment

The project includes a deployment script that deploys all contracts in the correct order and saves deployment addresses.

### Local Deployment

**Deploy to Hardhat network:**
```bash
npx hardhat run scripts/deploy.ts --network hardhat
```

**Deploy to localhost (requires running node):**
```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy contracts
npx hardhat run scripts/deploy.ts --network localhost
```

### Testnet Deployment

**Deploy to Sepolia:**
```bash
npx hardhat run scripts/deploy.ts --network sepolia
```

**Deploy to Polygon Mumbai:**
```bash
npx hardhat run scripts/deploy.ts --network polygonMumbai
```

**Deploy to Arbitrum Goerli:**
```bash
npx hardhat run scripts/deploy.ts --network arbitrumGoerli
```

**Deploy to Optimism Goerli:**
```bash
npx hardhat run scripts/deploy.ts --network optimismGoerli
```

### Deployment Output

The deployment script will:
1. Deploy MyToken contract
2. Deploy Staking contract (linked to MyToken)
3. Deploy Governance contract (linked to Staking)
4. Display all deployed addresses
5. Save deployment info to `/deployments/<network>.json`

**Example deployment output:**
```
Deploying contracts with the account: 0x...
Network: sepolia
Chain ID: 11155111

1. Deploying MyToken...
MyToken deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3

2. Deploying Staking...
Staking deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512

3. Deploying Governance...
Governance deployed to: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

=== Deployment Summary ===
MyToken: 0x5FbDB2315678afecb367f032d93F642f64180aa3
Staking: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
Governance: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0

Deployment addresses saved to: /deployments/sepolia.json
```