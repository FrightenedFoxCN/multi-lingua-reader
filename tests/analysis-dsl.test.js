import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAnalysisDsl,
  applyReplacementDsl,
  applySegmentationDsl,
  parseAnalysisDsl,
} from "../app/analysis-dsl.js";

const source = `version 1
language ab
segment /\\s+/gu -> " "

rule purpose_suffix priority 20
when form ends "рц"
set pos "动词"
add tags PURP TR
set role "目的式谓语"
head root
confidence 91
end
`;

test("parses a bounded analysis DSL with preprocessing, conditions, and actions", () => {
  const parsed = parseAnalysisDsl(source);

  assert.equal(parsed.valid, true);
  assert.equal(parsed.program.language, "ab");
  assert.equal(parsed.program.segments.length, 1);
  assert.equal(parsed.program.rules[0].priority, 20);
  assert.equal(parsed.program.rules[0].actions.length, 5);
});

test("applies DSL token corrections and records their provenance", () => {
  const result = applyAnalysisDsl([{
    id: "t1",
    form: "иқәиҵарц",
    lemma: "иқәиҵарц",
    pos: "待识别",
    role: "未定",
    dependency: "dep",
    headId: "t0",
    lgrTags: [],
    source: "本地分词",
  }], source, { languageCode: "ab" });

  assert.equal(result.changes, 1);
  assert.equal(result.tokens[0].pos, "动词");
  assert.equal(result.tokens[0].headId, null);
  assert.equal(result.tokens[0].dependency, "root");
  assert.deepEqual(result.tokens[0].lgrTags, ["PURP", "TR"]);
  assert.match(result.tokens[0].source, /DSL · purpose_suffix/u);
});

test("keeps invalid DSL non-destructive and reports exact line diagnostics", () => {
  const parsed = parseAnalysisDsl("version 1\nrule broken\nset unknown \"x\"\nend");
  const tokens = [{ id: "t1", form: "x" }];
  const result = applyAnalysisDsl(tokens, parsed.program && {
    ...parsed.program,
    rules: [],
  });

  assert.equal(parsed.valid, false);
  assert.ok(parsed.errors.some((error) => error.code === "set" && error.line === 3));
  assert.deepEqual(result.tokens, tokens);
});

test("applies language-scoped segmentation replacements only to matching languages", () => {
  const matching = applySegmentationDsl("a   b", source, { languageCode: "ab" });
  const skipped = applySegmentationDsl("a   b", source, { languageCode: "ja" });

  assert.equal(matching.text, "a b");
  assert.equal(matching.applied, 1);
  assert.equal(skipped.text, "a   b");
});

test("normalizes transliteration with field-scoped replace directives", () => {
  const transliteration = `version 1
language sa
replace all /A/gu -> "ā"
replace text /S/gu -> "ś"
replace lemma /z/gu -> "ṣ"`;
  const parsed = parseAnalysisDsl(transliteration);

  assert.equal(parsed.valid, true);
  assert.equal(parsed.program.replacements.length, 3);
  assert.equal(
    applyReplacementDsl("SAntiH", parsed.program, { languageCode: "sa" }, "text").value,
    "śāntiH",
  );
  assert.equal(
    applyReplacementDsl("zAs", parsed.program, { languageCode: "sa" }, "lemma").value,
    "ṣās",
  );
  assert.equal(
    applyReplacementDsl("SAntiH", parsed.program, { languageCode: "cs" }, "text").value,
    "SAntiH",
  );
});

test("rejects unsafe regular expressions and enforces bounded rule packs", () => {
  const unsafe = parseAnalysisDsl(`version 1
language *
segment /(a+)+$/gu -> "a"`);
  const tooManyRules = parseAnalysisDsl([
    "version 1",
    "language *",
    ...Array.from({ length: 101 }, (_, index) => [
      `rule rule_${index}`,
      `when index = "${index + 1}"`,
      `set gloss "g${index}"`,
      "end",
    ]).flat(),
  ].join("\n"));

  assert.equal(unsafe.valid, false);
  assert.ok(unsafe.errors.some((error) => error.code === "segment"));
  assert.equal(tooManyRules.valid, false);
  assert.ok(tooManyRules.errors.some((error) => error.code === "limit"));
});
