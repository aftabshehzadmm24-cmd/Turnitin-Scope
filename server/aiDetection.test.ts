import test from "node:test";
import assert from "node:assert/strict";

import { analyzeTextWithAiorNot, getAiProviderFailure } from "./aiDetection.ts";

test("classifies provider timeouts as retryable gateway timeouts", () => {
  const error = new Error("request timed out");
  error.name = "TimeoutError";

  assert.deepEqual(getAiProviderFailure(error), {
    status: 504,
    message: "AI or Not detection timed out. Please try again.",
  });
});

test("classifies provider connection failures without exposing low-level details", () => {
  assert.deepEqual(
    getAiProviderFailure(new TypeError("fetch failed: ECONNREFUSED")),
    {
      status: 502,
      message: "Could not reach AI or Not. Check server network and try again.",
    }
  );
});

test("classifies unreadable provider payloads", () => {
  assert.deepEqual(
    getAiProviderFailure(new SyntaxError("Unexpected token")),
    {
      status: 502,
      message: "AI or Not returned an unreadable response.",
    }
  );
});

test("sends text to AI or Not and maps its confidence and annotations", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.AIORNOT_API_KEY;
  process.env.AIORNOT_API_KEY = "test-api-key";
  globalThis.fetch = async (input, init) => {
    assert.equal(input, "https://api.aiornot.com/v2/text/sync?include_annotations=true");
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-api-key");
    assert.equal(new Headers(init?.headers).has("content-type"), false);
    assert.ok(init?.body instanceof FormData);
    assert.equal(init.body.get("text"), "a".repeat(250));
    return new Response(JSON.stringify({
      report: {
        ai_text: {
          confidence: 0.74,
          is_detected: true,
          annotations: [["AI-generated sentence.", 0.82]],
        },
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const result = await analyzeTextWithAiorNot(undefined, "a".repeat(250));
    assert.deepEqual(result, {
      status: 200,
      body: {
        aiScore: 74,
        isDetected: true,
        annotations: [{ text: "AI-generated sentence.", confidence: 0.82 }],
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.AIORNOT_API_KEY;
    else process.env.AIORNOT_API_KEY = originalApiKey;
  }
});

test("preserves a genuine zero-percent AI or Not result", async () => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.AIORNOT_API_KEY;
  process.env.AIORNOT_API_KEY = "test-api-key";
  globalThis.fetch = async () => new Response(JSON.stringify({
    report: { ai_text: { confidence: 0, is_detected: false, annotations: [] } },
  }), { status: 200, headers: { "Content-Type": "application/json" } });

  try {
    const result = await analyzeTextWithAiorNot(undefined, "a".repeat(250));
    assert.deepEqual(result, {
      status: 200,
      body: { aiScore: 0, isDetected: false, annotations: [] },
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.AIORNOT_API_KEY;
    else process.env.AIORNOT_API_KEY = originalApiKey;
  }
});
