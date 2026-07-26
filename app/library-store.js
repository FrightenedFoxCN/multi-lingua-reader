const DATABASE_NAME = "lingua-library-v1";
const DATABASE_VERSION = 1;
const WORK_STORE = "works";
const PASSAGE_STORE = "passages";

function databaseApi() {
  return globalThis.indexedDB;
}

function openLibraryDatabase() {
  return new Promise((resolve, reject) => {
    const api = databaseApi();
    if (!api) {
      reject(new Error("当前浏览器不支持大型书库本地存储"));
      return;
    }
    const request = api.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(WORK_STORE)) {
        database.createObjectStore(WORK_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(PASSAGE_STORE)) {
        const passages = database.createObjectStore(PASSAGE_STORE, { keyPath: "key" });
        passages.createIndex("workId", "workId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地书库存储"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("本地书库存储事务失败"));
    transaction.onabort = () => reject(transaction.error || new Error("本地书库存储事务已中止"));
  });
}

function requestResult(request, errorMessage) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error || new Error(errorMessage));
  });
}

export function localLibraryWorkRecord(input = {}) {
  const passageCount = Math.max(0, Number(input.passageCount) || 0);
  return {
    id: String(input.id),
    title: String(input.title || "本地文本"),
    titleZh: String(input.titleZh || "本地导入"),
    author: String(input.author || "本地导入"),
    languageId: String(input.languageId || "latin"),
    languageName: String(input.languageName || input.languageId || "未指定语言"),
    code: String(input.code || "und"),
    direction: input.direction === "rtl" ? "rtl" : "ltr",
    passageCount,
    format: String(input.format || "mdx"),
    fileNames: Array.isArray(input.fileNames) ? input.fileNames.map(String) : [],
    coverMark: String(input.coverMark || Array.from(input.title || "L")[0] || "L"),
    importedAt: String(input.importedAt || new Date().toISOString()),
    storedAt: String(input.storedAt || new Date().toISOString()),
  };
}

export function localLibraryPassageRecord(workId, entry = {}, index = 0) {
  const numericIndex = Math.max(0, Number(index) || 0);
  const definitions = Array.isArray(entry.definitions) ? entry.definitions.filter(Boolean) : [];
  const text = String(
    entry.text
    || entry.gloss
    || definitions.join("\n\n")
    || entry.definition
    || "",
  ).trim();
  return {
    key: `${String(workId)}:${String(numericIndex).padStart(10, "0")}`,
    workId: String(workId),
    index: numericIndex,
    citation: String(entry.citation || entry.form || entry.lemma || numericIndex + 1),
    text,
    sourceTitle: String(entry.sourceTitle || ""),
    sourcePage: String(entry.page || entry.sourcePage || ""),
  };
}

export async function putLocalLibraryWork(workInput, entries = [], onProgress) {
  const work = localLibraryWorkRecord({
    ...workInput,
    passageCount: entries.length,
  });
  const database = await openLibraryDatabase();
  try {
    const metadataTransaction = database.transaction(WORK_STORE, "readwrite");
    metadataTransaction.objectStore(WORK_STORE).put(work);
    await transactionDone(metadataTransaction);

    const batchSize = 300;
    for (let start = 0; start < entries.length; start += batchSize) {
      const transaction = database.transaction(PASSAGE_STORE, "readwrite");
      const store = transaction.objectStore(PASSAGE_STORE);
      entries.slice(start, start + batchSize).forEach((entry, offset) => {
        store.put(localLibraryPassageRecord(work.id, entry, start + offset));
      });
      await transactionDone(transaction);
      onProgress?.({
        current: Math.min(entries.length, start + batchSize),
        total: entries.length,
      });
    }
    return work;
  } finally {
    database.close();
  }
}

export async function putLocalLibraryWorkMetadata(workInput) {
  const database = await openLibraryDatabase();
  try {
    const transaction = database.transaction(WORK_STORE, "readwrite");
    transaction.objectStore(WORK_STORE).put(localLibraryWorkRecord(workInput));
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function putLocalLibraryPassageRecord(passageInput) {
  const record = {
    ...localLibraryPassageRecord(
      passageInput.workId,
      passageInput,
      passageInput.index,
    ),
    key: String(passageInput.key || localLibraryPassageRecord(
      passageInput.workId,
      passageInput,
      passageInput.index,
    ).key),
  };
  const database = await openLibraryDatabase();
  try {
    const transaction = database.transaction(PASSAGE_STORE, "readwrite");
    transaction.objectStore(PASSAGE_STORE).put(record);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getLocalLibraryWork(id) {
  const database = await openLibraryDatabase();
  try {
    return await requestResult(
      database.transaction(WORK_STORE, "readonly").objectStore(WORK_STORE).get(id),
      "无法读取本地作品",
    );
  } finally {
    database.close();
  }
}

export async function listLocalLibraryWorks() {
  const database = await openLibraryDatabase();
  try {
    const result = await requestResult(
      database.transaction(WORK_STORE, "readonly").objectStore(WORK_STORE).getAll(),
      "无法读取本地书库目录",
    );
    return (result || []).sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)));
  } finally {
    database.close();
  }
}

export async function getLocalLibraryPassage(workId, index) {
  const database = await openLibraryDatabase();
  try {
    const key = `${String(workId)}:${String(Math.max(0, Number(index) || 0)).padStart(10, "0")}`;
    return await requestResult(
      database.transaction(PASSAGE_STORE, "readonly").objectStore(PASSAGE_STORE).get(key),
      "无法读取本地书库段落",
    );
  } finally {
    database.close();
  }
}

export async function deleteLocalLibraryWork(id) {
  const database = await openLibraryDatabase();
  try {
    const transaction = database.transaction([WORK_STORE, PASSAGE_STORE], "readwrite");
    transaction.objectStore(WORK_STORE).delete(id);
    const passageStore = transaction.objectStore(PASSAGE_STORE);
    const index = passageStore.index("workId");
    const request = index.openKeyCursor(IDBKeyRange.only(String(id)));
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      passageStore.delete(cursor.primaryKey);
      cursor.continue();
    };
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
