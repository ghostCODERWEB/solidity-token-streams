import fs from "node:fs";
import { ethers } from "ethers";
// Explicit opt-in deployment utility; tests never call this script.
const { RPC_URL, PRIVATE_KEY, EXPECTED_CHAIN_ID, CONSTRUCTOR_ARGS } =
  process.env;
if (!RPC_URL || !PRIVATE_KEY || !EXPECTED_CHAIN_ID || !CONSTRUCTOR_ARGS)
  throw new Error(
    "RPC_URL, PRIVATE_KEY, EXPECTED_CHAIN_ID and CONSTRUCTOR_ARGS are required",
  );
const config = JSON.parse(fs.readFileSync("project.json"));
const provider = new ethers.JsonRpcProvider(RPC_URL);
const network = await provider.getNetwork();
if (network.chainId !== BigInt(EXPECTED_CHAIN_ID))
  throw new Error("Unexpected chain ID");
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const args = JSON.parse(fs.readFileSync(CONSTRUCTOR_ARGS));
if (!Array.isArray(args))
  throw new Error("Constructor file must contain an array");
const artifact = JSON.parse(
  fs.readFileSync("artifacts/" + config.contract + ".json"),
);
const factory = new ethers.ContractFactory(
  artifact.abi,
  artifact.evm.bytecode.object,
  wallet,
);
const deployed = await factory.deploy(...args);
await deployed.waitForDeployment();
console.log(
  JSON.stringify(
    {
      contract: config.contract,
      address: deployed.target,
      chainId: network.chainId.toString(),
      transaction: deployed.deploymentTransaction().hash,
    },
    null,
    2,
  ),
);
