import {
  listDictionaryLexicons,
  putDictionaryLexiconRecord,
} from "./dictionary-store.js";
import {
  getLocalLibraryPassage,
  listLocalLibraryWorks,
  putLocalLibraryPassageRecord,
  putLocalLibraryWorkMetadata,
} from "./library-store.js";
import {
  listPdfMaterials,
  putPdfMaterialRecord,
} from "./material-store.js";
import {
  listCorpora,
  listCorpusSentences,
  putCorpusMetadataRecord,
  putCorpusSentenceRecord,
} from "./corpus-store.js";

export const LOCAL_DATABASE_MAGIC = "LINGUA-LOCAL-DATABASE/1\n";
export const LOCAL_DATABASE_EXTENSION = ".linguadb";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const LOCAL_STORAGE_KEYS = [
  "lingua-reader-state-v2",
  "lingua-language-workspace-v1",
  "lingua-model-config-v1",
  "lingua-lexicon-sources-v1",
];

function downloadName() {
  return `lingua-local-${new Date().toISOString().slice(0, 10)}${LOCAL_DATABASE_EXTENSION}`;
}

async function createWriter(suggestedName) {
  if (typeof globalThis.showSaveFilePicker === "function" && !navigator.webdriver) {
    const handle = await globalThis.showSaveFilePicker({
      suggestedName,
      types: [{
        description: "Lingua 本地数据库",
        accept: { "application/octet-stream": [LOCAL_DATABASE_EXTENSION] },
      }],
    });
    const writable = await handle.createWritable();
    return {
      mode: "stream",
      write: (value) => writable.write(value),
      close: () => writable.close(),
    };
  }

  const chunks = [];
  return {
    mode: "memory",
    write(value) {
      chunks.push(value);
    },
    close() {
      const blob = new Blob(chunks, { type: "application/octet-stream" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = suggestedName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    },
  };
}

async function writeRecord(writer, headerInput, payloadInput) {
  let payload;
  let encoding;
  if (payloadInput instanceof Blob) {
    payload = payloadInput;
    encoding = "blob";
  } else if (typeof payloadInput === "string") {
    payload = encoder.encode(payloadInput);
    encoding = "text";
  } else {
    payload = encoder.encode(JSON.stringify(payloadInput));
    encoding = "json";
  }
  const length = payload instanceof Blob ? payload.size : payload.byteLength;
  const header = {
    ...headerInput,
    encoding,
    length,
  };
  await writer.write(encoder.encode(`${JSON.stringify(header)}\n`));
  await writer.write(payload);
  await writer.write(encoder.encode("\n"));
}

export function localDatabaseManifest({
  dictionaries = 0,
  works = 0,
  passages = 0,
  pdfs = 0,
  corpora = 0,
  corpusSentences = 0,
} = {}) {
  return {
    product: "Lingua Reader",
    format: "lingua-local-database",
    version: 1,
    createdAt: new Date().toISOString(),
    counts: {
      dictionaries,
      works,
      passages,
      pdfs,
      corpora,
      corpusSentences,
    },
    excludes: ["session API keys"],
  };
}

export async function exportLocalDatabase({ onProgress } = {}) {
  const [dictionaries, works, pdfs, corpora] = await Promise.all([
    listDictionaryLexicons(),
    listLocalLibraryWorks(),
    listPdfMaterials(),
    listCorpora(),
  ]);
  const passageCount = works.reduce((sum, work) => sum + work.passageCount, 0);
  const corpusSentenceCount = corpora.reduce(
    (sum, corpus) => sum + Number(corpus.sentenceCount || 0),
    0,
  );
  const total = LOCAL_STORAGE_KEYS.length
    + dictionaries.length
    + works.length
    + passageCount
    + pdfs.length
    + corpora.length
    + corpusSentenceCount;
  const writer = await createWriter(downloadName());
  let current = 0;
  await writer.write(encoder.encode(LOCAL_DATABASE_MAGIC));
  await writeRecord(writer, { store: "manifest", key: "manifest" }, localDatabaseManifest({
    dictionaries: dictionaries.length,
    works: works.length,
    passages: passageCount,
    pdfs: pdfs.length,
    corpora: corpora.length,
    corpusSentences: corpusSentenceCount,
  }));

  for (const key of LOCAL_STORAGE_KEYS) {
    await writeRecord(writer, { store: "local-storage", key }, localStorage.getItem(key) ?? "{}");
    current += 1;
    onProgress?.({ current, total, label: "偏好与工作区" });
  }
  for (const record of dictionaries) {
    await writeRecord(writer, { store: "dictionary", key: record.id }, record);
    current += 1;
    onProgress?.({ current, total, label: `词典 · ${record.language}` });
  }
  for (const work of works) {
    await writeRecord(writer, { store: "library-work", key: work.id }, work);
    current += 1;
    onProgress?.({ current, total, label: `书库 · ${work.title}` });
    for (let index = 0; index < work.passageCount; index += 1) {
      const passage = await getLocalLibraryPassage(work.id, index);
      if (passage) {
        await writeRecord(writer, {
          store: "library-passage",
          key: passage.key,
        }, passage);
      }
      current += 1;
      onProgress?.({ current, total, label: `${work.title} · ${index + 1}/${work.passageCount}` });
    }
  }
  for (const record of pdfs) {
    const { blob, ...metadata } = record;
    await writeRecord(writer, {
      store: "pdf",
      key: record.id,
      meta: metadata,
      contentType: blob.type || "application/pdf",
    }, blob);
    current += 1;
    onProgress?.({ current, total, label: `PDF · ${record.name}` });
  }
  for (const corpus of corpora) {
    await writeRecord(writer, { store: "corpus", key: corpus.id }, corpus);
    current += 1;
    onProgress?.({ current, total, label: `语料库 · ${corpus.title}` });
    const sentences = await listCorpusSentences(corpus.id);
    for (const sentence of sentences) {
      await writeRecord(writer, {
        store: "corpus-sentence",
        key: sentence.key,
      }, sentence);
      current += 1;
      onProgress?.({
        current,
        total,
        label: `${corpus.title} · ${sentence.ordinal + 1}/${sentences.length}`,
      });
    }
  }
  await writer.close();
  return {
    mode: writer.mode,
    total,
    counts: localDatabaseManifest({
      dictionaries: dictionaries.length,
      works: works.length,
      passages: passageCount,
      pdfs: pdfs.length,
      corpora: corpora.length,
      corpusSentences: corpusSentenceCount,
    }).counts,
  };
}

async function readLine(file, start) {
  const chunkSize = 64 * 1024;
  let cursor = start;
  let combined = new Uint8Array(0);
  while (cursor < file.size) {
    const chunk = new Uint8Array(await file.slice(cursor, Math.min(file.size, cursor + chunkSize)).arrayBuffer());
    const newline = chunk.indexOf(10);
    const next = new Uint8Array(combined.length + (newline >= 0 ? newline : chunk.length));
    next.set(combined);
    next.set(newline >= 0 ? chunk.slice(0, newline) : chunk, combined.length);
    if (newline >= 0) {
      return {
        line: decoder.decode(next),
        next: cursor + newline + 1,
      };
    }
    combined = next;
    cursor += chunk.length;
    if (combined.length > 1024 * 1024) throw new Error("本地数据库记录头过长");
  }
  return { line: decoder.decode(combined), next: file.size };
}

export async function inspectLocalDatabase(file) {
  if (!file || !String(file.name || "").toLocaleLowerCase().endsWith(LOCAL_DATABASE_EXTENSION)) {
    throw new Error(`请选择 ${LOCAL_DATABASE_EXTENSION} 本地数据库文件`);
  }
  const magic = await readLine(file, 0);
  if (`${magic.line}\n` !== LOCAL_DATABASE_MAGIC) throw new Error("无法识别该本地数据库版本");
  const manifestHeaderLine = await readLine(file, magic.next);
  const header = JSON.parse(manifestHeaderLine.line);
  if (header.store !== "manifest" || header.length < 2) throw new Error("本地数据库清单缺失");
  const payload = JSON.parse(await file.slice(
    manifestHeaderLine.next,
    manifestHeaderLine.next + header.length,
  ).text());
  return {
    manifest: payload,
    cursor: manifestHeaderLine.next + header.length + 1,
  };
}

export async function importLocalDatabase(file, { onProgress } = {}) {
  const inspected = await inspectLocalDatabase(file);
  let cursor = inspected.cursor;
  let current = 0;
  const total = Object.values(inspected.manifest.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0)
    + LOCAL_STORAGE_KEYS.length;

  while (cursor < file.size) {
    const headerLine = await readLine(file, cursor);
    cursor = headerLine.next;
    if (!headerLine.line.trim()) continue;
    const header = JSON.parse(headerLine.line);
    if (!Number.isSafeInteger(header.length) || header.length < 0 || cursor + header.length > file.size) {
      throw new Error("本地数据库记录长度无效");
    }
    const payload = file.slice(cursor, cursor + header.length, header.contentType || undefined);
    cursor += header.length + 1;
    if (header.store === "local-storage") {
      localStorage.setItem(header.key, await payload.text());
    } else if (header.store === "dictionary") {
      await putDictionaryLexiconRecord(JSON.parse(await payload.text()));
    } else if (header.store === "library-work") {
      await putLocalLibraryWorkMetadata(JSON.parse(await payload.text()));
    } else if (header.store === "library-passage") {
      await putLocalLibraryPassageRecord(JSON.parse(await payload.text()));
    } else if (header.store === "pdf") {
      await putPdfMaterialRecord({
        ...(header.meta || {}),
        id: header.key,
        blob: payload,
      });
    } else if (header.store === "corpus") {
      await putCorpusMetadataRecord(JSON.parse(await payload.text()));
    } else if (header.store === "corpus-sentence") {
      await putCorpusSentenceRecord(JSON.parse(await payload.text()));
    }
    current += 1;
    onProgress?.({ current, total, label: header.store });
  }
  return {
    manifest: inspected.manifest,
    importedRecords: current,
  };
}

export async function requestLocalPersistence() {
  const supported = Boolean(navigator.storage?.persist && navigator.storage?.estimate);
  if (!supported) return { supported: false, persisted: false, usage: 0, quota: 0 };
  const persisted = await navigator.storage.persist();
  const estimate = await navigator.storage.estimate();
  return {
    supported: true,
    persisted,
    usage: estimate.usage || 0,
    quota: estimate.quota || 0,
  };
}
