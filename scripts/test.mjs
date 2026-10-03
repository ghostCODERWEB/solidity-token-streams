import fs from "node:fs";
import assert from "node:assert/strict";
import { createVM, runTx } from "@ethereumjs/vm";
import { createBlock } from "@ethereumjs/block";
import { Common, Hardfork, Mainnet } from "@ethereumjs/common";
import { createLegacyTx } from "@ethereumjs/tx";
import {
  Account,
  createAddressFromPrivateKey,
  hexToBytes,
  bytesToHex,
  createAddressFromString,
} from "@ethereumjs/util";
import { ethers } from "ethers";

const common = new Common({ chain: Mainnet, hardfork: Hardfork.Cancun });
const vm = await createVM({ common });
// Public deterministic test keys only; never use these accounts on a real chain.
const keys = Array.from({ length: 6 }, (_, i) =>
  hexToBytes(
    "0x" +
      BigInt(i + 1)
        .toString(16)
        .padStart(64, "0"),
  ),
);
const senders = keys.map(createAddressFromPrivateKey);
const addresses = senders.map((a) => ethers.getAddress(a.toString()));
for (const sender of senders)
  await vm.stateManager.putAccount(sender, new Account(0n, 10n ** 24n));
let timestamp = 1800000000n,
  height = 1n,
  passed = 0,
  primary = null;
const config = JSON.parse(fs.readFileSync("project.json"));
const gas = [];
function block() {
  return createBlock(
    {
      header: {
        number: height,
        timestamp,
        baseFeePerGas: 7n,
        gasLimit: 30000000n,
      },
    },
    { common },
  );
}
function failure(result) {
  const error = new Error(
    "EVM revert: " +
      result.execResult.exceptionError +
      " " +
      bytesToHex(result.execResult.returnValue),
  );
  error.code = "CALL_EXCEPTION";
  return error;
}
async function send(index, to, data = "0x", value = 0n) {
  const account = await vm.stateManager.getAccount(senders[index]);
  const tx = createLegacyTx(
    {
      nonce: account.nonce,
      gasPrice: 10n,
      gasLimit: 20000000n,
      to,
      value: BigInt(value),
      data: hexToBytes(data),
    },
    { common },
  ).sign(keys[index]);
  const result = await runTx(vm, { tx, block: block() });
  height++;
  if (result.execResult.exceptionError) throw failure(result);
  gas.push(result.totalGasSpent.toString());
  return result;
}
function receipt(result) {
  return {
    hash: bytesToHex(result.txHash ?? new Uint8Array()),
    async wait() {
      return { status: 1, gasUsed: result.totalGasSpent };
    },
  };
}
function contract(address, abi, index = 0) {
  const iface = new ethers.Interface(abi);
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "target") return address;
        if (property === "interface") return iface;
        if (property === "connect")
          return (signer) => contract(address, abi, signer.index);
        if (property === "then" || typeof property === "symbol")
          return undefined;
        let fragment;
        try {
          fragment = iface.getFunction(property);
        } catch {
          return undefined;
        }
        if (!fragment) return undefined;
        return async (...args) => {
          let overrides = {};
          if (args.length > fragment.inputs.length) overrides = args.pop();
          const data = iface.encodeFunctionData(fragment, args);
          if (
            fragment.stateMutability === "view" ||
            fragment.stateMutability === "pure"
          ) {
            await vm.stateManager.checkpoint();
            try {
              const result = await vm.evm.runCall({
                to: createAddressFromString(address),
                caller: senders[index],
                origin: senders[index],
                data: hexToBytes(data),
                gasLimit: 20000000n,
                block: block(),
                isStatic: true,
              });
              if (result.execResult.exceptionError) throw failure(result);
              const output = iface.decodeFunctionResult(
                fragment,
                bytesToHex(result.execResult.returnValue),
              );
              return output.length === 1 ? output[0] : output;
            } finally {
              await vm.stateManager.revert();
            }
          }
          return receipt(
            await send(index, address, data, overrides.value ?? 0n),
          );
        };
      },
    },
  );
}
const signers = keys.map((_, index) => ({
  index,
  async sendTransaction(request) {
    return receipt(
      await send(index, request.to, request.data ?? "0x", request.value ?? 0n),
    );
  },
}));
const h = {
  ethers,
  signers,
  addresses,
  eq: assert.equal,
  ok: assert.ok,
  async tx(promise) {
    const transaction = await promise;
    return transaction.wait();
  },
  async deploy(name, args = []) {
    const artifact = JSON.parse(fs.readFileSync("artifacts/" + name + ".json"));
    const iface = new ethers.Interface(artifact.abi);
    const data =
      "0x" + artifact.evm.bytecode.object + iface.encodeDeploy(args).slice(2);
    const result = await send(0, undefined, data);
    assert.ok(result.createdAddress, "deployment address missing");
    const instance = contract(
      ethers.getAddress(result.createdAddress.toString()),
      artifact.abi,
    );
    if (name === config.contract) primary = instance;
    return instance;
  },
  async token() {
    const token = await this.deploy("TestToken");
    await this.tx(token.mint(addresses[0], 10n ** 24n));
    return token;
  },
  async nft() {
    const nft = await this.deploy("TestNFT");
    await this.tx(nft.mint(addresses[0], 1));
    return nft;
  },
  async now() {
    return Number(timestamp);
  },
  async mine(seconds) {
    assert.ok(Number.isSafeInteger(seconds) && seconds >= 0);
    timestamp += BigInt(seconds);
    height++;
  },
  async revert(action) {
    let failed = false;
    try {
      const value = await action();
      if (value?.wait) await value.wait();
    } catch (error) {
      if (error?.code === "CALL_EXCEPTION") failed = true;
      else throw error;
    }
    assert.ok(failed, "expected EVM revert");
  },
  async test(name, action) {
    await action();
    passed++;
    console.log("PASS " + name);
  },
};
const { suite } = await import("../test/suite.mjs");
await suite(h);
if (primary.interface.hasFunction("owner()")) {
  await h.test("unauthorized caller cannot pause", () =>
    h.revert(() => primary.connect(signers[4]).setPaused(true)),
  );
  await h.test("ownership transfer requires acceptance", async () => {
    await h.tx(primary.transferOwnership(addresses[4]));
    h.eq(await primary.owner(), addresses[0]);
    h.eq(await primary.pendingOwner(), addresses[4]);
    await h.revert(() => primary.connect(signers[3]).acceptOwnership());
  });
  await h.test("designated owner accepts control", async () => {
    await h.tx(primary.connect(signers[4]).acceptOwnership());
    h.eq(await primary.owner(), addresses[4]);
    await h.revert(() => primary.setPaused(true));
  });
}
await h.test("custody rejects fee-on-transfer assets atomically", async () => {
  const fee = await h.deploy("FeeToken");
  const custody = await h.deploy("CustodyHarness");
  await h.tx(fee.mint(addresses[0], 1000));
  await h.tx(fee.approve(custody.target, 1000));
  await h.revert(() => custody.pull(fee.target, 100));
  h.eq(await fee.balanceOf(addresses[0]), 1000n);
  h.eq(await fee.balanceOf(custody.target), 0n);
});
await h.test("native reentrancy rejection preserves custody", async () => {
  const custody = await h.deploy("CustodyHarness");
  const receiver = await h.deploy("ReenteringReceiver");
  await h.tx(signers[0].sendTransaction({ to: custody.target, value: 100 }));
  await h.revert(() => receiver.attack(custody.target));
  h.eq(
    (await vm.stateManager.getAccount(createAddressFromString(custody.target)))
      .balance,
    100n,
  );
});
console.log("All " + passed + " EVM behavior tests passed");
fs.writeFileSync(
  "artifacts/test-results.json",
  JSON.stringify(
    {
      passed,
      chain: "in-process EthereumJS VM, Cancun",
      compiler: "solc 0.8.37",
      successfulTransactionGas: gas,
    },
    null,
    2,
  ) + "\n",
);
