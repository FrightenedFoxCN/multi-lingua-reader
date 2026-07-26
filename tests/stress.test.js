import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import {
  ANALYSIS_DSL_SCHEMA,
  applyAnalysisDsl,
  parseAnalysisDsl,
} from "../app/analysis-dsl.js";
import {
  moveAnalysisEngine,
  normalizeAnalysisPipeline,
} from "../app/analysis-engines.js";
import { extractModelTokens } from "../app/api/analyze/model/route.js";
import { parseConlluCorpus } from "../app/corpus-store.js";

function elapsed(startedAt) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}

function maximumRulePack() {
  return [
    "version 1",
    "language *",
    ...Array.from({ length: ANALYSIS_DSL_SCHEMA.limits.rules }, (_, index) => [
      `rule stress_${String(index).padStart(3, "0")} priority ${index % 7}`,
      "when pos = \"NOUN\"",
      `set gloss "stress-${index}"`,
      "add tags SG",
      "end",
    ]).flat(),
  ].join("\n");
}

function corpusSentence(index) {
  return `# sent_id = stress-${index}
# text = Token${index} reads a book.
1\tToken${index}\ttoken${index}\tPROPN\t_\tNumber=Sing\t2\tnsubj\t_\t_
2\treads\tread\tVERB\t_\tTense=Pres\t0\troot\t_\t_
3\ta\ta\tDET\t_\tDefinite=Ind\t4\tdet\t_\t_
4\tbook\tbook\tNOUN\t_\tNumber=Sing\t2\tobj\t_\tSpaceAfter=No
5\t.\t.\tPUNCT\t_\t_\t2\tpunct\t_\t_`;
}

test("stress: parses the maximum DSL and applies it to 2,400 tokens", {
  timeout: 12_000,
}, (t) => {
  const source = maximumRulePack();
  const parseStarted = performance.now();
  const parsed = parseAnalysisDsl(source);
  const parseMs = elapsed(parseStarted);
  assert.equal(parsed.valid, true);
  assert.equal(parsed.program.rules.length, ANALYSIS_DSL_SCHEMA.limits.rules);

  const tokens = Array.from({ length: 2400 }, (_, index) => ({
    id: `stress-${index}`,
    form: `token-${index}`,
    lemma: `token-${index}`,
    pos: "NOUN",
    gloss: "",
    lgrTags: [],
    source: "压力测试",
  }));
  const applyStarted = performance.now();
  const result = applyAnalysisDsl(tokens, parsed.program, { languageCode: "en" });
  const applyMs = elapsed(applyStarted);

  assert.equal(result.tokens.length, 2400);
  assert.equal(result.changes, 2400);
  assert.equal(result.diagnostics.length, ANALYSIS_DSL_SCHEMA.limits.rules);
  assert.ok(result.tokens.every((token) => token.lgrTags.includes("SG")));
  assert.ok(parseMs < 2_000, `DSL parse took ${parseMs}ms`);
  assert.ok(applyMs < 8_000, `DSL apply took ${applyMs}ms`);
  t.diagnostic(`DSL: parse ${parseMs}ms; apply ${applyMs}ms; 240,000 rule-token checks`);
});

test("stress: parses 20,000 CoNLL-U sentences and 100,000 tokens", {
  timeout: 12_000,
}, (t) => {
  const source = Array.from({ length: 20_000 }, (_, index) => corpusSentence(index)).join("\n\n");
  const startedAt = performance.now();
  const sentences = parseConlluCorpus(source);
  const durationMs = elapsed(startedAt);

  assert.equal(sentences.length, 20_000);
  assert.equal(sentences[19_999].tokens.length, 5);
  assert.equal(sentences[19_999].sentId, "stress-19999");
  assert.ok(durationMs < 8_000, `Corpus parse took ${durationMs}ms`);
  t.diagnostic(`CoNLL-U: ${durationMs}ms; source ${(source.length / 1024 / 1024).toFixed(1)} MiB`);
});

test("stress: normalizes 50,000 pipeline mutations without losing the fallback", {
  timeout: 12_000,
}, (t) => {
  let pipeline = normalizeAnalysisPipeline([
    { id: "llm", enabled: true, order: 0 },
    { id: "local-corpus", enabled: true, order: 1 },
    { id: "local-rules", enabled: false, order: 2 },
  ]);
  const startedAt = performance.now();
  for (let index = 0; index < 50_000; index += 1) {
    const target = pipeline.engines[index % pipeline.engines.length];
    pipeline = moveAnalysisEngine(
      pipeline,
      target.id,
      index % 2 === 0 ? 1 : -1,
    );
  }
  const durationMs = elapsed(startedAt);

  assert.equal(pipeline.engines.length, 5);
  assert.equal(pipeline.engines.find((engine) => engine.id === "local-rules").enabled, true);
  assert.ok(durationMs < 8_000, `Pipeline mutations took ${durationMs}ms`);
  t.diagnostic(`Pipelines: 50,000 mutations in ${durationMs}ms`);
});

test("stress: validates the maximum 2,400-token model response", {
  timeout: 8_000,
}, (t) => {
  const payload = {
    tokens: Array.from({ length: 2400 }, (_, index) => ({
      form: `t${index}`,
      lemma: `l${index}`,
      upos: index === 1 ? "VERB" : "NOUN",
      features: { Number: "Sing" },
      head: index === 1 ? 0 : 2,
      dependency: index === 1 ? "root" : "dep",
    })),
  };
  const startedAt = performance.now();
  const tokens = extractModelTokens(payload);
  const durationMs = elapsed(startedAt);

  assert.equal(tokens.length, 2400);
  assert.equal(tokens[1].dependency, "root");
  assert.ok(durationMs < 2_000, `Model validation took ${durationMs}ms`);
  t.diagnostic(`Model JSON: 2,400 tokens in ${durationMs}ms`);
});

