// Run: node src/gmail/client.test.mjs
import assert from "node:assert/strict";
import { RETRY_CONFIG } from "../../dist/gmail/client.js";

const at = (n) => ({ config: { retryConfig: { currentRetryAttempt: n, retry: 8 } } });
const err = (status, reason, attempt = 0) => ({
  ...at(attempt),
  status,
  ...(reason ? { errors: [{ reason }] } : {}),
});
const R = (e) => RETRY_CONFIG.shouldRetry(e);

// the bug this fix exists for: Gmail's per-minute quota is a 403, not a 429
assert.equal(R(err(403, "rateLimitExceeded")), true, "403 rateLimitExceeded must retry");
assert.equal(R(err(403, "userRateLimitExceeded")), true);
assert.equal(R(err(403, "quotaExceeded")), true);

// ...but a real permission denial must NOT be retried into a hang
assert.equal(R(err(403, "insufficientPermissions")), false, "403 permission error must not retry");
assert.equal(R(err(403, "forbidden")), false);
assert.equal(R(err(403)), false, "bare 403 with no reason must not retry");

// nested response shape (what googleapis actually throws)
assert.equal(R({ ...at(0), response: { status: 403, data: { error: { errors: [{ reason: "rateLimitExceeded" }] } } } }), true);

// ordinary retryable + non-retryable statuses
assert.equal(R(err(429)), true);
assert.equal(R(err(503)), true);
assert.equal(R(err(408)), true);
assert.equal(R(err(404)), false);
assert.equal(R(err(401)), false, "expired auth must surface, not spin");

// budget is respected so a sustained outage terminates
assert.equal(R(err(429, null, 7)), true);
assert.equal(R(err(429, null, 8)), false, "must stop at the retry budget");
assert.equal(R(err(403, "rateLimitExceeded", 8)), false);

console.log("client.test: all assertions passed");
