import assert from "node:assert/strict";
import test from "node:test";
import {
  dictionaryFormatFromFiles,
  mergeDictionaryEntries,
  normalizeDictionaryEntries,
  normalizeDictionaryEntriesWithDsl,
  parseDictionaryText,
  stripDictionaryMarkup,
} from "../app/dictionary-import.js";

test("normalizes scanned dictionary output with page provenance and Leipzig tags", () => {
  const entries = normalizeDictionaryEntries({
    entries: [{
      headword: "cano",
      lemma: "canō",
      pos: "V",
      definitions: ["歌唱", "吟诵"],
      morphology: ["1SG", "PRS", "ACT", "IND"],
      sourcePage: 42,
      confidence: 94,
    }],
  }, { title: "拉丁语扫描词典", jobId: "pdf-1" });

  assert.deepEqual(entries[0].lgrTags, ["1SG", "PRS", "ACT", "IND"]);
  assert.equal(entries[0].page, "42");
  assert.equal(entries[0].sourceTitle, "拉丁语扫描词典");
  assert.equal(entries[0].sourceJobId, "pdf-1");
});

test("merges new dictionary senses into an existing headword", () => {
  const merged = mergeDictionaryEntries(
    [{ form: "arma", lemma: "arma", definitions: ["武器"], gloss: "武器" }],
    [{ form: "Arma", lemma: "arma", definitions: ["战争"], gloss: "战争" }],
  );

  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].definitions, ["武器", "战争"]);
  assert.equal(merged[0].gloss, "战争");
});

test("parses and organizes CSV, DSL, TEI, LIFT, and XDXF dictionaries", () => {
  const csv = parseDictionaryText(
    "headword,lemma,pos,definition\ncano,canō,V,\"歌唱,吟诵\"",
    "csv",
  );
  assert.equal(csv[0].form, "cano");
  assert.equal(csv[0].pos, "V");

  const dsl = parseDictionaryText("arma\n\t[m1][trn]武器[/trn][/m]", "dsl");
  assert.equal(dsl[0].gloss, "武器");

  const tei = parseDictionaryText(
    "<TEI><entry><form><orth>amo</orth></form><gramGrp><pos>V</pos></gramGrp><sense><def>爱</def></sense></entry></TEI>",
    "tei",
  );
  assert.equal(tei[0].gloss, "爱");

  const lift = parseDictionaryText(
    "<lift><entry><lexical-unit><form><text>kamuy</text></form></lexical-unit><sense><gloss><text>神</text></gloss></sense></entry></lift>",
    "lift",
  );
  assert.equal(lift[0].form, "kamuy");
  assert.equal(lift[0].gloss, "神");

  const xdxf = parseDictionaryText(
    "<xdxf><ar><k>λόγος</k><def>言语</def></ar></xdxf>",
    "xdxf",
  );
  assert.equal(xdxf[0].gloss, "言语");
});

test("detects archive formats and removes executable dictionary markup", () => {
  assert.equal(dictionaryFormatFromFiles([{ name: "lexicon.mdx" }, { name: "lexicon.mdd" }]), "mdx");
  assert.equal(dictionaryFormatFromFiles([{ name: "lexicon.ifo" }, { name: "lexicon.idx" }]), "stardict");
  assert.equal(
    stripDictionaryMarkup("<script>alert(1)</script><div>to <b>sing</b><br>歌唱</div>"),
    "to sing；歌唱",
  );
});

test("applies the same transliteration DSL to dictionary forms and lemmas", () => {
  const result = normalizeDictionaryEntriesWithDsl([{
    form: "SAntiH",
    lemma: "SAnti",
    definitions: ["寂静"],
    gloss: "寂静",
  }], [{
    id: "slp1",
    name: "梵语 SLP1",
    source: `version 1
language sa
replace all /A/gu -> "ā"
replace all /S/gu -> "ś"
replace all /H/gu -> "ḥ"`,
  }], { languageCode: "sa" });

  assert.equal(result.entries[0].form, "śāntiḥ");
  assert.equal(result.entries[0].lemma, "śānti");
  assert.equal(result.entries[0].originalForm, "SAntiH");
  assert.deepEqual(result.entries[0].normalizationSources, ["梵语 SLP1"]);
  assert.equal(result.changedEntries, 1);
  assert.equal(result.changedFields, 2);
});
