import test from "node:test";
import assert from "node:assert/strict";
import { OblivionClient } from "../dist/esm/server.js";
const sender = "0x" + "1".repeat(40),
  recipient = "0x" + "2".repeat(40),
  other = "0x" + "3".repeat(40);
const calls = [];
const api = new OblivionClient({
  apiKey: "local_test_credential_".repeat(3),
  fetch: async (url, init) => {
    calls.push(JSON.parse(init.body));
    return Response.json({
      quote: "opaque",
      executor: recipient,
      nativeValueWei: "10000000000000",
      payouts: [],
    });
  },
});
test("USDG is explicit, preserves six decimals and supports both routes and allocation modes", async () => {
  for (const method of ["abstraction", "mesh"]) {
    await api.quote({
      method,
      sender,
      recipient,
      asset: "USDG",
      amount: "1.123456",
    });
    assert.equal(calls.at(-1).asset, "USDG");
    assert.equal(calls.at(-1).amount, "1.123456");
  }
  for (const route of ["abstraction", "mesh"])
    for (const mode of ["fixed", "random"]) {
      const allocation =
        mode === "fixed"
          ? { mode, amount: "1.000001" }
          : { mode, min: "0.123456", max: "9.654321" };
      await api.quote({
        method: "multisend",
        sender,
        recipients: [recipient, other],
        route,
        asset: "USDG",
        allocation,
      });
      assert.deepEqual(calls.at(-1).allocation, allocation);
    }
});
test("USDG rejects precision loss, unknown assets, direct routing and RWA misuse before sending", async () => {
  const before = calls.length;
  for (const amount of ["1.1234567", 1.2, "1e3", "0", "-1"])
    await assert.rejects(
      api.quote({ method: "mesh", sender, recipient, asset: "USDG", amount }),
    );
  await assert.rejects(
    api.quote({
      method: "mesh",
      sender,
      recipient,
      asset: "USDC",
      amount: "1",
    }),
  );
  await assert.rejects(
    api.quote({
      method: "multisend",
      sender,
      recipients: [recipient, other],
      asset: "USDG",
      route: "direct",
      allocation: { mode: "fixed", amount: "1" },
    }),
  );
  await assert.rejects(
    api.quote({
      method: "multisend",
      sender,
      recipients: [recipient, other],
      asset: "USDG",
      route: "mesh",
      allocation: { mode: "random", min: "1.0000001", max: "2" },
    }),
  );
  await assert.rejects(
    api.quote({
      method: "rwa",
      sender,
      recipient,
      asset: "USDG",
      items: [{ symbol: "AAPL", amount: "1" }],
    }),
  );
  await assert.rejects(
    api.quote({
      method: "rwa",
      sender,
      recipient,
      items: [{ symbol: "USDG", amount: "1" }],
    }),
  );
  assert.equal(calls.length, before);
});
test("ETH retains 18-decimal precision and omitted asset remains unchanged", async () => {
  await api.quote({
    method: "abstraction",
    sender,
    recipient,
    amount: "1.123456789012345678",
  });
  assert.equal("asset" in calls.at(-1), false);
  await api.quote({
    method: "mesh",
    sender,
    recipient,
    asset: "ETH",
    amount: "1.123456789012345678",
  });
  assert.equal(calls.at(-1).asset, "ETH");
});
