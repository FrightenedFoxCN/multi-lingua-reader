import assert from "node:assert/strict";
import test from "node:test";
import { dictionaryLexiconRecord } from "../app/dictionary-store.js";

test("creates a serializable IndexedDB dictionary record", () => {
  const record = dictionaryLexiconRecord(
    "dictionary-1",
    "greek",
    [{ form: "λόγος", definitions: ["言语"] }],
  );

  assert.equal(record.id, "dictionary-1");
  assert.equal(record.language, "greek");
  assert.equal(record.entryCount, 1);
  assert.equal(record.entries[0].form, "λόγος");
  assert.ok(record.storedAt);
});
