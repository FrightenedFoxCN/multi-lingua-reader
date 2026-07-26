export const leipzigCoreDefinitions = {
  "1": "第一人称",
  "2": "第二人称",
  "3": "第三人称",
  A: "典型及物动词的施事论元",
  ABL: "夺格",
  ABS: "绝对格",
  ACC: "宾格",
  ADJ: "形容词",
  ADV: "副词或状语",
  AGR: "一致关系",
  ALL: "向格",
  ANTIP: "反被动",
  APPL: "应用式",
  ART: "冠词",
  AUX: "助动词",
  BEN: "受益格",
  CAUS: "使役",
  CLF: "量词或类别词",
  COM: "伴随格",
  COMP: "补语标记",
  COMPL: "完成性",
  COND: "条件式",
  COP: "系词",
  CVB: "副动词",
  DAT: "与格",
  DECL: "陈述标记",
  DEF: "定指",
  DEM: "指示词",
  DET: "限定词",
  DIST: "远指",
  DISTR: "分配式",
  DU: "双数",
  DUR: "持续体",
  ERG: "作格",
  EXCL: "排除式",
  F: "阴性",
  FUT: "将来时",
  GEN: "属格",
  IMP: "命令式",
  INAL: "不可让渡",
  INCH: "起始体",
  INCL: "包含式",
  IND: "直陈式",
  INDF: "不定指",
  INF: "不定式",
  INS: "工具格",
  INTR: "不及物",
  IPFV: "未完成体",
  IRR: "非现实式",
  LOC: "方位格",
  M: "阳性",
  N: "中性",
  NEG: "否定",
  NMLZ: "名词化",
  NOM: "主格",
  OBJ: "宾语",
  OBL: "斜格",
  P: "典型及物动词的受事论元",
  PASS: "被动",
  PFV: "完成体",
  PL: "复数",
  POSS: "领属",
  PRED: "述谓式",
  PRF: "完成时",
  PROG: "进行体",
  PROH: "禁止式",
  PROX: "近指",
  PRS: "现在时",
  PST: "过去时",
  PTCP: "分词",
  PURP: "目的式",
  Q: "疑问标记",
  QUOT: "引语标记",
  RECP: "相互式",
  REFL: "反身式",
  REL: "关系词",
  RES: "结果式",
  S: "典型不及物动词的唯一论元",
  SBJ: "主语",
  SBJV: "虚拟式",
  SG: "单数",
  TOP: "主题",
  TR: "及物",
  VOC: "呼格",
};

export const leipzigExtensionDefinitions = {
  ACT: "主动态",
  CMPR: "比较级",
  MID: "中动态",
  OPT: "愿望式",
  SPRL: "最高级",
};

const aliases = {
  ACTIVE: "ACT",
  AOR: ["PST", "PFV"],
  AORIST: ["PST", "PFV"],
  COMPARATIVE: "CMPR",
  FEM: "F",
  FEMININE: "F",
  IMPERATIVE: "IMP",
  IMPERFECT: ["PST", "IPFV"],
  IMPERFECTIVE: "IPFV",
  IMPF: "IPFV",
  INDICATIVE: "IND",
  MASC: "M",
  MASCULINE: "M",
  MIDDLE: "MID",
  NEUT: "N",
  NEUTER: "N",
  OPTATIVE: "OPT",
  PASSIVE: "PASS",
  PERF: "PRF",
  PERFECT: "PRF",
  PERFECTIVE: "PFV",
  PRES: "PRS",
  PRESENT: "PRS",
  SUBJUNCTIVE: "SBJV",
  SUPERLATIVE: "SPRL",
};

const registeredTags = new Set([
  ...Object.keys(leipzigCoreDefinitions),
  ...Object.keys(leipzigExtensionDefinitions),
]);

function tagItems(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return values.flatMap((item) => (
    String(item)
      .normalize("NFKC")
      .trim()
      .split(/[.\s,;|/]+/u)
      .filter(Boolean)
  ));
}

export function isRegisteredLgrTag(tag) {
  return registeredTags.has(tag) || /^[123](?:SG|PL|DU)$/u.test(tag);
}

export function normalizeLgrTags(value) {
  const expanded = tagItems(value).flatMap((item) => {
    const tag = item.toLocaleUpperCase().replace(/^[()]+|[()]+$/gu, "");
    if (/^[123]S$/u.test(tag)) return `${tag[0]}SG`;
    if (/^[123]P$/u.test(tag)) return `${tag[0]}PL`;
    const alias = aliases[tag];
    return Array.isArray(alias) ? alias : [alias || tag];
  });

  const combined = [];
  for (let index = 0; index < expanded.length; index += 1) {
    const tag = expanded[index];
    const next = expanded[index + 1];
    if (/^[123]$/u.test(tag) && /^(?:SG|PL|DU)$/u.test(next || "")) {
      combined.push(`${tag}${next}`);
      index += 1;
    } else {
      combined.push(tag);
    }
  }

  const tags = [...new Set(combined.filter(Boolean))];
  return {
    tags,
    extensions: tags.filter((tag) => Object.hasOwn(leipzigExtensionDefinitions, tag)),
    unregistered: tags.filter((tag) => !isRegisteredLgrTag(tag)),
  };
}

export function leipzigTagDescription(tag) {
  const normalized = String(tag || "").toLocaleUpperCase();
  const personNumber = /^([123])(SG|PL|DU)$/u.exec(normalized);
  if (personNumber) {
    const person = leipzigCoreDefinitions[personNumber[1]];
    const number = leipzigCoreDefinitions[personNumber[2]];
    return `${person}${number}`;
  }
  if (leipzigCoreDefinitions[normalized]) return leipzigCoreDefinitions[normalized];
  if (leipzigExtensionDefinitions[normalized]) {
    return `${leipzigExtensionDefinitions[normalized]}（语言特定扩展）`;
  }
  return "未注册的扩展标签";
}
