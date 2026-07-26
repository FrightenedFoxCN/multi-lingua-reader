import { normalizeLgrTags } from "./lgr.js";
import {
  applyReplacementDsl,
  parseAnalysisDsl,
} from "./analysis-dsl.js";

function clean(value) {
  return String(value ?? "").trim();
}

const XML_ENTITY_MAP = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#x([0-9a-f]+);/giu, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/gu, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/giu, (match, name) => XML_ENTITY_MAP[name.toLocaleLowerCase()] ?? match);
}

export function stripDictionaryMarkup(value) {
  return decodeEntities(String(value || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/(?:p|div|li|sense|def|cit|quote)>/giu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/\[(?:m|c|p|trn|ex|com|b|i|u|sub|sup)\d*\]/giu, " ")
    .replace(/\[\/(?:m|c|p|trn|ex|com|b|i|u|sub|sup)\]/giu, " ")
    .replace(/[\t ]+/gu, " ")
    .replace(/\s*\n\s*/gu, "；"))
    .replace(/；{2,}/gu, "；")
    .replace(/^[；\s]+|[；\s]+$/gu, "")
    .trim();
}

function normalizeDefinitions(entry) {
  const values = Array.isArray(entry?.definitions)
    ? entry.definitions
    : [entry?.gloss || entry?.definition];
  return [...new Set(values.map(clean).filter(Boolean))];
}

function splitDefinition(value) {
  const cleaned = stripDictionaryMarkup(value);
  if (!cleaned) return [];
  return cleaned
    .split(/\s*(?:\n+|；{2,})\s*/u)
    .map(clean)
    .filter(Boolean)
    .slice(0, 12);
}

function parseDelimitedRows(source, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\"") {
      if (quoted && source[index + 1] === "\"") {
        field += "\"";
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && character === delimiter) {
      row.push(field);
      field = "";
      continue;
    }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => clean(value))) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += character;
  }
  row.push(field);
  if (row.some((value) => clean(value))) rows.push(row);
  return rows;
}

function delimitedEntries(source, format) {
  const delimiter = format === "csv" ? "," : "\t";
  const rows = parseDelimitedRows(source, delimiter);
  if (!rows.length) return [];
  const possibleHeader = rows[0].map((value) => clean(value).toLocaleLowerCase());
  const knownHeaders = new Set([
    "form", "headword", "word", "lemma", "reading", "pronunciation",
    "pos", "partofspeech", "gloss", "definition", "definitions",
  ]);
  const hasHeader = possibleHeader.some((value) => knownHeaders.has(value.replaceAll("_", "")));
  const headers = hasHeader
    ? possibleHeader
    : ["form", "lemma", "pos", "definition"];
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return dataRows.map((row) => {
    const values = Object.fromEntries(headers.map((header, index) => [header, clean(row[index])]));
    const form = values.form || values.headword || values.word || row[0];
    const definition = values.definition || values.definitions || values.gloss || row[3] || row[1];
    return {
      form,
      lemma: values.lemma || form,
      reading: values.reading || values.pronunciation,
      pos: values.pos || values.partofspeech,
      definitions: splitDefinition(definition),
    };
  }).filter((entry) => clean(entry.form));
}

function dslEntries(source) {
  const entries = [];
  let headwords = [];
  let definitionLines = [];
  const flush = () => {
    const definitions = splitDefinition(definitionLines.join("\n"));
    headwords.forEach((form) => entries.push({
      form: form.replace(/^"|"$/gu, "").replaceAll("\\ ", " ").trim(),
      lemma: form.replace(/^"|"$/gu, "").replaceAll("\\ ", " ").trim(),
      definitions,
    }));
    headwords = [];
    definitionLines = [];
  };

  String(source || "").replace(/^\uFEFF/u, "").split(/\r?\n/u).forEach((line) => {
    if (!line.trim() || line.startsWith("#")) return;
    if (/^[\t ]/u.test(line)) {
      definitionLines.push(line.trim());
      return;
    }
    if (definitionLines.length) flush();
    headwords.push(line.trim());
  });
  flush();
  return entries.filter((entry) => entry.form);
}

function tagText(source, tags) {
  for (const tag of tags) {
    const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "iu").exec(source);
    if (match) return stripDictionaryMarkup(match[1]);
  }
  return "";
}

function allTagTexts(source, tags) {
  const values = [];
  tags.forEach((tag) => {
    const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "giu");
    for (const match of source.matchAll(pattern)) {
      const value = stripDictionaryMarkup(match[1]);
      if (value) values.push(value);
    }
  });
  return [...new Set(values)];
}

function xmlEntries(source, format) {
  const isLift = format === "lift" || /<lift\b/iu.test(source);
  const isXdxf = format === "xdxf" || /<xdxf\b/iu.test(source);
  const entryPattern = isXdxf
    ? /<ar\b[^>]*>([\s\S]*?)<\/ar>/giu
    : /<entry\b[^>]*>([\s\S]*?)<\/entry>/giu;
  const entries = [];
  for (const match of source.matchAll(entryPattern)) {
    const body = match[1];
    const form = isLift
      ? tagText(tagTextRaw(body, ["lexical-unit"]) || body, ["text", "form"])
      : isXdxf
        ? tagText(body, ["k"])
        : tagText(body, ["orth", "form"]);
    const definitions = isLift
      ? allTagTexts(body, ["definition", "gloss", "text"])
        .filter((value) => value !== form)
      : isXdxf
        ? splitDefinition(body.replace(/<k\b[^>]*>[\s\S]*?<\/k>/giu, ""))
        : allTagTexts(body, ["def", "quote", "gloss"]);
    if (!form) continue;
    entries.push({
      form,
      lemma: form,
      reading: tagText(body, ["pron", "usg"]),
      pos: tagText(body, ["pos", "gram"]),
      definitions: definitions.length ? definitions : splitDefinition(body),
    });
  }
  return entries;
}

function tagTextRaw(source, tags) {
  for (const tag of tags) {
    const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "iu").exec(source);
    if (match) return match[1];
  }
  return "";
}

function jsonEntries(source) {
  const payload = JSON.parse(source);
  return Array.isArray(payload) ? payload : payload.entries;
}

export function dictionaryFormatFromFiles(files = []) {
  const names = Array.from(files).map((file) => file.name.toLocaleLowerCase());
  if (names.some((name) => name.endsWith(".mdx"))) return "mdx";
  if (names.some((name) => name.endsWith(".ifo"))) return "stardict";
  const name = names[0] || "";
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".csv")) return "csv";
  if (name.endsWith(".tsv") || name.endsWith(".tab")) return "tsv";
  if (name.endsWith(".dsl")) return "dsl";
  if (name.endsWith(".lift")) return "lift";
  if (name.endsWith(".xdxf")) return "xdxf";
  if (name.endsWith(".tei") || name.endsWith(".xml")) return "tei";
  if (name.endsWith(".txt")) return "tsv";
  return "unknown";
}

export function parseDictionaryText(source, format, sourceMeta = {}) {
  let rows;
  if (format === "json") rows = jsonEntries(source);
  else if (["csv", "tsv"].includes(format)) rows = delimitedEntries(source, format);
  else if (format === "dsl") rows = dslEntries(source);
  else if (["tei", "lift", "xdxf"].includes(format)) rows = xmlEntries(source, format);
  else throw new Error("暂不支持该词典文本格式");
  return normalizeDictionaryEntries(rows, sourceMeta);
}

async function inflateGzip(buffer) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("当前浏览器无法解压 StarDict 压缩文件；请使用未压缩的 .dict/.idx");
  }
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function fileBytes(file, compressed = false) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return compressed ? inflateGzip(bytes) : bytes;
}

async function parseStarDictFiles(files, sourceMeta, maxEntries) {
  const list = Array.from(files);
  const ifo = list.find((file) => /\.ifo$/iu.test(file.name));
  const idx = list.find((file) => /\.idx(?:\.gz)?$/iu.test(file.name));
  const dict = list.find((file) => /\.dict(?:\.dz)?$/iu.test(file.name));
  if (!ifo || !idx || !dict) {
    throw new Error("StarDict 需要同时选择 .ifo、.idx（或 .idx.gz）和 .dict（或 .dict.dz）");
  }
  const metadata = Object.fromEntries(
    (await ifo.text()).split(/\r?\n/u)
      .map((line) => line.split("="))
      .filter((parts) => parts.length > 1)
      .map(([key, ...value]) => [key.trim(), value.join("=").trim()]),
  );
  const offsetBits = Number(metadata.idxoffsetbits || 32);
  if (offsetBits !== 32) throw new Error("当前版本仅支持 32 位 StarDict 索引");
  const idxBytes = await fileBytes(idx, /\.gz$/iu.test(idx.name));
  const dictBytes = await fileBytes(dict, /\.dz$/iu.test(dict.name));
  const decoder = new TextDecoder("utf-8");
  const entries = [];
  let cursor = 0;
  while (cursor < idxBytes.length && entries.length < maxEntries) {
    let wordEnd = cursor;
    while (wordEnd < idxBytes.length && idxBytes[wordEnd] !== 0) wordEnd += 1;
    if (wordEnd + 9 > idxBytes.length) break;
    const form = decoder.decode(idxBytes.slice(cursor, wordEnd));
    const view = new DataView(idxBytes.buffer, idxBytes.byteOffset + wordEnd + 1, 8);
    const offset = view.getUint32(0, false);
    const size = view.getUint32(4, false);
    const definition = decoder.decode(dictBytes.slice(offset, offset + size));
    entries.push({
      form,
      lemma: form,
      definitions: splitDefinition(definition),
    });
    cursor = wordEnd + 9;
  }
  return normalizeDictionaryEntries(entries, {
    ...sourceMeta,
    title: sourceMeta.title || metadata.bookname || ifo.name.replace(/\.ifo$/iu, ""),
  });
}

async function parseMdxFiles(files, sourceMeta, maxEntries, onProgress) {
  let DictParser;
  try {
    ({ default: DictParser } = await import("@goworks/mdict/src/mdict-parser.js"));
  } catch {
    throw new Error("MDX 本地解析器未能载入");
  }
  const list = Array.from(files);
  const mdx = list.find((file) => /\.mdx$/iu.test(file.name));
  if (!mdx) throw new Error("请选择一个 .mdx 文件；同名 .mdd 可以同时选择");
  const resources = await DictParser(list);
  const lookup = await resources.mdx;
  const words = [];
  let follow = false;
  while (words.length < maxEntries) {
    const batch = await lookup({
      phrase: "",
      max: Math.min(250, maxEntries - words.length),
      follow,
    });
    if (!batch?.length) break;
    for (const word of batch) {
      const value = String(word);
      if (value && !words.includes(value)) words.push(value);
    }
    follow = true;
    onProgress?.({
      phase: "index",
      current: words.length,
      total: maxEntries,
    });
    if (batch.length < 10) break;
  }

  const entries = [];
  for (let index = 0; index < words.length; index += 12) {
    const batch = words.slice(index, index + 12);
    const definitions = await Promise.all(batch.map(async (form) => {
      try {
        const values = await lookup(form);
        return {
          form,
          lemma: form,
          definitions: splitDefinition(Array.isArray(values) ? values.join("\n") : values),
        };
      } catch {
        return { form, lemma: form, definitions: [] };
      }
    }));
    entries.push(...definitions);
    onProgress?.({
      phase: "definitions",
      current: Math.min(index + batch.length, words.length),
      total: words.length,
    });
  }
  return normalizeDictionaryEntries(entries, {
    ...sourceMeta,
    title: sourceMeta.title || lookup.description || mdx.name.replace(/\.mdx$/iu, ""),
  });
}

export async function importDictionaryFiles(
  files,
  {
    title = "",
    jobId = "",
    maxEntries = 2000,
    onProgress,
  } = {},
) {
  const list = Array.from(files || []);
  if (!list.length) throw new Error("请选择词典文件");
  const format = dictionaryFormatFromFiles(list);
  const sourceMeta = {
    title: clean(title) || list[0].name.replace(/\.[^.]+$/u, ""),
    jobId: clean(jobId),
  };
  let entries;
  if (format === "mdx") {
    entries = await parseMdxFiles(list, sourceMeta, maxEntries, onProgress);
  } else if (format === "stardict") {
    entries = await parseStarDictFiles(list, sourceMeta, maxEntries);
  } else if (["json", "csv", "tsv", "dsl", "tei", "lift", "xdxf"].includes(format)) {
    entries = parseDictionaryText(await list[0].text(), format, sourceMeta).slice(0, maxEntries);
  } else {
    throw new Error("无法识别词典格式；请使用 MDX、StarDict、JSON、CSV/TSV、DSL、TEI、LIFT 或 XDXF");
  }
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  const organized = [...entries].sort((a, b) => collator.compare(a.form, b.form));
  return {
    format,
    entries: organized,
    stats: {
      entries: organized.length,
      withDefinitions: organized.filter((entry) => entry.definitions.length).length,
      withPartOfSpeech: organized.filter((entry) => entry.pos).length,
      truncated: organized.length >= maxEntries,
    },
    sourceTitle: sourceMeta.title,
  };
}

export function normalizeDictionaryEntries(source, sourceMeta = {}) {
  const rows = Array.isArray(source) ? source : source?.entries;
  if (!Array.isArray(rows)) {
    throw new Error("词典识别结果需要 entries 数组");
  }

  const normalized = rows.map((entry, index) => {
    const form = clean(entry?.form || entry?.headword);
    if (!form) {
      throw new Error(`第 ${index + 1} 条词典记录缺少词形`);
    }
    const definitions = normalizeDefinitions(entry);
    return {
      form,
      lemma: clean(entry?.lemma || form),
      reading: clean(entry?.reading),
      pos: clean(entry?.pos),
      gloss: definitions.join("；"),
      definitions,
      lgrTags: normalizeLgrTags(entry?.lgrTags || entry?.morphology || []).tags,
      morphologyCandidates: Array.isArray(entry?.morphologyCandidates)
        ? entry.morphologyCandidates
        : [],
      page: clean(entry?.page || entry?.sourcePage),
      confidence: Number.isFinite(Number(entry?.confidence))
        ? Math.max(0, Math.min(100, Number(entry.confidence)))
        : null,
      sourceTitle: clean(entry?.sourceTitle || sourceMeta.title),
      sourceJobId: clean(entry?.sourceJobId || sourceMeta.jobId),
    };
  });

  return normalized.filter((entry, index) => (
    normalized.findIndex((candidate) => (
      candidate.form.normalize("NFC").toLocaleLowerCase()
      === entry.form.normalize("NFC").toLocaleLowerCase()
    )) === index
  ));
}

export function normalizeDictionaryEntriesWithDsl(entries, packs = [], context = {}) {
  const contextCodes = [context.languageId, context.languageCode]
    .map((value) => clean(value).toLocaleLowerCase())
    .filter(Boolean);
  const compiledPacks = (packs || []).map((pack) => {
    const parsed = parseAnalysisDsl(pack?.source || "");
    const language = clean(parsed.program.language).toLocaleLowerCase();
    if (
      !parsed.valid
      || !parsed.program.replacements.length
      || (language !== "*" && !contextCodes.includes(language))
    ) return null;
    return {
      id: clean(pack.id),
      name: clean(pack.name) || "未命名规则包",
      source: pack.source,
      updatedAt: pack.updatedAt || "",
      program: parsed.program,
      replacementCount: parsed.program.replacements.length,
    };
  }).filter(Boolean);
  let changedEntries = 0;
  let changedFields = 0;
  const normalized = (entries || []).map((entry) => {
    let form = entry.form;
    let lemma = entry.lemma;
    const sources = [];
    compiledPacks.forEach((pack) => {
      const nextForm = applyReplacementDsl(form, pack.program, context, "form");
      const nextLemma = applyReplacementDsl(lemma, pack.program, context, "lemma");
      if (nextForm.value !== form || nextLemma.value !== lemma) sources.push(pack.name);
      if (nextForm.value !== form) changedFields += 1;
      if (nextLemma.value !== lemma) changedFields += 1;
      form = nextForm.value;
      lemma = nextLemma.value;
    });
    const changed = form !== entry.form || lemma !== entry.lemma;
    if (changed) changedEntries += 1;
    return {
      ...entry,
      form,
      lemma,
      ...(form !== entry.form ? { originalForm: entry.originalForm || entry.form } : {}),
      ...(lemma !== entry.lemma ? { originalLemma: entry.originalLemma || entry.lemma } : {}),
      ...(sources.length ? { normalizationSources: [...new Set(sources)] } : {}),
    };
  });
  const deduplicated = mergeDictionaryEntries([], normalized);
  return {
    entries: deduplicated,
    changedEntries,
    changedFields,
    packs: compiledPacks.map(({ program, ...pack }) => pack),
  };
}

export function mergeDictionaryEntries(current, incoming) {
  const merged = new Map();
  [...(current || []), ...(incoming || [])].forEach((entry) => {
    const key = clean(entry.form).normalize("NFC").toLocaleLowerCase();
    if (!key) return;
    const previous = merged.get(key);
    merged.set(key, previous ? {
      ...previous,
      ...entry,
      definitions: [...new Set([
        ...(previous.definitions || []),
        ...(entry.definitions || []),
      ])],
      gloss: entry.gloss || previous.gloss,
    } : entry);
  });
  return [...merged.values()];
}
