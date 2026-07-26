export const ANALYSIS_PIPELINE_VERSION = 1;

export const analysisEngineCatalog = [
  {
    id: "local-corpus",
    name: "本地 UD 语料库",
    execution: "本设备",
    capabilities: ["分词", "词法", "依存句法"],
    description: "优先匹配用户导入的 CoNLL-U 句子，使用原始人工或项目标注。",
  },
  {
    id: "ud-corpus",
    name: "内置 / 在线 UD 树库",
    execution: "本地缓存 + 网络",
    capabilities: ["分词", "词法", "依存句法"],
    description: "匹配已接入的 Universal Dependencies 树库；只返回真实语料标注。",
  },
  {
    id: "udpipe",
    name: "LINDAT UDPipe",
    execution: "远程服务",
    capabilities: ["分词", "词法", "依存句法"],
    description: "使用所选语言的公开 UD 模型；低资源语言可能没有可用模型。",
  },
  {
    id: "llm",
    name: "已配置的大模型",
    execution: "用户终点",
    capabilities: ["分词", "词法", "依存句法"],
    description: "通过模型设置中的 OpenAI 兼容终点生成结构化 UD 分析。",
  },
  {
    id: "local-rules",
    name: "本地分词与人工校订",
    execution: "本设备",
    capabilities: ["分词", "DSL 修正"],
    description: "保底层；没有句法证据时只显示分词，不生成伪依存树。",
  },
];

const catalogIds = new Set(analysisEngineCatalog.map((engine) => engine.id));

function clean(value) {
  return String(value ?? "").trim();
}

function resourceSelected(profile, id) {
  return (profile?.resources || []).some((resource) => (
    resource.id === id && resource.selected !== false
  ));
}

export function defaultAnalysisPipeline(profile = null) {
  return {
    version: ANALYSIS_PIPELINE_VERSION,
    engines: analysisEngineCatalog.map((engine, order) => ({
      id: engine.id,
      enabled: engine.id === "local-corpus"
        || engine.id === "local-rules"
        || (engine.id === "ud-corpus" && resourceSelected(profile, "ud"))
        || (engine.id === "udpipe" && resourceSelected(profile, "udpipe")),
      order,
      corpusIds: [],
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeAnalysisPipeline(input, profile = null) {
  const fallback = defaultAnalysisPipeline(profile);
  const source = Array.isArray(input) ? input : input?.engines;
  if (!Array.isArray(source) || !source.length) return fallback;
  const seen = new Set();
  const normalized = source
    .filter((engine) => engine && catalogIds.has(clean(engine.id)) && !seen.has(clean(engine.id)))
    .map((engine, index) => {
      const id = clean(engine.id);
      seen.add(id);
      return {
        id,
        enabled: engine.enabled !== false,
        order: Number.isFinite(Number(engine.order)) ? Number(engine.order) : index,
        corpusIds: Array.isArray(engine.corpusIds)
          ? [...new Set(engine.corpusIds.map(clean).filter(Boolean))]
          : [],
      };
    })
    .sort((left, right) => left.order - right.order)
    .map((engine, order) => ({ ...engine, order }));

  fallback.engines.forEach((engine) => {
    if (!seen.has(engine.id)) normalized.push({ ...engine, order: normalized.length });
  });
  const localRules = normalized.find((engine) => engine.id === "local-rules");
  if (localRules) localRules.enabled = true;
  return {
    version: ANALYSIS_PIPELINE_VERSION,
    engines: normalized,
    updatedAt: clean(input?.updatedAt) || new Date().toISOString(),
  };
}

export function enabledAnalysisEngines(input, profile = null) {
  return normalizeAnalysisPipeline(input, profile).engines.filter((engine) => engine.enabled);
}

export function moveAnalysisEngine(input, engineId, offset, profile = null) {
  const pipeline = normalizeAnalysisPipeline(input, profile);
  const index = pipeline.engines.findIndex((engine) => engine.id === engineId);
  const target = index + Number(offset || 0);
  if (index < 0 || target < 0 || target >= pipeline.engines.length) return pipeline;
  const engines = [...pipeline.engines];
  [engines[index], engines[target]] = [engines[target], engines[index]];
  return {
    ...pipeline,
    engines: engines.map((engine, order) => ({ ...engine, order })),
    updatedAt: new Date().toISOString(),
  };
}

export function analysisEngineDescriptor(id) {
  return analysisEngineCatalog.find((engine) => engine.id === id) || null;
}

