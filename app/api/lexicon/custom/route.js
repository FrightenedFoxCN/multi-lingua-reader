import {
  normalizeExternalLexiconResult,
  normalizeLexiconSource,
  renderLexiconEndpoint,
  validateLexiconSource,
} from "../../../lexicon-config.js";

const MAX_TERM_LENGTH = 80;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = 9000;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function normalizedItem(item, index = 0) {
  const term = String(item?.term || "").normalize("NFC").trim();
  const lemma = String(item?.lemma || term).normalize("NFC").trim();
  return {
    id: String(item?.id || `token-${index + 1}`),
    term,
    lemma,
  };
}

function validItem(item) {
  return Boolean(item.term)
    && item.term.length <= MAX_TERM_LENGTH
    && item.lemma.length <= MAX_TERM_LENGTH;
}

function requestHeaders(source, apiKey) {
  const headers = {
    accept: "application/json",
    "user-agent": "LinguaReader/0.1 (user-configured lexicon)",
  };
  if (apiKey && source.authMode === "bearer") headers.authorization = `Bearer ${apiKey}`;
  if (apiKey && source.authMode === "header") headers[source.authHeader] = apiKey;
  return headers;
}

async function lookup(source, apiKey, language, code, item) {
  const url = renderLexiconEndpoint(source.endpoint, {
    term: item.term,
    lemma: item.lemma,
    language,
    code,
  });
  if (apiKey && source.authMode === "query") url.searchParams.set(source.authHeader, apiKey);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: requestHeaders(source, apiKey),
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`上游接口返回 ${response.status}`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_RESPONSE_BYTES) throw new Error("上游响应超过 2 MB");
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new Error("上游响应超过 2 MB");
    }
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error("上游接口没有返回 JSON");
    }
    return {
      id: item.id,
      ...normalizeExternalLexiconResult(payload, {
        source,
        language: code || language,
        term: item.term,
        lemma: item.lemma,
        sourceUrl: url.toString(),
      }),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(items.length, limit) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ status: "invalid", message: "请求体必须是 JSON。" }, 400);
  }
  const source = normalizeLexiconSource(payload?.source);
  const errors = validateLexiconSource(source);
  if (Object.keys(errors).length) {
    return json({ status: "invalid", message: Object.values(errors)[0], errors }, 400);
  }
  if (source.authMode !== "none" && !String(payload?.apiKey || "")) {
    return json({ status: "invalid", message: "这个词典需要当前会话中的接口密钥。" }, 400);
  }
  const items = Array.isArray(payload?.items)
    ? payload.items.map(normalizedItem)
    : [normalizedItem(payload)];
  if (!items.length || items.length > 24 || items.some((item) => !validItem(item))) {
    return json({ status: "invalid", message: "每次可查询 1–24 个不超过 80 字符的词项。" }, 400);
  }
  const language = String(payload?.language || "").trim();
  const code = String(payload?.code || "").trim();
  const apiKey = String(payload?.apiKey || "");
  const results = await mapWithConcurrency(items, 3, async (item) => {
    try {
      return await lookup(source, apiKey, language, code, item);
    } catch (error) {
      return {
        id: item.id,
        status: "unavailable",
        source: source.name,
        sourceId: source.id,
        term: item.term,
        lemma: item.lemma,
        entries: [],
        message: error?.name === "AbortError"
          ? "词典接口响应超时"
          : error?.message || "词典接口暂时不可用",
      };
    }
  });
  if (Array.isArray(payload?.items)) {
    return json({ status: "ok", source: source.name, results });
  }
  return json(results[0]);
}
