const DATABASE_NAME = "lingua-dictionaries-v1";
const DATABASE_VERSION = 1;
const DICTIONARY_STORE = "dictionary-entries";

function databaseApi() {
  return globalThis.indexedDB;
}

function openDictionaryDatabase() {
  return new Promise((resolve, reject) => {
    const api = databaseApi();
    if (!api) {
      reject(new Error("当前浏览器不支持大型词典本地存储"));
      return;
    }
    const request = api.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DICTIONARY_STORE)) {
        database.createObjectStore(DICTIONARY_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地词典存储"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("本地词典存储事务失败"));
    transaction.onabort = () => reject(transaction.error || new Error("本地词典存储事务已中止"));
  });
}

export function dictionaryLexiconRecord(id, language, entries) {
  return {
    id: String(id),
    language: String(language),
    entries: Array.isArray(entries) ? entries : [],
    entryCount: Array.isArray(entries) ? entries.length : 0,
    storedAt: new Date().toISOString(),
  };
}

export async function putDictionaryLexicon(id, language, entries) {
  const database = await openDictionaryDatabase();
  try {
    const transaction = database.transaction(DICTIONARY_STORE, "readwrite");
    transaction.objectStore(DICTIONARY_STORE).put(
      dictionaryLexiconRecord(id, language, entries),
    );
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getDictionaryLexicon(id) {
  const database = await openDictionaryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(DICTIONARY_STORE, "readonly")
        .objectStore(DICTIONARY_STORE)
        .get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("无法读取本地词典"));
    });
  } finally {
    database.close();
  }
}

export async function listDictionaryLexicons() {
  const database = await openDictionaryDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database
        .transaction(DICTIONARY_STORE, "readonly")
        .objectStore(DICTIONARY_STORE)
        .getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("无法读取本地词典目录"));
    });
  } finally {
    database.close();
  }
}

export async function putDictionaryLexiconRecord(record) {
  return putDictionaryLexicon(record.id, record.language, record.entries);
}

export async function deleteDictionaryLexicon(id) {
  const database = await openDictionaryDatabase();
  try {
    const transaction = database.transaction(DICTIONARY_STORE, "readwrite");
    transaction.objectStore(DICTIONARY_STORE).delete(id);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
