const test = require("node:test");
const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { createApp } = require("../src");
const { createCheckRouter, isValidEmail, checkEmail } = require("../src/routes/check");

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function fixtureResolver() {
  return {
    async resolveMx(domain) {
      if (domain === "mx.example") return [{ exchange: "mx2.example", priority: 20 }, { exchange: "mx1.example", priority: 10 }];
      if (domain === "fallback.example") throw codedError("ENODATA");
      if (domain === "dns-error.example") throw codedError("EAI_AGAIN");
      if (domain === "dns-not-found.example") throw codedError("ENOTFOUND");
      if (domain === "timeout.example") throw codedError("ETIMEOUT");
      throw codedError("ENODATA");
    },
    async resolve4(domain) {
      if (domain === "fallback.example") return ["192.0.2.10"];
      throw codedError("ENODATA");
    },
    async resolve6() { throw codedError("ENODATA"); },
  };
}

async function withApi(run) {
  const app = createApp(createCheckRouter({ resolver: fixtureResolver(), maxEmails: 3, concurrency: 2 }));
  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  try { await run(`http://127.0.0.1:${port}`); }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

 test("email syntax accepts ordinary addresses and rejects malformed addresses", () => {
  assert.equal(isValidEmail("person+tag@example.com"), true);
  assert.equal(isValidEmail("person..name@example.com"), false);
  assert.equal(isValidEmail("person@localhost"), false);
  assert.equal(isValidEmail("@example.com"), false);
});

test("MX lookup reports Unknown because DNS does not verify the individual mailbox", async () => {
  const result = await checkEmail("person@mx.example", fixtureResolver());
  assert.equal(result.classification, "Unknown");
  assert.match(result.explanation, /individual mailbox was not verified/);
  assert.equal(result.checks.mx, true);
});

test("no MX uses implicit A/AAAA fallback and no routing records means Likely to Bounce", async () => {
  const fallback = await checkEmail("person@fallback.example", fixtureResolver());
  assert.equal(fallback.classification, "Unknown");
  assert.equal(fallback.checks.addressFallback, true);
  const none = await checkEmail("person@no-route.example", fixtureResolver());
  assert.equal(none.classification, "Likely to Bounce");
  assert.match(none.explanation, /no MX or fallback A\/AAAA/);
});

test("DNS failures, ambiguous ENOTFOUND responses, and timeouts produce Unknown", async () => {
  for (const domain of ["dns-error.example", "dns-not-found.example", "timeout.example"]) {
    const result = await checkEmail(`person@${domain}`, fixtureResolver());
    assert.equal(result.classification, "Unknown");
  }
});

test("health and check endpoints handle outcomes and malformed requests", async () => {
  await withApi(async (base) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).status, "ok");

    const check = await fetch(`${base}/api/check`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ emails: ["person@mx.example", "bad-address", "person@dns-error.example", "person@timeout.example"] }),
    });
    assert.equal(check.status, 400); // test app has a three-address batch limit
    assert.match((await check.json()).error, /Maximum is 3/);

    const good = await fetch(`${base}/api/check`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ emails: ["person@mx.example", "bad-address", "person@dns-error.example"] }),
    });
    assert.equal(good.status, 200);
    const payload = await good.json();
    assert.equal(payload.count, 3);
    assert.deepEqual(payload.results.map((row) => row.classification), ["Unknown", "Likely to Bounce", "Unknown"]);

    const malformed = await fetch(`${base}/api/check`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{not json",
    });
    assert.equal(malformed.status, 400);
    assert.match((await malformed.json()).error, /Invalid JSON/);

    const wrongShape = await fetch(`${base}/api/check`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ emails: ["a@example.com", 3] }),
    });
    assert.equal(wrongShape.status, 400);
  });
});
