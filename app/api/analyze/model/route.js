import { modelChatUrl, normalizeModelConfig, validateModelConfig } from "../../../model-config.js";

const MAX_TEXT_LENGTH = 12000;
const MAX_MODEL_TOKENS = 2400;
const UPSTREAM_TIMEOUT_MS = 45000;

function clean(value) {
  return String(value ?? "").trim();
}

function jsonFromModelContent(content) {
  if (content && typeof content === "object") return content;
  const source = clean(content)
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "");
  try {
    return JSON.parse(source);
  } catch {
    const start = source.indexOf("{");
    const end = source.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(source.slice(start, end + 1));
    throw new Error("模型没有返回可解析的 JSON");
  }
}

function normalizedFeatures(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value)
    .slice(0, 48)
    .map(([key, item]) => [clean(key).slice(0, 80), clean(item).slice(0, 160)])
    .filter(([key, item]) => key && item));
}

export function extractModelTokens(content) {
  const payload = jsonFromModelContent(content);
  const source = Array.isArray(payload) ? payload : payload?.tokens;
  if (!Array.isArray(source) || !source.length || source.length > MAX_MODEL_TOKENS) {
    throw new Error("模型 JSON 中缺少有效的 tokens 数组");
  }
  const tokens = source.map((token, index) => ({
    id: index + 1,
    form: clean(token?.form).slice(0, 500),
    lemma: clean(token?.lemma || token?.form).slice(0, 500),
    upos: clean(token?.upos || "X").toLocaleUpperCase().slice(0, 40),
    xpos: clean(token?.xpos).slice(0, 80),
    features: normalizedFeatures(token?.features),
    head: Number.isInteger(Number(token?.head)) ? Number(token.head) : 0,
    dependency: clean(token?.dependency || "dep").slice(0, 80),
    misc: "",
  }));
  if (tokens.some((token) => !token.form)) {
    throw new Error("模型返回了空词形");
  }
  tokens.forEach((token) => {
    if (token.head < 0 || token.head > tokens.length || token.head === token.id) {
      token.head = 0;
      token.dependency = "root";
    }
  });
  if (!tokens.some((token) => token.head === 0)) {
    tokens[0].head = 0;
    tokens[0].dependency = "root";
  }
  return tokens;
}

function promptFor({ text, code, languageName }) {
  return [
    "Analyze the supplied sentence as a descriptive linguist.",
    "Return JSON only: {\"tokens\":[{\"form\":\"…\",\"lemma\":\"…\",\"upos\":\"NOUN\",\"xpos\":\"\",\"features\":{\"Case\":\"Nom\"},\"head\":0,\"dependency\":\"root\"}]}",
    "Use Universal Dependencies UPOS, FEATS and dependency relation names.",
    "Token ids are implicit array positions starting at 1. head is 0 for the root.",
    "Preserve every surface character except whitespace between tokens; do not translate or explain.",
    `Language: ${clean(languageName) || clean(code) || "unknown"} (${clean(code) || "und"})`,
    `Text: ${text}`,
  ].join("\n");
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ status: "invalid", message: "请求体必须是 JSON。" }, { status: 400 });
  }
  const text = clean(payload?.text).normalize("NFC");
  const config = normalizeModelConfig({
    endpoint: payload?.endpoint,
    model: payload?.model,
    apiKey: request.headers.get("authorization")?.replace(/^Bearer\s+/iu, ""),
  });
  const errors = validateModelConfig(config);
  if (Object.keys(errors).length) {
    return Response.json(
      { status: "invalid", message: Object.values(errors)[0] },
      { status: 400 },
    );
  }
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return Response.json(
      { status: "invalid", message: `文本不能为空，且不得超过 ${MAX_TEXT_LENGTH} 个字符。` },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(modelChatUrl(config.endpoint), {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: "You return conservative, machine-readable Universal Dependencies analyses.",
          },
          {
            role: "user",
            content: promptFor({
              text,
              code: payload?.code,
              languageName: payload?.languageName,
            }),
          },
        ],
        temperature: 0,
      }),
      redirect: "error",
      signal: controller.signal,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      return Response.json({
        status: "unavailable",
        message: clean(result?.error?.message || result?.message)
          .slice(0, 160)
          || `模型终点返回 HTTP ${response.status}`,
      }, { status: 502 });
    }
    const content = result?.choices?.[0]?.message?.content ?? result?.output_text;
    const tokens = extractModelTokens(content);
    return Response.json({
      status: "ok",
      kind: "llm",
      code: clean(payload?.code).toLocaleLowerCase(),
      model: config.model,
      license: "模型生成分析 · 需要人工校订",
      acknowledgements: [],
      sourceUrl: "",
      tokens,
    }, {
      headers: {
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return Response.json({
      status: "unavailable",
      message: error?.name === "AbortError"
        ? "模型分析超时。"
        : clean(error?.message) || "模型终点暂时不可用。",
    }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
