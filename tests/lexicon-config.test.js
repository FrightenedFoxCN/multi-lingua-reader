import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeLexiconResults,
  normalizeExternalLexiconResult,
  normalizeLexiconSources,
  renderLexiconEndpoint,
  sourceSupportsLanguage,
  validateLexiconSource,
} from "../app/lexicon-config.js";

test("custom source templates encode query values and restrict protocols", () => {
  const url = renderLexiconEndpoint(
    "https://dict.example/lookup?q={lemma}&lang={code}",
    { term: "amō", lemma: "amō", code: "la" },
  );
  assert.equal(url.searchParams.get("q"), "amō");
  assert.equal(url.searchParams.get("lang"), "la");
  assert.throws(() => renderLexiconEndpoint("file:///tmp/{term}", { term: "amo" }));
});

test("custom source validation and language scope remain user friendly", () => {
  const source = {
    id: "latin",
    kind: "custom",
    name: "Latin service",
    endpoint: "https://dict.example/{term}",
    languages: "la, grc",
    authMode: "none",
  };
  assert.deepEqual(validateLexiconSource(source), {});
  assert.equal(sourceSupportsLanguage(source, "custom-latin", "la"), true);
  assert.equal(sourceSupportsLanguage(source, "custom-russian", "ru"), false);
  assert.equal(normalizeLexiconSources([])[0].id, "wiktionary");
});

test("common definition, IPA and audio fields normalize into the reader schema", () => {
  const result = normalizeExternalLexiconResult({
    word: "amo",
    pos: "verb",
    definitions: ["to love"],
    ipa: "/ˈa.moː/",
    audioUrl: "https://media.example/amo.mp3",
    entryUrl: "https://dict.example/amo",
  }, {
    source: {
      id: "latin",
      kind: "custom",
      name: "Latin service",
      endpoint: "https://dict.example/{term}",
    },
    term: "amo",
    lemma: "amo",
    language: "la",
  });
  assert.equal(result.status, "ok");
  assert.equal(result.entries[0].definitions[0], "to love");
  assert.equal(result.entries[0].partOfSpeech, "verb");
  assert.equal(result.ipa[0], "/ˈa.moː/");
  assert.equal(result.pronunciations[0].provider, "Latin service");
});

test("multiple sources merge definitions while deduplicating pronunciation paths", () => {
  const merged = mergeLexiconResults([
    {
      status: "ok",
      source: "First",
      sourceId: "first",
      term: "amo",
      lemma: "amo",
      entries: [{ partOfSpeech: "verb", definitions: ["love"] }],
      ipa: ["/a.mo/"],
      pronunciations: [{ url: "https://media.example/amo.mp3", provider: "First" }],
    },
    {
      status: "ok",
      source: "Second",
      sourceId: "second",
      entries: [{ partOfSpeech: "verb", definitions: ["be fond of"] }],
      ipa: ["/a.mo/"],
      pronunciations: [{ url: "https://media.example/amo.mp3", provider: "Second" }],
    },
  ]);
  assert.equal(merged.sources.length, 2);
  assert.equal(merged.entries.length, 2);
  assert.equal(merged.ipa.length, 1);
  assert.equal(merged.pronunciations.length, 1);
});
