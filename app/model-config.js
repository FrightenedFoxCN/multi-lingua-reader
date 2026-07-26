export const DEFAULT_MODEL_ENDPOINT = "https://api.openai.com/v1";
export const DEFAULT_MODEL_ID = "gpt-5.6-sol";

function clean(value) {
  return String(value ?? "").trim();
}

export function normalizeModelEndpoint(value) {
  return clean(value).replace(/\/+$/u, "");
}

export function normalizeModelConfig(value = {}) {
  return {
    provider: clean(value.provider) || "openai-compatible",
    endpoint: normalizeModelEndpoint(value.endpoint || DEFAULT_MODEL_ENDPOINT),
    model: clean(value.model) || DEFAULT_MODEL_ID,
    apiKey: clean(value.apiKey),
  };
}

export function persistentModelConfig(value = {}) {
  const config = normalizeModelConfig(value);
  return {
    provider: config.provider,
    endpoint: config.endpoint,
    model: config.model,
  };
}

export function validateModelConfig(value = {}, { requireKey = true } = {}) {
  const config = normalizeModelConfig(value);
  const errors = {};
  let endpoint;

  try {
    endpoint = new URL(config.endpoint);
  } catch {
    errors.endpoint = "请输入有效的模型终点 URL";
  }

  if (endpoint && !["http:", "https:"].includes(endpoint.protocol)) {
    errors.endpoint = "模型终点只支持 HTTP 或 HTTPS";
  }
  if (endpoint && (endpoint.username || endpoint.password)) {
    errors.endpoint = "请勿把用户名或密钥写入终点 URL";
  }
  if (!config.model) errors.model = "请输入模型 ID";
  if (requireKey && !config.apiKey) errors.apiKey = "请输入当前会话使用的 API 密钥";

  return errors;
}

export function modelListUrl(endpoint) {
  const normalized = normalizeModelEndpoint(endpoint);
  return normalized.endsWith("/models") ? normalized : `${normalized}/models`;
}

export function modelChatUrl(endpoint) {
  const normalized = normalizeModelEndpoint(endpoint);
  return normalized.endsWith("/chat/completions")
    ? normalized
    : `${normalized}/chat/completions`;
}

function connectionError(status, message) {
  if ([401, 403].includes(status)) return "认证失败，请检查密钥与终点权限";
  if (status === 404) return "终点没有提供兼容的 /models 接口";
  if (status === 429) return "终点暂时限流，请稍后重试";
  return `连接测试失败（HTTP ${status}${message ? ` · ${message}` : ""}）`;
}

export async function testModelConnection(
  value,
  fetchImplementation = globalThis.fetch,
) {
  const config = normalizeModelConfig(value);
  const errors = validateModelConfig(config);
  if (Object.keys(errors).length) {
    const error = new Error(Object.values(errors)[0]);
    error.fields = errors;
    throw error;
  }
  if (typeof fetchImplementation !== "function") {
    throw new Error("当前环境无法发起连接测试");
  }

  const startedAt = Date.now();
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 12_000) : null;

  try {
    const response = await fetchImplementation(modelListUrl(config.endpoint), {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      redirect: "error",
      signal: controller?.signal,
    });

    if (!response.ok) {
      let message = "";
      try {
        const payload = await response.json();
        message = String(payload?.error?.message || payload?.message || "").slice(0, 120);
      } catch {
        // Do not reflect arbitrary upstream bodies into the settings UI.
      }
      throw new Error(connectionError(response.status, message));
    }

    const payload = await response.json();
    const modelIds = Array.isArray(payload?.data)
      ? payload.data.map((item) => String(item?.id || "")).filter(Boolean)
      : Array.isArray(payload?.models)
        ? payload.models.map((item) => String(item?.id || item?.name || item || "")).filter(Boolean)
        : [];

    return {
      ok: true,
      latencyMs: Math.max(0, Date.now() - startedAt),
      modelAvailable: modelIds.length ? modelIds.includes(config.model) : null,
      modelCount: modelIds.length,
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("连接测试超时（12 秒）");
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
