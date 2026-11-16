import test from "node:test";
import assert from "node:assert/strict";

import { getAiProviderFailure } from "./aiDetection.ts";

test("classifies provider timeouts as retryable gateway timeouts", () => {
  const error = new Error("request timed out");
  error.name = "TimeoutError";

  assert.deepEqual(getAiProviderFailure(error), {
    status: 504,
    message: "TruthScan AI detection timed out. Please try again.",
  });
});

test("classifies provider connection failures without exposing low-level details", () => {
  assert.deepEqual(
    getAiProviderFailure(new TypeError("fetch failed: ECONNREFUSED")),
    {
      status: 502,
      message: "Could not reach TruthScan. Check server network and try again.",
    }
  );
});

test("classifies unreadable provider payloads", () => {
  assert.deepEqual(
    getAiProviderFailure(new SyntaxError("Unexpected token")),
    {
      status: 502,
      message: "TruthScan returned an unreadable response.",
    }
  );
});
