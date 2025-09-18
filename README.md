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