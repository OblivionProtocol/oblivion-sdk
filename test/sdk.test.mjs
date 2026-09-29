import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { OblivionClient } from "../dist/esm/server.js";
import { RegistrationClient } from "../dist/esm/registration.js";
import { sendReviewedTransaction } from "../dist/esm/wallet.js";
const key = "test_sdk_credential_".repeat(3),
  sender = "0x" + "1".repeat(40),
  recipient = "0x" + "2".repeat(40),
  hash = "0x" + "3".repeat(64);
const request = {
  from: sender,
  chainId: "0x1237",
  data: "0x1234",
  value: "0x1",
  nonce: "0x0",
  gas: "0x5208",
};
const review = {
  account: sender,
  kind: "execution",
  valueWei: "1",
  data: "0x1234",
  nonce: "0x0",
};
const calls = [];
function client(reply, options = {}) {
  return new OblivionClient({
    apiKey: key,
    fetch: async (url, init) => {
      calls.push({ url, init });
      return Response.json(
        typeof reply === "function" ? reply(url, init) : reply,
      );
    },
    ...options,
  });
}
const quote = {
  quote: "opaque-quote",
  executor: recipient,
  nativeValueWei: "1",
  payouts: [],
};
test("all four quote methods use only authenticated backend requests", async () => {
  const c = client(quote);
  const inputs = [
    { method: "abstraction", sender, recipient, amount: "1" },
    { method: "mesh", sender, recipient, amount: "0.2" },
    {
      method: "multisend",
      sender,
      recipients: [recipient, "0x" + "4".repeat(40)],
      route: "mesh",
      allocation: { mode: "random", min: "0.1", max: "0.2" },
    },
    {
      method: "rwa",
      sender,
      recipient,
      items: [
        { symbol: "AAPL", percentage: 50 },
        { symbol: "NVDA", amount: "1" },
      ],
    },
  ];
  for (const input of inputs) {
    assert.equal((await c.quote(input)).quote, "opaque-quote");
    const call = calls.at(-1);
    assert.equal(call.url, "https://oblivion-protocol.com/api/v1/quotes");
    assert.deepEqual(JSON.parse(call.init.body), input);
    assert.equal(call.init.headers.Authorization, "Bearer " + key);
    assert.equal(call.init.redirect, "error");
    assert.ok(!call.url.includes(key));
  }
  assert.equal(JSON.stringify(c), "{}");
});
test("read, approval, simulation, preparation and status endpoints match protocol", async () => {
  const c = client((url) =>
    url.endsWith("/features")
      ? {
          chainId: 4663,
          methods: [],
          serverSigns: false,
          serverBroadcasts: false,
        }
      : url.endsWith("/assets")
        ? { chainId: 4663, assets: [] }
        : url.includes("/balances")
          ? { chainId: 4663, sender, ethWei: "1", assets: [] }
          : url.endsWith("/approvals/prepare")
            ? { complete: true }
            : url.endsWith("/simulations")
              ? { request, simulation: "s" }
              : url.endsWith("/transactions/prepare")
                ? { request, tracking: "t" }
                : {
                    status: "confirmed",
                    hash,
                    feePaidWei: "10000000000000",
                    payouts: [],
                  },
  );
  await c.features();
  await c.assets();
  await c.balances(sender);
  assert.deepEqual(await c.prepareApproval("q"), { complete: true });
  await c.simulate("q");
  await c.prepare("s");
  assert.equal((await c.status("t", hash)).status, "confirmed");
});
test("invalid amounts and destinations never reach transport", async () => {
  let sent = 0;
  const c = client(quote, {
    fetch: async () => {
      sent++;
      return Response.json(quote);
    },
  });
  for (const amount of ["0", "-1", "1e3", "1.0000000000000000001"])
    await assert.rejects(
      c.quote({ method: "mesh", sender, recipient, amount }),
      { code: "INVALID_INPUT" },
    );
  await assert.rejects(c.balances("bad"), { code: "INVALID_INPUT" });
  assert.equal(sent, 0);
});
test("reject unsupported and duplicate RWA and conflicting amount modes", async () => {
  const c = client(quote);
  for (const items of [
    [{ symbol: "BAD", amount: "1" }],
    [
      { symbol: "AAPL", amount: "1" },
      { symbol: "AAPL", amount: "2" },
    ],
    [{ symbol: "AAPL", amount: "1", percentage: 50 }],
  ])
    await assert.rejects(c.quote({ method: "rwa", sender, recipient, items }), {
      code: "INVALID_INPUT",
    });
});
test("HTTPS required; loopback HTTP is opt-in", () => {
  assert.throws(() => client({}, { baseUrl: "http://example.com" }));
  assert.throws(() => client({}, { baseUrl: "http://localhost:3100" }));
  assert.doesNotThrow(() =>
    client(
      {},
      { baseUrl: "http://localhost:3100", allowInsecureLocalhost: true },
    ),
  );
  assert.throws(() =>
    client({}, { baseUrl: "https://user:password@example.com" }),
  );
});
test("HTTP errors redact reflected message and do not retry", async () => {
  let n = 0;
  const c = client(
    {},
    {
      fetch: async () => {
        n++;
        return Response.json(
          { error: { code: "RATE_LIMIT", message: key, details: { key } } },
          { status: 429, headers: { "Retry-After": "60" } },
        );
      },
    },
  );
  await assert.rejects(
    c.features(),
    (e) =>
      e.status === 429 &&
      e.retryAfterSeconds === 60 &&
      !JSON.stringify(e).includes(key) &&
      !String(e).includes(key),
  );
  assert.equal(n, 1);
});
test("network errors cannot expose request credentials through a cause", async () => {
  const c = client(
    {},
    {
      fetch: async () => {
        throw new Error(key);
      },
    },
  );
  await assert.rejects(
    c.features(),
    (e) => e.code === "NETWORK_ERROR" && !String(e).includes(key) && !e.cause,
  );
});
test("redirected response is rejected", async () => {
  const r = Response.json({});
  Object.defineProperty(r, "redirected", { value: true });
  await assert.rejects(client({}, { fetch: async () => r }).features(), {
    code: "REDIRECT_BLOCKED",
  });
});
test("timeout and cancellation release request", async () => {
  const fetch = async (_url, { signal }) =>
    new Promise((_, reject) => {
      if (signal.aborted) reject(new Error("abort"));
      else
        signal.addEventListener("abort", () => reject(new Error("abort")), {
          once: true,
        });
    });
  await assert.rejects(client({}, { fetch, timeoutMs: 5 }).features(), {
    code: "TIMEOUT",
  });
  const c = new AbortController();
  c.abort();
  await assert.rejects(client({}, { fetch }).features({ signal: c.signal }), {
    code: "ABORTED",
  });
});
test("malformed or oversized responses rejected", async () => {
  await assert.rejects(
    client({}, { fetch: async () => new Response("not-json") }).features(),
    { code: "INVALID_RESPONSE" },
  );
  await assert.rejects(
    client(
      {},
      { fetch: async () => new Response("x".repeat(2097153)) },
    ).features(),
    { code: "INVALID_RESPONSE" },
  );
  await assert.rejects(
    client({ request: { ...request, to: recipient }, tracking: "t" }).prepare(
      "s",
    ),
    { code: "INVALID_RESPONSE" },
  );
});
test("browser client entry fails closed and Node class also guards browsers", async () => {
  const browser = await import("../dist/esm/browser.js");
  assert.throws(() => new browser.OblivionClient({ apiKey: key }), {
    code: "SERVER_ONLY",
  });
  globalThis.window = {};
  try {
    assert.throws(() => client({}));
  } finally {
    delete globalThis.window;
  }
});
test("CJS distribution loads independently", () => {
  const require = createRequire(import.meta.url);
  assert.equal(
    typeof require("../dist/cjs/server.js").OblivionClient,
    "function",
  );
  assert.equal(
    typeof require("../dist/cjs/wallet.js").sendReviewedTransaction,
    "function",
  );
});
function wallet(overrides = {}) {
  const calls = [];
  return {
    calls,
    async request({ method, params }) {
      calls.push({ method, params });
      if (method in overrides) return overrides[method];
      if (method === "eth_accounts") return [sender];
      if (method === "eth_chainId") return "0x1237";
      return hash;
    },
  };
}
test("wallet submission is explicit and occurs once", async () => {
  const p = wallet();
  assert.equal(await sendReviewedTransaction(p, request, review), hash);
  assert.deepEqual(
    p.calls.map((x) => x.method),
    ["eth_accounts", "eth_chainId", "eth_sendTransaction"],
  );
});
test("wrong account and chain prevent sending", async () => {
  for (const overrides of [
    { eth_accounts: [recipient] },
    { eth_chainId: "0x1" },
  ]) {
    const p = wallet(overrides);
    await assert.rejects(sendReviewedTransaction(p, request, review));
    assert.ok(!p.calls.some((x) => x.method === "eth_sendTransaction"));
  }
});
test("changed value, data, nonce or destination fail review", async () => {
  for (const patch of [
    { value: "0x2" },
    { data: "0xabcd" },
    { nonce: "0x1" },
    { to: recipient },
  ]) {
    const p = wallet();
    await assert.rejects(
      sendReviewedTransaction(p, { ...request, ...patch }, review),
    );
    assert.equal(p.calls.length, 0);
  }
});
test("approval requires matching token and zero ETH", async () => {
  const p = wallet();
  await sendReviewedTransaction(
    p,
    { ...request, to: recipient, value: "0x0" },
    { ...review, kind: "approval", to: recipient, valueWei: "0" },
  );
  assert.equal(p.calls.at(-1).params[0].to, recipient);
});
test("unrecognized wallet result never resubmits", async () => {
  const p = wallet({ eth_sendTransaction: null });
  await assert.rejects(sendReviewedTransaction(p, request, review), {
    code: "SUBMISSION_UNKNOWN",
  });
  assert.equal(
    p.calls.filter((x) => x.method === "eth_sendTransaction").length,
    1,
  );
});
test("wallet transaction is snapshotted before asynchronous checks", async () => {
  const tx = { ...request };
  const p = wallet();
  const original = p.request.bind(p);
  p.request = async (args) => {
    if (args.method === "eth_accounts") tx.value = "0x9";
    return original(args);
  };
  await sendReviewedTransaction(p, tx, review);
  assert.equal(p.calls.at(-1).params[0].value, "0x1");
});
test("registration endpoints never send a bearer credential", async () => {
  const seen = [];
  const r = new RegistrationClient({
    fetch: async (url, init) => {
      seen.push({ url, init });
      return Response.json(
        url.includes("/config")
          ? { chainId: 4663, address: recipient, request: { to: recipient } }
          : url.endsWith("/challenge")
            ? {
                challenge: "c",
                message: "review me",
                expiresAt: Date.now() + 1000,
              }
            : url.endsWith("/authenticate")
              ? { session: "s", wallet: sender }
              : { apiKey: key, wallet: sender, revoked: false },
      );
    },
  });
  await r.config(sender);
  await r.challenge(sender, "issue");
  await r.authenticate("c", "0x" + "1".repeat(130));
  await r.issueKey("s");
  assert.equal(seen.length, 4);
  assert.ok(seen.every((x) => !x.init.headers.Authorization));
  assert.equal(JSON.stringify(r), "{}");
});
test("AMD exact amounts and percentages reach the API without precision loss", async () => {
  const c = client(quote);
  for (const item of [{symbol:"AMD", amount:"0.123456789012345678"}, {symbol:"AMD", percentage:50}]) {
    const input = {method:"rwa", sender, recipient, items:[item,{symbol:"AAPL",amount:"1"}]};
    await c.quote(input);
    assert.deepEqual(JSON.parse(calls.at(-1).init.body),input);
  }
});
test("eleven supported symbols retain a ten-asset basket maximum", async () => {
  const c = client(quote);
  const symbols = ["NVDA","AAPL","TSLA","MSFT","AMZN","GOOGL","META","SPY","MSTR","QQQ","AMD"];
  await c.quote({method:"rwa",sender,recipient,items:symbols.slice(1).map(symbol=>({symbol,amount:"1"}))});
  const before=calls.length;
  for(const items of [symbols.map(symbol=>({symbol,amount:"1"})),[{symbol:"AMD",amount:"1"},{symbol:"AMD",percentage:25}],[{symbol:"UNKNOWN",amount:"1"}]]) {
    await assert.rejects(c.quote({method:"rwa",sender,recipient,items}));
  }
  assert.equal(calls.length,before);
});
