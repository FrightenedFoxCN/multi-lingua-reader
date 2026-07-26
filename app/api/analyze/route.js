import { bundledUdTreebankSamples } from "../../ud-treebank-samples.js";

const UDPIPE_ENDPOINT = "https://lindat.mff.cuni.cz/services/udpipe/api/process";
const USER_AGENT = "LinguaReader/0.1 (local research prototype)";
const UPSTREAM_TIMEOUT_MS = 18000;
const MAX_TEXT_LENGTH = 12000;
const UD_TREEBANKS = {
  ab: {
    name: "UD Abkhaz AbNC 2.18",
    url: "https://raw.githubusercontent.com/UniversalDependencies/UD_Abkhaz-AbNC/master/ab_abnc-ud-test.conllu",
    sourceUrl: "https://universaldependencies.org/treebanks/ab_abnc/",
    license: "CC BY-SA 4.0",
    acknowledgements: [
      "Paul Meurer · Abkhaz National Corpus / UD Abkhaz AbNC",
    ],
  },
};
const treebankCache = new Map();

function normalizedLanguageCode(value) {
  return String(value || "")
    .trim()
    .toLocaleLowerCase()
    .replaceAll("_", "-")
    .split("-")[0];
}

function parseFeatures(value) {
  if (!value || value === "_") return {};
  return Object.fromEntries(value.split("|").map((item) => {
    const separator = item.indexOf("=");
    return separator > 0
      ? [item.slice(0, separator), item.slice(separator + 1)]
      : [item, "Yes"];
  }));
}

export function parseConllu(source) {
  return String(source || "")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.split("\t"))
    .filter((columns) => columns.length >= 10 && /^\d+$/u.test(columns[0]))
    .map((columns) => ({
      id: Number(columns[0]),
      form: columns[1],
      lemma: columns[2] === "_" ? columns[1] : columns[2],
      upos: columns[3],
      xpos: columns[4] === "_" ? "" : columns[4],
      features: parseFeatures(columns[5]),
      head: Number(columns[6]) || 0,
      dependency: columns[7] === "_" ? "dep" : columns[7],
      misc: columns[9] === "_" ? "" : columns[9],
    }));
}

function conlluMetadata(source) {
  const metadata = {};
  for (const line of String(source || "").split(/\r?\n/u)) {
    const match = /^# ([^=]+) = (.+)$/u.exec(line);
    if (match) metadata[match[1].trim()] = match[2].trim();
  }
  return metadata;
}

export function normalizeTreebankText(value) {
  return String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
}

export function findConlluSentence(source, text) {
  const target = normalizeTreebankText(text);
  if (!target) return null;
  for (const block of String(source || "").split(/\r?\n\r?\n/u)) {
    const metadata = conlluMetadata(block);
    if (normalizeTreebankText(metadata.text) !== target) continue;
    const tokens = parseConllu(block);
    if (tokens.length) return { metadata, tokens };
  }
  return null;
}

export function normalizeRequestedAnalysisEngines(value) {
  if (!Array.isArray(value)) return ["ud-corpus", "udpipe"];
  return value
    .map((engine) => String(engine || "").trim())
    .filter((engine, index, engines) => (
      ["ud-corpus", "udpipe"].includes(engine) && engines.indexOf(engine) === index
    ));
}

async function fetchTreebank(config, signal) {
  if (treebankCache.has(config.url)) return treebankCache.get(config.url);
  const response = await fetch(config.url, {
    headers: {
      accept: "text/plain",
      "user-agent": USER_AGENT,
    },
    signal,
  });
  if (!response.ok) throw new Error(`UD treebank request failed with ${response.status}`);
  const source = await response.text();
  treebankCache.set(config.url, source);
  return source;
}

async function lookupTreebankSentence(code, text, signal) {
  const config = UD_TREEBANKS[code];
  if (!config) return null;
  const bundledMatch = findConlluSentence(bundledUdTreebankSamples[code], text);
  if (bundledMatch) return { ...config, ...bundledMatch };
  try {
    const source = await fetchTreebank(config, signal);
    const match = findConlluSentence(source, text);
    return match ? { ...config, ...match } : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ status: "invalid", message: "请求体必须是 JSON。" }, { status: 400 });
  }

  const code = normalizedLanguageCode(payload?.code);
  const text = String(payload?.text || "").normalize("NFC").trim();
  const requestedEngines = normalizeRequestedAnalysisEngines(payload?.engines);
  if (!code || code === "x" || !/^[a-z]{2,8}$/u.test(code)) {
    return Response.json(
      { status: "not_configured", message: "该语言代码无法映射到 UDPipe 模型。" },
      { status: 400 },
    );
  }
  if (!text || text.length > MAX_TEXT_LENGTH) {
    return Response.json(
      { status: "invalid", message: `文本不能为空，且不得超过 ${MAX_TEXT_LENGTH} 个字符。` },
      { status: 400 },
    );
  }
  if (!requestedEngines.length) {
    return Response.json(
      { status: "not_configured", message: "请求中没有启用服务端句法引擎。" },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    for (const engine of requestedEngines) {
      if (engine === "ud-corpus") {
        const treebankMatch = await lookupTreebankSentence(code, text, controller.signal);
        if (treebankMatch) {
          return Response.json({
            status: "ok",
            kind: "ud-corpus",
            code,
            model: treebankMatch.name,
            license: treebankMatch.license,
            acknowledgements: treebankMatch.acknowledgements,
            sourceUrl: treebankMatch.sourceUrl,
            sentenceId: treebankMatch.metadata.sent_id || "",
            tokens: treebankMatch.tokens,
          }, {
            headers: {
              "cache-control": "private, max-age=3600",
            },
          });
        }
        continue;
      }

      const body = new URLSearchParams({
        model: code,
        tokenizer: "",
        tagger: "",
        parser: "",
        data: text,
      });
      const response = await fetch(UDPIPE_ENDPOINT, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          "user-agent": USER_AGENT,
        },
        body,
        signal: controller.signal,
      });
      const responseText = await response.text();
      let result = null;
      try {
        result = JSON.parse(responseText);
      } catch {
        result = null;
      }
      if (!response.ok || !result?.result) continue;
      const metadata = conlluMetadata(result.result);
      return Response.json({
        status: "ok",
        kind: "udpipe",
        code,
        model: result.model || metadata.udpipe_model || code,
        license: metadata.udpipe_model_licence || "按所选 Universal Dependencies 模型授权",
        acknowledgements: result.acknowledgements || [],
        sourceUrl: "https://lindat.mff.cuni.cz/services/udpipe/",
        tokens: parseConllu(result.result),
      }, {
        headers: {
          "cache-control": "private, max-age=300",
        },
      });
    }

    return Response.json({
      status: "not_configured",
      code,
      attemptedEngines: requestedEngines,
      message: requestedEngines.includes("udpipe")
        ? "已启用的 UD 树库与 UDPipe 均未返回可用分析。"
        : "启用的 UD 树库没有匹配该句。",
    }, { status: 404 });
  } catch (error) {
    return Response.json({
      status: "unavailable",
      code,
      message: error?.name === "AbortError"
        ? "UDPipe 分析超时，已回退到本地分词。"
        : "UDPipe 暂时不可用，已回退到本地分词。",
    }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
