import assert from "node:assert/strict";
import test from "node:test";
import {
  analysisEngineDescriptor,
  defaultAnalysisPipeline,
  enabledAnalysisEngines,
  moveAnalysisEngine,
  normalizeAnalysisPipeline,
} from "../app/analysis-engines.js";

test("builds a traceable default pipeline from initialized language resources", () => {
  const profile = {
    resources: [
      { id: "ud", selected: true },
      { id: "udpipe", selected: true },
    ],
  };
  const enabled = enabledAnalysisEngines(defaultAnalysisPipeline(profile), profile).map((item) => item.id);

  assert.deepEqual(enabled, ["local-corpus", "ud-corpus", "udpipe", "local-rules"]);
  assert.equal(analysisEngineDescriptor("llm").execution, "用户终点");
});

test("normalizes custom engine order and keeps the honest local fallback enabled", () => {
  const pipeline = normalizeAnalysisPipeline({
    engines: [
      { id: "llm", enabled: true, order: 0 },
      { id: "local-rules", enabled: false, order: 1 },
      { id: "llm", enabled: false, order: 2 },
    ],
  });

  assert.equal(pipeline.engines[0].id, "llm");
  assert.equal(pipeline.engines.find((item) => item.id === "local-rules").enabled, true);
  const moved = moveAnalysisEngine(pipeline, "llm", 1);
  assert.equal(moved.engines[1].id, "llm");
});
