import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_LOCAL_PDF_BYTES,
  pdfMaterialMetadata,
  validatePdfMaterial,
} from "../app/material-store.js";

test("validates local PDF type, size, and empty files", () => {
  assert.equal(validatePdfMaterial(null), "请选择一个 PDF 文件");
  assert.equal(
    validatePdfMaterial({ name: "notes.txt", type: "text/plain", size: 12 }),
    "当前导入接口只接受 PDF",
  );
  assert.equal(
    validatePdfMaterial({ name: "empty.pdf", type: "application/pdf", size: 0 }),
    "PDF 文件为空或无法读取",
  );
  assert.equal(
    validatePdfMaterial({
      name: "large.pdf",
      type: "application/pdf",
      size: MAX_LOCAL_PDF_BYTES + 1,
    }),
    "单个 PDF 的本地保存上限为 50 MB",
  );
  assert.equal(
    validatePdfMaterial({ name: "sample.pdf", type: "application/pdf", size: 1024 }),
    "",
  );
});

test("creates serializable PDF metadata without embedding the blob", () => {
  const metadata = pdfMaterialMetadata("pdf-1", {
    name: "parallel.pdf",
    type: "application/pdf",
    size: 2048,
    lastModified: 42,
  });

  assert.equal(metadata.id, "pdf-1");
  assert.equal(metadata.name, "parallel.pdf");
  assert.equal(metadata.size, 2048);
  assert.equal(metadata.lastModified, 42);
  assert.equal(Object.hasOwn(metadata, "blob"), false);
  assert.ok(metadata.storedAt);
});
