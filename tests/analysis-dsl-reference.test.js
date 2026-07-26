import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYSIS_DSL_SCHEMA,
  analysisDslExamples,
} from "../app/analysis-dsl-reference.js";
import { parseAnalysisDsl } from "../app/analysis-dsl.js";

test("keeps every documented DSL example executable by the current parser", () => {
  analysisDslExamples.forEach((example) => {
    const parsed = parseAnalysisDsl(example.source);
    assert.equal(parsed.valid, true, `${example.id}: ${JSON.stringify(parsed.errors)}`);
  });
});

test("publishes implementation limits and all supported rule fields", () => {
  assert.equal(ANALYSIS_DSL_SCHEMA.version, 1);
  assert.equal(ANALYSIS_DSL_SCHEMA.limits.rules, 100);
  assert.ok(ANALYSIS_DSL_SCHEMA.conditionFields.includes("tag"));
  assert.ok(ANALYSIS_DSL_SCHEMA.conditionOperators.includes("matches"));
  assert.ok(ANALYSIS_DSL_SCHEMA.setFields.includes("dependency"));
});

