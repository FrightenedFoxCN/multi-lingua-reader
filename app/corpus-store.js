import {
  applyReplacementDsl,
  parseAnalysisDsl,
} from "./analysis-dsl.js";

const DATABASE_NAME = "lingua-corpora-v1";
const DATABASE_VERSION = 1;
const CORPUS_STORE = "corpora";
const SENTENCE_STORE = "corpus-sentences";
const SENTENCE_BATCH_SIZE = 300;
const MAX_CORPUS_BYTES = 1024 * 1024 * 1024;

function databaseApi() {
  return globalThis.indexedDB;
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizationContext(input = {}) {
  return {
    languageId: clean(input.languageId),
    languageCode: clean(input.languageCode).toLocaleLowerCase(),
  };
}

function languageApplies(language, context = {}) {
  const scope = clean(language).toLocaleLowerCase();
  const codes = [context.languageId, context.languageCode]
    .map((value) => clean(value).toLocaleLowerCase())
    .filter(Boolean);
  return scope === "*" || codes.includes(scope);
}

function compileNormalizationPacks(packs = [], context = {}) {
  return (packs || []).map((pack) => {
    const parsed = parseAnalysisDsl(pack?.source || "");
    if (
      !parsed.valid
      || !parsed.program.replacements.length
      || !languageApplies(parsed.program.language, context)
    ) return null;
    return {
      id: clean(pack.id),
      name: clean(pack.name) || "未命名规则包",
      source: pack.source,
      updatedAt: pack.updatedAt || "",
      replacementCount: parsed.program.replacements.length,
      program: parsed.program,
    };
  }).filter(Boolean);
}

function normalizationPackSnapshots(compiledPacks = []) {
  return compiledPacks.map(({ program, ...snapshot }) => snapshot);
}

function normalizeWithPacks(value, field, compiledPacks, context) {
  let result = String(value || "");
  let applied = 0;
  compiledPacks.forEach((pack) => {
    const next = applyReplacementDsl(result, pack.program, context, field);
    result = next.value;
    applied += next.applied;
  });
  return { value: result, applied };
}

export function normalizeCorpusText(value) {
  return String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/\s+/gu, " ")
    .trim();
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

function blockMetadata(source) {
  const metadata = {};
  String(source || "").split(/\r?\n/u).forEach((line) => {
    const match = /^# ([^=]+) = (.+)$/u.exec(line);
    if (match) metadata[match[1].trim()] = match[2].trim();
  });
  return metadata;
}

export function parseConlluTokens(source) {
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

function textFromTokens(tokens) {
  return tokens.map((token, index) => {
    const noSpace = token.misc.split("|").includes("SpaceAfter=No");
    return `${token.form}${noSpace || index === tokens.length - 1 ? "" : " "}`;
  }).join("").trim();
}

export function parseConlluSentence(source, ordinal = 0, options = {}) {
  const context = normalizationContext(options);
  const compiledPacks = options.compiledNormalizationPacks
    || compileNormalizationPacks(options.normalizationPacks, context);
  const metadata = blockMetadata(source);
  const originalTokens = parseConlluTokens(source);
  if (!originalTokens.length) return null;
  let normalizationChanges = 0;
  const tokens = originalTokens.map((token) => {
    const normalizedForm = normalizeWithPacks(token.form, "form", compiledPacks, context);
    const normalizedLemma = normalizeWithPacks(token.lemma, "lemma", compiledPacks, context);
    normalizationChanges += normalizedForm.applied + normalizedLemma.applied;
    return {
      ...token,
      form: normalizedForm.value,
      lemma: normalizedLemma.value,
      ...(normalizedForm.value !== token.form ? { originalForm: token.form } : {}),
      ...(normalizedLemma.value !== token.lemma ? { originalLemma: token.lemma } : {}),
    };
  });
  const originalText = clean(metadata.text) || textFromTokens(originalTokens);
  const normalizedSentence = normalizeWithPacks(originalText, "text", compiledPacks, context);
  normalizationChanges += normalizedSentence.applied;
  const text = normalizedSentence.value;
  return {
    ordinal,
    sentId: clean(metadata.sent_id) || `sentence-${ordinal + 1}`,
    text,
    ...(text !== originalText ? { originalText } : {}),
    normalizedText: normalizeCorpusText(text),
    tokens,
    normalizationChanges,
  };
}

export function parseConlluCorpus(source, options = {}) {
  const context = normalizationContext(options);
  const compiledNormalizationPacks = compileNormalizationPacks(
    options.normalizationPacks,
    context,
  );
  return String(source || "")
    .normalize("NFC")
    .replace(/\r\n?/gu, "\n")
    .split(/\n{2,}/u)
    .map((block, index) => parseConlluSentence(block, index, {
      ...context,
      compiledNormalizationPacks,
    }))
    .filter(Boolean);
}

function openCorpusDatabase() {
  return new Promise((resolve, reject) => {
    const api = databaseApi();
    if (!api) {
      reject(new Error("当前浏览器不支持本地语料库存储"));
      return;
    }
    const request = api.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(CORPUS_STORE)) {
        database.createObjectStore(CORPUS_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SENTENCE_STORE)) {
        const store = database.createObjectStore(SENTENCE_STORE, { keyPath: "key" });
        store.createIndex("by-corpus", "corpusId", { unique: false });
        store.createIndex("by-text", "normalizedText", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地语料库存储"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("本地语料库事务失败"));
    transaction.onabort = () => reject(transaction.error || new Error("本地语料库事务已中止"));
  });
}

function requestResult(request, message) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error(message));
  });
}

export function corpusMetadataRecord(input = {}) {
  const packs = Array.isArray(input.normalizationPacks)
    ? input.normalizationPacks.map((pack) => ({
      id: clean(pack.id),
      name: clean(pack.name) || "未命名规则包",
      source: String(pack.source || ""),
      updatedAt: pack.updatedAt || "",
      replacementCount: Number(pack.replacementCount) || 0,
    })).filter((pack) => pack.source)
    : [];
  return {
    id: clean(input.id) || `corpus-${Date.now()}`,
    title: clean(input.title) || "未命名语料库",
    languageId: clean(input.languageId),
    languageCode: clean(input.languageCode).toLocaleLowerCase(),
    format: "conllu",
    sourceUrl: clean(input.sourceUrl),
    license: clean(input.license) || "用户导入 · 授权待补充",
    acknowledgement: clean(input.acknowledgement),
    sentenceCount: Number(input.sentenceCount) || 0,
    tokenCount: Number(input.tokenCount) || 0,
    normalizationPacks: packs,
    replacementCount: packs.reduce((sum, pack) => sum + pack.replacementCount, 0),
    normalizationChanges: Number(input.normalizationChanges) || 0,
    fileName: clean(input.fileName),
    fileSize: Number(input.fileSize) || 0,
    importedAt: input.importedAt || new Date().toISOString(),
  };
}

function sentenceRecord(corpus, sentence) {
  return {
    key: `${corpus.id}:${String(sentence.ordinal).padStart(9, "0")}`,
    corpusId: corpus.id,
    languageId: corpus.languageId,
    languageCode: corpus.languageCode,
    ordinal: sentence.ordinal,
    sentId: sentence.sentId,
    text: sentence.text,
    ...(sentence.originalText ? { originalText: sentence.originalText } : {}),
    normalizedText: sentence.normalizedText,
    tokens: sentence.tokens,
    normalizationChanges: sentence.normalizationChanges || 0,
  };
}

async function deleteCorpusSentences(database, corpusId) {
  const transaction = database.transaction(SENTENCE_STORE, "readwrite");
  const index = transaction.objectStore(SENTENCE_STORE).index("by-corpus");
  await new Promise((resolve, reject) => {
    const request = index.openKeyCursor(IDBKeyRange.only(corpusId));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      transaction.objectStore(SENTENCE_STORE).delete(cursor.primaryKey);
      cursor.continue();
    };
    request.onerror = () => reject(request.error || new Error("无法清理旧语料句子"));
  });
  await transactionDone(transaction);
}

async function putSentenceBatch(database, corpus, sentences) {
  if (!sentences.length) return;
  const transaction = database.transaction(SENTENCE_STORE, "readwrite");
  const store = transaction.objectStore(SENTENCE_STORE);
  sentences.forEach((sentence) => store.put(sentenceRecord(corpus, sentence)));
  await transactionDone(transaction);
}

export function validateCorpusFile(file) {
  if (!file) return "请选择 CoNLL-U 文件";
  if (!file.size) return "语料库文件为空";
  if (file.size > MAX_CORPUS_BYTES) return "单个语料库文件不能超过 1 GB";
  if (!/\.(?:conllu|conll|txt)$/iu.test(file.name || "")) {
    return "请选择 .conllu、.conll 或 .txt 文件";
  }
  return "";
}

export async function importConlluCorpus(file, input = {}, { onProgress } = {}) {
  const validationError = validateCorpusFile(file);
  if (validationError) throw new Error(validationError);
  const context = normalizationContext(input);
  const compiledNormalizationPacks = compileNormalizationPacks(
    input.normalizationPacks,
    context,
  );
  const corpus = corpusMetadataRecord({
    ...input,
    normalizationPacks: normalizationPackSnapshots(compiledNormalizationPacks),
    fileName: file.name,
    fileSize: file.size,
    sentenceCount: 0,
    tokenCount: 0,
  });
  const database = await openCorpusDatabase();
  let sentenceCount = 0;
  let tokenCount = 0;
  let normalizationChanges = 0;
  let processedBytes = 0;
  let buffer = "";
  let batch = [];
  try {
    await deleteCorpusSentences(database, corpus.id);
    const reader = file.stream().getReader();
    const decoder = new TextDecoder();
    const processBlock = async (block) => {
      const sentence = parseConlluSentence(block, sentenceCount, {
        ...context,
        compiledNormalizationPacks,
      });
      if (!sentence) return;
      sentenceCount += 1;
      tokenCount += sentence.tokens.length;
      normalizationChanges += sentence.normalizationChanges;
      batch.push(sentence);
      if (batch.length >= SENTENCE_BATCH_SIZE) {
        await putSentenceBatch(database, corpus, batch);
        batch = [];
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      processedBytes += value.byteLength;
      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n?/gu, "\n");
      let separator = buffer.indexOf("\n\n");
      while (separator >= 0) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        await processBlock(block);
        separator = buffer.indexOf("\n\n");
      }
      onProgress?.({
        current: processedBytes,
        total: file.size,
        sentenceCount,
        tokenCount,
        normalizationChanges,
      });
    }
    buffer += decoder.decode();
    if (buffer.trim()) await processBlock(buffer);
    await putSentenceBatch(database, corpus, batch);

    const completed = corpusMetadataRecord({
      ...corpus,
      sentenceCount,
      tokenCount,
      normalizationChanges,
    });
    const transaction = database.transaction(CORPUS_STORE, "readwrite");
    transaction.objectStore(CORPUS_STORE).put(completed);
    await transactionDone(transaction);
    return completed;
  } catch (error) {
    await deleteCorpusSentences(database, corpus.id).catch(() => {});
    throw error;
  } finally {
    database.close();
  }
}

export async function listCorpora() {
  const database = await openCorpusDatabase();
  try {
    return await requestResult(
      database.transaction(CORPUS_STORE, "readonly").objectStore(CORPUS_STORE).getAll(),
      "无法读取本地语料库目录",
    );
  } finally {
    database.close();
  }
}

export async function lookupCorpusSentence({
  text,
  languageId = "",
  languageCode = "",
  corpusIds = [],
} = {}) {
  const rawNormalizedText = normalizeCorpusText(text);
  if (!rawNormalizedText) return null;
  const database = await openCorpusDatabase();
  try {
    const allowedCorpora = new Set(corpusIds);
    const normalizedCode = clean(languageCode).toLocaleLowerCase();
    const corpora = await requestResult(
      database.transaction(CORPUS_STORE, "readonly").objectStore(CORPUS_STORE).getAll(),
      "无法读取语料库目录",
    );
    const eligibleCorpora = corpora.filter((corpus) => (
      (!allowedCorpora.size || allowedCorpora.has(corpus.id))
      && (
        (!languageId && !normalizedCode)
        || corpus.languageId === languageId
        || corpus.languageCode === normalizedCode
      )
    ));
    const recordsByText = new Map();
    let match = null;
    let corpus = null;
    for (const candidateCorpus of eligibleCorpora) {
      const context = normalizationContext(candidateCorpus);
      const compiledPacks = compileNormalizationPacks(
        candidateCorpus.normalizationPacks,
        context,
      );
      const canonical = normalizeWithPacks(text, "text", compiledPacks, context);
      const normalizedText = normalizeCorpusText(canonical.value);
      if (!recordsByText.has(normalizedText)) {
        const records = await requestResult(
          database
            .transaction(SENTENCE_STORE, "readonly")
            .objectStore(SENTENCE_STORE)
            .index("by-text")
            .getAll(normalizedText),
          "无法查询本地语料库",
        );
        recordsByText.set(normalizedText, records);
      }
      const record = recordsByText.get(normalizedText)
        .find((item) => item.corpusId === candidateCorpus.id);
      if (record) {
        match = record;
        corpus = candidateCorpus;
        break;
      }
    }
    if (!match) return null;
    return {
      status: "ok",
      kind: "local-corpus",
      code: match.languageCode,
      model: corpus?.title || match.corpusId,
      license: corpus?.license || "",
      acknowledgements: [corpus?.acknowledgement].filter(Boolean),
      sourceUrl: corpus?.sourceUrl || "",
      sentenceId: match.sentId,
      corpusId: match.corpusId,
      originalText: match.originalText || "",
      normalizationChanges: match.normalizationChanges || 0,
      normalizationPacks: corpus?.normalizationPacks || [],
      tokens: match.tokens,
    };
  } finally {
    database.close();
  }
}

export async function listCorpusSentences(corpusId) {
  const database = await openCorpusDatabase();
  try {
    return await requestResult(
      database
        .transaction(SENTENCE_STORE, "readonly")
        .objectStore(SENTENCE_STORE)
        .index("by-corpus")
        .getAll(corpusId),
      "无法读取语料库句子",
    );
  } finally {
    database.close();
  }
}

export async function putCorpusMetadataRecord(record) {
  const database = await openCorpusDatabase();
  try {
    const transaction = database.transaction(CORPUS_STORE, "readwrite");
    transaction.objectStore(CORPUS_STORE).put(corpusMetadataRecord(record));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function putCorpusSentenceRecord(record) {
  const database = await openCorpusDatabase();
  try {
    const transaction = database.transaction(SENTENCE_STORE, "readwrite");
    transaction.objectStore(SENTENCE_STORE).put(record);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function deleteCorpus(corpusId) {
  const database = await openCorpusDatabase();
  try {
    await deleteCorpusSentences(database, corpusId);
    const transaction = database.transaction(CORPUS_STORE, "readwrite");
    transaction.objectStore(CORPUS_STORE).delete(corpusId);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
