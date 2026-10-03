export async function suite(h) {
  const token = await h.token();
  const c = await h.deploy("TokenStreams", [token.target, h.addresses[0]]);
  await h.tx(token.approve(c.target, 10000));
  const now = await h.now();
  await h.tx(c.create(h.addresses[1], now, now + 100, now + 20, 1000, true));
  await h.test("cliff blocks claims", () => h.revert(() => c.claim(1)));
  await h.test("sender identity protects cancel", () =>
    h.revert(() => c.connect(h.signers[2]).cancel(1)),
  );
  await h.test("vested claim goes only to beneficiary", async () => {
    await h.mine(50);
    await h.tx(c.connect(h.signers[2]).claim(1));
    h.ok((await token.balanceOf(h.addresses[1])) >= 500n);
  });
  await h.test("cancellation refunds unvested funds", async () => {
    await h.tx(c.cancel(1));
    const s = await c.streams(1);
    h.ok(s.stopped > 0n);
    h.eq(await token.balanceOf(c.target), await c.liability());
  });
  await h.test("cancel cannot repeat", () => h.revert(() => c.cancel(1)));
  await h.test("stopped vesting does not grow", async () => {
    const v = await c.vested(1);
    await h.mine(100);
    h.eq(await c.vested(1), v);
  });
}
