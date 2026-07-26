import assert from "node:assert/strict";
import test from "node:test";
import {
  localLibraryPassageRecord,
  localLibraryWorkRecord,
} from "../app/library-store.js";

test("normalizes local work metadata without embedding the full text", () => {
  const work = localLibraryWorkRecord({
    id: "local-1",
    title: "Iliad",
    author: "Homer · Loeb",
    languageId: "greek",
    languageName: "古希腊语",
    code: "grc",
    passageCount: 120,
    fileNames: ["iliad.mdx"],
  });

  assert.equal(work.id, "local-1");
  assert.equal(work.passageCount, 120);
  assert.deepEqual(work.fileNames, ["iliad.mdx"]);
  assert.equal(Object.hasOwn(work, "passages"), false);
});

test("creates stable, sortable passage keys from MDX entries", () => {
  const passage = localLibraryPassageRecord(
    "local-1",
    { form: "1.1", gloss: "Μῆνιν ἄειδε θεὰ" },
    7,
  );

  assert.equal(passage.key, "local-1:0000000007");
  assert.equal(passage.citation, "1.1");
  assert.equal(passage.text, "Μῆνιν ἄειδε θεὰ");
});
