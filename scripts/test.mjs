import fs from "node:fs";
import assert from "node:assert/strict";
import ganache from "ganache";
import { ethers } from "ethers";
const rpc = ganache.provider({
  logging: { quiet: true },
  chain: { hardfork: "shanghai" },
  wallet: { totalAccounts: 6, defaultBalance: 1000 },
  miner: { timestampIncrement: 0 },
});
const provider = new ethers.BrowserProvider(rpc, undefined, {
  cacheTimeout: -1,
});
provider.pollingInterval = 20;
const signers = await Promise.all(
  Array.from({ length: 6 }, (_, i) => provider.getSigner(i)),
);
const addresses = await Promise.all(signers.map((s) => s.getAddress()));
const config = JSON.parse(fs.readFileSync("project.json"));
let primary = null;
let passed = 0;
const h = {
  ethers,
  provider,
  signers,
  addresses,
  eq: assert.equal,
  ok: assert.ok,
  async tx(promise) {
    const response = await promise;
    return await response.wait();
  },
  async deploy(name, args = []) {
    const artifact = JSON.parse(fs.readFileSync("artifacts/" + name + ".json"));
    const factory = new ethers.ContractFactory(
      artifact.abi,
      artifact.evm.bytecode.object,
      signers[0],
    );
    const instance = await factory.deploy(...args);
    await instance.waitForDeployment();
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
    const block = await rpc.request({
      method: "eth_getBlockByNumber",
      params: ["latest", false],
    });
    return Number(BigInt(block.timestamp));
  },
  async mine(seconds) {
    await rpc.request({ method: "evm_increaseTime", params: [seconds] });
    await rpc.request({ method: "evm_mine", params: [] });
  },
  async revert(action) {
    let failed = false;
    try {
      const value = await action();
      if (value?.wait) await value.wait();
    } catch (error) {
      if (
        error?.code === "CALL_EXCEPTION" ||
        /revert|invalid opcode/i.test(String(error))
      ) {
        failed = true;
      } else throw error;
    }
    assert.ok(failed, "expected transaction or call to revert");
  },
  async test(name, action) {
    await action();
    passed++;
    console.log("PASS " + name);
  },
};
try {
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
  await h.test(
    "custody rejects fee-on-transfer assets atomically",
    async () => {
      const fee = await h.deploy("FeeToken");
      const custody = await h.deploy("CustodyHarness");
      await h.tx(fee.mint(addresses[0], 1000));
      await h.tx(fee.approve(custody.target, 1000));
      await h.revert(() => custody.pull(fee.target, 100));
      h.eq(await fee.balanceOf(addresses[0]), 1000n);
      h.eq(await fee.balanceOf(custody.target), 0n);
    },
  );
  await h.test("native reentrancy rejection preserves custody", async () => {
    const custody = await h.deploy("CustodyHarness");
    const receiver = await h.deploy("ReenteringReceiver");
    await h.tx(signers[0].sendTransaction({ to: custody.target, value: 100 }));
    await h.revert(() => receiver.attack(custody.target));
    h.eq(
      BigInt(
        await rpc.request({
          method: "eth_getBalance",
          params: [custody.target, "latest"],
        }),
      ),
      100n,
    );
  });
  console.log("All " + passed + " EVM behavior tests passed");
  fs.writeFileSync(
    "artifacts/test-results.json",
    JSON.stringify(
      {
        passed,
        chain: "in-process Ganache, Shanghai",
        compiler: "solc 0.8.30",
      },
      null,
      2,
    ) + "\n",
  );
} finally {
  await rpc.disconnect();
}
