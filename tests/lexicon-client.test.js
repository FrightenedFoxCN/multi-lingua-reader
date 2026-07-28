import test from "node:test";
import assert from "node:assert/strict";
import {
  enrichTokenWithLexicon,
  lexiconDefinitions,
  lexiconSourceLabel,
} from "../app/lexicon-client.js";

const mergedResult = {
  status: "ok",
  source: "First",
  sourceLanguage: "Latin",
  sourceUrl: "https://dict.example/amo",
  term: "amō",
  lemma: "amō",
  detailsLoaded: true,
  sources: [
    { id: "first", name: "First", sourceUrl: "https://dict.example/amo" },
    { id: "second", name: "Second", sourceUrl: "https://other.example/amo" },
  ],
  entries: [{
    partOfSpeech: "verb",
    definitions: ["to love", "to be fond of"],
    morphologyCandidates: [],
  }],
};

test("client helpers present merged source and definition information consistently", () => {
  assert.equal(lexiconSourceLabel(mergedResult), "First · Second");
  assert.deepEqual(lexiconDefinitions(mergedResult, 1), ["to love"]);
});

test("lexicon enrichment fills pending fields without overwriting contextual analysis", () => {
  const pending = enrichTokenWithLexicon({
    id: "1",
    form: "amō",
    lemma: "amō",
    pos: "待识别",
    gloss: "等待词典或人工校订",
    confidence: 45,
    source: "本地规则",
  }, mergedResult);
  assert.equal(pending.pos, "动词");
  assert.equal(pending.gloss, "to love");
  assert.equal(pending.source, "本地规则 · First · Second");

  const contextual = enrichTokenWithLexicon({
    ...pending,
    gloss: "context-specific meaning",
    source: "UDPipe",
  }, mergedResult);
  assert.equal(contextual.gloss, "context-specific meaning");
});
