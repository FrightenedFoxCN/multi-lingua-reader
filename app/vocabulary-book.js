export const VOCABULARY_CSV_COLUMNS = [
  "language_id",
  "language_code",
  "language_name",
  "form",
  "lemma",
  "part_of_speech",
  "meaning",
  "reading",
  "morphology",
  "work",
  "passage",
  "token_id",
  "cts_urn",
  "source_url",
  "added_at",
  "updated_at",
];

const HEADER_ALIASES = {
  language_id: ["language_id", "language", "语言", "语言标识"],
  language_code: ["language_code", "code", "语言代码"],
  language_name: ["language_name", "语言名称"],
  form: ["form", "word", "term", "词形", "单词"],
  lemma: ["lemma", "headword", "词元", "原形"],
  part_of_speech: ["part_of_speech", "pos", "词性"],
  meaning: ["meaning", "definition", "gloss", "释义", "词义"],
  reading: ["reading", "pronunciation", "读音", "发音"],
  morphology: ["morphology", "features", "词法", "词法特征"],
  work: ["work", "title", "作品"],
  passage: ["passage", "citation", "段落"],
  token_id: ["token_id", "token", "词位"],
  cts_urn: ["cts_urn", "urn", "cts", "CTS URN"],
  source_url: ["source_url", "source", "来源"],
  added_at: ["added_at", "created_at", "收藏时间"],
  updated_at: ["updated_at", "修改时间"],
};

const MAX_RECORDS = 10_000;
const MAX_CELL_LENGTH = 20_000;

function text(value, maxLength = MAX_CELL_LENGTH) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizedWord(value) {
  return text(value)
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/^[\s'"“”‘’]+|[\s'"“”‘’]+$/gu, "");
}

function safeDate(value, fallback) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

export function vocabularyRecordKey(record = {}) {
  const language = normalizedWord(record.languageId || record.languageCode || record.languageName || "und");
  const lemma = normalizedWord(record.lemma || record.form);
  const form = normalizedWord(record.form || record.lemma);
  return `vocab:${encodeURIComponent(language)}:${encodeURIComponent(lemma)}:${encodeURIComponent(form)}`;
}

export function createVocabularyRecord(input = {}, now = new Date().toISOString()) {
  const addedAt = safeDate(input.addedAt || input.added_at, now);
  const record = {
    languageId: text(
      input.languageId
      || input.language_id
      || input.language
      || input.languageCode
      || input.language_code
      || input.code
      || "und",
      80,
    ),
    languageCode: text(input.languageCode || input.language_code || input.code, 80),
    languageName: text(input.languageName || input.language_name, 120),
    form: text(input.form || input.word || input.term),
    lemma: text(input.lemma || input.headword || input.form || input.word || input.term),
    partOfSpeech: text(input.partOfSpeech || input.part_of_speech || input.pos, 160),
    meaning: text(input.meaning || input.definition || input.gloss),
    reading: text(input.reading || input.pronunciation, 500),
    morphology: Array.isArray(input.morphology)
      ? input.morphology.map((item) => text(item, 300)).filter(Boolean).join(" · ")
      : text(input.morphology || input.features),
    work: text(input.work || input.title, 500),
    passage: text(input.passage || input.citation, 300),
    tokenId: text(input.tokenId || input.token_id || input.token, 200),
    ctsUrn: text(input.ctsUrn || input.cts_urn || input.urn, 1_000),
    sourceUrl: text(input.sourceUrl || input.source_url || input.source, 2_000),
    addedAt,
    updatedAt: safeDate(input.updatedAt || input.updated_at, addedAt),
  };
  if (!record.form && !record.lemma) {
    throw new Error("生词记录缺少词形或词元");
  }
  if (!record.form) record.form = record.lemma;
  if (!record.lemma) record.lemma = record.form;
  return {
    ...record,
    key: vocabularyRecordKey(record),
  };
}

export function normalizeVocabularyRecords(records = []) {
  const normalized = [];
  const byKey = new Map();
  for (const item of Array.isArray(records) ? records.slice(0, MAX_RECORDS) : []) {
    try {
      const record = createVocabularyRecord(item);
      const existingIndex = byKey.get(record.key);
      if (existingIndex === undefined) {
        byKey.set(record.key, normalized.length);
        normalized.push(record);
      } else {
        normalized[existingIndex] = {
          ...normalized[existingIndex],
          ...Object.fromEntries(
            Object.entries(record).filter(([, value]) => value !== ""),
          ),
          addedAt: normalized[existingIndex].addedAt,
        };
      }
    } catch {
      // Ignore malformed legacy records while keeping the rest importable.
    }
  }
  return normalized.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
}

function escapeCsvCell(value) {
  let cell = text(value);
  if (/^[=+@]/u.test(cell) || /^-\D/u.test(cell)) cell = `'${cell}`;
  return `"${cell.replaceAll("\"", "\"\"")}"`;
}

export function exportVocabularyCsv(records = []) {
  const rows = normalizeVocabularyRecords(records).map((record) => ({
    language_id: record.languageId,
    language_code: record.languageCode,
    language_name: record.languageName,
    form: record.form,
    lemma: record.lemma,
    part_of_speech: record.partOfSpeech,
    meaning: record.meaning,
    reading: record.reading,
    morphology: record.morphology,
    work: record.work,
    passage: record.passage,
    token_id: record.tokenId,
    cts_urn: record.ctsUrn,
    source_url: record.sourceUrl,
    added_at: record.addedAt,
    updated_at: record.updatedAt,
  }));
  return [
    VOCABULARY_CSV_COLUMNS.map(escapeCsvCell).join(","),
    ...rows.map((row) => VOCABULARY_CSV_COLUMNS.map((column) => escapeCsvCell(row[column])).join(",")),
  ].join("\r\n");
}

function parseCsvRows(source) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === "\"" && source[index + 1] === "\"") {
        cell += "\"";
        index += 1;
      } else if (character === "\"") {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === "\"") {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/u, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
    if (cell.length > MAX_CELL_LENGTH) throw new Error("CSV 单元格内容过长");
  }
  if (quoted) throw new Error("CSV 引号没有闭合");
  if (cell || row.length) {
    row.push(cell.replace(/\r$/u, ""));
    rows.push(row);
  }
  return rows.filter((items) => items.some((item) => item.trim()));
}

function canonicalHeader(value) {
  const normalized = text(value.replace(/^\uFEFF/u, "")).toLocaleLowerCase();
  return Object.entries(HEADER_ALIASES).find(([, aliases]) => (
    aliases.some((alias) => alias.toLocaleLowerCase() === normalized)
  ))?.[0] || "";
}

function restoreSpreadsheetCell(value) {
  return /^'[=+@]/u.test(value) || /^'-\D/u.test(value) ? value.slice(1) : value;
}

export function parseVocabularyCsv(source) {
  const rows = parseCsvRows(String(source ?? ""));
  if (rows.length < 2) throw new Error("CSV 没有可导入的生词记录");
  if (rows.length - 1 > MAX_RECORDS) throw new Error(`CSV 最多导入 ${MAX_RECORDS.toLocaleString()} 条记录`);
  const headers = rows[0].map(canonicalHeader);
  if (!headers.includes("form") && !headers.includes("lemma")) {
    throw new Error("CSV 表头必须包含 form/词形 或 lemma/词元");
  }
  const importedAt = new Date().toISOString();
  const parsed = [];
  const invalidRows = [];
  rows.slice(1).forEach((cells, rowIndex) => {
    const raw = {};
    headers.forEach((header, columnIndex) => {
      if (header) raw[header] = restoreSpreadsheetCell(text(cells[columnIndex]));
    });
    try {
      parsed.push(createVocabularyRecord(raw, importedAt));
    } catch (error) {
      invalidRows.push({ row: rowIndex + 2, message: error.message });
    }
  });
  if (!parsed.length) throw new Error(invalidRows[0]?.message || "CSV 没有有效的生词记录");
  return {
    records: normalizeVocabularyRecords(parsed),
    invalidRows,
  };
}

export function mergeVocabularyRecords(current = [], incoming = []) {
  const existing = normalizeVocabularyRecords(current);
  const normalizedIncoming = normalizeVocabularyRecords(incoming);
  const merged = new Map(existing.map((record) => [record.key, record]));
  let added = 0;
  let updated = 0;
  for (const record of normalizedIncoming) {
    const previous = merged.get(record.key);
    if (!previous) {
      merged.set(record.key, record);
      added += 1;
      continue;
    }
    const next = {
      ...previous,
      ...Object.fromEntries(Object.entries(record).filter(([, value]) => value !== "")),
      addedAt: previous.addedAt,
      updatedAt: record.updatedAt,
    };
    if (JSON.stringify(next) !== JSON.stringify(previous)) updated += 1;
    merged.set(record.key, next);
  }
  return {
    records: [...merged.values()].sort((a, b) => b.addedAt.localeCompare(a.addedAt)),
    added,
    updated,
    unchanged: normalizedIncoming.length - added - updated,
  };
}

export function findVocabularyTarget(tokens = [], query = "") {
  const normalizedQuery = normalizedWord(query);
  if (!normalizedQuery) return null;
  const candidates = tokens.map((token) => ({
    ...token,
    normalizedForm: normalizedWord(token.form),
    normalizedLemma: normalizedWord(token.lemma),
  }));
  return candidates.find((token) => (
    token.normalizedForm === normalizedQuery || token.normalizedLemma === normalizedQuery
  )) || candidates.find((token) => (
    token.normalizedForm.startsWith(normalizedQuery)
    || token.normalizedLemma.startsWith(normalizedQuery)
  )) || candidates.find((token) => (
    token.normalizedForm.includes(normalizedQuery)
    || token.normalizedLemma.includes(normalizedQuery)
  )) || null;
}

export function relatedVocabularyItems(tokens = [], selectedToken, limit = 6) {
  if (!selectedToken) return [];
  const selectedLemma = normalizedWord(selectedToken.lemma);
  const selectedPos = text(selectedToken.pos);
  const selectedMorphology = new Set(
    (selectedToken.morphology || []).map(normalizedWord).filter(Boolean),
  );
  const seen = new Set();
  return tokens
    .filter((token) => token.id !== selectedToken.id)
    .map((token) => {
      const lemmaMatches = selectedLemma && normalizedWord(token.lemma) === selectedLemma;
      const sharedMorphology = (token.morphology || []).filter(
        (item) => selectedMorphology.has(normalizedWord(item)),
      ).length;
      const posMatches = selectedPos && token.pos === selectedPos;
      const score = (lemmaMatches ? 100 : 0) + (posMatches ? 18 : 0) + sharedMorphology * 7;
      return {
        ...token,
        score,
        reason: lemmaMatches ? "同词元" : sharedMorphology ? "相近词法" : posMatches ? "同词性" : "",
      };
    })
    .filter((token) => token.score > 0)
    .sort((a, b) => b.score - a.score || a.lineIndex - b.lineIndex)
    .filter((token) => {
      const key = `${normalizedWord(token.form)}:${normalizedWord(token.lemma)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}
