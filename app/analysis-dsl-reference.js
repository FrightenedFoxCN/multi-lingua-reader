export const ANALYSIS_DSL_SCHEMA = Object.freeze({
  version: 1,
  limits: Object.freeze({
    sourceLength: 200_000,
    rules: 100,
    segments: 100,
    replacements: 200,
    conditionsPerRule: 50,
    actionsPerRule: 100,
    regexLength: 256,
  }),
  globalDirectives: Object.freeze([
    {
      syntax: "version 1",
      name: "版本",
      description: "声明规则包格式版本；当前只支持 1。",
    },
    {
      syntax: "language * | BCP47 | custom-*",
      name: "语言范围",
      description: "限定规则包适用的语言代码或语言配置 ID；* 表示全部语言。",
    },
    {
      syntax: "replace [all|text|form|lemma] /pattern/flags -> \"replacement\"",
      name: "录入规范化",
      description: "在导入语料、词典与分析文本时替换转写字符；省略字段时等同 all，并保留原始值与规则快照。",
    },
    {
      syntax: "segment /pattern/flags -> \"replacement\"",
      name: "分词预处理",
      description: "在语法引擎运行前替换字符或边界；按书写顺序执行。",
    },
  ]),
  ruleDirectives: Object.freeze([
    {
      syntax: "rule id [priority n]",
      name: "开始规则",
      description: "ID 必须唯一；priority 越大越先执行，同优先级保持原顺序。",
    },
    {
      syntax: "when field operator value",
      name: "匹配条件",
      description: "同一规则中的全部 when 都满足时才执行动作。",
    },
    {
      syntax: "set field value",
      name: "写入字段",
      description: "修改词元、读音、词性、释义、角色或依存说明。",
    },
    {
      syntax: "add tags TAG… / remove tags TAG…",
      name: "Leipzig 标签",
      description: "添加或移除规范化的 Leipzig 词素标签；未知扩展仍会记录为问题。",
    },
    {
      syntax: "head root | previous | next | form \"…\" | lemma \"…\"",
      name: "中心词",
      description: "设置依存中心；root 同时把 dependency 设为 root。",
    },
    {
      syntax: "confidence 0–100",
      name: "置信度",
      description: "记录规则校订后的置信度，不改变其他字段。",
    },
    {
      syntax: "stop",
      name: "停止后续规则",
      description: "当前词项命中并执行本规则后，不再尝试较低优先级规则。",
    },
    {
      syntax: "end",
      name: "结束规则",
      description: "结束当前 rule；每条规则至少需要一个条件和一个动作。",
    },
  ]),
  conditionFields: Object.freeze([
    "form",
    "lemma",
    "pos",
    "dependency",
    "role",
    "gloss",
    "tag",
    "index",
  ]),
  conditionOperators: Object.freeze([
    "=",
    "is",
    "starts",
    "ends",
    "contains",
    "matches",
    "has",
  ]),
  setFields: Object.freeze([
    "lemma",
    "reading",
    "pos",
    "gloss",
    "role",
    "relation",
    "dependency",
  ]),
  headModes: Object.freeze([
    "root",
    "previous",
    "next",
    "form",
    "lemma",
  ]),
});

export const analysisDslTemplate = `version 1
language *

# 录入规范化示例（按具体转写体系启用，勿混用不同体系）
# replace all /A/gu -> "ā"

# 在送入引擎前整理字符边界
segment /\\s+/gu -> " "

rule purpose_suffix priority 20
when form ends "рц"
set pos "动词"
add tags PURP
set role "目的式谓语"
end
`;

export const analysisDslExamples = [
  {
    id: "morphology",
    title: "补充屈折词法",
    description: "按词元与现有词性补充释义、标签和置信度。",
    source: `version 1
language ru

rule present_reading priority 30
when lemma = "читать"
when pos contains "动词"
set gloss "阅读"
add tags PRS IPFV
confidence 92
stop
end`,
  },
  {
    id: "polysynthesis",
    title: "复综语后缀与依存根",
    description: "对目的式后缀进行词法补充，并把谓语指定为依存根。",
    source: `version 1
language ab

rule purpose_suffix priority 40
when form ends "рц"
set pos "动词"
add tags PURP TR
set role "目的式谓语"
head root
confidence 91
end`,
  },
  {
    id: "segmentation",
    title: "边界标准化",
    description: "在所有分析引擎之前统一竖线与多余空白。",
    source: `version 1
language *

segment /\\s*\\|\\s*/gu -> " "
segment /\\s+/gu -> " "`,
  },
  {
    id: "sanskrit-slp1",
    title: "梵语 SLP1 转写规范化",
    description: "把 SLP1 的 ASCII 码位整理为带变音符形式；规则包限定为梵语，并对句子、词形和词元共同生效。",
    source: `version 1
language sa

replace all /A/gu -> "ā"
replace all /I/gu -> "ī"
replace all /U/gu -> "ū"
replace all /f/gu -> "ṛ"
replace all /F/gu -> "ṝ"
replace all /S/gu -> "ś"
replace all /z/gu -> "ṣ"
replace all /R/gu -> "ṇ"
replace all /M/gu -> "ṃ"
replace all /H/gu -> "ḥ"`,
  },
];
