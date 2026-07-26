const DATABASE_NAME = "lingua-materials-v1";
const DATABASE_VERSION = 1;
const PDF_STORE = "pdf-files";

export const MAX_LOCAL_PDF_BYTES = 50 * 1024 * 1024;

export function validatePdfMaterial(file) {
  if (!file) return "请选择一个 PDF 文件";
  const name = String(file.name || "");
  const type = String(file.type || "");
  if (type !== "application/pdf" && !name.toLocaleLowerCase().endsWith(".pdf")) {
    return "当前导入接口只接受 PDF";
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return "PDF 文件为空或无法读取";
  }
  if (file.size > MAX_LOCAL_PDF_BYTES) {
    return "单个 PDF 的本地保存上限为 50 MB";
  }
  return "";
}

export function pdfMaterialMetadata(id, file) {
  return {
    id,
    name: String(file.name || "material.pdf"),
    size: Number(file.size) || 0,
    type: String(file.type || "application/pdf"),
    lastModified: Number(file.lastModified) || null,
    storedAt: new Date().toISOString(),
  };
}

function databaseApi() {
  return globalThis.indexedDB;
}

function openMaterialDatabase() {
  return new Promise((resolve, reject) => {
    const api = databaseApi();
    if (!api) {
      reject(new Error("当前浏览器不支持本地 PDF 存储"));
      return;
    }
    const request = api.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PDF_STORE)) {
        database.createObjectStore(PDF_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("无法打开本地 PDF 存储"));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("本地 PDF 存储事务失败"));
    transaction.onabort = () => reject(transaction.error || new Error("本地 PDF 存储事务已中止"));
  });
}

export async function putPdfMaterial(id, file) {
  const validationError = validatePdfMaterial(file);
  if (validationError) throw new Error(validationError);
  const database = await openMaterialDatabase();
  try {
    const transaction = database.transaction(PDF_STORE, "readwrite");
    transaction.objectStore(PDF_STORE).put({
      ...pdfMaterialMetadata(id, file),
      blob: file,
    });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getPdfMaterial(id) {
  const database = await openMaterialDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(PDF_STORE, "readonly").objectStore(PDF_STORE).get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("无法读取本地 PDF"));
    });
  } finally {
    database.close();
  }
}

export async function hasPdfMaterial(id) {
  return Boolean(await getPdfMaterial(id));
}

export async function listPdfMaterials() {
  const database = await openMaterialDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(PDF_STORE, "readonly").objectStore(PDF_STORE).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("无法读取本地 PDF 目录"));
    });
  } finally {
    database.close();
  }
}

export async function putPdfMaterialRecord(record) {
  if (!record?.id || !(record.blob instanceof Blob)) {
    throw new Error("PDF 备份记录无效");
  }
  const database = await openMaterialDatabase();
  try {
    const transaction = database.transaction(PDF_STORE, "readwrite");
    transaction.objectStore(PDF_STORE).put({
      ...record,
      id: String(record.id),
      name: String(record.name || "material.pdf"),
      size: Number(record.size) || record.blob.size,
      type: String(record.type || record.blob.type || "application/pdf"),
      storedAt: String(record.storedAt || new Date().toISOString()),
      blob: record.blob,
    });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function deletePdfMaterial(id) {
  const database = await openMaterialDatabase();
  try {
    const transaction = database.transaction(PDF_STORE, "readwrite");
    transaction.objectStore(PDF_STORE).delete(id);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}
