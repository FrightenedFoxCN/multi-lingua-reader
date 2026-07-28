export const LEXICON_CONFIG_STORAGE_KEY = "lingua-lexicon-sources-v1";
export const LEXICON_SECRET_SESSION_KEY = "lingua-lexicon-secrets-v1";

export const builtInLexiconSource = Object.freeze({
  id: "wiktionary",
  kind: "wiktionary",
  name: "Wiktionary",
  enabled: true,
  languages: "*",
  endpoint: "",
  authMode: "none",
  authHeader: "x-api-key",
});

function plainText(value, fallback = "") {
  return String(value ?? fallback).replace(/\s+/gu, " ").trim();
}

function stringList(value) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return values
    .map((item) => plainText(item))
    .filter(Boolean);
}

function uniqueStrings(values, limit = 12) {
  return [...new Set(values.map((value) => plainText(value)).filter(Boolean))].slice(0, limit);
}

export function freshCustomLexiconSource(index = 1) {
  return {
    id: `custom-${Date.now()}-${index}`,
    kind: "custom",
    name: `自定义词典 ${index}`,
    enabled: true,
    languages: "*",
    endpoint: "https://dictionary.example/api/lookup?term={term}&language={code}",
    authMode: "none",
    authHeader: "x-api-key",
  };
}

export function normalizeLexiconSource(source, index = 0) {
  if (source?.kind === "wiktionary" || source?.id === "wiktionary") {
    return {
      ...builtInLexiconSource,
      enabled: source?.enabled !== false,
      languages: plainText(source?.languages, "*") || "*",
    };
  }
  return {
    id: plainText(source?.id, `custom-${index + 1}`),
    kind: "custom",
    name: plainText(source?.name, `自定义词典 ${index + 1}`).slice(0, 80),
    enabled: source?.enabled !== false,
    languages: plainText(source?.languages, "*").toLocaleLowerCase() || "*",
    endpoint: String(source?.endpoint || "").trim().slice(0, 2000),
    authMode: ["none", "bearer", "header", "query"].includes(source?.authMode)
      ? source.authMode
      : "none",
    authHeader: plainText(source?.authHeader, "x-api-key").slice(0, 80) || "x-api-key",
  };
}

export function normalizeLexiconSources(sources) {
  const input = Array.isArray(sources) && sources.length ? sources : [builtInLexiconSource];
  const normalized = input.map(normalizeLexiconSource);
  if (!normalized.some((source) => source.id === "wiktionary")) {
    normalized.unshift({ ...builtInLexiconSource });
  }
  const seen = new Set();
  return normalized.filter((source) => {
    if (!source.id || seen.has(source.id)) return false;
    seen.add(source.id);
    return true;
  }).slice(0, 8);
}

export function persistentLexiconSources(sources) {
  return normalizeLexiconSources(sources).map((source) => ({
    id: source.id,
    kind: source.kind,
    name: source.name,
    enabled: source.enabled,
    languages: source.languages,
    endpoint: source.endpoint,
    authMode: source.authMode,
    authHeader: source.authHeader,
  }));
}

export function validateLexiconSource(source) {
  if (source?.kind === "wiktionary") return {};
  const errors = {};
  if (!plainText(source?.name)) errors.name = "请填写词典名称";
  if (!String(source?.endpoint || "").trim()) {
    errors.endpoint = "请填写查询地址";
  } else {
    try {
      const url = new URL(
        String(source.endpoint)
          .replaceAll("{term}", "word")
          .replaceAll("{lemma}", "word")
          .replaceAll("{language}", "english")
          .replaceAll("{code}", "en"),
      );
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        errors.endpoint = "查询地址必须是无内嵌账号的 HTTP 或 HTTPS 地址";
      }
    } catch {
      errors.endpoint = "查询地址格式无效";
    }
  }
  if (source?.authMode === "header" && !plainText(source?.authHeader)) {
    errors.authHeader = "请填写密钥请求头名称";
  }
  return errors;
}

export function sourceSupportsLanguage(source, languageId, code = "") {
  const scope = plainText(source?.languages, "*").toLocaleLowerCase();
  if (!scope || scope === "*") return true;
  const accepted = new Set(scope.split(/[\s,;]+/u).filter(Boolean));
  const normalizedCode = plainText(code).toLocaleLowerCase();
  const normalizedLanguage = plainText(languageId).toLocaleLowerCase();
  return accepted.has(normalizedCode)
    || accepted.has(normalizedCode.split("-")[0])
    || accepted.has(normalizedLanguage);
}

export function renderLexiconEndpoint(template, values = {}) {
  const substitutions = {
    term: values.term || "",
    lemma: values.lemma || values.term || "",
    language: values.language || "",
    code: values.code || values.language || "",
  };
  const rendered = Object.entries(substitutions).reduce(
    (current, [key, value]) => current.replaceAll(`{${key}}`, encodeURIComponent(value)),
    String(template || "").trim(),
  );
  const url = new URL(rendered);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("查询地址必须是无内嵌账号的 HTTP 或 HTTPS 地址");
  }
  return url;
}

function normalizedDefinition(value) {
  if (typeof value === "string") return plainText(value);
  return plainText(value?.definition || value?.gloss || value?.text || value?.value);
}

function normalizePronunciation(item, source) {
  if (typeof item === "string") {
    return {
      url: item,
      type: "",
      provider: source.name,
      sourceUrl: "",
      file: "",
    };
  }
  const url = plainText(item?.url || item?.audioUrl || item?.audio || item?.src);
  if (!url) return null;
  return {
    url,
    type: plainText(item?.type || item?.mimeType),
    provider: plainText(item?.provider, source.name),
    sourceUrl: plainText(item?.sourceUrl || item?.pageUrl),
    file: plainText(item?.file || item?.label),
  };
}

function normalizeEntry(entry, fallbackPartOfSpeech = "") {
  if (typeof entry === "string") {
    return {
      partOfSpeech: fallbackPartOfSpeech,
      definitions: [plainText(entry)],
      morphologyCandidates: [],
    };
  }
  const definitions = uniqueStrings([
    ...stringList(entry?.definitions),
    ...stringList(entry?.definition),
    ...stringList(entry?.glosses),
    ...stringList(entry?.gloss),
    ...stringList(entry?.senses).map(normalizedDefinition),
  ], 20);
  return {
    ...entry,
    partOfSpeech: plainText(entry?.partOfSpeech || entry?.pos || fallbackPartOfSpeech),
    definitions,
    morphologyCandidates: Array.isArray(entry?.morphologyCandidates)
      ? entry.morphologyCandidates
      : [],
  };
}

export function normalizeExternalLexiconResult(payload, context = {}) {
  const source = normalizeLexiconSource(context.source || freshCustomLexiconSource());
  const root = Array.isArray(payload) ? payload[0] || {} : payload || {};
  const data = root?.data && typeof root.data === "object" && !Array.isArray(root.data)
    ? root.data
    : root;
  const rawEntries = Array.isArray(data?.entries)
    ? data.entries
    : Array.isArray(data?.meanings)
      ? data.meanings.map((meaning) => ({
        partOfSpeech: meaning?.partOfSpeech,
        definitions: (meaning?.definitions || []).map(normalizedDefinition),
      }))
    : Array.isArray(data?.results)
      ? data.results
      : Array.isArray(data?.senses)
        ? [{ senses: data.senses, pos: data.pos }]
        : [];
  const topDefinitions = uniqueStrings([
    ...stringList(data?.definitions),
    ...stringList(data?.definition),
    ...stringList(data?.glosses),
    ...stringList(data?.gloss),
  ], 20);
  const entries = rawEntries
    .map((entry) => normalizeEntry(entry, data?.partOfSpeech || data?.pos))
    .filter((entry) => entry.definitions.length || entry.partOfSpeech || entry.morphologyCandidates.length);
  if (!entries.length && topDefinitions.length) {
    entries.push({
      partOfSpeech: plainText(data?.partOfSpeech || data?.pos),
      definitions: topDefinitions,
      morphologyCandidates: [],
    });
  }
  const phonetics = Array.isArray(data?.phonetics) ? data.phonetics : [];
  const rawPronunciations = [
    ...(Array.isArray(data?.pronunciations) ? data.pronunciations : data?.pronunciations ? [data.pronunciations] : []),
    ...(Array.isArray(data?.audio) ? data.audio : data?.audio ? [data.audio] : []),
    ...(data?.audioUrl ? [data.audioUrl] : []),
    ...phonetics.filter((item) => item?.audio).map((item) => ({
      url: item.audio,
      provider: source.name,
      sourceUrl: item.sourceUrl || "",
      label: item.text || "",
    })),
  ];
  const pronunciations = rawPronunciations
    .map((item) => normalizePronunciation(item, source))
    .filter(Boolean)
    .filter((item, index, values) => values.findIndex((value) => value.url === item.url) === index)
    .slice(0, 8);
  const ipa = uniqueStrings([
    ...stringList(data?.ipa),
    ...stringList(data?.phonetic),
    ...phonetics.map((item) => typeof item === "string" ? item : item?.text || item?.ipa),
  ], 8);
  const status = data?.status === "unavailable"
    ? "unavailable"
    : entries.length || pronunciations.length || ipa.length
      ? "ok"
      : "not_found";
  return {
    status,
    source: source.name,
    sourceId: source.id,
    sourceLanguage: plainText(data?.sourceLanguage || data?.language || context.language),
    sourceUrl: plainText(data?.sourceUrl || data?.entryUrl || data?.pageUrl || context.sourceUrl),
    license: plainText(data?.license),
    term: plainText(data?.term || context.term),
    lemma: plainText(data?.lemma || context.lemma || context.term),
    detailsLoaded: true,
    ipa,
    pronunciations,
    paradigms: Array.isArray(data?.paradigms) ? data.paradigms : [],
    fixedExpressions: Array.isArray(data?.fixedExpressions) ? data.fixedExpressions : [],
    relatedTerms: Array.isArray(data?.relatedTerms) ? data.relatedTerms : [],
    entries,
  };
}

export function mergeLexiconResults(results, context = {}) {
  const available = (results || []).filter(Boolean);
  const successful = available.filter((result) => result.status === "ok");
  if (!successful.length) {
    const fallback = available.find((result) => result.status === "unavailable")
      || available.find((result) => result.status === "not_configured")
      || available[0];
    return fallback || {
      status: "not_configured",
      term: context.term || "",
      lemma: context.lemma || context.term || "",
      entries: [],
    };
  }
  const primary = successful[0];
  const entries = [];
  const entryKeys = new Set();
  successful.forEach((result) => {
    (result.entries || []).forEach((entry) => {
      const normalized = normalizeEntry(entry);
      const key = `${normalized.partOfSpeech}\u0000${normalized.definitions.join("\u0001")}`;
      if (entryKeys.has(key)) return;
      entryKeys.add(key);
      entries.push({ ...normalized, source: result.source, sourceUrl: result.sourceUrl });
    });
  });
  const pronunciations = successful
    .flatMap((result) => result.pronunciations || [])
    .filter((item, index, values) => values.findIndex((value) => value.url === item.url) === index)
    .slice(0, 8);
  const sources = successful.map((result) => ({
    id: result.sourceId || result.source,
    name: result.source || "在线词典",
    sourceLanguage: result.sourceLanguage || "",
    sourceUrl: result.sourceUrl || "",
    license: result.license || "",
  }));
  return {
    ...primary,
    status: "ok",
    term: primary.term || context.term || "",
    lemma: primary.lemma || context.lemma || context.term || "",
    entries,
    ipa: uniqueStrings(successful.flatMap((result) => result.ipa || []), 8),
    pronunciations,
    paradigms: successful.flatMap((result) => result.paradigms || []).slice(0, 4),
    fixedExpressions: successful.flatMap((result) => result.fixedExpressions || []).slice(0, 12),
    relatedTerms: successful.flatMap((result) => result.relatedTerms || []).slice(0, 12),
    detailsLoaded: successful.every((result) => result.detailsLoaded !== false),
    sources,
  };
}
