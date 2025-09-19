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