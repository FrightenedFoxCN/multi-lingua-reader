import assert from "node:assert/strict";
import test from "node:test";
import {
  languageDataSources,
  resolveLanguageInitialization,
  selectedResourceManifest,
} from "../app/language-resources.js";

test("resolves an ISO code into identity, orthography, segmentation, and resources", () => {
  const result = resolveLanguageInitialization({ code: "grc" });

  assert.equal(result.matched, true);
  assert.equal(result.name, "古希腊语");
  assert.equal(result.identity.glottocode, "anci1242");
  assert.equal(result.orthography.direction, "ltr");
  assert.equal(result.segmentation.source, "ud");
  assert.ok(result.resources.some((resource) => resource.id === "kaikki" && resource.selected));
});

test("creates an honest candidate list for languages outside the local snapshot", () => {
  const result = resolveLanguageInitialization({ code: "x-demo", name: "示例语" });

  assert.equal(result.matched, false);
  assert.equal(result.name, "示例语");
  assert.ok(result.resources.every((resource) => ["available", "candidate"].includes(resource.status)));
  assert.ok(result.resources.some((resource) => resource.id === "glottolog"));
});

test("exports only user-selected resources with provenance fields", () => {
  const result = resolveLanguageInitialization({ code: "ain" });
  const manifest = selectedResourceManifest(result.resources);

  assert.ok(manifest.length > 0);
  assert.ok(manifest.every((resource) => resource.id && resource.url && resource.license));
  assert.ok(languageDataSources.length >= 16);
});

test("initializes Russian with grammar, inflection, and contextual analysis sources", () => {
  const result = resolveLanguageInitialization({ code: "ru" });
  const selectedIds = result.resources
    .filter((resource) => resource.selected)
    .map((resource) => resource.id);

  assert.equal(result.matched, true);
  assert.equal(result.name, "俄语");
  assert.equal(result.identity.iso6393, "rus");
  assert.equal(result.identity.glottocode, "russ1263");
  assert.equal(result.orthography.script, "Cyrillic · Cyrl");
  assert.equal(result.segmentation.source, "ud");
  assert.ok(selectedIds.includes("udpipe"));
  assert.ok(selectedIds.includes("unimorph"));
  assert.ok(selectedIds.includes("grambank"));
  assert.ok(selectedIds.includes("kaikki"));
});

test("initializes Japanese and Abkhaz with stable descriptive-language identities", () => {
  const japanese = resolveLanguageInitialization({ code: "ja" });
  const abkhaz = resolveLanguageInitialization({ code: "ab" });

  assert.equal(japanese.name, "日语");
  assert.equal(japanese.identity.glottocode, "nucl1643");
  assert.ok(japanese.resources.some((resource) => resource.id === "udpipe" && resource.selected));
  assert.match(japanese.sample, /飲んでいます/u);

  assert.equal(abkhaz.name, "阿布哈兹语");
  assert.equal(abkhaz.identity.iso6393, "abk");
  assert.equal(abkhaz.identity.glottocode, "abkh1244");
  assert.ok(abkhaz.resources.some((resource) => resource.id === "grambank" && resource.selected));
  assert.ok(abkhaz.resources.some((resource) => resource.id === "ud" && resource.selected));
});
