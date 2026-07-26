import assert from "node:assert/strict";
import test from "node:test";
import {
  LOCAL_DATABASE_EXTENSION,
  LOCAL_DATABASE_MAGIC,
  localDatabaseManifest,
} from "../app/local-database.js";

test("describes a versioned local backup and explicitly excludes session keys", () => {
  const manifest = localDatabaseManifest({
    dictionaries: 2,
    works: 3,
    passages: 400,
    pdfs: 4,
    corpora: 2,
    corpusSentences: 12000,
  });

  assert.equal(LOCAL_DATABASE_MAGIC, "LINGUA-LOCAL-DATABASE/1\n");
  assert.equal(LOCAL_DATABASE_EXTENSION, ".linguadb");
  assert.equal(manifest.version, 1);
  assert.equal(manifest.counts.passages, 400);
  assert.equal(manifest.counts.corpora, 2);
  assert.equal(manifest.counts.corpusSentences, 12000);
  assert.deepEqual(manifest.excludes, ["session API keys"]);
});
