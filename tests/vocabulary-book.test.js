import assert from "node:assert/strict";
import test from "node:test";
import {
  createVocabularyRecord,
  exportVocabularyCsv,
  findVocabularyTarget,
  mergeVocabularyRecords,
  parseVocabularyCsv,
  relatedVocabularyItems,
  vocabularyRecordKey,
} from "../app/vocabulary-book.js";

test("exports and imports a quoted vocabulary CSV without losing linguistic fields", () => {
  const record = createVocabularyRecord({
    languageId: "greek",
    languageCode: "grc",
    languageName: "古希腊语",
    form: "Μῆνιν",
    lemma: "μῆνις",
    partOfSpeech: "名词",
    meaning: "愤怒，神圣的“震怒”",
    reading: "mê-nin",
    morphology: ["阴性", "单数", "宾格"],
    ctsUrn: "urn:cts:greekLit:tlg0012.tlg001:1.1@Μῆνιν[1]",
  }, "2026-07-28T00:00:00.000Z");

  const csv = exportVocabularyCsv([record]);
  const parsed = parseVocabularyCsv(`\uFEFF${csv}`);

  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].meaning, "愤怒，神圣的“震怒”");
  assert.equal(parsed.records[0].morphology, "阴性 · 单数 · 宾格");
  assert.equal(parsed.records[0].ctsUrn, record.ctsUrn);
});

test("accepts localized CSV headers and merges duplicate lexemes", () => {
  const imported = parseVocabularyCsv([
    "语言,语言代码,词形,词元,词性,释义",
    "latin,la,amō,amō,动词,爱",
    "latin,la,amō,amō,动词,喜爱",
  ].join("\n"));
  const existing = [createVocabularyRecord({
    languageId: "latin",
    form: "amō",
    lemma: "amō",
    meaning: "爱",
  }, "2026-07-20T00:00:00.000Z")];
  const merged = mergeVocabularyRecords(existing, imported.records);

  assert.equal(imported.records.length, 1);
  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].meaning, "喜爱");
  assert.equal(merged.records[0].addedAt, "2026-07-20T00:00:00.000Z");
  assert.equal(vocabularyRecordKey(merged.records[0]), merged.records[0].key);
});

test("finds query targets and ranks related inflections before similar morphology", () => {
  const tokens = [
    { id: "1", form: "amo", lemma: "amō", pos: "动词", morphology: ["现在时"], lineIndex: 0 },
    { id: "2", form: "amat", lemma: "amō", pos: "动词", morphology: ["现在时"], lineIndex: 1 },
    { id: "3", form: "canit", lemma: "canō", pos: "动词", morphology: ["现在时"], lineIndex: 2 },
    { id: "4", form: "arma", lemma: "arma", pos: "名词", morphology: ["复数"], lineIndex: 0 },
  ];

  assert.equal(findVocabularyTarget(tokens, "canō").id, "3");
  const related = relatedVocabularyItems(tokens, tokens[0], 3);
  assert.equal(related[0].id, "2");
  assert.equal(related[0].reason, "同词元");
  assert.equal(related[1].id, "3");
});
