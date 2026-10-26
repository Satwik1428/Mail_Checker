const express = require("express");
const { Resolver } = require("node:dns").promises;
const rateLimit = require("express-rate-limit");

const MAX_EMAILS = readIntEnv("MAX_EMAILS", 50, 1, 100);
const CONCURRENCY = readIntEnv("CHECK_CONCURRENCY", 5, 1, 10);
const DNS_TIMEOUT_MS = readIntEnv("DNS_TIMEOUT_MS", 4000, 100, 30000);
const CLASSIFICATION = Object.freeze({
  deliverable: "Likely Deliverable",
  bounce: "Likely to Bounce",
  unknown: "Unknown",
});

function readIntEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value)) {
    console.warn(`Invalid ${name} value; using ${fallback}`);
    return fallback;
  }
  return Math.min(Math.max(value, min), max);
}

function isValidEmail(email) {
  if (typeof email !== "string" || email.length > 254) return false;
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || !/^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+$/.test(local)) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.length > 253 || !domain.includes(".")) return false;
  return domain.split(".").every((label) =>
    label.length > 0 && label.length <= 63 &&
    /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label)
  );
}

function makeResolver(timeoutMs = DNS_TIMEOUT_MS) {
  return new Resolver({ timeout: timeoutMs, tries: 1 });
}

function dnsErrorCode(error) {
  return error && typeof error.code === "string" ? error.code : "UNKNOWN";
}

async function lookupMx(domain, resolver) {
  try {
    const records = await resolver.resolveMx(domain);
    if (Array.isArray(records) && records.length > 0) {
      records.sort((a, b) => a.priority - b.priority);
      return { status: "found", records, source: "MX" };
    }
  } catch (error) {
    const code = dnsErrorCode(error);
    if (code !== "ENODATA" && code !== "ENOTFOUND") return { status: "error", code };
    if (code === "ENOTFOUND") return { status: "none", code };
    // RFC 5321 implicit MX: when no MX RRset exists, use the domain's address record.
  }

  for (const method of ["resolve4", "resolve6"]) {
    if (typeof resolver[method] !== "function") continue;
    try {
      const addresses = await resolver[method](domain);
      if (Array.isArray(addresses) && addresses.length > 0) {
        return { status: "found", records: addresses, source: method === "resolve4" ? "A" : "AAAA" };
      }
    } catch (error) {
      const code = dnsErrorCode(error);
      if (code === "ENODATA" || code === "ENOTFOUND") continue;
      return { status: "error", code };
    }
  }
  return { status: "none", code: "ENODATA" };
}

function result(email, classification, explanation, checks) {
  return { email, classification, explanation, checks };
}

async function checkEmail(email, resolver) {
  const checks = { syntax: false, mx: null, addressFallback: false, mailbox: "not_checked" };
  if (!isValidEmail(email)) {
    return result(email, CLASSIFICATION.bounce, "The address does not have valid email syntax.", checks);
  }
  checks.syntax = true;
  const domain = email.slice(email.lastIndexOf("@") + 1).toLowerCase();
  const routing = await lookupMx(domain, resolver);
  if (routing.status === "none") {
    checks.mx = false;
    return result(email, CLASSIFICATION.bounce, "The domain has no MX or fallback A/AAAA mail-routing records.", checks);
  }
  if (routing.status === "error") {
    return result(email, CLASSIFICATION.unknown, `DNS lookup failed (${routing.code}), so mail routing could not be determined.`, checks);
  }

  checks.mx = routing.source === "MX";
  checks.addressFallback = routing.source !== "MX";
  const routeDescription = routing.source === "MX"
    ? `${routing.records.length} MX mail-routing record${routing.records.length === 1 ? "" : "s"}`
    : `an implicit mail route using ${routing.source} address records`;
  return result(
    email,
    CLASSIFICATION.deliverable,
    `The domain publishes ${routeDescription}. DNS does not confirm the individual mailbox exists or guarantee inbox delivery.`,
    checks
  );
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function parseEmails(input) {
  if (typeof input !== "string" && !Array.isArray(input)) return null;
  const source = typeof input === "string" ? input.split(/[\s,;]+/) : input;
  if (source.some((item) => typeof item !== "string")) return null;
  const emails = [];
  const seen = new Set();
  for (const item of source) {
    const email = item.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      emails.push(email);
    }
  }
  return emails;
}

function createCheckRouter({ resolver = makeResolver(), maxEmails = MAX_EMAILS, concurrency = CONCURRENCY } = {}) {
  const router = express.Router();
  const checkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many check requests. Please try again later." },
  });
  router.post("/", checkLimiter, async (req, res, next) => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || !("emails" in req.body)) {
        return res.status(400).json({ error: "Request body must be an object with an emails field." });
      }
      const emails = parseEmails(req.body.emails);
      if (!emails || emails.length === 0) {
        return res.status(400).json({ error: "Provide at least one valid email string in 'emails'." });
      }
      if (emails.length > maxEmails) {
        return res.status(400).json({ error: `Too many addresses. Maximum is ${maxEmails} per request.` });
      }
      const results = await mapLimit(emails, concurrency, (email) => checkEmail(email, resolver));
      return res.status(200).json({ count: results.length, results });
    } catch (error) {
      return next(error);
    }
  });
  return router;
}

const router = createCheckRouter();
module.exports = router;
module.exports.createCheckRouter = createCheckRouter;
module.exports.lookupMx = lookupMx;
module.exports.isValidEmail = isValidEmail;
module.exports.checkEmail = checkEmail;
