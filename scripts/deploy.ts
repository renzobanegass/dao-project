import { ethers } from "hardhat";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Network:", network.name);
  console.log("Chain ID:", network.chainId);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  const deployedAddresses: { [key: string]: string } = {};

  // 1. Deploy MyToken
  console.log("\n1. Deploying MyToken...");
  const MyToken = await ethers.getContractFactory("MyToken");
  const myToken = await MyToken.deploy();
  await myToken.waitForDeployment();
  const myTokenAddress = await myToken.getAddress();
  deployedAddresses.MyToken = myTokenAddress;
  console.log("MyToken deployed to:", myTokenAddress);

  // 2. Deploy Staking (pass token address)
  console.log("\n2. Deploying Staking...");
  const Staking = await ethers.getContractFactory("Staking");
  const staking = await Staking.deploy(myTokenAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  deployedAddresses.Staking = stakingAddress;
  console.log("Staking deployed to:", stakingAddress);

  // 3. Deploy Governance (pass staking address)
  console.log("\n3. Deploying Governance...");
  const Governance = await ethers.getContractFactory("Governance");
  const quorum = 2000; // 20% quorum
  const governance = await Governance.deploy(stakingAddress, quorum);
  await governance.waitForDeployment();
  const governanceAddress = await governance.getAddress();
  deployedAddresses.Governance = governanceAddress;
  console.log("Governance deployed to:", governanceAddress);

  // Display all deployed addresses
  console.log("\n=== Deployment Summary ===");
  console.log("MyToken:", deployedAddresses.MyToken);
  console.log("Staking:", deployedAddresses.Staking);
  console.log("Governance:", deployedAddresses.Governance);

  // Save deployment addresses to JSON file
  const networkName = network.name === "unknown" ? "localhost" : network.name;
  const deploymentsDir = join(__dirname, "..", "deployments");

  try {
    mkdirSync(deploymentsDir, { recursive: true });
  } catch (error) {
    // Directory already exists
  }

  const deploymentFile = join(deploymentsDir, `${networkName}.json`);
  const deploymentData = {
    network: networkName,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: deployedAddresses
  };

  writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
  console.log(`\nDeployment addresses saved to: ${deploymentFile}`);

  // Verify contracts are deployed correctly
  console.log("\n=== Verification ===");
  const tokenName = await myToken.name();
  const tokenSymbol = await myToken.symbol();
  const stakingToken = await staking.stakingToken();
  const governanceStaking = await governance.staking();
  const governanceQuorum = await governance.quorum();

  console.log("Token name:", tokenName);
  console.log("Token symbol:", tokenSymbol);
  console.log("Staking token address matches:", stakingToken === myTokenAddress);
  console.log("Governance staking address matches:", governanceStaking === stakingAddress);
  console.log("Governance quorum:", governanceQuorum.toString(), "basis points");

  console.log("\n✅ Deployment completed successfully!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});