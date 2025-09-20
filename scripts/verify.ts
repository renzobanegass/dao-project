import { readFileSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

interface DeploymentData {
  network: string;
  chainId: string;
  deployer: string;
  timestamp: string;
  contracts: {
    MyToken: string;
    Staking: string;
    Governance: string;
  };
}

async function main() {
  const networkName = process.argv[2];

  if (!networkName) {
    console.error("Usage: npx hardhat run scripts/verify.ts --network <network-name>");
    console.error("Example: npx hardhat run scripts/verify.ts --network polygonMumbai");
    process.exit(1);
  }

  console.log(`🔍 Starting contract verification for network: ${networkName}`);

  // Read deployment data
  const deploymentFile = join(__dirname, "..", "deployments", `${networkName}.json`);

  let deploymentData: DeploymentData;
  try {
    const fileContent = readFileSync(deploymentFile, "utf8");
    deploymentData = JSON.parse(fileContent);
  } catch (error) {
    console.error(`❌ Could not read deployment file: ${deploymentFile}`);
    console.error("Make sure you have deployed contracts first using:");
    console.error(`npx hardhat run scripts/deploy.ts --network ${networkName}`);
    process.exit(1);
  }

  console.log("📄 Deployment data loaded:");
  console.log(`  Network: ${deploymentData.network}`);
  console.log(`  Chain ID: ${deploymentData.chainId}`);
  console.log(`  Deployer: ${deploymentData.deployer}`);
  console.log(`  Timestamp: ${deploymentData.timestamp}`);

  const contracts = deploymentData.contracts;
  console.log("\n📋 Contract addresses:");
  console.log(`  MyToken: ${contracts.MyToken}`);
  console.log(`  Staking: ${contracts.Staking}`);
  console.log(`  Governance: ${contracts.Governance}`);

  // Verify contracts in deployment order
  const verificationCommands = [
    {
      name: "MyToken",
      address: contracts.MyToken,
      constructorArgs: [], // MyToken has no constructor arguments
    },
    {
      name: "Staking",
      address: contracts.Staking,
      constructorArgs: [contracts.MyToken], // Staking takes token address
    },
    {
      name: "Governance",
      address: contracts.Governance,
      constructorArgs: [contracts.Staking, "2000"], // Governance takes staking address and quorum (2000 = 20%)
    },
  ];

  console.log("\n🚀 Starting verification process...\n");

  for (const contract of verificationCommands) {
    try {
      console.log(`🔎 Verifying ${contract.name} at ${contract.address}...`);

      const args = contract.constructorArgs.length > 0
        ? contract.constructorArgs.join(" ")
        : "";

      const command = `npx hardhat verify --network ${networkName} ${contract.address} ${args}`.trim();

      console.log(`  Command: ${command}`);

      const output = execSync(command, {
        encoding: "utf8",
        stdio: "pipe",
        timeout: 60000 // 60 second timeout
      });

      console.log(`✅ ${contract.name} verified successfully!`);
      if (output.includes("https://")) {
        const lines = output.split("\n");
        const urlLine = lines.find(line => line.includes("https://"));
        if (urlLine) {
          console.log(`  Explorer: ${urlLine.trim()}`);
        }
      }

    } catch (error: any) {
      const errorMessage = error.message || error.toString();

      if (errorMessage.includes("Already Verified")) {
        console.log(`ℹ️  ${contract.name} is already verified`);
      } else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("network")) {
        console.error(`❌ Network error verifying ${contract.name}. Please check your network connection and try again.`);
      } else {
        console.error(`❌ Failed to verify ${contract.name}:`);
        console.error(`  Error: ${errorMessage}`);
      }
    }

    console.log(""); // Empty line for readability
  }

  console.log("🎉 Verification process completed!");
  console.log("\n📝 Manual verification commands:");
  console.log("If you need to verify contracts manually, use these commands:");

  for (const contract of verificationCommands) {
    const args = contract.constructorArgs.length > 0
      ? ` ${contract.constructorArgs.join(" ")}`
      : "";
    console.log(`npx hardhat verify --network ${networkName} ${contract.address}${args}`);
  }
}

main().catch((error) => {
  console.error("❌ Verification script failed:");
  console.error(error);
  process.exitCode = 1;
});