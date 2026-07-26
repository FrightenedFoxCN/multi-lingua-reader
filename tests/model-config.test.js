import assert from "node:assert/strict";
import test from "node:test";
import {
  modelChatUrl,
  modelListUrl,
  persistentModelConfig,
  testModelConnection,
  validateModelConfig,
} from "../app/model-config.js";

test("normalizes a model endpoint and excludes the secret from persistent config", () => {
  assert.equal(modelListUrl("https://api.openai.com/v1/"), "https://api.openai.com/v1/models");
  assert.equal(
    modelChatUrl("https://api.openai.com/v1/"),
    "https://api.openai.com/v1/chat/completions",
  );
  assert.deepEqual(persistentModelConfig({
    endpoint: "https://example.test/v1/",
    model: "example-model",
    apiKey: "secret",
  }), {
    provider: "openai-compatible",
    endpoint: "https://example.test/v1",
    model: "example-model",
  });
});

test("validates endpoint, model, and session key", () => {
  assert.deepEqual(validateModelConfig({
    endpoint: "file:///tmp/model",
    model: "",
    apiKey: "",
  }), {
    endpoint: "模型终点只支持 HTTP 或 HTTPS",
    apiKey: "请输入当前会话使用的 API 密钥",
  });
});

test("tests an OpenAI-compatible model list without exposing the key", async () => {
  let request;
  const result = await testModelConnection({
    endpoint: "https://example.test/v1",
    model: "lingua-model",
    apiKey: "session-secret",
  }, async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({ data: [{ id: "lingua-model" }] }),
    };
  });

  assert.equal(request.url, "https://example.test/v1/models");
  assert.equal(request.options.headers.authorization, "Bearer session-secret");
  assert.equal(result.modelAvailable, true);
  assert.equal(result.modelCount, 1);
});
