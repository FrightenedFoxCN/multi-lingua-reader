"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { library, searchableWorks } from "./data";
import { validateCtsAnnotationBundle } from "./cts-validation";
import { leipzigTagDescription, normalizeLgrTags } from "./lgr";
import {
  createLanguageProfile,
  findLanguageLexiconEntry,
  parseLanguageLexicon,
  segmentationStrategies,
  tokenizeLanguageText,
  validateLanguageProfile,
} from "./language-profile";
import {
  dictionaryFormatFromFiles,
  importDictionaryFiles,
  mergeDictionaryEntries,
  normalizeDictionaryEntries,
  normalizeDictionaryEntriesWithDsl,
} from "./dictionary-import";
import {
  getDictionaryLexicon,
  putDictionaryLexicon,
} from "./dictionary-store";
import {
  getLocalLibraryPassage,
  listLocalLibraryWorks,
  putLocalLibraryWork,
} from "./library-store";
import {
  exportLocalDatabase,
  importLocalDatabase,
  inspectLocalDatabase,
  requestLocalPersistence,
} from "./local-database";
import { selectedResourceManifest } from "./language-resources";
import {
  deletePdfMaterial,
  hasPdfMaterial,
  putPdfMaterial,
  validatePdfMaterial,
} from "./material-store";
import {
  normalizeModelConfig,
  persistentModelConfig,
  testModelConnection,
  validateModelConfig,
} from "./model-config";
import {
  analysisEngineDescriptor,
  enabledAnalysisEngines,
  moveAnalysisEngine,
  normalizeAnalysisPipeline,
} from "./analysis-engines";
import {
  analysisDslTemplate,
  applyAnalysisDsl,
  applySegmentationDsl,
  parseAnalysisDsl,
} from "./analysis-dsl";
import {
  deleteCorpus,
  importConlluCorpus,
  listCorpora,
  lookupCorpusSentence,
} from "./corpus-store";
import {
  languageWorkspaceTabs,
  primaryNavigation,
} from "./site-config";

const paths = {
  library: <><path d="M4 4.5h6.5v15H4zM13.5 4.5H20v15h-6.5z"/><path d="M7.25 8h0M16.75 8h0"/></>,
  search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>,
  panel: <><rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M9 4v16"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.82 2.82-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.82-2.82.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.04 14H3v-4h.04A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88L4.2 7.06l2.82-2.82.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.82 2.82-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 20.96 10H21v4h-.04A1.7 1.7 0 0 0 19.4 15Z"/></>,
  moon: <path d="M20 15.3A8.5 8.5 0 0 1 8.7 4a8.5 8.5 0 1 0 11.3 11.3Z"/>,
  sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"/></>,
  chevronDown: <path d="m7 10 5 5 5-5"/>,
  chevronRight: <path d="m10 7 5 5-5 5"/>,
  arrowLeft: <path d="m15 18-6-6 6-6"/>,
  arrowRight: <path d="m9 18 6-6-6-6"/>,
  spark: <><path d="m12 3 1.2 4.1a5 5 0 0 0 3.7 3.7L21 12l-4.1 1.2a5 5 0 0 0-3.7 3.7L12 21l-1.2-4.1a5 5 0 0 0-3.7-3.7L3 12l4.1-1.2a5 5 0 0 0 3.7-3.7L12 3Z"/></>,
  translate: <><path d="M5 5h8M9 3v2M7 5c0 4 3 7 6 8M11 5c0 3-3 7-7 9"/><path d="m14 20 3-8 3 8M15 17h4"/></>,
  rows: <><path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 3v6M14 9v6M10 15v6"/></>,
  type: <><path d="M5 6V4h14v2M12 4v16M8 20h8"/></>,
  close: <path d="m6 6 12 12M18 6 6 18"/>,
  copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  download: <><path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 20h14"/></>,
  upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></>,
  bookmark: <path d="M6 3.5h12v17L12 17l-6 3.5z"/>,
  note: <><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
  info: <><circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/></>,
};

function Icon({ name, size = 18, strokeWidth = 1.7 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

function Toggle({ active, onClick, icon, label }) {
  return (
    <button className={`tool-toggle ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active}>
      <Icon name={icon} size={16} />
      <span>{label}</span>
    </button>
  );
}

const STORAGE_KEY = "lingua-reader-state-v2";
const LANGUAGE_WORKSPACE_KEY = "lingua-language-workspace-v1";
const MODEL_CONFIG_STORAGE_KEY = "lingua-model-config-v1";
const MODEL_SECRET_SESSION_KEY = "lingua-model-secret-v1";
const CTS_PROFILE = "lingua-cts-annotations/1.0";
const CTS_SPEC = "https://cite-architecture.github.io/ctsurn_spec/";
const CEX_VERSION = "3.0";
const CEX_ANNOTATION_COLLECTION = "urn:cite2:lingua:annotations.v1:";

const labSamples = {
  greek: {
    label: "《伊利亚特》1.1",
    text: "Μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος",
    ctsUrn: "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1",
  },
  latin: {
    label: "《埃涅阿斯纪》1.1",
    text: "Arma virumque cano Troiae qui primus ab oris",
    ctsUrn: "urn:cts:latinLit:phi0690.phi003.perseus-lat2:1.1",
  },
  chinese: {
    label: "《论语·学而》",
    text: "學而時習之，不亦說乎？",
    ctsUrn: "urn:cts:lingua:confucius.analects.demo:1.1",
  },
};

const readerCtsWorks = {
  greek: "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2",
  latin: "urn:cts:latinLit:phi0690.phi003.perseus-lat2",
  chinese: "urn:cts:lingua:confucius.analects.demo",
};

function lineCitation(languageId, lineNumber) {
  if (languageId === "chinese") return lineNumber;
  const match = /^(\d+)(?:[–-](\d+))?$/u.exec(lineNumber);
  if (!match) return lineNumber;
  return match[2] ? `1.${match[1]}-1.${match[2]}` : `1.${match[1]}`;
}

function readerPassageUrn(languageId, lineNumber) {
  const workUrn = readerCtsWorks[languageId];
  return workUrn ? `${workUrn}:${lineCitation(languageId, lineNumber)}` : "";
}

function readerPassageRangeUrn(languageId, lineNumbers) {
  const workUrn = readerCtsWorks[languageId];
  if (!workUrn || !lineNumbers.length) return "";
  const citations = lineNumbers.map((lineNumber) => lineCitation(languageId, lineNumber));
  const start = citations[0].split("-")[0];
  const end = citations.at(-1).split("-").at(-1);
  return `${workUrn}:${start === end ? start : `${start}-${end}`}`;
}

function citationIncludes(linePassage, requestedPassage) {
  if (linePassage === requestedPassage) return true;
  const [start, end] = linePassage.split("-");
  if (!end || requestedPassage.includes("-")) return false;
  const startParts = start.split(".");
  const endParts = end.split(".");
  const requestedParts = requestedPassage.split(".");
  if (startParts.length !== requestedParts.length || endParts.length !== requestedParts.length) return false;
  if (startParts.slice(0, -1).join(".") !== requestedParts.slice(0, -1).join(".")) return false;
  const requestedLeaf = Number(requestedParts.at(-1));
  return requestedLeaf >= Number(startParts.at(-1)) && requestedLeaf <= Number(endParts.at(-1));
}

function parseCtsNavigationUrn(value) {
  const source = value.trim();
  const parsed = parseCtsPassageUrn(source);
  if (!parsed) return null;
  const rawSubreference = source.includes("@") ? source.slice(source.indexOf("@") + 1) : "";
  const subreferenceMatch = /^(.+?)(?:\[(\d+)\])?$/u.exec(rawSubreference);
  let form = subreferenceMatch?.[1] || "";
  try {
    form = decodeURIComponent(form);
  } catch {
    // Keep the source form when it is not URI encoded.
  }
  return {
    ...parsed,
    subreference: form ? {
      form,
      occurrence: Math.max(1, Number(subreferenceMatch?.[2] || 1)),
    } : null,
  };
}

function resolveReaderCtsLocation(parsed) {
  if (!parsed) return null;
  const languageId = Object.keys(readerCtsWorks).find((id) => readerCtsWorks[id] === parsed.workUrn);
  if (!languageId) return null;
  const work = library[languageId];
  const lineIndex = work.lines.findIndex((line) => (
    citationIncludes(lineCitation(languageId, line.n), parsed.passage)
  ));
  if (lineIndex < 0) return { languageId, lineIndex: -1, work };
  return { languageId, lineIndex, line: work.lines[lineIndex], work };
}

function resolveReaderCtsTarget(value) {
  const parsed = parseCtsNavigationUrn(value);
  if (!parsed) return { status: "invalid", parsed: null, location: null, targetToken: null };
  const location = resolveReaderCtsLocation(parsed);
  if (!location) return { status: "unsupported-work", parsed, location: null, targetToken: null };
  if (location.lineIndex < 0) {
    return { status: "missing-passage", parsed, location, targetToken: null };
  }

  let targetToken = location.line.tokens[0] || null;
  if (parsed.subreference) {
    const requestedForm = ctsSubreferenceForm(parsed.subreference.form);
    const matches = location.line.tokens.filter((token) => (
      ctsSubreferenceForm(token.form) === requestedForm
    ));
    targetToken = matches[parsed.subreference.occurrence - 1] || null;
    if (!targetToken) {
      return { status: "missing-token", parsed, location, targetToken: null };
    }
  }

  return { status: "ok", parsed, location, targetToken };
}

function parseCtsPassageUrn(value) {
  const urn = value.trim();
  const match = /^urn:cts:([^:\s]+):([^:\s]+):([^:\s]+)$/u.exec(urn);
  if (!match) return null;
  const workParts = match[2].split(".");
  if (workParts.length < 3 || workParts.length > 4 || !match[3]) return null;
  const passage = match[3].split("@")[0];
  if (!passage || passage.includes("..")) return null;
  return {
    urn: `urn:cts:${match[1]}:${match[2]}:${passage}`,
    namespace: match[1],
    work: match[2],
    workUrn: `urn:cts:${match[1]}:${match[2]}`,
    passage,
  };
}

function ctsSubreferenceForm(value) {
  return value
    .normalize("NFC")
    .replace(/[:@%/?#&<>^`|{}~\\]/gu, "")
    .trim();
}

function ctsTokenTarget(passageUrn, tokens, index) {
  const form = ctsSubreferenceForm(tokens[index].form);
  if (!form) return passageUrn;
  const occurrence = tokens
    .slice(0, index + 1)
    .filter((token) => ctsSubreferenceForm(token.form) === form)
    .length;
  return `${passageUrn.split("@")[0]}@${form}[${occurrence}]`;
}

const cexLanguageMetadata = {
  greek: {
    iso: "grc",
    groupName: "Homer",
    workTitle: "Iliad",
    versionLabel: "Perseus Greek edition",
    citationScheme: ["book", "line"],
  },
  latin: {
    iso: "lat",
    groupName: "Vergil",
    workTitle: "Aeneid",
    versionLabel: "Perseus Latin edition",
    citationScheme: ["book", "line"],
  },
  chinese: {
    iso: "zho",
    groupName: "Confucius",
    workTitle: "Analects",
    versionLabel: "Lingua demonstration text",
    citationScheme: ["book", "section"],
  },
};

function chooseCexDelimiter(values) {
  const source = values.join("");
  return ["#", "|", "§", "\t", "␟"].find((candidate) => !source.includes(candidate)) || "␞";
}

function cexLine(value) {
  return String(value ?? "").replace(/\r?\n/gu, " ").trim();
}

function buildCexAnnotationBundle(bundle) {
  const metadata = cexLanguageMetadata[bundle.language] || {};
  const workParts = bundle.cts.workUrn.split(":").at(-1).split(".");
  const passageDepth = bundle.cts.passage.split("-")[0].split(".").length;
  const citationScheme = Array.from(
    { length: passageDepth },
    (_, index) => metadata.citationScheme?.[index] || `level${index + 1}`,
  ).join(",");
  const groupName = metadata.groupName || workParts[0];
  const workTitle = metadata.workTitle || workParts[1];
  const versionLabel = metadata.versionLabel || workParts[2];
  const exemplarLabel = workParts[3] || "";
  const language = metadata.iso || bundle.language;
  const annotationRows = bundle.annotations.map((annotation, index) => [
    `urn:cite2:lingua:annotations.v1:a${index + 1}`,
    index + 1,
    annotation.target,
    annotation.id,
    annotation.form,
    annotation.lemma,
    annotation.reading,
    annotation.pos,
    JSON.stringify(annotation.morphology || []),
    annotation.gloss,
    annotation.lgr?.surface,
    annotation.lgr?.gloss,
    JSON.stringify(annotation.lgr?.tags || []),
    annotation.syntax?.role,
    annotation.syntax?.relation,
    annotation.syntax?.head || "",
    annotation.syntax?.dependency || "",
    annotation.confidence ?? "",
    annotation.source || "",
    JSON.stringify(annotation.normalization || null),
    JSON.stringify(annotation.lexicon || null),
    bundle.language,
  ]);
  const values = [
    bundle.cts.passageUrn,
    cexLine(bundle.text),
    bundle.cts.workUrn,
    citationScheme,
    groupName,
    workTitle,
    versionLabel,
    exemplarLabel,
    language,
    ...annotationRows.flat(),
  ].map(cexLine);
  const delimiter = chooseCexDelimiter(values);
  const join = (row) => row.map(cexLine).join(delimiter);
  const property = (id) => `${CEX_ANNOTATION_COLLECTION.slice(0, -1)}.${id}:`;
  const properties = [
    ["urn", "Annotation URN", "Cite2Urn"],
    ["sequence", "Token order", "Number"],
    ["target", "CTS token target", "CtsUrn"],
    ["id", "Local annotation identifier", "String"],
    ["form", "Surface form", "String"],
    ["lemma", "Lemma", "String"],
    ["reading", "Reading", "String"],
    ["pos", "Part of speech", "String"],
    ["morphology", "Morphology JSON", "String"],
    ["gloss", "Lexical gloss", "String"],
    ["lgrSurface", "LGR surface form", "String"],
    ["lgrGloss", "LGR gloss", "String"],
    ["lgrTags", "LGR tags JSON", "String"],
    ["syntaxRole", "Syntax role", "String"],
    ["syntaxRelation", "Syntax relation", "String"],
    ["syntaxHead", "Syntactic head CTS target", "String"],
    ["syntaxDependency", "Dependency relation", "String"],
    ["confidence", "Analysis confidence", "String"],
    ["source", "Annotation source", "String"],
    ["normalization", "Original transcription JSON", "String"],
    ["lexicon", "Wiktionary provenance JSON", "String"],
    ["language", "Lingua language identifier", "String"],
  ];

  return [
    "#!cexversion",
    CEX_VERSION,
    "",
    "#!citelibrary",
    join(["name", "Lingua CTS annotation export"]),
    join(["urn", "urn:cite2:lingua:exports.v1:annotationbundle"]),
    join(["license", "Source text and annotations retain their original rights status"]),
    "",
    "#!ctscatalog",
    join(["urn", "citationScheme", "groupName", "workTitle", "versionLabel", "exemplarLabel", "online", "lang"]),
    join([`${bundle.cts.workUrn}:`, citationScheme, groupName, workTitle, versionLabel, exemplarLabel, "true", language]),
    "",
    "#!ctsdata",
    join([bundle.cts.passageUrn, bundle.text]),
    "",
    "#!citecollections",
    join(["URN", "Description", "Labelling property", "Ordering property", "License"]),
    join([
      CEX_ANNOTATION_COLLECTION,
      "Lingua token-level linguistic annotations",
      property("form"),
      property("sequence"),
      "Source text and annotations retain their original rights status",
    ]),
    "",
    "#!citeproperties",
    join(["Property", "Label", "Type", "Authority list"]),
    ...properties.map(([id, label, type]) => join([property(id), label, type, ""])),
    "",
    "#!citedata",
    join(properties.map(([id]) => id)),
    ...annotationRows.map(join),
    "",
  ].join("\n");
}

function parseCexBlocks(source) {
  const blocks = [];
  let current = null;
  for (const rawLine of source.replace(/\r\n?/gu, "\n").split("\n")) {
    const label = /^#!([a-z]+)$/u.exec(rawLine.trim());
    if (label) {
      current = { label: label[1], lines: [] };
      blocks.push(current);
    } else if (current) {
      const line = rawLine.trim();
      if (line && !line.startsWith("//")) current.lines.push(rawLine);
    }
  }
  return blocks;
}

function parseCexAnnotationBundle(source) {
  const blocks = parseCexBlocks(source);
  const catalog = blocks.find((block) => block.label === "ctscatalog");
  const catalogHeader = catalog?.lines[0] || "";
  const delimiter = /^urn(.+?)citationScheme/u.exec(catalogHeader)?.[1];
  if (!delimiter) throw new Error("missing-cex-delimiter");

  const ctsData = blocks.find((block) => block.label === "ctsdata");
  const ctsRow = ctsData?.lines.find((line) => line.startsWith("urn:cts:"));
  const ctsSeparator = ctsRow?.indexOf(delimiter) ?? -1;
  if (!ctsRow || ctsSeparator < 0) throw new Error("missing-ctsdata");
  const passageUrn = ctsRow.slice(0, ctsSeparator);
  const text = ctsRow.slice(ctsSeparator + delimiter.length);

  const citedata = blocks
    .filter((block) => block.label === "citedata")
    .find((block) => {
      const headers = block.lines[0]?.split(delimiter) || [];
      return headers.includes("target") && headers.includes("lgrTags");
    });
  if (!citedata) throw new Error("missing-annotation-collection");
  const headers = citedata.lines[0].split(delimiter);
  const rows = citedata.lines.slice(1).map((line) => {
    const values = line.split(delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
  const parseArray = (value) => {
    try {
      const parsed = JSON.parse(value || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const parseObject = (value) => {
    try {
      const parsed = JSON.parse(value || "null");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  };

  return {
    format: "Lingua CEX Annotation Bundle",
    profile: CTS_PROFILE,
    cts: { passageUrn },
    language: rows[0]?.language || detectLanguage(text),
    text,
    annotations: rows
      .sort((left, right) => Number(left.sequence) - Number(right.sequence))
      .map((row) => ({
        id: row.id,
        target: row.target,
        form: row.form,
        lemma: row.lemma,
        reading: row.reading,
        pos: row.pos,
        morphology: parseArray(row.morphology),
        gloss: row.gloss,
        lgr: {
          surface: row.lgrSurface,
          gloss: row.lgrGloss,
          tags: parseArray(row.lgrTags),
        },
        syntax: {
          role: row.syntaxRole,
          relation: row.syntaxRelation,
          head: row.syntaxHead || null,
          dependency: row.syntaxDependency || "",
        },
        confidence: row.confidence === "" ? null : Number(row.confidence),
        source: row.source || "CEX 导入",
        normalization: parseObject(row.normalization),
        lexicon: parseObject(row.lexicon),
      })),
  };
}

function leipzigTags(token) {
  if (Array.isArray(token.lgrTags)) return normalizeLgrTags(token.lgrTags).tags;
  const tags = [];
  const add = (...items) => items.forEach((item) => {
    if (item && !tags.includes(item)) tags.push(item);
  });

  for (const feature of token.morphology || []) {
    if (feature.includes("第一人称单数")) add("1SG");
    else if (feature.includes("第二人称单数")) add("2SG");
    else if (feature.includes("第三人称单数")) add("3SG");
    else if (feature.includes("第一人称复数")) add("1PL");
    else if (feature.includes("第二人称复数")) add("2PL");
    else if (feature.includes("第三人称复数")) add("3PL");
    else {
      if (feature.includes("单数")) add("SG");
      if (feature.includes("复数")) add("PL");
      if (feature.includes("双数")) add("DU");
    }

    if (feature.includes("阴性")) add("F");
    if (feature.includes("阳性")) add("M");
    if (feature.includes("中性")) add("N");
    if (feature.includes("主格")) add("NOM");
    if (feature.includes("宾格")) add("ACC");
    if (feature.includes("属格")) add("GEN");
    if (feature.includes("与格")) add("DAT");
    if (feature.includes("夺格")) add("ABL");
    if (feature.includes("呼格")) add("VOC");
    if (feature.includes("未完成过去时")) add("PST", "IPFV");
    else if (feature.includes("不定过去时")) add("PST", "PFV");
    else if (feature.includes("现在时")) add("PRS");
    else if (feature.includes("完成时")) add("PRF");
    if (feature.includes("命令式")) add("IMP");
    if (feature.includes("直陈式")) add("IND");
    if (feature.includes("虚拟式")) add("SBJV");
    if (feature.includes("被动")) add("PASS");
    if (feature.includes("主动")) add("ACT");
    if (feature.includes("中间") || feature.includes("中动")) add("MID");
    if (feature.includes("否定")) add("NEG");
    if (feature.includes("反问") || feature.includes("疑问")) add("Q");
    if (feature.includes("主题")) add("TOP");
  }

  if (token.pos?.includes("关系代词")) add("REL");
  if (token.pos?.includes("指示代词")) add("DEM");
  if (token.pos?.includes("冠词")) add("ART");
  if (token.pos === "形容词") add("ADJ");
  if (token.pos === "副词") add("ADV");
  if (token.pos?.includes("分词")) add("PTCP");
  if (token.pos?.includes("语气词") && token.role === "语气") add("Q");

  return normalizeLgrTags(tags).tags;
}

function leipzigRecord(token) {
  const tags = leipzigTags(token);
  const lexical = (token.gloss || "待析")
    .split(/[；;,，]/u)[0]
    .trim()
    .replace(/\s+/g, "_");
  const isNominal = token.pos?.includes("名词");
  const gender = isNominal ? tags.find((tag) => ["F", "M", "N"].includes(tag)) : null;
  const overtTags = tags.filter((tag) => tag !== gender);
  let gloss = `${lexical}${gender ? `(${gender})` : ""}${overtTags.length ? `.${overtTags.join(".")}` : ""}`;
  let surface = token.lgrSurface || token.form;

  if (token.lgrGloss) gloss = token.lgrGloss;

  if (!token.lgrSurface && token.lemma?.includes("-que") && /que$/iu.test(token.form)) {
    surface = `${token.form.slice(0, -3)}=que`;
    gloss = `${gloss.replace(/^(以及|和)/u, "")}=和`;
  }

  return { surface, gloss, tags };
}

function normalizeForm(value) {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}]/gu, "");
}

function detectLanguage(text) {
  if (/[\u0370-\u03ff\u1f00-\u1fff]/u.test(text)) return "greek";
  if (/[\u3400-\u9fff]/u.test(text)) return "chinese";
  return "latin";
}

function readerLineText(line, languageId, languageProfile) {
  const compact = languageId === "chinese"
    || languageProfile?.segmentation?.strategy === "character";
  return (line?.tokens || [])
    .map((token) => String(token.form || "").trim())
    .filter(Boolean)
    .join(compact ? "" : " ");
}

function useWiktionaryLookup(token, languageId, enabled = true, languageProfile = null) {
  const [result, setResult] = useState({ status: "idle", entries: [] });
  const customCode = languageProfile?.code || "";
  const supportedLanguage = ["greek", "latin", "chinese"].includes(languageId)
    || (Boolean(customCode) && !customCode.startsWith("x-"));
  const tokenId = token?.id;
  const term = token?.form || "";
  const lemma = token?.lemma || term;
  const embedded = token?.lexicon;
  const embeddedMatches = embedded
    && (!embedded.term || embedded.term === term)
    && (!embedded.lemma || embedded.lemma === lemma);
  const embeddedComplete = embeddedMatches && embedded.detailsLoaded;

  useEffect(() => {
    if (!enabled || embeddedComplete) return undefined;
    if (!tokenId || !term || !supportedLanguage) {
      setResult({ status: "idle", entries: [] });
      return undefined;
    }

    const controller = new AbortController();
    setResult({ status: "loading", entries: [], term, lemma, tokenId });
    const parameters = new URLSearchParams({
      language: languageId,
      term,
      lemma,
      ...(customCode ? { code: customCode } : {}),
    });
    fetch(`/api/lexicon?${parameters}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Lexicon request failed with ${response.status}`);
        return response.json();
      })
      .then((payload) => setResult({ ...payload, tokenId }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setResult({
            status: "unavailable",
            entries: [],
            tokenId,
            message: "Wiktionary 暂时不可用，已显示本地词法结果。",
          });
        }
      });

    return () => controller.abort();
  }, [customCode, embeddedComplete, enabled, languageId, lemma, supportedLanguage, term, tokenId]);

  if (embeddedComplete) return { status: "ok", tokenId, term, lemma, ...embedded };
  if (
    embeddedMatches
    && (result.tokenId !== tokenId || result.status === "loading" || result.status === "idle")
  ) {
    return { status: "ok", tokenId, term, lemma, ...embedded };
  }
  if (tokenId && !supportedLanguage) {
    return { status: "not_configured", entries: [], term, lemma, tokenId };
  }
  if (!enabled && tokenId) return { status: "loading", entries: [], term, lemma, tokenId };
  if (tokenId && result.tokenId !== tokenId) {
    return { status: "loading", entries: [], term, lemma, tokenId };
  }
  return result;
}

function wiktionaryDefinitions(result, limit = 3) {
  return [...new Set(
    (result?.entries || []).flatMap((entry) => entry.definitions || []).filter(Boolean),
  )].slice(0, limit);
}

function wiktionaryMorphologyCandidates(result) {
  const candidates = (result?.entries || []).flatMap((entry) => entry.morphologyCandidates || []);
  return candidates.filter((candidate, index) => (
    candidates.findIndex((item) => item.lgrTags.join(".") === candidate.lgrTags.join(".")) === index
  ));
}

function compactLexiconRecord(result) {
  if (result?.status !== "ok") return null;
  return {
    source: "Wiktionary",
    sourceWiki: result.sourceWiki,
    sourceLanguage: result.sourceLanguage,
    sourceUrl: result.sourceUrl,
    license: result.license,
    term: result.term,
    lemma: result.lemma,
    ipa: result.ipa || [],
    pronunciations: result.pronunciations || [],
    detailsLoaded: Boolean(result.detailsLoaded),
    paradigms: result.paradigms || [],
    fixedExpressions: result.fixedExpressions || [],
    relatedTerms: result.relatedTerms || [],
    entries: result.entries,
  };
}

function compactCjkExpression(value) {
  const source = String(value || "").replace(/\s+/gu, " ").trim();
  if (!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(source)) return source;
  return source
    .replace(/\s*\(\s*/gu, "(")
    .replace(/\s*\)\s*/gu, ")")
    .replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])\s+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, "$1");
}

function normalizedExpressionItem(item) {
  const source = typeof item === "string" ? { form: item, translation: "" } : item || {};
  let form = String(source.form || "").replace(/\s+/gu, " ").trim();
  let translation = String(source.translation || "").replace(/\s+/gu, " ").trim();
  if (!translation) {
    const quotedTranslation = /[“"]([^”"]+)[”"]/u.exec(form);
    if (quotedTranslation) {
      translation = quotedTranslation[1].trim();
      let prefix = form.slice(0, quotedTranslation.index).trim();
      const transliterationStart = prefix.lastIndexOf("(");
      if (
        transliterationStart >= 0
        && /[A-Za-zÀ-ž]/u.test(prefix.slice(transliterationStart))
      ) {
        prefix = prefix.slice(0, transliterationStart).trim();
      }
      form = prefix;
    } else {
      const trailingTransliteration = /\(\s*([^()]*(?:[A-Za-zÀ-ž])[^()]*)\s*\)\s*$/u.exec(form);
      if (trailingTransliteration) {
        translation = trailingTransliteration[1].trim();
        form = form.slice(0, trailingTransliteration.index).trim();
      }
    }
  }
  return {
    form: compactCjkExpression(form),
    translation,
  };
}

function relevantGrammarRules(profile, token, limit = 5) {
  const rules = profile?.grammarReference?.rules || [];
  if (!rules.length || !token) return [];
  const nominal = /名词|代词|限定词|专名|形容词/u.test(token.pos || "");
  const verbal = /动词/u.test(token.pos || "");
  const hasPolysyntheticProfile = rules.some((rule) => (
    rule.category === "复综形态" && rule.value === "1"
  ));
  const categoryOrder = verbal
    ? hasPolysyntheticProfile
      ? ["复综形态", "动词形态", "否定", "语态", "语序", "格与论元"]
      : ["动词形态", "否定", "语态", "语序", "格与论元", "复综形态"]
    : nominal
      ? hasPolysyntheticProfile
        ? ["名词形态", "格与论元", "复综形态", "一致关系", "名词短语", "语序"]
        : ["名词形态", "格与论元", "一致关系", "名词短语", "语序", "复综形态"]
      : hasPolysyntheticProfile
        ? ["复综形态", "动词形态", "格与论元", "一致关系", "语序", "名词短语"]
        : ["语序", "格与论元", "名词短语", "否定", "动词形态"];
  return [...rules]
    .sort((left, right) => {
      const leftIndex = categoryOrder.indexOf(left.category);
      const rightIndex = categoryOrder.indexOf(right.category);
      return (leftIndex < 0 ? categoryOrder.length : leftIndex)
        - (rightIndex < 0 ? categoryOrder.length : rightIndex);
    })
    .slice(0, limit);
}

const wiktionaryPartOfSpeech = {
  adjective: "形容词",
  adverb: "副词",
  article: "冠词",
  conjunction: "连词",
  interjection: "感叹词",
  noun: "名词",
  numeral: "数词",
  particle: "小品词",
  preposition: "介词",
  pronoun: "代词",
  verb: "动词",
  動詞: "动词",
  名詞: "名词",
  形容詞: "形容词",
  副詞: "副词",
  代詞: "代词",
  介詞: "介词",
  連詞: "连词",
  助詞: "助词",
  語氣詞: "语气词",
  感嘆詞: "感叹词",
  數詞: "数词",
  量詞: "量词",
  冠詞: "冠词",
};

function enrichedWithWiktionary(token, result) {
  const lexicon = compactLexiconRecord(result);
  if (!lexicon) return token;
  const externalPos = result.entries?.[0]?.partOfSpeech || "";
  const normalizedPos = wiktionaryPartOfSpeech[externalPos.toLocaleLowerCase()]
    || wiktionaryPartOfSpeech[externalPos]
    || externalPos;
  const definition = wiktionaryDefinitions(result, 1)[0];
  const pendingGloss = /^(?:等待模型|等待词典|等待 Wiktionary|待补充|待析)/u.test(token.gloss || "");
  const wiktionarySource = `Wiktionary · ${lexicon.sourceLanguage}`;
  const baseSource = token.source || "本地词法";
  const sourceWithWiktionary = baseSource.includes(wiktionarySource)
    ? baseSource
    : `${baseSource} · ${wiktionarySource}`;
  return {
    ...token,
    pos: token.pos === "待识别" && normalizedPos ? normalizedPos : token.pos,
    gloss: pendingGloss && definition ? definition : token.gloss,
    confidence: token.confidence <= 48 ? 70 : token.confidence,
    source: token.source?.startsWith("人工校订")
      ? `人工校订 · ${wiktionarySource}`
      : sourceWithWiktionary,
    lexicon: {
      ...lexicon,
      localSource: token.lexicon?.localSource || token.source,
      selectedCandidate: token.lexicon?.selectedCandidate || null,
    },
  };
}

function dependencyFromRole(token, isRoot = false) {
  if (isRoot) return "root";
  const role = token.role || "";
  if (role.includes("主语")) return "nsubj";
  if (role.includes("宾语")) return "obj";
  if (role.includes("定语")) return "nmod";
  if (role.includes("状语")) return "advmod";
  if (role.includes("连接")) return "cc";
  if (role.includes("介词")) return "case";
  if (role.includes("语气")) return "discourse";
  if (role.includes("谓语")) return "conj";
  return "dep";
}

function withSyntaxLinks(tokens) {
  if (!tokens.length) return [];
  const ids = new Set(tokens.map((token) => token.id));
  const explicitRoot = tokens.find((token) => (
    (Object.hasOwn(token, "headId") && token.headId === null)
    || token.dependency === "root"
  ));
  const root = explicitRoot
    || tokens.find((token) => token.role === "谓语" || token.pos === "动词")
    || tokens[0];
  const normalized = tokens.map((token) => {
    if (token.id === root.id) {
      return { ...token, headId: null, dependency: "root" };
    }
    const requestedHead = token.headId;
    const headId = requestedHead && requestedHead !== token.id && ids.has(requestedHead)
      ? requestedHead
      : root.id;
    const dependency = token.dependency && token.dependency !== "root"
      ? token.dependency
      : dependencyFromRole(token);
    return { ...token, headId, dependency };
  });
  const byId = new Map(normalized.map((token) => [token.id, token]));

  return normalized.map((token) => {
    if (token.id === root.id) return token;
    const seen = new Set([token.id]);
    let cursor = token.headId;
    while (cursor) {
      if (seen.has(cursor) || !byId.has(cursor)) {
        return { ...token, headId: root.id };
      }
      seen.add(cursor);
      cursor = byId.get(cursor).headId;
    }
    return token;
  });
}

function isSyntaxDescendant(tokens, candidateId, ancestorId) {
  const byId = new Map(tokens.map((token) => [token.id, token]));
  const seen = new Set();
  let cursor = candidateId;
  while (cursor && !seen.has(cursor)) {
    if (cursor === ancestorId) return true;
    seen.add(cursor);
    cursor = byId.get(cursor)?.headId;
  }
  return false;
}

const udPartOfSpeech = {
  ADJ: "形容词",
  ADP: "介词",
  ADV: "副词",
  AUX: "助动词",
  CCONJ: "连词",
  DET: "限定词",
  INTJ: "感叹词",
  NOUN: "名词",
  NUM: "数词",
  PART: "小品词",
  PRON: "代词",
  PROPN: "专名",
  PUNCT: "标点",
  SCONJ: "连词",
  SYM: "符号",
  VERB: "动词",
  X: "待识别",
};

const udFeatureTags = {
  "Aspect=Imp": "IPFV",
  "Aspect=Perf": "PFV",
  "Case=Abl": "ABL",
  "Case=Acc": "ACC",
  "Case=Dat": "DAT",
  "Case=Gen": "GEN",
  "Case=Ins": "INS",
  "Case=Loc": "LOC",
  "Case=Nom": "NOM",
  "Case=Voc": "VOC",
  "Definite=Def": "DEF",
  "Definite=Ind": "INDF",
  "Degree=Cmp": "CMPR",
  "Degree=Sup": "SPRL",
  "Gender=Fem": "F",
  "Gender=Masc": "M",
  "Gender=Neut": "N",
  "Mood=Cnd": "COND",
  "Mood=Imp": "IMP",
  "Mood=Ind": "IND",
  "Mood=Prp": "PURP",
  "Mood=Sub": "SBJV",
  "Number=Dual": "DU",
  "Number=Plur": "PL",
  "Number=Sing": "SG",
  "Polarity=Neg": "NEG",
  "PronType=Dem": "DEM",
  "PronType=Rel": "REL",
  "Reflex=Yes": "REFL",
  "Tense=Fut": "FUT",
  "Tense=Imp": ["PST", "IPFV"],
  "Tense=Past": "PST",
  "Tense=Pres": "PRS",
  "Tense=Prf": "PRF",
  "Subcat=Intr": "INTR",
  "Subcat=Tran": "TR",
  "VerbForm=Conv": "CVB",
  "VerbForm=Inf": "INF",
  "VerbForm=Part": "PTCP",
  "Voice=Act": "ACT",
  "Voice=Cau": "CAUS",
  "Voice=Mid": "MID",
  "Voice=Pass": "PASS",
};

const udArgumentRoleTags = {
  cs: "A",
  io: "DAT",
  lo: "LOC",
  obj: "OBJ",
  po: "OBJ",
  psor: "POSS",
  refl: "REFL",
  ro: "REL",
  subj: "SBJ",
};

const udArgumentRoleLabels = {
  cs: "使役论元",
  io: "间接宾语",
  lo: "方位论元",
  obj: "宾语",
  po: "间接论元",
  psor: "领属者",
  refl: "反身论元",
  ro: "关系论元",
  subj: "主语",
};

const udFeatureValueLabels = {
  Com: "通性",
  Fem: "阴性",
  Masc: "阳性",
  Neut: "中性",
  Plur: "复数",
  Rel: "关系人称",
  Sing: "单数",
};

const udSyntaxRoles = {
  root: ["谓语", "句子的依存根"],
  nsubj: ["主语", "名词性主语"],
  csubj: ["主语从句", "从句充当主语"],
  obj: ["宾语", "直接宾语"],
  iobj: ["间接宾语", "间接宾语"],
  ccomp: ["补语从句", "从句补语"],
  xcomp: ["补语", "开放式从句补语"],
  acl: ["定语从句", "从句修饰名词"],
  advcl: ["状语从句", "从句修饰谓语"],
  obl: ["斜格论元", "斜格或介词论元"],
  advmod: ["状语", "副词性修饰语"],
  amod: ["定语", "形容词性修饰语"],
  nmod: ["定语", "名词性修饰语"],
  appos: ["同位成分", "同位关系"],
  cc: ["连接成分", "并列连接词"],
  conj: ["并列成分", "并列关系"],
  case: ["介词标记", "格或介词标记"],
  mark: ["从句标记", "从属标记"],
  aux: ["助动成分", "助动词"],
  cop: ["系词", "系词关系"],
  det: ["限定成分", "限定关系"],
  compound: ["复合成分", "复合词关系"],
  discourse: ["话语成分", "话语关系"],
  dislocated: ["移位成分", "移位关系"],
  flat: ["并列命名成分", "扁平结构"],
  nummod: ["数量修饰语", "数词修饰关系"],
  orphan: ["省略残项", "省略结构中的残余成分"],
  parataxis: ["并列句", "松散并列关系"],
  punct: ["标点", "标点关系"],
  vocative: ["呼语", "呼语关系"],
};

function udMorphology(features = {}) {
  const rawTags = Object.entries(features)
    .flatMap(([name, value]) => udFeatureTags[`${name}=${value}`] || [])
    .filter(Boolean);
  const person = features.Person;
  const number = udFeatureTags[`Number=${features.Number}`];
  const tags = rawTags.filter((tag) => !["SG", "PL", "DU"].includes(tag));
  if (person && number) tags.unshift(`${person}${number}`);
  else if (number) tags.unshift(number);
  else if (person) tags.unshift(person);
  const argumentFeatures = new Map();
  Object.entries(features).forEach(([name, value]) => {
    const match = /^(Person|Number|Gender)\[([^\]]+)\]$/u.exec(name);
    if (!match) return;
    const record = argumentFeatures.get(match[2]) || {};
    record[match[1]] = value;
    argumentFeatures.set(match[2], record);
  });
  const argumentLabels = [];
  argumentFeatures.forEach((record, role) => {
    const roleLabel = udArgumentRoleLabels[role] || role;
    const personNumber = record.Person && record.Number
      ? `${record.Person}${udFeatureTags[`Number=${record.Number}`] || ""}`
      : record.Person || udFeatureTags[`Number=${record.Number}`] || "";
    const genderTag = udFeatureTags[`Gender=${record.Gender}`];
    if (personNumber) tags.push(personNumber);
    if (genderTag) tags.push(genderTag);
    if (udArgumentRoleTags[role]) tags.push(udArgumentRoleTags[role]);
    const values = [
      record.Person && (record.Person === "Rel" ? "关系人称" : `第${record.Person}人称`),
      udFeatureValueLabels[record.Number],
      udFeatureValueLabels[record.Gender],
    ].filter(Boolean);
    if (values.length) argumentLabels.push(`${roleLabel}：${values.join("")}`);
  });
  const normalized = normalizeLgrTags(tags);
  return {
    labels: [
      ...normalized.tags.map((tag) => leipzigTagDescription(tag)),
      ...argumentLabels,
    ],
    tags: normalized.tags,
    issues: normalized.unregistered,
  };
}

function udTokensToLab(items, languageProfile, model, sourceLabel = "UDPipe") {
  const idByUdId = new Map(items.map((item, index) => [item.id, `lab-${index}`]));
  return withSyntaxLinks(items.map((item, index) => {
    const known = findLanguageLexiconEntry(languageProfile, item.form)
      || findLanguageLexiconEntry(languageProfile, item.lemma);
    const dependencyType = String(item.dependency || "dep").split(":")[0];
    const [role, relation] = udSyntaxRoles[dependencyType] || ["句法成分", item.dependency || "依存关系待校订"];
    const morphology = udMorphology(item.features);
    return {
      id: idByUdId.get(item.id) || `lab-${index}`,
      form: item.form,
      lemma: known?.lemma || item.lemma || item.form,
      originalForm: item.originalForm || "",
      originalLemma: item.originalLemma || "",
      reading: "—",
      pos: known?.pos || udPartOfSpeech[item.upos] || item.upos || "待识别",
      morphology: morphology.labels,
      lgrTags: morphology.tags,
      lgrIssues: morphology.issues,
      gloss: known?.gloss
        || (item.upos === "PUNCT" ? "标点" : "等待词典或人工校订"),
      role,
      relation,
      confidence: known ? 88 : 82,
      source: known
        ? `初始化词表 · ${sourceLabel} · ${model}`
        : `${sourceLabel} · ${model}`,
      headId: item.head === 0 ? null : idByUdId.get(item.head) || null,
      dependency: item.dependency || "dep",
    };
  }));
}

function tokenizeCustomText(text, languageId, languageProfile = null) {
  const sourceWork = library[languageId];
  if (!sourceWork && languageProfile) {
    const strategy = segmentationStrategies.find((item) => (
      item.id === languageProfile.segmentation?.strategy
    ));
    const forms = tokenizeLanguageText(text, languageProfile);
    return withSyntaxLinks(forms.map((form, index) => {
      const known = findLanguageLexiconEntry(languageProfile, form);
      return {
        id: `lab-${index}`,
        form,
        lemma: known?.lemma || form,
        reading: "—",
        pos: known?.pos || "待识别",
        morphology: [],
        gloss: known?.gloss || "等待词典或人工校订",
        role: index === 0 ? "主干候选" : "未定",
        relation: "需要结合完整语境判断",
        confidence: known ? 70 : 45,
        source: `语言配置 · ${strategy?.label || "自定义分词"}`,
      };
    }));
  }

  const sourceTokens = sourceWork.lines.flatMap((line) => line.tokens);
  const sourceIndex = new Map(sourceTokens.map((token) => [normalizeForm(token.form), token]));
  let forms = [];

  if (languageId === "chinese") {
    const hasExplicitBoundaries = /[\u3400-\u9fff][\s|]+[\u3400-\u9fff]/u.test(text);
    if (hasExplicitBoundaries) {
      forms = text
        .split(/[\s|]+/u)
        .flatMap((segment) => segment.match(/[\u3400-\u9fff]+/gu) || []);
    }
    if (forms.length) {
      return withSyntaxLinks(forms.map((form, index) => {
        const known = sourceIndex.get(normalizeForm(form));
        if (known) return { ...known, id: `lab-${index}-${known.id}`, source: "显式分词 · 词典匹配" };
        return {
          id: `lab-${index}`,
          form,
          lemma: form,
          reading: "—",
          pos: "待识别",
          morphology: ["未标注"],
          gloss: "等待 Wiktionary 或人工校订",
          role: index === 0 ? "主干候选" : "未定",
          relation: "需要结合完整语境判断",
          confidence: 55,
          source: "显式分词边界",
        };
      }));
    }

    const compact = text.replace(/[\s|]+/gu, "");
    const lexicon = [...new Set(sourceTokens.map((token) => token.form))]
      .filter((form) => form.length > 1)
      .sort((a, b) => b.length - a.length);
    for (let cursor = 0; cursor < compact.length;) {
      const character = compact[cursor];
      if (/[，。！？；：“”‘’、]/u.test(character)) {
        cursor += 1;
        continue;
      }
      const match = lexicon.find((candidate) => compact.startsWith(candidate, cursor));
      forms.push(match || character);
      cursor += (match || character).length;
    }
  } else {
    forms = text.match(/[\p{L}\p{M}]+(?:[’᾽'][\p{L}\p{M}]*)?/gu) || [];
  }

  return withSyntaxLinks(forms.map((form, index) => {
    const known = sourceIndex.get(normalizeForm(form));
    if (known) return { ...known, id: `lab-${index}-${known.id}`, source: "词典匹配" };
    return {
      id: `lab-${index}`,
      form,
      lemma: languageId === "latin" ? form.toLocaleLowerCase() : form,
      reading: "—",
      pos: "待识别",
      morphology: ["未标注"],
      gloss: "等待模型或外部词典补充",
      role: index === 0 ? "主干候选" : "未定",
      relation: "需要结合完整语境判断",
      confidence: 48,
      source: "分词规则",
    };
  }));
}

function SyntaxTreeBranch({ token, childrenByHead, activeTokenId, onSelect, depth = 1 }) {
  const children = childrenByHead.get(token.id) || [];
  return (
    <div className="syntax-tree-branch" role="none">
      <button
        className={`syntax-tree-node ${token.headId === null ? "syntax-tree-root" : ""} ${activeTokenId === token.id ? "active" : ""}`}
        onClick={() => onSelect(token)}
        role="treeitem"
        aria-level={depth}
        aria-expanded={children.length ? "true" : undefined}
        aria-label={`${token.form}，${token.role}，${token.dependency}，${token.relation}`}
        title={`${token.dependency} · ${token.relation}`}
        data-head-id={token.headId || "root"}
      >
        <span>{token.role}</span>
        <strong>{token.form}</strong>
      </button>
      {children.length > 0 && (
        <div className="syntax-tree-children" role="group">
          {children.map((child) => (
            <SyntaxTreeBranch
              key={child.id}
              token={child}
              childrenByHead={childrenByHead}
              activeTokenId={activeTokenId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LibraryView({
  onOpenWork,
  onOpenLocalWork,
  localWorks = [],
  bookmarks,
  notes,
  lastLanguage,
}) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const availableWorks = [
    ...searchableWorks.map((item) => ({ ...item, kind: "built-in" })),
    ...localWorks.map((work) => ({
      id: work.id,
      kind: "local",
      languageId: work.languageId,
      title: work.title,
      titleZh: work.titleZh,
      author: work.author,
      language: work.languageName,
      meta: `${work.format.toUpperCase()} · ${work.passageCount.toLocaleString()} 段 · 本地数据库`,
      localWork: work,
    })),
  ];
  const visibleWorks = availableWorks.filter((item) => {
    const matchesFilter = filter === "all"
      || (item.kind === "built-in" ? item.id === filter : item.languageId === filter);
    const haystack = `${item.title} ${item.titleZh} ${item.author} ${item.language}`.toLocaleLowerCase();
    return matchesFilter && haystack.includes(query.toLocaleLowerCase());
  });

  return (
    <main className="workspace-page library-page">
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">Lingua Reader Collection</span>
          <h1>书库</h1>
          <p>浏览可阅读的原文、校勘本与语言学标注示例。</p>
        </div>
        <div className="library-summary">
          <div><strong>{availableWorks.length}</strong><span>部作品</span></div>
          <div><strong>{bookmarks.length}</strong><span>个收藏词</span></div>
          <div><strong>{notes.length}</strong><span>条本地笔记</span></div>
        </div>
      </header>

      <div className="workspace-toolbar">
        <div className="library-filters" role="tablist" aria-label="语言筛选">
          {[
            ["all", "全部"],
            ["greek", "古希腊语"],
            ["latin", "拉丁语"],
            ["chinese", "文言文"],
          ].map(([id, label]) => (
            <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        <label className="page-search">
          <Icon name="search" size={15} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="筛选作品或作者…" />
        </label>
      </div>

      <section className="library-list" aria-label="作品列表">
        <div className="library-list-head">
          <span>作品</span><span>语言与版本</span><span>阅读状态</span><span />
        </div>
        {visibleWorks.map((item) => {
          const work = item.kind === "local" ? item.localWork : library[item.id];
          const isRecent = item.kind === "built-in" && item.id === lastLanguage;
          return (
            <article className="library-item" key={item.id}>
              <div className="library-identity">
                <span className="library-cover">{work.coverMark}</span>
                <div><h2 lang={work.lang || work.code}>{item.title} <i>《{item.titleZh}》</i></h2><p>{item.author}</p></div>
              </div>
              <div className="library-edition"><strong>{item.language}</strong><span>{item.meta}</span></div>
              <div className="library-progress">
                <span>{isRecent ? "最近阅读" : "可开始阅读"}</span>
                <div><i style={{ width: `${isRecent ? work.progress : 0}%` }} /></div>
                <small>{isRecent ? `${work.progress}%` : "—"}</small>
              </div>
              <button
                className="open-work-button"
                onClick={() => item.kind === "local"
                  ? onOpenLocalWork(item.localWork)
                  : onOpenWork(item.id)}
              >
                {isRecent ? "继续阅读" : "打开作品"}<Icon name="arrowRight" size={14} />
              </button>
            </article>
          );
        })}
        {visibleWorks.length === 0 && <div className="empty-library">没有找到匹配的作品。</div>}
      </section>

      <footer className="workspace-footnote">
        内置公开领域样例与本地导入文本共用同一阅读界面；本地正文按段从 IndexedDB 读取，不会上传。
      </footer>
    </main>
  );
}

const builtInWorkspaceLanguages = [
  { id: "greek", name: "古希腊语", code: "grc" },
  { id: "latin", name: "拉丁语", code: "la" },
  { id: "chinese", name: "文言文", code: "lzh" },
];

function freshLanguageDraft() {
  return {
    name: "",
    code: "",
    script: "",
    direction: "ltr",
    strategy: "whitespace",
    delimiter: "|",
    sample: "",
    lexiconText: "",
    identity: {
      bcp47: "",
      iso6393: "",
      glottocode: "",
      glottologName: "",
    },
    orthography: {
      script: "",
      direction: "ltr",
      exemplars: "",
    },
    resources: [],
    grammarReference: null,
    initialization: {
      mode: "manual",
      catalogMatched: false,
      catalogReleaseDate: "",
    },
    segmentationSource: "manual",
  };
}

function readableFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function buildLanguageProfileWork(profile, payload) {
  const parsed = parseCtsPassageUrn(payload?.ctsUrn || "");
  const passage = parsed?.passage || "1.1";
  const mark = Array.from(profile.name || profile.code || "L")[0];
  return {
    id: profile.id,
    language: profile.name,
    shortLanguage: profile.name,
    lang: profile.code,
    direction: profile.direction,
    author: "Language Workspace · 语言工作台",
    title: profile.name,
    titleZh: "初始化语料",
    edition: "本地语言配置",
    passage: `工作语料 · ${passage}`,
    progress: 100,
    coverMark: mark,
    chapters: [
      { label: "工作语料", detail: `CTS ${passage}`, active: true },
    ],
    sections: [passage],
    lines: [],
  };
}

function buildLocalLibraryWork(work) {
  return {
    id: work.id,
    language: work.languageName,
    shortLanguage: work.languageName,
    lang: work.code,
    direction: work.direction,
    author: `${work.author} · 本地书库`,
    title: work.title,
    titleZh: work.titleZh || "本地导入文本",
    edition: `${work.format.toUpperCase()} · 浏览器本地数据库`,
    passage: "本地书库",
    progress: 0,
    coverMark: work.coverMark,
    chapters: [{
      label: work.title,
      detail: `${work.passageCount.toLocaleString()} 段`,
      active: true,
    }],
    sections: [],
    lines: [],
  };
}

function remapPassageTokens(tokens, prefix) {
  const idMap = new Map(tokens.map((token, index) => [token.id, `${prefix}-${index}`]));
  return withSyntaxLinks(tokens.map((token, index) => ({
    ...token,
    id: idMap.get(token.id) || `${prefix}-${index}`,
    headId: token.headId === null ? null : idMap.get(token.headId) || null,
  })));
}

function WorkspaceQueue({
  items,
  emptyLabel,
  statusForItem,
  onRemove,
}) {
  if (!items.length) return <p className="workspace-empty-row">{emptyLabel}</p>;
  return (
    <div className="workspace-queue">
      {items.map((item) => (
        <div key={item.id}>
          <span>
            <strong>{item.title}</strong>
            <small>{item.meta}</small>
          </span>
          <div className="workspace-queue-actions">
            <em>{statusForItem?.(item) || (item.status === "waiting-model" ? "等待模型连接" : item.status)}</em>
            {onRemove && (
              <button onClick={() => onRemove(item)} aria-label={`移除任务${item.title}`} title="从本设备移除">
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ModelSettingsDialog({
  config,
  errors,
  testState,
  onChange,
  onClose,
  onSave,
  onTest,
}) {
  const [showSecret, setShowSecret] = useState(false);
  const statusLabel = testState.status === "testing"
    ? "正在验证终点与密钥…"
    : testState.status === "ok"
      ? testState.modelAvailable === false
        ? `终点可用，但未在模型列表中找到 ${config.model}`
        : `连接通过 · ${testState.modelCount || "已读取"} 个模型 · ${testState.latencyMs} ms`
      : testState.status === "error"
        ? testState.message
        : "尚未测试当前设置";

  return (
    <div className="settings-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="model-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="model-settings-title">
        <header>
          <div>
            <span className="eyebrow">Model connection</span>
            <h2 id="model-settings-title">模型设置</h2>
          </div>
          <button onClick={onClose} aria-label="关闭模型设置"><Icon name="close" /></button>
        </header>

        <div className="model-settings-form">
          <label>
            <span>接口类型</span>
            <select value={config.provider} onChange={(event) => onChange({ ...config, provider: event.target.value })}>
              <option value="openai-compatible">OpenAI 兼容接口</option>
            </select>
          </label>
          <label>
            <span>模型终点</span>
            <input
              value={config.endpoint}
              onChange={(event) => onChange({ ...config, endpoint: event.target.value })}
              placeholder="https://api.openai.com/v1"
              aria-invalid={errors.endpoint ? "true" : "false"}
              autoCapitalize="off"
              spellCheck="false"
            />
            {errors.endpoint && <small>{errors.endpoint}</small>}
          </label>
          <label>
            <span>模型 ID</span>
            <input
              value={config.model}
              onChange={(event) => onChange({ ...config, model: event.target.value })}
              placeholder="gpt-5.6-sol"
              aria-invalid={errors.model ? "true" : "false"}
              autoCapitalize="off"
              spellCheck="false"
            />
            {errors.model && <small>{errors.model}</small>}
          </label>
          <label>
            <span>API 密钥</span>
            <div className="model-secret-field">
              <input
                type={showSecret ? "text" : "password"}
                value={config.apiKey}
                onChange={(event) => onChange({ ...config, apiKey: event.target.value })}
                placeholder="仅当前浏览器会话"
                aria-invalid={errors.apiKey ? "true" : "false"}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck="false"
              />
              <button type="button" onClick={() => setShowSecret((current) => !current)}>
                {showSecret ? "隐藏" : "显示"}
              </button>
            </div>
            {errors.apiKey && <small>{errors.apiKey}</small>}
          </label>
        </div>

        <p className="model-privacy-note">
          终点与模型 ID 保存在本设备；密钥只保留在当前浏览器会话。点击测试或启动识别前，不会向模型终点发送请求。
        </p>
        <div className={`model-test-status ${testState.status}`} role="status">
          <i aria-hidden="true" />
          <span>{statusLabel}</span>
        </div>
        <footer>
          <button onClick={onClose}>取消</button>
          <button onClick={onSave}>保存设置</button>
          <button className="primary-action" onClick={onTest} disabled={testState.status === "testing"}>
            {testState.status === "testing" ? "测试中…" : "测试连接"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function LanguageWorkspace({
  workspace,
  setWorkspace,
  showToast,
  onOpenLab,
  modelConnection,
  onOpenModelSettings,
}) {
  const [tab, setTab] = useState("initialize");
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState(freshLanguageDraft);
  const [errors, setErrors] = useState({});
  const [resourcePhase, setResourcePhase] = useState({ status: "idle", code: "" });
  const [lexiconSeedPhase, setLexiconSeedPhase] = useState({ status: "idle" });
  const [grammarSeedPhase, setGrammarSeedPhase] = useState({ status: "idle" });
  const [dictionaryDraft, setDictionaryDraft] = useState({
    destination: "lexicon",
    language: "greek",
    title: "",
    author: "",
    files: [],
    maxEntries: 2000,
    mergeMode: "merge",
  });
  const [dictionaryPhase, setDictionaryPhase] = useState({ status: "idle" });
  const [dictionaryPreview, setDictionaryPreview] = useState([]);
  const [dictionarySearch, setDictionarySearch] = useState("");
  const [pdfDraft, setPdfDraft] = useState({
    kind: "bilingual",
    sourceLanguage: "greek",
    targetLanguage: "chinese",
    pageRange: "",
    title: "",
    file: null,
  });
  const [grammarDraft, setGrammarDraft] = useState({
    language: "greek",
    mode: "generate",
    sourceJobId: "",
    title: "",
    scope: "音系、词法、句法与常见结构",
  });
  const [storedPdfIds, setStoredPdfIds] = useState(() => new Set());
  const [pdfQueuePhase, setPdfQueuePhase] = useState("idle");
  const [databaseDraft, setDatabaseDraft] = useState({ file: null });
  const [databasePhase, setDatabasePhase] = useState({ status: "idle", message: "" });
  const [storageState, setStorageState] = useState({ status: "idle" });
  const [analysisLanguageId, setAnalysisLanguageId] = useState("greek");
  const [corpusDraft, setCorpusDraft] = useState({
    file: null,
    title: "",
    sourceUrl: "",
    license: "",
    acknowledgement: "",
  });
  const [corpusPhase, setCorpusPhase] = useState({ status: "idle", message: "" });
  const [dslDraft, setDslDraft] = useState({
    name: "本地分析修正规则",
    source: analysisDslTemplate,
  });
  const [dslEditingId, setDslEditingId] = useState("");
  const pdfInputRef = useRef(null);
  const dictionaryResultInputRef = useRef(null);
  const dictionaryArchiveInputRef = useRef(null);
  const localDatabaseInputRef = useRef(null);
  const corpusInputRef = useRef(null);
  const lexiconSeedRequestRef = useRef(null);
  const grammarSeedRequestRef = useRef(null);
  const [dictionaryResultJobId, setDictionaryResultJobId] = useState("");
  const languageOptions = [...builtInWorkspaceLanguages, ...workspace.profiles];
  const analysisLanguage = languageOptions.find((item) => item.id === analysisLanguageId)
    || languageOptions[0];
  const analysisProfile = workspace.profiles.find((profile) => profile.id === analysisLanguageId)
    || null;
  const analysisPipeline = normalizeAnalysisPipeline(
    workspace.analysisPipelines?.[analysisLanguageId],
    analysisProfile,
  );
  const analysisDslValidation = useMemo(
    () => parseAnalysisDsl(dslDraft.source),
    [dslDraft.source],
  );
  const languageCorpora = (workspace.corpora || []).filter((corpus) => (
    corpus.languageId === analysisLanguageId
    || corpus.languageCode === analysisLanguage?.code?.toLocaleLowerCase()
  ));
  const grammarPdfJobs = workspace.pdfJobs.filter((job) => job.kind === "grammar");
  const dictionaryPdfJobs = workspace.pdfJobs.filter((job) => job.kind === "dictionary");
  const modelStatus = modelConnection.tested
    ? "模型连接已验证"
    : modelConnection.configured
      ? "模型已配置，尚未测试"
      : "多模态模型未连接";
  const previewProfile = useMemo(() => createLanguageProfile({
    ...draft,
    id: "custom-preview",
  }), [draft]);
  const previewTokens = useMemo(() => (
    tokenizeLanguageText(draft.sample, previewProfile)
  ), [draft.sample, previewProfile]);
  const visibleDictionaryPreview = useMemo(() => {
    const query = dictionarySearch.trim().toLocaleLowerCase();
    if (!query) return dictionaryPreview.slice(0, 30);
    return dictionaryPreview.filter((entry) => (
      `${entry.form} ${entry.lemma} ${entry.gloss} ${entry.pos}`
        .toLocaleLowerCase()
        .includes(query)
    )).slice(0, 30);
  }, [dictionaryPreview, dictionarySearch]);

  useEffect(() => {
    let active = true;
    const syncStoredPdfIds = async () => {
      const entries = await Promise.all(workspace.pdfJobs.map(async (job) => {
        try {
          return [job.id, await hasPdfMaterial(job.id)];
        } catch {
          return [job.id, false];
        }
      }));
      if (active) {
        setStoredPdfIds(new Set(entries.filter(([, stored]) => stored).map(([id]) => id)));
      }
    };
    void syncStoredPdfIds();
    return () => {
      active = false;
    };
  }, [workspace.pdfJobs]);

  useEffect(() => {
    if (!dictionaryPdfJobs.length) {
      setDictionaryResultJobId("");
      return;
    }
    if (!dictionaryPdfJobs.some((job) => job.id === dictionaryResultJobId)) {
      setDictionaryResultJobId(dictionaryPdfJobs[0].id);
    }
  }, [workspace.pdfJobs, dictionaryResultJobId]);

  useEffect(() => () => {
    lexiconSeedRequestRef.current?.abort();
    grammarSeedRequestRef.current?.abort();
  }, []);

  useEffect(() => {
    let active = true;
    void listCorpora()
      .then((corpora) => {
        if (!active) return;
        setWorkspace((current) => ({ ...current, corpora }));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [setWorkspace]);

  const updateLanguageIdentity = (patch) => {
    lexiconSeedRequestRef.current?.abort();
    grammarSeedRequestRef.current?.abort();
    lexiconSeedRequestRef.current = null;
    grammarSeedRequestRef.current = null;
    setDraft((current) => ({
      ...current,
      ...patch,
      resources: [],
      grammarReference: null,
      initialization: {
        mode: "manual",
        catalogMatched: false,
        catalogReleaseDate: "",
      },
    }));
    setResourcePhase({ status: "idle", code: "" });
    setLexiconSeedPhase({ status: "idle" });
    setGrammarSeedPhase({ status: "idle" });
    setErrors({});
  };

  const discoverLanguageResources = async ({ advance = false } = {}) => {
    const code = draft.code.trim();
    const validCode = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u.test(code)
      || /^x(?:-[a-zA-Z0-9]{1,8})+$/u.test(code);
    if (!validCode) {
      setErrors({ code: "请输入 BCP 47 风格的语言代码" });
      showToast("请输入可识别的语言代码");
      return false;
    }
    setResourcePhase({ status: "loading", code });
    try {
      const response = await fetch(
        `/api/languages/resolve?code=${encodeURIComponent(code)}&name=${encodeURIComponent(draft.name)}`,
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "数据库目录无法读取");
      const nextName = result.name || draft.name;
      if (!nextName) {
        setErrors({ name: "目录中没有该代码，请补充语言名称" });
        setResourcePhase({ status: "unmatched", code });
        showToast("没有找到标准名称，请补充语言名称后继续");
        return false;
      }
      setDraft((current) => ({
        ...current,
        name: nextName,
        code: result.code || current.code,
        script: result.orthography.script || current.script,
        direction: result.orthography.direction || current.direction,
        strategy: result.segmentation.strategy || current.strategy,
        sample: result.sample || current.sample,
        identity: result.identity,
        orthography: result.orthography,
        resources: result.resources,
        initialization: {
          mode: "database-assisted",
          catalogMatched: result.matched,
          catalogReleaseDate: result.releaseDate,
        },
        segmentationSource: result.segmentation.source,
      }));
      setErrors({});
      setResourcePhase({
        status: result.matched ? "ready" : "candidate",
        code: result.code,
        count: result.resources.length,
      });
      showToast(result.matched
        ? `已匹配 ${nextName}，发现 ${result.resources.length} 个候选数据源`
        : `已为 ${nextName} 生成通用资源清单`);
      if (advance) setStep(2);
      return true;
    } catch (error) {
      setResourcePhase({ status: "error", code, message: error?.message });
      showToast(error?.message || "语言资源目录暂时不可用");
      return false;
    }
  };

  const pullWiktionarySeed = async ({ automatic = false } = {}) => {
    const code = draft.code.trim();
    if (!code || code.startsWith("x-")) {
      setLexiconSeedPhase({
        status: "not-configured",
        message: "私用语言代码无法自动映射到 Wiktionary 分类",
      });
      return false;
    }
    lexiconSeedRequestRef.current?.abort();
    const controller = new AbortController();
    const requestedCode = code.toLocaleLowerCase();
    lexiconSeedRequestRef.current = controller;
    setLexiconSeedPhase({
      status: "loading",
      message: automatic ? "正在自动建立 Wiktionary 种子词表…" : "正在读取 Wiktionary 词表…",
    });
    try {
      const response = await fetch(
        `/api/languages/wiktionary?code=${encodeURIComponent(code)}&limit=24`,
        { signal: controller.signal },
      );
      const result = await response.json();
      if (!response.ok || result.status !== "ok") {
        throw new Error(result.message || `Wiktionary 暂无 ${result.languageName || code} 词表`);
      }
      setDraft((current) => {
        if (current.code.trim().toLocaleLowerCase() !== requestedCode) return current;
        const merged = mergeDictionaryEntries(
          parseLanguageLexicon(current.lexiconText),
          result.entries,
        );
        return {
          ...current,
          lexiconText: merged.map((entry) => [
            entry.form,
            entry.lemma || entry.form,
            entry.pos || "",
            String(entry.gloss || "").replace(/[\t\r\n]+/gu, " "),
          ].join("\t")).join("\n"),
        };
      });
      setLexiconSeedPhase({
        status: "done",
        message: `已从 ${result.languageName} lemmas 拉取 ${result.entries.length} 条种子词目`,
        sourceUrl: result.sourceUrl,
      });
      showToast(`已自动补入 ${result.entries.length} 条 Wiktionary 词目`);
      return true;
    } catch (error) {
      if (error.name === "AbortError") return false;
      setLexiconSeedPhase({
        status: "error",
        message: error?.message || "Wiktionary 词表暂时无法读取",
      });
      if (!automatic) showToast(error?.message || "Wiktionary 词表暂时无法读取");
      return false;
    } finally {
      if (lexiconSeedRequestRef.current === controller) {
        lexiconSeedRequestRef.current = null;
      }
    }
  };

  const pullGrammarReference = async ({ automatic = false } = {}) => {
    const glottocode = draft.identity.glottocode.trim();
    if (!glottocode) {
      setGrammarSeedPhase({
        status: "not-configured",
        message: "尚无 Glottocode，无法自动匹配 Grambank。",
      });
      return false;
    }
    grammarSeedRequestRef.current?.abort();
    const controller = new AbortController();
    grammarSeedRequestRef.current = controller;
    setGrammarSeedPhase({
      status: "loading",
      message: automatic ? "正在生成描述语法概况…" : "正在读取 Grambank 语法特征…",
    });
    try {
      const response = await fetch(
        `/api/languages/grammar?glottocode=${encodeURIComponent(glottocode)}`,
        { signal: controller.signal },
      );
      const result = await response.json();
      if (!response.ok || result.status !== "ok") {
        throw new Error(result.message || "Grambank 暂无该语言的语法记录");
      }
      setDraft((current) => (
        current.identity.glottocode === glottocode
          ? { ...current, grammarReference: result }
          : current
      ));
      setGrammarSeedPhase({
        status: "done",
        message: `已整理 ${result.rules.length} 条核心规则；数据库覆盖 ${result.coverage.coded}/${result.coverage.total} 项特征。`,
        sourceUrl: result.sourceUrl,
      });
      if (!automatic) showToast(`已从 Grambank 整理 ${result.rules.length} 条语法规则`);
      return true;
    } catch (error) {
      if (error.name === "AbortError") return false;
      setGrammarSeedPhase({
        status: "error",
        message: error?.message || "Grambank 语法特征暂时无法读取",
      });
      if (!automatic) showToast(error?.message || "Grambank 语法特征暂时无法读取");
      return false;
    } finally {
      if (grammarSeedRequestRef.current === controller) {
        grammarSeedRequestRef.current = null;
      }
    }
  };

  const advanceLanguageWizard = async () => {
    if (step === 1) {
      const normalizedCode = draft.code.trim().toLocaleLowerCase();
      if (!draft.resources.length || resourcePhase.code.toLocaleLowerCase() !== normalizedCode) {
        await discoverLanguageResources({ advance: true });
        return;
      }
    }
    const validation = validateLanguageProfile(draft);
    const relevantErrors = step === 1
      ? { name: validation.name, code: validation.code }
      : step === 2
        ? {}
        : step === 3
          ? { delimiter: validation.delimiter, lexicon: validation.lexicon }
          : validation;
    const visibleErrors = Object.fromEntries(
      Object.entries(relevantErrors).filter(([, value]) => value),
    );
    setErrors(visibleErrors);
    if (Object.keys(visibleErrors).length) {
      showToast(Object.values(visibleErrors)[0]);
      return;
    }
    if (step === 2 && !draft.resources.some((resource) => resource.selected)) {
      showToast("请至少保留一个初始化数据源");
      return;
    }
    if (step === 2) {
      setStep(3);
      if (
        !draft.lexiconText.trim()
        && draft.resources.some((resource) => resource.id === "kaikki" && resource.selected)
      ) {
        void pullWiktionarySeed({ automatic: true });
      }
      if (
        !draft.grammarReference
        && draft.resources.some((resource) => resource.id === "grambank" && resource.selected)
      ) {
        void pullGrammarReference({ automatic: true });
      }
      return;
    }
    setStep((current) => Math.min(4, current + 1));
  };

  const saveLanguage = () => {
    const validation = validateLanguageProfile(draft);
    setErrors(validation);
    if (Object.keys(validation).length) {
      showToast(Object.values(validation)[0]);
      return;
    }
    const profile = createLanguageProfile(
      {
        ...draft,
        resources: selectedResourceManifest(draft.resources),
        segmentation: {
          source: draft.segmentationSource,
        },
      },
      workspace.profiles.map((item) => item.id),
    );
    lexiconSeedRequestRef.current?.abort();
    grammarSeedRequestRef.current?.abort();
    lexiconSeedRequestRef.current = null;
    grammarSeedRequestRef.current = null;
    setWorkspace((current) => ({
      ...current,
      profiles: [...current.profiles, profile],
      analysisPipelines: {
        ...(current.analysisPipelines || {}),
        [profile.id]: normalizeAnalysisPipeline(null, profile),
      },
    }));
    setDraft(freshLanguageDraft());
    setStep(1);
    setErrors({});
    setResourcePhase({ status: "idle", code: "" });
    setLexiconSeedPhase({ status: "idle" });
    setGrammarSeedPhase({ status: "idle" });
    showToast(`${profile.name}已使用 ${profile.resources.length} 个数据源完成初始化`);
  };

  const importDictionaryArchive = async () => {
    if (!dictionaryDraft.files.length) {
      showToast("请选择词典文件");
      return;
    }
    const language = languageOptions.find((item) => item.id === dictionaryDraft.language);
    const importId = `${dictionaryDraft.destination === "library" ? "local-work" : "dictionary"}-${Date.now()}`;
    setDictionaryPhase({ status: "working", message: "正在读取文件索引…" });
    try {
      const result = await importDictionaryFiles(dictionaryDraft.files, {
        title: dictionaryDraft.title,
        jobId: importId,
        maxEntries: Number(dictionaryDraft.maxEntries),
        onProgress: ({ phase, current, total }) => {
          setDictionaryPhase({
            status: "working",
            message: phase === "index"
              ? `正在读取 MDX 索引 ${current}/${total}`
              : `正在整理词条 ${current}/${total}`,
          });
        },
      });
      if (!result.entries.length) throw new Error("词典中没有可导入的词条");
      if (dictionaryDraft.destination === "library") {
        const targetProfile = workspace.profiles.find(
          (profile) => profile.id === dictionaryDraft.language,
        );
        const title = dictionaryDraft.title.trim() || result.sourceTitle;
        const record = await putLocalLibraryWork({
          id: importId,
          title,
          titleZh: "本地导入文本",
          author: dictionaryDraft.author.trim() || "本地导入",
          languageId: dictionaryDraft.language,
          languageName: language?.name || dictionaryDraft.language,
          code: language?.code || targetProfile?.code || library[dictionaryDraft.language]?.lang || "und",
          direction: targetProfile?.direction || library[dictionaryDraft.language]?.direction || "ltr",
          format: result.format,
          fileNames: dictionaryDraft.files.map((file) => file.name),
          coverMark: Array.from(title || language?.name || "L")[0],
          importedAt: new Date().toISOString(),
        }, result.entries, ({ current, total }) => {
          setDictionaryPhase({
            status: "working",
            message: `正在写入本地书库 ${current}/${total}`,
          });
        });
        setWorkspace((current) => ({
          ...current,
          libraryImports: [record, ...(current.libraryImports || []).filter((item) => item.id !== record.id)],
        }));
        setDictionaryPreview(result.entries);
        setDictionarySearch("");
        setDictionaryPhase({
          status: "done",
          message: `已写入书库 ${record.passageCount.toLocaleString()} 段，可在书库中打开`,
        });
        setDictionaryDraft((current) => ({
          ...current,
          title: "",
          author: "",
          files: [],
        }));
        if (dictionaryArchiveInputRef.current) dictionaryArchiveInputRef.current.value = "";
        showToast(`《${record.title}》已导入本地书库`);
        return;
      }
      const targetProfile = workspace.profiles.find(
        (profile) => profile.id === dictionaryDraft.language,
      );
      const normalization = normalizeDictionaryEntriesWithDsl(
        result.entries,
        (workspace.analysisRulePacks || []).filter((pack) => pack.enabled !== false),
        {
          languageId: dictionaryDraft.language,
          languageCode: language?.code
            || targetProfile?.code
            || library[dictionaryDraft.language]?.lang
            || "",
        },
      );
      const importedEntries = normalization.entries;
      setDictionaryPhase({ status: "working", message: "正在保存到本地词典库…" });
      await putDictionaryLexicon(
        importId,
        dictionaryDraft.language,
        importedEntries,
      );
      const previousEntries = workspace.profiles.find(
        (profile) => profile.id === dictionaryDraft.language,
      )?.lexicon || workspace.lexicons?.[dictionaryDraft.language] || [];
      const nextEntries = dictionaryDraft.mergeMode === "replace"
        ? importedEntries
        : mergeDictionaryEntries(previousEntries, importedEntries);
      const record = {
        id: importId,
        title: dictionaryDraft.title.trim() || result.sourceTitle,
        language: dictionaryDraft.language,
        languageName: language?.name || dictionaryDraft.language,
        format: result.format,
        mergeMode: dictionaryDraft.mergeMode,
        entryCount: importedEntries.length,
        withDefinitions: importedEntries.filter((entry) => entry.definitions.length).length,
        withPartOfSpeech: importedEntries.filter((entry) => entry.pos).length,
        normalizationChanges: normalization.changedFields,
        normalizationPacks: normalization.packs,
        truncated: result.stats.truncated,
        fileNames: dictionaryDraft.files.map((file) => file.name),
        importedAt: new Date().toISOString(),
      };
      setWorkspace((current) => {
        const targetProfile = current.profiles.find(
          (profile) => profile.id === dictionaryDraft.language,
        );
        return {
          ...current,
          profiles: targetProfile
            ? current.profiles.map((profile) => profile.id === targetProfile.id
              ? { ...profile, lexicon: nextEntries }
              : profile)
            : current.profiles,
          lexicons: targetProfile ? (current.lexicons || {}) : {
            ...(current.lexicons || {}),
            [dictionaryDraft.language]: nextEntries,
          },
          dictionaryImports: [record, ...(current.dictionaryImports || [])],
        };
      });
      setDictionaryPreview(importedEntries);
      setDictionarySearch("");
      setDictionaryPhase({
        status: "done",
        message: `已整理 ${importedEntries.length} 条；${normalization.changedFields
          ? `规范化 ${normalization.changedFields} 个字段`
          : "未触发替换规则"}`,
      });
      setDictionaryDraft((current) => ({ ...current, title: "", files: [] }));
      if (dictionaryArchiveInputRef.current) dictionaryArchiveInputRef.current.value = "";
      showToast(`已将 ${result.stats.entries} 条词目导入${language?.name || "目标词库"}`);
    } catch (error) {
      setDictionaryPhase({ status: "error", message: error?.message || "词典无法导入" });
      showToast(error?.message || "词典无法导入");
    }
  };

  const exportDatabase = async () => {
    setDatabasePhase({ status: "working", message: "正在清点本地数据…" });
    try {
      const result = await exportLocalDatabase({
        onProgress: ({ current, total, label }) => {
          setDatabasePhase({
            status: "working",
            message: `正在导出 ${label} · ${current}/${total}`,
          });
        },
      });
      setDatabasePhase({
        status: "done",
        message: `已导出 ${result.total.toLocaleString()} 条记录${result.mode === "memory" ? " · 当前浏览器使用兼容下载" : " · 已直接写入文件"}`,
      });
      showToast("本地数据库备份已生成");
    } catch (error) {
      if (error?.name === "AbortError") {
        setDatabasePhase({ status: "idle", message: "" });
        return;
      }
      setDatabasePhase({ status: "error", message: error?.message || "本地数据库无法导出" });
    }
  };

  const chooseDatabaseFile = async (file) => {
    if (!file) return;
    try {
      const { manifest } = await inspectLocalDatabase(file);
      setDatabaseDraft({ file, manifest });
      setDatabasePhase({
        status: "ready",
        message: `${file.name} · ${readableFileSize(file.size)} · ${Object.values(manifest.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0).toLocaleString()} 条数据`,
      });
    } catch (error) {
      setDatabaseDraft({ file: null });
      setDatabasePhase({ status: "error", message: error?.message || "无法读取本地数据库" });
    }
  };

  const restoreDatabase = async () => {
    if (!databaseDraft.file) {
      showToast("请选择 Lingua 本地数据库文件");
      return;
    }
    setDatabasePhase({ status: "working", message: "正在恢复本地数据库…" });
    try {
      const result = await importLocalDatabase(databaseDraft.file, {
        onProgress: ({ current, total }) => setDatabasePhase({
          status: "working",
          message: `正在恢复 ${current}/${total}`,
        }),
      });
      setDatabasePhase({
        status: "restored",
        message: `已恢复 ${result.importedRecords.toLocaleString()} 条记录；重新载入后生效`,
      });
      showToast("本地数据库恢复完成");
    } catch (error) {
      setDatabasePhase({ status: "error", message: error?.message || "本地数据库无法恢复" });
    }
  };

  const enablePersistentStorage = async () => {
    setStorageState({ status: "working" });
    try {
      const result = await requestLocalPersistence();
      setStorageState({ status: "done", ...result });
      showToast(result.persisted ? "浏览器已允许持久存储" : "浏览器未授予持久存储，仍会保留本地数据");
    } catch {
      setStorageState({ status: "error" });
      showToast("无法读取当前浏览器的存储状态");
    }
  };

  const queuePdf = async () => {
    const file = pdfDraft.file;
    const validationError = validatePdfMaterial(file);
    if (validationError) {
      showToast(validationError);
      return;
    }
    const title = pdfDraft.title.trim() || file.name.replace(/\.pdf$/iu, "");
    const sourceLanguage = languageOptions.find((item) => item.id === pdfDraft.sourceLanguage);
    const targetLanguage = languageOptions.find((item) => item.id === pdfDraft.targetLanguage);
    const id = `pdf-${Date.now()}`;
    const job = {
      id,
      kind: pdfDraft.kind,
      title,
      fileName: file.name,
      fileSize: file.size,
      sourceLanguage: pdfDraft.sourceLanguage,
      targetLanguage: pdfDraft.kind === "bilingual" ? pdfDraft.targetLanguage : null,
      pageRange: pdfDraft.pageRange.trim() || "全部页",
      status: "waiting-model",
      meta: `${sourceLanguage?.name || "未指定"}${
        pdfDraft.kind === "bilingual"
          ? ` ↔ ${targetLanguage?.name || "未指定"}`
          : pdfDraft.kind === "dictionary"
            ? " · 扫描词典 → 词库"
            : " · 语法材料"
      } · ${readableFileSize(file.size)}`,
      createdAt: new Date().toISOString(),
    };
    setPdfQueuePhase("saving");
    try {
      await putPdfMaterial(id, file);
      setStoredPdfIds((current) => new Set([...current, id]));
      setWorkspace((current) => ({
        ...current,
        pdfJobs: [job, ...current.pdfJobs],
      }));
      setPdfDraft((current) => ({ ...current, title: "", file: null }));
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      showToast("PDF 已安全保存在当前浏览器，等待模型连接");
    } catch (error) {
      showToast(error?.message || "PDF 无法保存在当前浏览器");
    } finally {
      setPdfQueuePhase("idle");
    }
  };

  const removePdfJob = async (job) => {
    const referenced = workspace.grammarJobs.some((item) => item.sourceJobId === job.id);
    if (referenced) {
      showToast("请先移除引用该 PDF 的语法参考任务");
      return;
    }
    if (!window.confirm(`从本设备移除“${job.title}”及其 PDF 文件？`)) return;
    try {
      await deletePdfMaterial(job.id);
      setStoredPdfIds((current) => {
        const next = new Set(current);
        next.delete(job.id);
        return next;
      });
      setWorkspace((current) => ({
        ...current,
        pdfJobs: current.pdfJobs.filter((item) => item.id !== job.id),
      }));
      showToast("PDF 任务与本地文件已移除");
    } catch (error) {
      showToast(error?.message || "无法移除本地 PDF");
    }
  };

  const removeGrammarJob = (job) => {
    if (!window.confirm(`从本设备移除语法参考任务“${job.title}”？`)) return;
    setWorkspace((current) => ({
      ...current,
      grammarJobs: current.grammarJobs.filter((item) => item.id !== job.id),
    }));
    showToast("语法参考任务已移除");
  };

  const importDictionaryResult = async (file) => {
    const job = dictionaryPdfJobs.find((item) => item.id === dictionaryResultJobId);
    if (!job) {
      showToast("请先选择一个扫描词典任务");
      return;
    }
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      const rawEntries = normalizeDictionaryEntries(payload, { title: job.title, jobId: job.id });
      const language = languageOptions.find((item) => item.id === job.sourceLanguage);
      const targetProfile = workspace.profiles.find((profile) => profile.id === job.sourceLanguage);
      const normalization = normalizeDictionaryEntriesWithDsl(
        rawEntries,
        (workspace.analysisRulePacks || []).filter((pack) => pack.enabled !== false),
        {
          languageId: job.sourceLanguage,
          languageCode: language?.code || targetProfile?.code || "",
        },
      );
      const entries = normalization.entries;
      if (!entries.length) throw new Error("识别结果中没有可导入词条");
      setWorkspace((current) => {
        const targetProfile = current.profiles.find((profile) => profile.id === job.sourceLanguage);
        return {
          ...current,
          profiles: targetProfile
            ? current.profiles.map((profile) => profile.id === targetProfile.id
              ? { ...profile, lexicon: mergeDictionaryEntries(profile.lexicon, entries) }
              : profile)
            : current.profiles,
          lexicons: targetProfile ? (current.lexicons || {}) : {
            ...(current.lexicons || {}),
            [job.sourceLanguage]: mergeDictionaryEntries(
              current.lexicons?.[job.sourceLanguage],
              entries,
            ),
          },
          pdfJobs: current.pdfJobs.map((item) => item.id === job.id ? {
            ...item,
            status: "dictionary-imported",
            importedEntryCount: entries.length,
            normalizationChanges: normalization.changedFields,
            normalizationPacks: normalization.packs,
          } : item),
        };
      });
      showToast(`已导入 ${entries.length} 条词典记录${normalization.changedFields
        ? `，规范化 ${normalization.changedFields} 个字段`
        : ""}，并保留扫描页码`);
    } catch (error) {
      showToast(error?.message || "无法导入词典识别结果");
    } finally {
      if (dictionaryResultInputRef.current) dictionaryResultInputRef.current.value = "";
    }
  };

  const queueGrammar = () => {
    const language = languageOptions.find((item) => item.id === grammarDraft.language);
    const sourceJob = grammarPdfJobs.find((item) => item.id === grammarDraft.sourceJobId);
    if (grammarDraft.mode === "pdf" && !sourceJob) {
      showToast("请先选择一份语法 PDF 任务");
      return;
    }
    if (grammarDraft.mode === "pdf" && !storedPdfIds.has(sourceJob.id)) {
      showToast("所选语法 PDF 的本地文件已缺失");
      return;
    }
    const title = grammarDraft.title.trim() || `${language?.name || "目标语言"}语法参考`;
    const job = {
      id: `grammar-${Date.now()}`,
      title,
      language: grammarDraft.language,
      mode: grammarDraft.mode,
      sourceJobId: sourceJob?.id || null,
      scope: grammarDraft.scope.trim(),
      status: "waiting-model",
      meta: grammarDraft.mode === "pdf"
        ? `${language?.name || "目标语言"} · 基于《${sourceJob.title}》`
        : `${language?.name || "目标语言"} · 大模型起草`,
      createdAt: new Date().toISOString(),
    };
    setWorkspace((current) => ({
      ...current,
      grammarJobs: [job, ...current.grammarJobs],
    }));
    setGrammarDraft((current) => ({ ...current, title: "" }));
    showToast("语法参考任务已加入队列");
  };

  const storeAnalysisPipeline = (nextPipeline) => {
    setWorkspace((current) => ({
      ...current,
      analysisPipelines: {
        ...(current.analysisPipelines || {}),
        [analysisLanguageId]: normalizeAnalysisPipeline(nextPipeline, analysisProfile),
      },
    }));
  };

  const toggleAnalysisEngine = (engineId) => {
    if (engineId === "local-rules") return;
    storeAnalysisPipeline({
      ...analysisPipeline,
      engines: analysisPipeline.engines.map((engine) => (
        engine.id === engineId ? { ...engine, enabled: !engine.enabled } : engine
      )),
      updatedAt: new Date().toISOString(),
    });
  };

  const moveEngine = (engineId, offset) => {
    storeAnalysisPipeline(
      moveAnalysisEngine(analysisPipeline, engineId, offset, analysisProfile),
    );
  };

  const importCorpus = async () => {
    if (!corpusDraft.file) {
      showToast("请选择 CoNLL-U 语料文件");
      return;
    }
    setCorpusPhase({ status: "working", message: "正在逐句写入本地语料库…" });
    try {
      const metadata = await importConlluCorpus(corpusDraft.file, {
        id: `corpus-${Date.now()}`,
        title: corpusDraft.title.trim()
          || corpusDraft.file.name.replace(/\.(?:conllu|conll|txt)$/iu, ""),
        languageId: analysisLanguageId,
        languageCode: analysisLanguage?.code || analysisProfile?.code || "",
        sourceUrl: corpusDraft.sourceUrl,
        license: corpusDraft.license,
        acknowledgement: corpusDraft.acknowledgement,
        normalizationPacks: (workspace.analysisRulePacks || [])
          .filter((pack) => pack.enabled !== false),
      }, {
        onProgress: ({ current, total, sentenceCount }) => {
          setCorpusPhase({
            status: "working",
            message: `正在导入 ${Math.round((current / Math.max(total, 1)) * 100)}% · ${sentenceCount.toLocaleString()} 句`,
          });
        },
      });
      setWorkspace((current) => ({
        ...current,
        corpora: [
          metadata,
          ...(current.corpora || []).filter((corpus) => corpus.id !== metadata.id),
        ],
      }));
      setCorpusDraft({
        file: null,
        title: "",
        sourceUrl: "",
        license: "",
        acknowledgement: "",
      });
      if (corpusInputRef.current) corpusInputRef.current.value = "";
      setCorpusPhase({
        status: "done",
        message: `已导入 ${metadata.sentenceCount.toLocaleString()} 句 · ${metadata.tokenCount.toLocaleString()} 词项${
          metadata.normalizationChanges
            ? ` · 规范化 ${metadata.normalizationChanges.toLocaleString()} 处`
            : ""
        }`,
      });
      showToast(`${metadata.title}已加入本地分析管线`);
    } catch (error) {
      setCorpusPhase({ status: "error", message: error?.message || "语料库无法导入" });
      showToast(error?.message || "语料库无法导入");
    }
  };

  const removeCorpus = async (corpus) => {
    if (!window.confirm(`从本设备移除语料库“${corpus.title}”及其逐句标注？`)) return;
    try {
      await deleteCorpus(corpus.id);
      setWorkspace((current) => ({
        ...current,
        corpora: (current.corpora || []).filter((item) => item.id !== corpus.id),
        analysisPipelines: Object.fromEntries(
          Object.entries(current.analysisPipelines || {}).map(([language, pipeline]) => [
            language,
            {
              ...pipeline,
              engines: pipeline.engines.map((engine) => ({
                ...engine,
                corpusIds: (engine.corpusIds || []).filter((id) => id !== corpus.id),
              })),
            },
          ]),
        ),
      }));
      showToast("本地语料库已移除");
    } catch (error) {
      showToast(error?.message || "无法移除本地语料库");
    }
  };

  const saveDslPack = () => {
    if (!analysisDslValidation.valid) {
      showToast(`DSL 第 ${analysisDslValidation.errors[0]?.line || 1} 行需要修正`);
      return;
    }
    const now = new Date().toISOString();
    const pack = {
      id: dslEditingId || `rule-pack-${Date.now()}`,
      name: dslDraft.name.trim() || "未命名规则包",
      source: dslDraft.source,
      language: analysisDslValidation.program.language,
      enabled: true,
      ruleCount: analysisDslValidation.program.rules.length,
      segmentCount: analysisDslValidation.program.segments.length,
      replacementCount: analysisDslValidation.program.replacements.length,
      updatedAt: now,
    };
    setWorkspace((current) => {
      const existing = (current.analysisRulePacks || []).some((item) => item.id === pack.id);
      return {
        ...current,
        analysisRulePacks: existing
          ? current.analysisRulePacks.map((item) => item.id === pack.id
            ? { ...pack, enabled: item.enabled }
            : item)
          : [pack, ...(current.analysisRulePacks || [])],
      };
    });
    setDslEditingId("");
    setDslDraft({ name: "本地分析修正规则", source: analysisDslTemplate });
    showToast(dslEditingId ? "DSL 规则包已更新" : "DSL 规则包已启用");
  };

  const editDslPack = (pack) => {
    setDslEditingId(pack.id);
    setDslDraft({ name: pack.name, source: pack.source });
  };

  const toggleDslPack = (packId) => {
    setWorkspace((current) => ({
      ...current,
      analysisRulePacks: (current.analysisRulePacks || []).map((pack) => (
        pack.id === packId ? { ...pack, enabled: !pack.enabled } : pack
      )),
    }));
  };

  const removeDslPack = (packId) => {
    setWorkspace((current) => ({
      ...current,
      analysisRulePacks: (current.analysisRulePacks || []).filter((pack) => pack.id !== packId),
    }));
    if (dslEditingId === packId) {
      setDslEditingId("");
      setDslDraft({ name: "本地分析修正规则", source: analysisDslTemplate });
    }
    showToast("DSL 规则包已移除");
  };

  return (
    <main className="workspace-page language-workspace">
      <header className="workspace-heading language-workspace-heading">
        <div>
          <span className="eyebrow">Language Workspace</span>
          <h1>语言工作台</h1>
          <p>从开放数据库初始化语言，整理词典与本地书库，并管理 PDF、语法参考和个人数据库。</p>
        </div>
        <div className="workspace-status-line">
          <button className={`workspace-model-status ${modelConnection.tested ? "connected" : ""}`} onClick={onOpenModelSettings}>
            {modelStatus}
          </button>
        </div>
      </header>

      <div className="workspace-toolbar language-workspace-tabs">
        <div className="library-filters" role="tablist" aria-label="语言工作台栏目">
          {languageWorkspaceTabs.map(({ id, label }) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              role="tab"
              aria-selected={tab === id}
            >
              {label}
            </button>
          ))}
        </div>
        <button className="model-connection-note" onClick={onOpenModelSettings}>
          {modelConnection.configured ? `${modelConnection.model} · 模型设置` : "模型设置"}
        </button>
      </div>

      {tab === "initialize" && (
        <section className="language-initialize-layout">
          <aside className="language-registry">
            <div className="workspace-section-head">
              <strong>已初始化语言</strong>
            </div>
            <div className="language-registry-list">
              {builtInWorkspaceLanguages.map((item) => (
                <div key={item.id}>
                  <span><strong>{item.name}</strong><small>{item.code} · 内置</small></span>
                  <em>可用</em>
                </div>
              ))}
              {workspace.profiles.map((profile) => (
                <div key={profile.id}>
                  <span>
                    <strong>{profile.name}</strong>
                    <small>
                      {profile.code} · {segmentationStrategies.find((item) => item.id === profile.segmentation.strategy)?.label}
                      {profile.resources?.length ? ` · ${profile.resources.length} 个来源` : ""}
                    </small>
                  </span>
                  <button onClick={() => onOpenLab(profile.id)}>测试</button>
                </div>
              ))}
            </div>
          </aside>

          <div className="language-wizard">
            <div className="wizard-progress" aria-label={`语言初始化第 ${step} 步`}>
              {["识别语言", "选择数据", "分词系统", "验证保存"].map((label, index) => (
                <span className={step === index + 1 ? "active" : step > index + 1 ? "done" : ""} key={label}>
                  <i>{index + 1}</i>{label}
                </span>
              ))}
            </div>

            {step === 1 && (
              <div className="workspace-form">
                <label>
                  <span>语言名称</span>
                  <input
                    value={draft.name}
                    onChange={(event) => updateLanguageIdentity({ name: event.target.value })}
                    placeholder="例如：阿伊努语"
                    aria-invalid={errors.name ? "true" : "false"}
                  />
                  {errors.name && <small>{errors.name}</small>}
                </label>
                <label>
                  <span>语言代码</span>
                  <input
                    value={draft.code}
                    onChange={(event) => updateLanguageIdentity({ code: event.target.value })}
                    placeholder="BCP 47，例如 ain"
                    aria-invalid={errors.code ? "true" : "false"}
                  />
                  {errors.code && <small>{errors.code}</small>}
                </label>
                <label>
                  <span>文字系统</span>
                  <input
                    value={draft.script}
                    onChange={(event) => setDraft({ ...draft, script: event.target.value })}
                    placeholder="例如：Latin / Kana"
                  />
                </label>
                <label>
                  <span>书写方向</span>
                  <select value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value })}>
                    <option value="ltr">从左到右</option>
                    <option value="rtl">从右到左</option>
                  </select>
                </label>
                <div className="resource-discovery-action workspace-form-wide">
                  <button
                    type="button"
                    onClick={() => void discoverLanguageResources()}
                    disabled={resourcePhase.status === "loading"}
                  >
                    <Icon name="search" size={14} />
                    {resourcePhase.status === "loading" ? "正在检索数据库…" : "自动查找语言与数据资源"}
                  </button>
                  <span>
                    {resourcePhase.status === "ready" && `已匹配标准目录 · ${resourcePhase.count} 个候选来源`}
                    {resourcePhase.status === "candidate" && `未找到预设语言 · 已生成 ${resourcePhase.count} 个通用候选`}
                    {resourcePhase.status === "error" && (resourcePhase.message || "资源目录无法读取")}
                    {resourcePhase.status === "idle" && "输入代码后可自动补齐名称、文字、方向、分词策略和数据来源。"}
                  </span>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="resource-selection">
                <div className="resolved-language-line">
                  <span>
                    <strong>{draft.name}</strong>
                    <small>
                      {draft.identity.iso6393 || draft.code}
                      {draft.identity.glottocode ? ` · ${draft.identity.glottocode}` : " · Glottocode 待同步"}
                      {draft.identity.glottologName ? ` · ${draft.identity.glottologName}` : ""}
                    </small>
                  </span>
                  <span>{draft.script || "文字待确认"} · {draft.direction === "rtl" ? "从右到左" : "从左到右"}</span>
                </div>
                <div className="resource-selection-list" aria-label="初始化数据来源">
                  {draft.resources.map((resource) => (
                    <label key={resource.id} className={resource.selected ? "selected" : ""}>
                      <input
                        type="checkbox"
                        checked={resource.selected}
                        onChange={(event) => setDraft((current) => ({
                          ...current,
                          resources: current.resources.map((item) => (
                            item.id === resource.id ? { ...item, selected: event.target.checked } : item
                          )),
                        }))}
                      />
                      <span>
                        <strong>{resource.name}</strong>
                        <small>{resource.category} · {resource.version} · {resource.license}</small>
                      </span>
                      <em className={resource.status}>
                        {resource.status === "available" ? "目录匹配" : "待在线核验"}
                      </em>
                      <a href={resource.url} target="_blank" rel="noreferrer" aria-label={`打开 ${resource.name}`}>来源</a>
                    </label>
                  ))}
                </div>
                <p className="resource-selection-note">
                  保存的是版本、授权和来源清单，不会在浏览器中直接下载大型数据。
                  <a href="/sources">查看全部数据库与致谢</a>
                </p>
              </div>
            )}

            {step === 3 && (
              <div className="segmentation-setup">
                <div className="segmentation-options" role="radiogroup" aria-label="分词策略">
                  {segmentationStrategies.map((item) => (
                    <label className={draft.strategy === item.id ? "active" : ""} key={item.id}>
                      <input
                        type="radio"
                        name="segmentation-strategy"
                        value={item.id}
                        checked={draft.strategy === item.id}
                        onChange={() => setDraft({ ...draft, strategy: item.id })}
                      />
                      <span><strong>{item.label}</strong><small>{item.description}</small></span>
                    </label>
                  ))}
                </div>
                {draft.strategy === "delimiter" && (
                  <label className="workspace-inline-field">
                    <span>定界符</span>
                    <input value={draft.delimiter} onChange={(event) => setDraft({ ...draft, delimiter: event.target.value })} />
                    {errors.delimiter && <small>{errors.delimiter}</small>}
                  </label>
                )}
                <div className={`wiktionary-seed-action ${lexiconSeedPhase.status}`}>
                  <span>
                    <strong>Wiktionary 种子词表</strong>
                    <small>
                      {lexiconSeedPhase.message || "进入本步骤时默认拉取 24 条带释义词目；分析时仍会查询未收录词。"}
                    </small>
                  </span>
                  {lexiconSeedPhase.sourceUrl && (
                    <a href={lexiconSeedPhase.sourceUrl} target="_blank" rel="noreferrer">分类来源</a>
                  )}
                  <button
                    type="button"
                    onClick={() => void pullWiktionarySeed()}
                    disabled={lexiconSeedPhase.status === "loading"}
                  >
                    {lexiconSeedPhase.status === "loading" ? "正在拉取…" : "重新拉取"}
                  </button>
                </div>
                <div className={`wiktionary-seed-action grammar-seed-action ${grammarSeedPhase.status}`}>
                  <span>
                    <strong>Grambank 描述语法</strong>
                    <small>
                      {grammarSeedPhase.message || "按 Glottocode 汇总格、数、性、时体、语序、一致和否定等核心规则。"}
                    </small>
                  </span>
                  {grammarSeedPhase.sourceUrl && (
                    <a href={grammarSeedPhase.sourceUrl} target="_blank" rel="noreferrer">语法来源</a>
                  )}
                  <button
                    type="button"
                    onClick={() => void pullGrammarReference()}
                    disabled={grammarSeedPhase.status === "loading"}
                  >
                    {grammarSeedPhase.status === "loading" ? "正在整理…" : "重新整理"}
                  </button>
                </div>
                <label className="workspace-text-field">
                  <span>初始化词表 <i>每行：词形 ⇥ 词元 ⇥ 词性 ⇥ 释义</i></span>
                  <textarea
                    value={draft.lexiconText}
                    onChange={(event) => setDraft({ ...draft, lexiconText: event.target.value })}
                    placeholder={"可选；最长匹配策略需要词表\nword\tlemma\tN\t释义"}
                  />
                  {errors.lexicon && <small>{errors.lexicon}</small>}
                </label>
              </div>
            )}

            {step === 4 && (
              <div className="language-validation">
                <label className="workspace-text-field">
                  <span>分词样例</span>
                  <textarea
                    dir={draft.direction}
                    value={draft.sample}
                    onChange={(event) => setDraft({ ...draft, sample: event.target.value })}
                    placeholder="粘贴一小段该语言文本…"
                    aria-invalid={errors.sample ? "true" : "false"}
                  />
                  {errors.sample && <small>{errors.sample}</small>}
                </label>
                <div className="tokenization-preview" dir={draft.direction}>
                  {previewTokens.length ? previewTokens.map((form, index) => (
                    <span key={`${form}-${index}`}><i>{index + 1}</i>{form}</span>
                  )) : <em>输入样例后在此检查初始分词</em>}
                </div>
                <dl className="language-manifest-summary">
                  <div><dt>语言身份</dt><dd>{draft.identity.iso6393 || draft.code}{draft.identity.glottocode ? ` · ${draft.identity.glottocode}` : ""}</dd></div>
                  <div><dt>文字系统</dt><dd>{draft.script || "未指定"} · {draft.direction.toUpperCase()}</dd></div>
                  <div><dt>分词</dt><dd>{segmentationStrategies.find((item) => item.id === draft.strategy)?.label} · {draft.segmentationSource}</dd></div>
                  <div><dt>数据来源</dt><dd>{draft.resources.filter((resource) => resource.selected).map((resource) => resource.name).join(" · ") || "未选择"}</dd></div>
                  <div>
                    <dt>语法概况</dt>
                    <dd>
                      {draft.grammarReference
                        ? `${draft.grammarReference.provider} · ${draft.grammarReference.rules.length} 条核心规则`
                        : "尚未建立"}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="wizard-actions">
              <button disabled={step === 1} onClick={() => { setErrors({}); setStep((current) => current - 1); }}>上一步</button>
              {step < 4
                ? <button className="primary-action" onClick={() => void advanceLanguageWizard()}>
                  {step === 1 && !draft.resources.length ? "查找并继续" : "下一步"}<Icon name="arrowRight" size={14} />
                </button>
                : <button className="primary-action" onClick={saveLanguage}><Icon name="check" size={14} />保存并初始化</button>}
            </div>
          </div>
        </section>
      )}

      {tab === "dictionaries" && (
        <section className="dictionary-workspace">
          <div className="dictionary-import-panel">
            <div className="workspace-section-head">
              <strong>导入并整理文本</strong>
              <span>所有解析均在当前浏览器完成</span>
            </div>
            <div className="workspace-form">
              <label>
                <span>导入到</span>
                <select
                  value={dictionaryDraft.destination}
                  onChange={(event) => setDictionaryDraft({
                    ...dictionaryDraft,
                    destination: event.target.value,
                  })}
                >
                  <option value="lexicon">词库 · 用于词法查询</option>
                  <option value="library">书库 · 用于逐段阅读</option>
                </select>
              </label>
              <label>
                <span>{dictionaryDraft.destination === "library" ? "正文语言" : "词库语言"}</span>
                <select
                  value={dictionaryDraft.language}
                  onChange={(event) => setDictionaryDraft({ ...dictionaryDraft, language: event.target.value })}
                >
                  {languageOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                <span>{dictionaryDraft.destination === "library" ? "作品标题" : "词典标题"}</span>
                <input
                  value={dictionaryDraft.title}
                  onChange={(event) => setDictionaryDraft({ ...dictionaryDraft, title: event.target.value })}
                  placeholder="留空则使用文件或词典标题"
                />
              </label>
              {dictionaryDraft.destination === "library" && (
                <label>
                  <span>作者 / 版本</span>
                  <input
                    value={dictionaryDraft.author}
                    onChange={(event) => setDictionaryDraft({ ...dictionaryDraft, author: event.target.value })}
                    placeholder="例如 Homer · Loeb"
                  />
                </label>
              )}
              <label>
                <span>{dictionaryDraft.destination === "library" ? "段落上限" : "整理上限"}</span>
                <select
                  value={dictionaryDraft.maxEntries}
                  onChange={(event) => setDictionaryDraft({ ...dictionaryDraft, maxEntries: Number(event.target.value) })}
                >
                  <option value={1000}>1,000 条</option>
                  <option value={2000}>2,000 条</option>
                  <option value={5000}>5,000 条</option>
                  <option value={10000}>10,000 条</option>
                  <option value={50000}>50,000 条</option>
                  <option value={200000}>200,000 条</option>
                </select>
              </label>
              {dictionaryDraft.destination === "lexicon" && (
                <label>
                  <span>写入方式</span>
                  <select
                    value={dictionaryDraft.mergeMode}
                    onChange={(event) => setDictionaryDraft({ ...dictionaryDraft, mergeMode: event.target.value })}
                  >
                    <option value="merge">合并同形词与义项</option>
                    <option value="replace">替换当前语言词库</option>
                  </select>
                </label>
              )}
            </div>
            <button className="dictionary-file-picker" onClick={() => dictionaryArchiveInputRef.current?.click()}>
              <Icon name="upload" size={18} />
              <span>
                <strong>
                  {dictionaryDraft.files.length
                    ? dictionaryDraft.files.map((file) => file.name).join(" · ")
                    : dictionaryDraft.destination === "library" ? "选择 MDX / 文本书库" : "选择词典文件"}
                </strong>
                <small>
                  {dictionaryDraft.files.length
                    ? `${dictionaryFormatFromFiles(dictionaryDraft.files).toUpperCase()} · ${dictionaryDraft.files.length} 个文件`
                    : "MDX/MDD、StarDict、JSON、CSV/TSV、DSL、TEI、LIFT、XDXF"}
                </small>
              </span>
            </button>
            <input
              ref={dictionaryArchiveInputRef}
              className="visually-hidden"
              type="file"
              multiple
              accept=".mdx,.mdd,.ifo,.idx,.gz,.dict,.dz,.json,.csv,.tsv,.tab,.txt,.dsl,.tei,.xml,.lift,.xdxf"
              aria-label="选择离线词典文件"
              onChange={(event) => {
                const files = Array.from(event.target.files || []);
                setDictionaryDraft({ ...dictionaryDraft, files });
                setDictionaryPhase({ status: "idle" });
              }}
            />
            <div className={`dictionary-import-status ${dictionaryPhase.status}`} role="status">
              <span>
                {dictionaryPhase.status === "idle"
                  ? dictionaryDraft.destination === "library"
                    ? "MDX 的索引词作为段落编号，条目正文作为可阅读文本；适合 Loeb 等按条目整理的 MDX。"
                    : "MDX 可同时选择同名 MDD；StarDict 请同时选择 IFO、IDX 与 DICT 文件。"
                  : dictionaryPhase.message}
              </span>
              <button
                className="primary-action"
                onClick={() => void importDictionaryArchive()}
                disabled={dictionaryPhase.status === "working"}
              >
                {dictionaryPhase.status === "working"
                  ? "正在解析与整理…"
                  : dictionaryDraft.destination === "library" ? "导入书库" : "解析并导入"}
              </button>
            </div>
            <p className="dictionary-license-note">
              文件不会上传。请只导入有权使用的材料；MDX/MDD 中的脚本和样式不会执行，正文会转为纯文本并写入本地数据库。
            </p>
            <div className="pronunciation-source-strip">
              <span>
                <strong>世界发音</strong>
                <small>阅读器已自动查询 Wiktionary IPA、Wikimedia Commons 与 Lingua Libre 录音</small>
              </span>
              <a href="https://api.forvo.com/documentation/" target="_blank" rel="noreferrer">Forvo · 可选密钥源</a>
              <a href="/sources">来源与许可</a>
            </div>
          </div>

          <aside className="dictionary-organizer">
            <div className="workspace-section-head">
              <strong>词条预览</strong>
              <span>{dictionaryPreview.length || 0}</span>
            </div>
            <label className="dictionary-preview-search">
              <Icon name="search" size={14} />
              <input
                value={dictionarySearch}
                onChange={(event) => setDictionarySearch(event.target.value)}
                placeholder="筛选刚导入的词条…"
              />
            </label>
            <div className="dictionary-preview-list">
              {visibleDictionaryPreview.map((entry) => (
                <div key={`${entry.form}-${entry.lemma}`}>
                  <span title={entry.originalForm ? `录入原值：${entry.originalForm}` : ""}>
                    <strong>{entry.form}</strong>
                    <small>{entry.lemma}{entry.pos ? ` · ${entry.pos}` : ""}</small>
                  </span>
                  <p>{entry.gloss || "尚无纯文本释义"}</p>
                </div>
              ))}
              {!visibleDictionaryPreview.length && (
                <p className="workspace-empty-row">导入后在此检查格式化结果</p>
              )}
            </div>
          </aside>

          <section className="dictionary-import-history">
            <div className="workspace-section-head">
              <strong>导入记录</strong>
              <span>{(workspace.dictionaryImports?.length || 0) + (workspace.libraryImports?.length || 0)}</span>
            </div>
            {(workspace.dictionaryImports || []).length || (workspace.libraryImports || []).length ? (
              <div className="dictionary-history-list">
                {[
                  ...(workspace.libraryImports || []).map((item) => ({
                    ...item,
                    destinationLabel: "书库",
                    entryCount: item.passageCount,
                    language: item.languageId,
                    languageName: item.languageName,
                  })),
                  ...(workspace.dictionaryImports || []).map((item) => ({
                    ...item,
                    destinationLabel: "词库",
                  })),
                ].sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt))).map((item) => (
                  <div key={item.id}>
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.destinationLabel} · {item.languageName} · {item.format.toUpperCase()} · {item.fileNames.join(" · ")}</small>
                    </span>
                    <em>
                      {item.entryCount} 条
                      {item.truncated ? " · 已按上限截取" : ""}
                    </em>
                  </div>
                ))}
              </div>
            ) : <p className="workspace-empty-row">尚未导入离线词典或书库文本</p>}
          </section>
        </section>
      )}

      {tab === "analysis" && (
        <section className="analysis-pipeline-workspace">
          <div className="analysis-pipeline-toolbar">
            <label>
              <span>配置语言</span>
              <select
                value={analysisLanguageId}
                onChange={(event) => {
                  setAnalysisLanguageId(event.target.value);
                  setCorpusPhase({ status: "idle", message: "" });
                }}
              >
                {languageOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.name} · {item.code}</option>
                ))}
              </select>
            </label>
            <span>
              {analysisPipeline.engines.filter((engine) => engine.enabled).length} 个启用引擎
              · {languageCorpora.length} 个本地语料库
              · {(workspace.analysisRulePacks || []).filter((pack) => pack.enabled).length} 个 DSL 规则包
            </span>
          </div>

          <div className="analysis-pipeline-grid">
            <section className="analysis-engine-panel">
              <div className="workspace-section-head">
                <strong>引擎顺序</strong>
                <span>命中即停止</span>
              </div>
              <div className="analysis-engine-list">
                {analysisPipeline.engines.map((engine, index) => {
                  const descriptor = analysisEngineDescriptor(engine.id);
                  return (
                    <div className={`analysis-engine-row ${engine.enabled ? "enabled" : ""}`} key={engine.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={engine.enabled}
                          disabled={engine.id === "local-rules"}
                          onChange={() => toggleAnalysisEngine(engine.id)}
                        />
                        <span>
                          <strong>{descriptor?.name || engine.id}</strong>
                          <small>
                            {descriptor?.execution} · {(descriptor?.capabilities || []).join(" / ")}
                            {engine.id === "llm" && !modelConnection.configured ? " · 尚未配置终点" : ""}
                          </small>
                        </span>
                      </label>
                      <div>
                        <button
                          aria-label={`上移${descriptor?.name || engine.id}`}
                          disabled={index === 0}
                          onClick={() => moveEngine(engine.id, -1)}
                        >↑</button>
                        <button
                          aria-label={`下移${descriptor?.name || engine.id}`}
                          disabled={index === analysisPipeline.engines.length - 1}
                          onClick={() => moveEngine(engine.id, 1)}
                        >↓</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="analysis-pipeline-note">
                本地规则始终保留为最后的诚实回退；没有句法证据时只给出分词，不绘制推测语法树。
              </p>
            </section>

            <section className="corpus-import-panel">
              <div className="workspace-section-head">
                <strong>CoNLL-U 语料库</strong>
                <span>逐句本地索引 · 上限 1 GB</span>
              </div>
              <div className="corpus-metadata-form">
                <label>
                  <span>名称</span>
                  <input
                    value={corpusDraft.title}
                    onChange={(event) => setCorpusDraft({ ...corpusDraft, title: event.target.value })}
                    placeholder="留空使用文件名"
                  />
                </label>
                <label>
                  <span>许可</span>
                  <input
                    value={corpusDraft.license}
                    onChange={(event) => setCorpusDraft({ ...corpusDraft, license: event.target.value })}
                    placeholder="例如 CC BY-SA 4.0"
                  />
                </label>
                <label>
                  <span>来源链接</span>
                  <input
                    value={corpusDraft.sourceUrl}
                    onChange={(event) => setCorpusDraft({ ...corpusDraft, sourceUrl: event.target.value })}
                    placeholder="https://…"
                  />
                </label>
                <label>
                  <span>Acknowledgement</span>
                  <input
                    value={corpusDraft.acknowledgement}
                    onChange={(event) => setCorpusDraft({ ...corpusDraft, acknowledgement: event.target.value })}
                    placeholder="项目、作者与树库名称"
                  />
                </label>
              </div>
              <div className="corpus-file-row">
                <button onClick={() => corpusInputRef.current?.click()}>
                  <Icon name="upload" size={15} />
                  {corpusDraft.file ? corpusDraft.file.name : "选择 .conllu 文件"}
                </button>
                <input
                  ref={corpusInputRef}
                  className="visually-hidden"
                  type="file"
                  accept=".conllu,.conll,.txt,text/plain"
                  aria-label="选择 CoNLL-U 语料文件"
                  onChange={(event) => {
                    setCorpusDraft({ ...corpusDraft, file: event.target.files?.[0] || null });
                    setCorpusPhase({ status: "idle", message: "" });
                  }}
                />
                <button
                  className="primary-action"
                  disabled={corpusPhase.status === "working"}
                  onClick={() => void importCorpus()}
                >
                  {corpusPhase.status === "working" ? "正在导入…" : "导入并启用"}
                </button>
              </div>
              {corpusPhase.message && (
                <p className={`corpus-import-status ${corpusPhase.status}`} role="status">
                  {corpusPhase.message}
                </p>
              )}
              <div className="corpus-list">
                {languageCorpora.map((corpus) => (
                  <div key={corpus.id}>
                    <span>
                      <strong>{corpus.title}</strong>
                      <small>
                        {corpus.sentenceCount.toLocaleString()} 句 · {corpus.tokenCount.toLocaleString()} 词项
                        {corpus.replacementCount
                          ? ` · ${corpus.replacementCount} 条录入替换`
                          : ""}
                        {corpus.normalizationChanges
                          ? ` · 已整理 ${corpus.normalizationChanges.toLocaleString()} 处`
                          : ""}
                        · {corpus.license}
                      </small>
                    </span>
                    <button onClick={() => void removeCorpus(corpus)}>移除</button>
                  </div>
                ))}
                {!languageCorpora.length && (
                  <p className="workspace-empty-row">该语言尚无本地 UD 语料；导入后按原始句子精确匹配。</p>
                )}
              </div>
            </section>
          </div>

          <section className="analysis-dsl-panel">
            <div className="analysis-dsl-editor">
              <div className="workspace-section-head">
                <strong>分析 DSL</strong>
                <span className={analysisDslValidation.valid ? "valid" : "invalid"}>
                  {analysisDslValidation.valid
                    ? `${analysisDslValidation.program.rules.length} 条规则 · ${analysisDslValidation.program.replacements.length} 条替换 · 可保存`
                    : `${analysisDslValidation.errors.length} 处需要修正`}
                </span>
              </div>
              <label className="dsl-name-field">
                <span>规则包名称</span>
                <input
                  value={dslDraft.name}
                  onChange={(event) => setDslDraft({ ...dslDraft, name: event.target.value })}
                />
              </label>
              <textarea
                className="analysis-dsl-source"
                value={dslDraft.source}
                onChange={(event) => setDslDraft({ ...dslDraft, source: event.target.value })}
                spellCheck="false"
                aria-label="分析 DSL 源码"
              />
              {!analysisDslValidation.valid && (
                <ul className="dsl-diagnostics">
                  {analysisDslValidation.errors.slice(0, 5).map((error, index) => (
                    <li key={`${error.line}-${error.code}-${index}`}>第 {error.line} 行 · {error.message}</li>
                  ))}
                </ul>
              )}
              <div className="dsl-editor-actions">
                <details>
                  <summary>指令速查</summary>
                  <p>language · replace · segment · rule / when · set · add/remove tags · head · confidence · stop · end</p>
                </details>
                {dslEditingId && (
                  <button onClick={() => {
                    setDslEditingId("");
                    setDslDraft({ name: "本地分析修正规则", source: analysisDslTemplate });
                  }}>取消编辑</button>
                )}
                <button
                  className="primary-action"
                  disabled={!analysisDslValidation.valid}
                  onClick={saveDslPack}
                >
                  {dslEditingId ? "更新规则包" : "保存并启用"}
                </button>
              </div>
            </div>
            <aside className="analysis-rule-pack-list">
              <div className="workspace-section-head">
                <strong>规则包</strong>
                <span>{workspace.analysisRulePacks?.length || 0}</span>
              </div>
              {(workspace.analysisRulePacks || []).map((pack) => (
                <div className={pack.enabled ? "enabled" : ""} key={pack.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={pack.enabled}
                      onChange={() => toggleDslPack(pack.id)}
                    />
                    <span>
                      <strong>{pack.name}</strong>
                      <small>{pack.language} · {pack.replacementCount || 0} 条替换 · {pack.ruleCount} 条规则 · {pack.segmentCount} 条分词预处理</small>
                    </span>
                  </label>
                  <span>
                    <button onClick={() => editDslPack(pack)}>编辑</button>
                    <button onClick={() => removeDslPack(pack.id)}>移除</button>
                  </span>
                </div>
              ))}
              {!(workspace.analysisRulePacks || []).length && (
                <p className="workspace-empty-row">保存规则包后，它会在引擎前后自动执行。</p>
              )}
            </aside>
          </section>
        </section>
      )}

      {tab === "database" && (
        <section className="local-database-workspace">
          <div className="local-database-intro">
            <div>
              <span className="eyebrow">Device-local persistence</span>
              <h2>个人本地数据库</h2>
              <p>统一保存词典、MDX 书库正文、UD 语料、DSL、PDF、语言配置、笔记、收藏与模型终点。会话 API 密钥不会进入备份。</p>
            </div>
            <dl>
              <div><dt>词典</dt><dd>{workspace.dictionaryImports?.length || 0}</dd></div>
              <div><dt>本地作品</dt><dd>{workspace.libraryImports?.length || 0}</dd></div>
              <div><dt>UD 语料</dt><dd>{workspace.corpora?.length || 0}</dd></div>
              <div><dt>DSL</dt><dd>{workspace.analysisRulePacks?.length || 0}</dd></div>
              <div><dt>PDF</dt><dd>{workspace.pdfJobs?.length || 0}</dd></div>
            </dl>
          </div>

          <div className="local-database-actions">
            <section>
              <div className="workspace-section-head">
                <strong>导出完整备份</strong>
                <span>.linguadb</span>
              </div>
              <p>支持直接流式写入文件；浏览器不支持文件流时自动使用兼容下载。</p>
              <button className="primary-action" onClick={() => void exportDatabase()} disabled={databasePhase.status === "working"}>
                <Icon name="download" size={16} />导出本地数据库
              </button>
            </section>

            <section>
              <div className="workspace-section-head">
                <strong>恢复本地数据库</strong>
                <span>同 ID 数据会覆盖</span>
              </div>
              <button className="local-database-picker" onClick={() => localDatabaseInputRef.current?.click()}>
                <Icon name="upload" size={17} />
                <span>
                  <strong>{databaseDraft.file?.name || "选择 .linguadb 文件"}</strong>
                  <small>{databaseDraft.file ? readableFileSize(databaseDraft.file.size) : "导入前会先验证文件清单与版本"}</small>
                </span>
              </button>
              <input
                ref={localDatabaseInputRef}
                className="visually-hidden"
                type="file"
                accept=".linguadb,application/octet-stream"
                aria-label="选择 Lingua 本地数据库"
                onChange={(event) => void chooseDatabaseFile(event.target.files?.[0])}
              />
              <button onClick={() => void restoreDatabase()} disabled={!databaseDraft.file || databasePhase.status === "working"}>
                恢复备份
              </button>
            </section>
          </div>

          <div className={`dictionary-import-status ${databasePhase.status}`} role="status">
            <span>{databasePhase.message || "正文和大型文件保存在浏览器 IndexedDB；建议定期导出独立备份。"}</span>
            {databasePhase.status === "restored" && (
              <button className="primary-action" onClick={() => window.location.reload()}>重新载入</button>
            )}
          </div>

          <div className="local-storage-persistence">
            <span>
              <strong>浏览器持久存储</strong>
              <small>
                {storageState.status === "done"
                  ? storageState.supported
                    ? `${storageState.persisted ? "已授予" : "未授予"} · 已用 ${readableFileSize(storageState.usage)} / ${readableFileSize(storageState.quota)}`
                    : "当前浏览器不提供持久存储接口"
                  : "请求后，浏览器会尽量避免在空间不足时自动清理这些本地数据。"}
              </small>
            </span>
            <button onClick={() => void enablePersistentStorage()} disabled={storageState.status === "working"}>
              {storageState.status === "working" ? "正在检查…" : "启用持久存储"}
            </button>
          </div>
        </section>
      )}

      {tab === "pdf" && (
        <section className="material-workspace">
          <div className="material-form">
            <div className="workspace-section-head">
              <strong>新建 PDF 识别任务</strong>
              <span>保留页码与双语对齐关系</span>
            </div>
            <div className="workspace-form">
              <label>
                <span>材料类型</span>
                <select value={pdfDraft.kind} onChange={(event) => setPdfDraft({ ...pdfDraft, kind: event.target.value })}>
                  <option value="bilingual">双语对照材料</option>
                  <option value="grammar">语法学材料</option>
                  <option value="dictionary">扫描词典</option>
                </select>
              </label>
              <label>
                <span>材料标题</span>
                <input value={pdfDraft.title} onChange={(event) => setPdfDraft({ ...pdfDraft, title: event.target.value })} placeholder="留空则使用文件名" />
              </label>
              <label>
                <span>
                  {pdfDraft.kind === "bilingual"
                    ? "原文语言"
                    : pdfDraft.kind === "dictionary"
                      ? "词库语言"
                      : "语法所述语言"}
                </span>
                <select value={pdfDraft.sourceLanguage} onChange={(event) => setPdfDraft({ ...pdfDraft, sourceLanguage: event.target.value })}>
                  {languageOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </label>
              {pdfDraft.kind === "bilingual" && (
                <label>
                  <span>对译语言</span>
                  <select value={pdfDraft.targetLanguage} onChange={(event) => setPdfDraft({ ...pdfDraft, targetLanguage: event.target.value })}>
                    {languageOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                  </select>
                </label>
              )}
              <label>
                <span>页码范围</span>
                <input value={pdfDraft.pageRange} onChange={(event) => setPdfDraft({ ...pdfDraft, pageRange: event.target.value })} placeholder="例如 12–48；留空为全部" />
              </label>
            </div>
            <button className="pdf-file-picker" onClick={() => pdfInputRef.current?.click()}>
              <Icon name="upload" size={18} />
              <span>
                <strong>{pdfDraft.file?.name || "选择 PDF 文件"}</strong>
                <small>{pdfDraft.file ? readableFileSize(pdfDraft.file.size) : "页面图像与文本层将在识别时一起提交"}</small>
              </span>
            </button>
            <input
              ref={pdfInputRef}
              className="visually-hidden"
              type="file"
              accept=".pdf,application/pdf"
              aria-label="选择双语、语法或扫描词典 PDF"
              onChange={(event) => setPdfDraft({ ...pdfDraft, file: event.target.files?.[0] || null })}
            />
            <div className="material-actions">
              <span>
                {modelConnection.tested
                  ? "模型连接已通过；文件仍只在加入并启动任务时处理。"
                  : modelConnection.configured
                    ? "模型设置已保存；建议先完成连接测试。"
                    : "当前未配置模型；PDF 会保存在当前浏览器，不会上传。"}
              </span>
              <button className="primary-action" onClick={queuePdf} disabled={pdfQueuePhase === "saving"}>
                {pdfQueuePhase === "saving" ? "正在本地保存…" : "加入识别队列"}
              </button>
            </div>
          </div>
          <aside className="material-queue-panel">
            <div className="workspace-section-head"><strong>识别队列</strong><span>{workspace.pdfJobs.length}</span></div>
            <WorkspaceQueue
              items={workspace.pdfJobs}
              emptyLabel="尚无 PDF 任务"
              statusForItem={(item) => storedPdfIds.has(item.id)
                ? item.status === "dictionary-imported"
                  ? `已导入 ${item.importedEntryCount || 0} 条词目`
                  : item.kind === "dictionary"
                    ? "扫描件已就绪 · 等待词库识别"
                    : "文件已就绪 · 等待模型"
                : "本地文件缺失"}
              onRemove={removePdfJob}
            />
            {dictionaryPdfJobs.length > 0 && (
              <div className="dictionary-result-import">
                <span>词典识别结果</span>
                <select value={dictionaryResultJobId} onChange={(event) => setDictionaryResultJobId(event.target.value)}>
                  {dictionaryPdfJobs.map((job) => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
                <button onClick={() => dictionaryResultInputRef.current?.click()}>导入 JSON 到词库</button>
                <input
                  ref={dictionaryResultInputRef}
                  className="visually-hidden"
                  type="file"
                  accept=".json,application/json"
                  aria-label="选择词典识别结果 JSON"
                  onChange={(event) => void importDictionaryResult(event.target.files?.[0])}
                />
                <small>字段：form / lemma / pos / definitions / page / confidence</small>
              </div>
            )}
          </aside>
        </section>
      )}

      {tab === "grammar" && (
        <section className="material-workspace">
          <div className="material-form">
            <div className="workspace-section-head">
              <strong>新建语法参考</strong>
              <span>统一生成可检索的章节、规则与例句</span>
            </div>
            <div className="workspace-form">
              <label>
                <span>语言</span>
                <select value={grammarDraft.language} onChange={(event) => setGrammarDraft({ ...grammarDraft, language: event.target.value })}>
                  {languageOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </label>
              <label>
                <span>生成方式</span>
                <select value={grammarDraft.mode} onChange={(event) => setGrammarDraft({ ...grammarDraft, mode: event.target.value })}>
                  <option value="generate">由大模型直接生成</option>
                  <option value="pdf">依据语法 PDF 整理</option>
                </select>
              </label>
              <label>
                <span>参考标题</span>
                <input value={grammarDraft.title} onChange={(event) => setGrammarDraft({ ...grammarDraft, title: event.target.value })} placeholder="例如：古希腊语基础语法" />
              </label>
              {grammarDraft.mode === "pdf" && (
                <label>
                  <span>语法 PDF</span>
                  <select value={grammarDraft.sourceJobId} onChange={(event) => setGrammarDraft({ ...grammarDraft, sourceJobId: event.target.value })}>
                    <option value="">选择已加入队列的语法材料</option>
                    {grammarPdfJobs.map((job) => <option value={job.id} key={job.id}>{job.title}</option>)}
                  </select>
                  {!grammarPdfJobs.length && <small>请先在 PDF 导入中添加“语法学材料”。</small>}
                </label>
              )}
              <label className="workspace-form-wide">
                <span>覆盖范围</span>
                <input value={grammarDraft.scope} onChange={(event) => setGrammarDraft({ ...grammarDraft, scope: event.target.value })} />
              </label>
            </div>
            <div className="grammar-output-schema">
              <span>输出结构</span>
              <p>章节 → 规则 → 例句 → 逐词标注 → 来源页码；例句沿用 Leipzig 标签。</p>
            </div>
            <div className="material-actions">
              <span>
                {modelConnection.tested
                  ? "模型连接已通过；生成结果将保留来源页码。"
                  : "任务只保存配置，不生成虚构内容。"}
              </span>
              <button className="primary-action" onClick={queueGrammar}>加入生成队列</button>
            </div>
          </div>
          <aside className="material-queue-panel">
            <div className="workspace-section-head"><strong>语法参考</strong><span>{workspace.grammarJobs.length}</span></div>
            <WorkspaceQueue
              items={workspace.grammarJobs}
              emptyLabel="尚无语法参考任务"
              onRemove={removeGrammarJob}
            />
          </aside>
        </section>
      )}
    </main>
  );
}

function AnalysisLab({
  initialDraft = null,
  onOpenReader,
  showToast,
  languageProfiles = [],
  analysisPipelines = {},
  analysisRulePacks = [],
  corpora = [],
  modelConfig = {},
}) {
  const initialTokens = initialDraft?.tokens?.length
    ? withSyntaxLinks(initialDraft.tokens.map((token) => ({ ...token })))
    : [];
  const initialLexiconCount = initialTokens.filter((token) => token.lexicon).length;
  const [languageId, setLanguageId] = useState(initialDraft?.languageId || "greek");
  const activeLanguageProfile = languageProfiles.find((profile) => profile.id === languageId) || null;
  const activePipeline = enabledAnalysisEngines(
    analysisPipelines?.[languageId],
    activeLanguageProfile,
  );
  const activeCorpusCount = corpora.filter((corpus) => (
    corpus.languageId === languageId
    || corpus.languageCode === activeLanguageProfile?.code?.toLocaleLowerCase()
  )).length;
  const [text, setText] = useState(initialDraft?.text || labSamples.greek.text);
  const [ctsUrn, setCtsUrn] = useState(initialDraft?.ctsUrn || labSamples.greek.ctsUrn);
  const [ctsError, setCtsError] = useState("");
  const [phase, setPhase] = useState(initialTokens.length ? "done" : "idle");
  const [tokens, setTokens] = useState(initialTokens);
  const [activeToken, setActiveToken] = useState(initialTokens[0] || null);
  const [editingToken, setEditingToken] = useState(false);
  const [segmentDraft, setSegmentDraft] = useState(initialTokens[0]?.form || "");
  const [lexiconPhase, setLexiconPhase] = useState(initialTokens.length
    ? { status: initialLexiconCount ? "done" : "idle", found: initialLexiconCount, total: initialTokens.length }
    : { status: "idle", found: 0, total: 0 });
  const [analysisBackend, setAnalysisBackend] = useState({
    status: initialTokens.length ? "imported" : "idle",
    message: "",
  });
  const importRef = useRef(null);
  const analysisRequestRef = useRef(null);
  const initialRunRef = useRef(false);
  const activeLexicon = useWiktionaryLookup(
    activeToken,
    languageId,
    lexiconPhase.status !== "loading",
    activeLanguageProfile,
  );
  const activeLexiconDefinitions = wiktionaryDefinitions(activeLexicon, 2);
  const activeLexiconCandidates = wiktionaryMorphologyCandidates(activeLexicon);
  const activeParadigm = activeLexicon.paradigms?.[0] || null;
  const activeFixedExpressions = [
    ...(activeLexicon.fixedExpressions || []),
    ...(activeLexicon.relatedTerms || []),
  ]
    .map(normalizedExpressionItem)
    .filter((item, index, items) => (
      item.form && items.findIndex((candidate) => candidate.form === item.form) === index
    ))
    .slice(0, 8);
  const activeGrammarRules = relevantGrammarRules(activeLanguageProfile, activeToken);

  useEffect(() => {
    const lexicon = compactLexiconRecord(activeLexicon);
    const alreadyCurrent = activeToken?.lexicon?.sourceUrl === lexicon?.sourceUrl
      && (activeToken?.lexicon?.detailsLoaded || !lexicon?.detailsLoaded);
    if (!activeToken || !lexicon || alreadyCurrent) return;
    const enrichedToken = enrichedWithWiktionary(activeToken, activeLexicon);
    setTokens((current) => current.map((token) => token.id === activeToken.id ? enrichedToken : token));
    setActiveToken(enrichedToken);
  }, [activeLexicon, activeToken]);

  useEffect(() => () => analysisRequestRef.current?.abort(), []);

  const updateActiveToken = (field, value) => {
    if (!activeToken) return;
    const patch = {
      [field]: value,
      source: activeToken.lexicon
        ? `人工校订 · Wiktionary · ${activeToken.lexicon.sourceLanguage}`
        : "人工校订 · 本地词法",
    };
    if (field === "morphology") {
      patch.lgrTags = undefined;
      patch.lgrIssues = undefined;
      if (activeToken.lexicon) {
        patch.lexicon = { ...activeToken.lexicon, selectedCandidate: null };
      }
    }
    if (field === "lemma") patch.lexicon = null;
    const nextToken = { ...activeToken, ...patch };
    setTokens((current) => current.map((token) => token.id === activeToken.id ? nextToken : token));
    setActiveToken(nextToken);
  };

  const applyMorphologyCandidate = (candidate) => {
    if (!activeToken) return;
    const lexicon = activeToken.lexicon || compactLexiconRecord(activeLexicon);
    const normalizedCandidate = normalizeLgrTags(candidate.lgrTags);
    const nextToken = {
      ...activeToken,
      morphology: candidate.labels,
      lgrTags: normalizedCandidate.tags,
      lgrIssues: normalizedCandidate.unregistered,
      confidence: Math.max(activeToken.confidence || 0, 82),
      source: `人工校订 · Wiktionary · ${lexicon?.sourceLanguage || "词形候选"}`,
      lexicon: lexicon ? {
        ...lexicon,
        localSource: lexicon.localSource || activeToken.source,
        selectedCandidate: { ...candidate, lgrTags: normalizedCandidate.tags },
      } : activeToken.lexicon,
    };
    setTokens((current) => current.map((token) => token.id === activeToken.id ? nextToken : token));
    setActiveToken(nextToken);
    showToast(`已采用 ${normalizedCandidate.tags.join(".")} 词法候选`);
  };

  const updateSyntaxHead = (headId) => {
    if (!activeToken || activeToken.headId === null) return;
    const nextToken = {
      ...activeToken,
      headId,
      source: activeToken.lexicon
        ? `人工校订 · Wiktionary · ${activeToken.lexicon.sourceLanguage}`
        : "人工校订 · 本地词法",
    };
    setTokens((current) => current.map((token) => token.id === activeToken.id ? nextToken : token));
    setActiveToken(nextToken);
  };

  const applyTokenStructure = (nextTokens, activeId, message) => {
    const normalizedTokens = withSyntaxLinks(nextTokens);
    const nextActive = normalizedTokens.find((token) => token.id === activeId) || normalizedTokens[0] || null;
    const linkedTokens = normalizedTokens.filter((token) => token.lexicon).length;
    setTokens(normalizedTokens);
    setActiveToken(nextActive);
    setEditingToken(false);
    setSegmentDraft(nextActive?.form || "");
    setLexiconPhase({
      status: linkedTokens ? "done" : "idle",
      found: linkedTokens,
      total: normalizedTokens.length,
    });
    showToast(message);
  };

  const splitActiveToken = () => {
    if (!activeToken) return;
    const parts = segmentDraft.split("|").map((part) => part.trim()).filter(Boolean);
    const source = activeToken.form.normalize("NFC").replace(/\s+/gu, "");
    if (parts.length < 2 || parts.join("").normalize("NFC") !== source) {
      showToast("请用 | 标出边界，并保持原词形不变");
      return;
    }

    const usedIds = new Set(tokens.map((token) => token.id));
    const splitTokens = parts.map((form, index) => {
      let id = index === 0 ? activeToken.id : `${activeToken.id}-s${index + 1}`;
      let suffix = index + 1;
      while (index > 0 && usedIds.has(id)) {
        suffix += 1;
        id = `${activeToken.id}-s${suffix}`;
      }
      usedIds.add(id);
      return {
        ...activeToken,
        id,
        form,
        lemma: form,
        reading: "—",
        pos: "待识别",
        morphology: ["未标注"],
        gloss: "等待 Wiktionary 或人工校订",
        role: index === 0 ? activeToken.role : "词内成分",
        relation: index === 0 ? activeToken.relation : "人工拆分成分",
        headId: index === 0 ? activeToken.headId : activeToken.id,
        dependency: index === 0 ? activeToken.dependency : "fixed",
        confidence: 55,
        source: "人工分词 · 拆分",
        lexicon: null,
        lgrSurface: undefined,
        lgrGloss: undefined,
        lgrTags: undefined,
        lgrIssues: undefined,
        ctsTarget: undefined,
      };
    });
    const activeIndex = tokens.findIndex((token) => token.id === activeToken.id);
    const nextTokens = tokens.filter((token) => token.id !== activeToken.id);
    nextTokens.splice(activeIndex, 0, ...splitTokens);
    applyTokenStructure(nextTokens, splitTokens[0].id, `已拆分为 ${parts.length} 个词项`);
  };

  const mergeActiveToken = (offset) => {
    if (!activeToken) return;
    const activeIndex = tokens.findIndex((token) => token.id === activeToken.id);
    const neighborIndex = activeIndex + offset;
    if (activeIndex < 0 || neighborIndex < 0 || neighborIndex >= tokens.length) return;
    const leftIndex = Math.min(activeIndex, neighborIndex);
    const rightIndex = Math.max(activeIndex, neighborIndex);
    const left = tokens[leftIndex];
    const right = tokens[rightIndex];
    const mergedIds = new Set([left.id, right.id]);
    const rootToken = [left, right].find((token) => token.headId === null);
    const externalHead = [activeToken, left, right]
      .map((token) => token.headId)
      .find((headId) => headId && !mergedIds.has(headId));
    const reading = [left.reading, right.reading].filter((value) => value && value !== "—").join(" ");
    const mergedToken = {
      ...activeToken,
      id: left.id,
      form: `${left.form}${right.form}`.normalize("NFC"),
      lemma: `${left.lemma || left.form}${right.lemma || right.form}`.normalize("NFC"),
      reading: reading || "—",
      pos: "待识别",
      morphology: ["人工合并"],
      gloss: "等待 Wiktionary 或人工校订",
      role: rootToken?.role || activeToken.role,
      relation: rootToken?.relation || "由相邻词项人工合并；需重新校订",
      headId: rootToken ? null : externalHead || syntaxRoot?.id || null,
      dependency: rootToken ? "root" : activeToken.dependency || "dep",
      confidence: 55,
      source: "人工分词 · 合并",
      lexicon: null,
      lgrSurface: undefined,
      lgrGloss: undefined,
      lgrTags: undefined,
      lgrIssues: undefined,
      ctsTarget: undefined,
    };
    const nextTokens = tokens
      .filter((_, index) => index !== leftIndex && index !== rightIndex)
      .map((token) => mergedIds.has(token.headId) ? { ...token, headId: mergedToken.id } : token);
    nextTokens.splice(leftIndex, 0, mergedToken);
    applyTokenStructure(nextTokens, mergedToken.id, `已合并为“${mergedToken.form}”`);
  };

  const toggleTokenEditor = () => {
    if (!editingToken) setSegmentDraft(activeToken?.form || "");
    setEditingToken((current) => !current);
  };

  const loadSample = (id) => {
    analysisRequestRef.current?.abort();
    setLanguageId(id);
    setText(labSamples[id].text);
    setCtsUrn(labSamples[id].ctsUrn);
    setCtsError("");
    setTokens([]);
    setActiveToken(null);
    setEditingToken(false);
    setSegmentDraft("");
    setLexiconPhase({ status: "idle", found: 0, total: 0 });
    setAnalysisBackend({ status: "idle", message: "" });
    setPhase("idle");
  };

  const runAnalysis = async () => {
    if (!text.trim()) {
      showToast("请先输入需要分析的文本");
      return;
    }
    analysisRequestRef.current?.abort();
    const controller = new AbortController();
    analysisRequestRef.current = controller;
    const detected = detectLanguage(text);
    const resolvedLanguage = languageId === "auto" ? detected : languageId;
    setPhase("working");
    setAnalysisBackend({ status: "loading", message: "" });
    await new Promise((resolve) => window.setTimeout(resolve, 260));
    if (controller.signal.aborted) return;

    const resolvedProfile = languageProfiles.find((profile) => profile.id === resolvedLanguage) || null;
    const context = {
      languageId: resolvedLanguage,
      languageCode: resolvedProfile?.code || builtInWorkspaceLanguages.find(
        (item) => item.id === resolvedLanguage,
      )?.code || "",
    };
    const enabledRulePacks = analysisRulePacks.filter((pack) => pack.enabled !== false);
    let analyzedText = text;
    let preprocessingChanges = 0;
    for (const pack of enabledRulePacks) {
      const preprocessing = applySegmentationDsl(analyzedText, pack.source, context);
      analyzedText = preprocessing.text;
      preprocessingChanges += preprocessing.applied;
    }
    const engines = enabledAnalysisEngines(
      analysisPipelines?.[resolvedLanguage],
      resolvedProfile,
    );
    let nextTokens = null;
    let backend = {
      status: resolvedProfile ? "fallback" : "local",
      message: "",
      attemptedEngines: [],
    };
    for (const engine of engines) {
      if (controller.signal.aborted) return;
      backend.attemptedEngines.push(engine.id);
      if (engine.id === "local-rules") break;
      try {
        let payload = null;
        if (engine.id === "local-corpus") {
          payload = await lookupCorpusSentence({
            text: analyzedText,
            languageId: resolvedLanguage,
            languageCode: context.languageCode,
            corpusIds: engine.corpusIds,
          });
        } else if (
          ["ud-corpus", "udpipe"].includes(engine.id)
          && context.languageCode
          && !context.languageCode.toLocaleLowerCase().startsWith("x-")
        ) {
          const response = await fetch("/api/analyze", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              code: context.languageCode,
              text: analyzedText,
              engines: [engine.id],
            }),
            signal: controller.signal,
          });
          const result = await response.json();
          if (response.ok) payload = result;
          else backend.message = result.message || backend.message;
        } else if (
          engine.id === "llm"
          && modelConfig.endpoint
          && modelConfig.model
          && modelConfig.apiKey
        ) {
          const response = await fetch("/api/analyze/model", {
            method: "POST",
            headers: {
              authorization: `Bearer ${modelConfig.apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({
              code: context.languageCode,
              languageName: resolvedProfile?.name
                || builtInWorkspaceLanguages.find((item) => item.id === resolvedLanguage)?.name,
              text: analyzedText,
              endpoint: modelConfig.endpoint,
              model: modelConfig.model,
            }),
            signal: controller.signal,
          });
          const result = await response.json();
          if (response.ok) payload = result;
          else backend.message = result.message || backend.message;
        }
        if (payload?.status === "ok" && payload.tokens?.length) {
          const payloadKind = payload.kind || engine.id;
          const sourceLabel = {
            "local-corpus": "本地 UD 语料",
            "ud-corpus": "UD 人工校订树库",
            udpipe: "UDPipe",
            llm: "大模型分析",
          }[payloadKind] || "UD 分析";
          nextTokens = udTokensToLab(
            payload.tokens,
            resolvedProfile,
            payload.model,
            sourceLabel,
          );
          backend = {
            ...backend,
            status: payloadKind,
            message: payload.model || "",
            sourceUrl: payload.sourceUrl || "",
            corpusId: payload.corpusId || "",
            sentenceId: payload.sentenceId || "",
            license: payload.license || "",
            acknowledgements: payload.acknowledgements || [],
          };
          break;
        }
      } catch (error) {
        if (error.name === "AbortError") return;
        backend.message = `${analysisEngineDescriptor(engine.id)?.name || engine.id} 暂时不可用`;
      }
    }

    nextTokens ||= tokenizeCustomText(analyzedText, resolvedLanguage, resolvedProfile);
    let dslChanges = 0;
    const dslDiagnostics = [];
    for (const pack of enabledRulePacks) {
      const result = applyAnalysisDsl(nextTokens, pack.source, context);
      nextTokens = result.tokens;
      dslChanges += result.changes;
      dslDiagnostics.push({
        id: pack.id,
        name: pack.name,
        changes: result.changes,
        diagnostics: result.diagnostics,
      });
    }
    if (backend.status !== "fallback") nextTokens = withSyntaxLinks(nextTokens);
    setAnalysisBackend({
      ...backend,
      dslChanges,
      preprocessingChanges,
      dslDiagnostics,
      pipeline: engines.map((engine) => engine.id),
    });
    setTokens(nextTokens);
    setActiveToken(nextTokens[0] || null);
    setEditingToken(false);
    setSegmentDraft(nextTokens[0]?.form || "");
    setLanguageId(resolvedLanguage);
    const lookupTokens = resolvedProfile
      ? nextTokens.filter((token) => token.gloss === "等待词典或人工校订")
      : nextTokens;
    const locallyMatched = nextTokens.length - lookupTokens.length;
    const needsWiktionary = lookupTokens.length > 0;
    setLexiconPhase(needsWiktionary
      ? { status: "loading", found: locallyMatched, total: nextTokens.length }
      : { status: "profile", found: locallyMatched, total: nextTokens.length });
    setPhase("done");

    if (!needsWiktionary) {
      analysisRequestRef.current = null;
      return;
    }

    try {
      const results = [];
      for (let start = 0; start < lookupTokens.length; start += 24) {
        const response = await fetch("/api/lexicon", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            language: resolvedLanguage,
            code: resolvedProfile?.code || "",
            items: lookupTokens.slice(start, start + 24).map((token) => ({
              id: token.id,
              term: token.form,
              lemma: token.lemma,
            })),
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Lexicon batch failed with ${response.status}`);
        const payload = await response.json();
        results.push(...(payload.results || []));
      }
      const resultById = new Map(results.map((result) => [result.id, result]));
      const found = results.filter((result) => result.status === "ok").length;
      setTokens((current) => current.map((token) => (
        enrichedWithWiktionary(token, resultById.get(token.id))
      )));
      setActiveToken((current) => current
        ? enrichedWithWiktionary(current, resultById.get(current.id))
        : current);
      setLexiconPhase({
        status: "done",
        found: Math.min(nextTokens.length, locallyMatched + found),
        total: nextTokens.length,
      });
    } catch (error) {
      if (error.name === "AbortError") return;
      setLexiconPhase({ status: "unavailable", found: 0, total: nextTokens.length });
    } finally {
      if (analysisRequestRef.current === controller) analysisRequestRef.current = null;
    }
  };

  useEffect(() => {
    if (!initialDraft?.autoRun || initialRunRef.current) return;
    initialRunRef.current = true;
    void runAnalysis();
  }, []);

  const syntaxRoot = tokens.find((token) => token.headId === null) || tokens[0];
  const hasDependencyEvidence = [
    "imported",
    "local",
    "local-corpus",
    "ud-corpus",
    "udpipe",
    "llm",
  ].includes(analysisBackend.status);
  const syntaxChildrenByHead = new Map();
  tokens.forEach((token) => {
    if (!token.headId) return;
    const children = syntaxChildrenByHead.get(token.headId) || [];
    children.push(token);
    syntaxChildrenByHead.set(token.headId, children);
  });
  const syntaxParentOptions = activeToken
    ? tokens.filter((token) => (
      token.id !== activeToken.id
      && !isSyntaxDescendant(tokens, token.id, activeToken.id)
    ))
    : [];
  const activeTokenIndex = activeToken ? tokens.findIndex((token) => token.id === activeToken.id) : -1;
  const interlinearTokens = tokens.map((token) => ({ token, ...leipzigRecord(token) }));
  const activeLgr = activeToken ? leipzigRecord(activeToken) : null;
  const ctsPassage = parseCtsPassageUrn(ctsUrn);
  const buildCtsBundle = () => {
    if (!ctsPassage) return null;
    const annotationTargets = tokens.map((token, index) => (
      token.ctsTarget?.startsWith(`${ctsPassage.urn}@`)
        ? token.ctsTarget
        : ctsTokenTarget(ctsPassage.urn, tokens, index)
    ));
    const tokenIndex = new Map(tokens.map((token, index) => [token.id, index]));
    return {
      format: "Lingua CTS Annotation Bundle",
      profile: CTS_PROFILE,
      conformsTo: {
        citation: CTS_SPEC,
        glossing: "Leipzig Glossing Rules (revised February 2008)",
      },
      analysis: {
        segmentation: "local rules with explicit and manual boundary correction",
        morphology: "Wiktionary primary, local fallback, human candidate selection",
        syntax: "local dependency rules with human correction",
        model: null,
      },
      cts: {
        passageUrn: ctsPassage.urn,
        workUrn: ctsPassage.workUrn,
        namespace: ctsPassage.namespace,
        passage: ctsPassage.passage,
      },
      language: languageId,
      text,
      annotations: interlinearTokens.map(({ token, surface, gloss, tags }, index) => {
        const tagProfile = normalizeLgrTags(tags);
        return {
          id: token.id,
          target: annotationTargets[index],
          form: token.form,
          lemma: token.lemma,
          normalization: token.originalForm || token.originalLemma ? {
            originalForm: token.originalForm || token.form,
            originalLemma: token.originalLemma || token.lemma,
          } : null,
          reading: token.reading,
          pos: token.pos,
          morphology: token.morphology || [],
          gloss: token.gloss,
          lgr: {
            surface,
            gloss,
            tags: tagProfile.tags,
            extensions: tagProfile.extensions,
            unregistered: tagProfile.unregistered,
          },
          syntax: {
            role: token.role,
            relation: token.relation,
            head: token.headId ? annotationTargets[tokenIndex.get(token.headId)] || null : null,
            dependency: token.dependency || dependencyFromRole(token, token.headId === null),
          },
          confidence: token.confidence,
          source: token.source,
          lexicon: token.lexicon || null,
        };
      }),
    };
  };

  const prepareCtsExport = () => {
    const payload = buildCtsBundle();
    if (!payload) {
      setCtsError("请输入包含版本与段落的有效 CTS URN");
      showToast("CTS URN 无效，暂不能导出");
      return null;
    }
    const validation = validateCtsAnnotationBundle(payload);
    if (!validation.valid) {
      const message = validation.errors[0]?.message || "CTS 标注结构无效";
      setCtsError(message);
      showToast(`暂不能导出：${message}`);
      return null;
    }
    setCtsError("");
    return payload;
  };

  const copyAnalysis = async () => {
    const payload = prepareCtsExport();
    if (!payload) return;
    await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    showToast("CTS 标注 JSON 已复制");
  };

  const downloadAnalysis = () => {
    const payload = prepareCtsExport();
    if (!payload) return;
    const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ctsPassage.work.replaceAll(".", "-")}-${ctsPassage.passage.replaceAll(".", "-")}-annotations.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("CTS 标注 JSON 已导出");
  };

  const downloadCex = () => {
    const payload = prepareCtsExport();
    if (!payload) return;
    const blob = new Blob([buildCexAnnotationBundle(payload)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ctsPassage.work.replaceAll(".", "-")}-${ctsPassage.passage.replaceAll(".", "-")}-annotations.cex`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("CEX 3.0 标注包已导出");
  };

  const importAnalysis = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    analysisRequestRef.current?.abort();
    try {
      const source = await file.text();
      const isCex = source.includes("#!cexversion");
      const payload = isCex
        ? parseCexAnnotationBundle(source)
        : JSON.parse(source);
      const validation = validateCtsAnnotationBundle(payload);
      if (!validation.valid) {
        throw new Error(validation.errors[0]?.message || "CTS 标注结构无效");
      }
      const passageUrn = payload.cts?.passageUrn || payload.passage?.urn;
      const parsedPassage = parseCtsPassageUrn(passageUrn || "");
      const annotations = payload.annotations || payload.tokens;
      if (!parsedPassage || !Array.isArray(annotations) || !payload.text) {
        throw new Error("invalid-bundle");
      }
      const importedLanguage = [
        "greek",
        "latin",
        "chinese",
        ...languageProfiles.map((profile) => profile.id),
      ].includes(payload.language)
        ? payload.language
        : detectLanguage(payload.text);
      const importedIds = annotations.map((annotation, index) => annotation.id || `cts-${index + 1}`);
      const targetToId = new Map(annotations.map((annotation, index) => [annotation.target, importedIds[index]]));
      const importedTokens = withSyntaxLinks(annotations.map((annotation, index) => {
        const dependency = annotation.syntax?.dependency || "";
        const headTarget = annotation.syntax?.head;
        const normalizedLgr = normalizeLgrTags(annotation.lgr?.tags || []);
        const syntaxLink = dependency === "root"
          ? { headId: null }
          : headTarget && targetToId.has(headTarget)
            ? { headId: targetToId.get(headTarget) }
            : {};
        return {
          id: importedIds[index],
          form: annotation.form || annotation.lgr?.surface || "—",
          lemma: annotation.lemma || "—",
          originalForm: annotation.normalization?.originalForm || "",
          originalLemma: annotation.normalization?.originalLemma || "",
          reading: annotation.reading || "—",
          pos: annotation.pos || "待识别",
          morphology: Array.isArray(annotation.morphology) ? annotation.morphology : [],
          gloss: annotation.gloss || annotation.lgr?.gloss || "待补充",
          lgrSurface: annotation.lgr?.surface,
          lgrGloss: annotation.lgr?.gloss,
          lgrTags: normalizedLgr.tags,
          lgrIssues: normalizedLgr.unregistered,
          role: annotation.syntax?.role || annotation.role || "未定",
          relation: annotation.syntax?.relation || annotation.relation || "未提供依存关系",
          dependency,
          confidence: Number.isFinite(annotation.confidence) ? annotation.confidence : null,
          source: annotation.source || `${isCex ? "CEX" : "CTS JSON"} 导入 · ${file.name}`,
          lexicon: annotation.lexicon || null,
          ctsTarget: annotation.target,
          ...syntaxLink,
        };
      }));
      setLanguageId(importedLanguage);
      setText(payload.text);
      setCtsUrn(parsedPassage.urn);
      setCtsError("");
      setTokens(importedTokens);
      setActiveToken(importedTokens[0] || null);
      setEditingToken(false);
      setSegmentDraft(importedTokens[0]?.form || "");
      const linkedTokens = importedTokens.filter((token) => token.lexicon).length;
      setLexiconPhase({
        status: linkedTokens ? "done" : "idle",
        found: linkedTokens,
        total: importedTokens.length,
      });
      setPhase("done");
      showToast(`已从 ${isCex ? "CEX" : "JSON"} 导入 ${importedTokens.length} 条标注`);
    } catch (error) {
      const message = error?.message && ![
        "invalid-bundle",
        "missing-cex-delimiter",
        "missing-ctsdata",
        "missing-annotation-collection",
      ].includes(error.message)
        ? error.message
        : "文件不是可识别的 CTS 标注 JSON 或 CEX";
      setCtsError(message);
      showToast(`导入失败：${message}`);
    }
  };

  return (
    <main className="workspace-page lab-page">
      <header className="workspace-heading">
        <h1>分析实验室</h1>
      </header>

      <section className="lab-input-panel">
        <div className="lab-input-head">
          <label htmlFor="lab-language">文本语言</label>
          <select
            id="lab-language"
            value={languageId}
            onChange={(event) => {
              const nextLanguage = event.target.value;
              setLanguageId(nextLanguage);
              if (labSamples[nextLanguage]) {
                setCtsUrn(labSamples[nextLanguage].ctsUrn);
              } else {
                const profile = languageProfiles.find((item) => item.id === nextLanguage);
                if (profile) setCtsUrn(`urn:cts:lingua:custom.${profile.code}.v1:1.1`);
              }
              setCtsError("");
            }}
          >
            <option value="auto">自动识别</option>
            <option value="greek">古希腊语</option>
            <option value="latin">拉丁语</option>
            <option value="chinese">文言文</option>
            {languageProfiles.map((profile) => (
              <option value={profile.id} key={profile.id}>{profile.name} · 已初始化</option>
            ))}
          </select>
          <div className="lab-samples">
            <span>载入样例：</span>
            {Object.entries(labSamples).map(([id, sample]) => <button key={id} onClick={() => loadSample(id)}>{sample.label}</button>)}
          </div>
        </div>
        <div className="cts-source-row">
          <label htmlFor="cts-passage-urn">CTS URN</label>
          <input
            id="cts-passage-urn"
            value={ctsUrn}
            onChange={(event) => {
              setCtsUrn(event.target.value);
              setCtsError("");
            }}
            aria-invalid={ctsError ? "true" : "false"}
            aria-describedby="cts-profile-note"
            spellCheck="false"
          />
          <span id="cts-profile-note" className={ctsError ? "cts-status invalid" : "cts-status"}>
            {ctsError || (ctsPassage ? "段落定位有效" : "需含版本与段落")}
          </span>
          <button className="cts-import-action" onClick={() => importRef.current?.click()}>
            <Icon name="upload" size={14} />导入 JSON / CEX
          </button>
          <input
            ref={importRef}
            className="visually-hidden"
            type="file"
            accept=".json,.cex,application/json,text/plain"
            onChange={importAnalysis}
            aria-label="导入 CTS 标注 JSON 或 CEX"
          />
        </div>
        <textarea
          value={text}
          onChange={(event) => {
            analysisRequestRef.current?.abort();
            setText(event.target.value);
            setLexiconPhase({ status: "idle", found: 0, total: 0 });
            setAnalysisBackend({ status: "idle", message: "" });
            setPhase("idle");
          }}
          placeholder={activeLanguageProfile
            ? `在这里粘贴${activeLanguageProfile.name}文本…`
            : "在这里粘贴希腊语、拉丁语或文言文…"}
        />
        <div className="lab-input-foot">
          <span>
            {text.length} 个字符 · LGR
            {languageId === "chinese" && " · 空格/| 定界"}
            {phase === "done" && !activeLanguageProfile && " · 词法 Wiktionary 优先 · 句法 本地规则"}
            {phase === "done" && activeLanguageProfile && (
              ({
                "local-corpus": ` · 本地 UD 语料命中 · 初始化词表 ${activeLanguageProfile.lexicon.length}`,
                "ud-corpus": ` · UD 人工校订树库命中 · 初始化词表 ${activeLanguageProfile.lexicon.length}`,
                udpipe: ` · UDPipe 上下文分析 · 初始化词表 ${activeLanguageProfile.lexicon.length}`,
                llm: ` · ${analysisBackend.message || "大模型"}生成 UD 分析 · 需要校订`,
              }[analysisBackend.status]
                || ` · ${segmentationStrategies.find((item) => item.id === activeLanguageProfile.segmentation.strategy)?.label} · 初始化词表 ${activeLanguageProfile.lexicon.length}`)
            )}
            {phase === "done" && analysisBackend.status === "fallback" && " · 无可用句法模型，仅显示分词与词法"}
            {phase === "done" && analysisBackend.preprocessingChanges > 0 && ` · DSL 预处理 ${analysisBackend.preprocessingChanges}`}
            {phase === "done" && analysisBackend.dslChanges > 0 && ` · DSL 修正 ${analysisBackend.dslChanges} 词项`}
            {lexiconPhase.status === "loading" && " · Wiktionary 查询中"}
            {lexiconPhase.status === "done" && ` · Wiktionary ${lexiconPhase.found}/${lexiconPhase.total}`}
            {lexiconPhase.status === "unavailable" && " · Wiktionary 离线回退"}
            {lexiconPhase.status === "profile" && ` · 词表匹配 ${lexiconPhase.found}/${lexiconPhase.total}`}
          </span>
          <small className="lab-pipeline-summary">
            管线：{activePipeline.map((engine) => (
              analysisEngineDescriptor(engine.id)?.name || engine.id
            )).join(" → ")}
            {activeCorpusCount > 0 ? ` · ${activeCorpusCount} 个本地语料库` : ""}
          </small>
          <button className="primary-action" onClick={runAnalysis} disabled={phase === "working"}>
            <Icon name="spark" size={16} />{phase === "working" ? "正在分析…" : "开始分析"}
          </button>
        </div>
      </section>

      {phase === "idle" && (
        <section className="lab-empty">
          <span>输入文本后开始分析</span>
        </section>
      )}

      {phase === "working" && (
        <section className="lab-empty is-working">
          <span className="analysis-spinner" />
          <span>正在分析</span>
        </section>
      )}

      {phase === "done" && (
        <>
        <section className="lab-results">
          <div
            className="lab-results-main"
            aria-label={hasDependencyEvidence
              ? `${tokens.length} 个词项的语法树`
              : `${tokens.length} 个待解析词项`}
          >
            {hasDependencyEvidence ? (
              <div className="lab-syntax-preview" aria-label="语法树">
                <div className="syntax-tree-scroll">
                  <div className="syntax-tree" role="tree" aria-label="语法树">
                    {syntaxRoot && (
                      <SyntaxTreeBranch
                        token={syntaxRoot}
                        childrenByHead={syntaxChildrenByHead}
                        activeTokenId={activeToken?.id}
                        onSelect={(token) => {
                          setActiveToken(token);
                          setEditingToken(false);
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="syntax-pending" aria-label="待解析的分词结果">
                <p>当前只有分词与词法结果。导入 CTS / UD 标注或连接句法模型后生成语法树。</p>
                <div className="syntax-pending-tokens">
                  {tokens.map((token) => (
                    <button
                      className={activeToken?.id === token.id ? "active" : ""}
                      key={token.id}
                      onClick={() => {
                        setActiveToken(token);
                        setEditingToken(false);
                      }}
                    >
                      <strong>{token.form}</strong>
                      <span>{token.pos}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <aside className="lab-inspector" aria-label="词项详情">
            {activeToken ? (
              <>
                <div className="lab-token-heading">
                  <h3>{activeToken.form}</h3>
                  <button onClick={toggleTokenEditor}>
                    {editingToken ? "收起" : "校订"}
                  </button>
                </div>
                <p className="lab-lemma">{activeToken.lemma} · {activeToken.reading}</p>
                <div className="token-summary-line" aria-label={`词性 ${activeToken.pos}；LGR 标签 ${activeLgr.tags.join("、") || "LEX"}；释义 ${activeToken.gloss}`}>
                  <span className="token-summary-pos">{activeToken.pos}</span>
                  <span className="lgr-inline">
                    {activeLgr.tags.length ? activeLgr.tags.map((tag) => (
                      <span className="lgr-tag" key={tag} tabIndex={0} aria-label={`${tag}：${leipzigTagDescription(tag)}`}>
                        <b>{tag}</b>
                        <span className="lgr-tag-tooltip" role="tooltip">{leipzigTagDescription(tag)}</span>
                      </span>
                    )) : "LEX"}
                  </span>
                  <span className="token-summary-gloss" title={activeToken.gloss}>{activeToken.gloss}</span>
                </div>
                {activeToken.lgrIssues?.length > 0 && (
                  <p className="lgr-validation-note">
                    未注册扩展标签：{activeToken.lgrIssues.join(" · ")}
                  </p>
                )}
                {editingToken && (
                  <div className="token-editor" aria-label="人工校订词项">
                    <label className="token-editor-wide">
                      <span>分词</span>
                      <input
                        aria-label="分词边界"
                        value={segmentDraft}
                        onChange={(event) => setSegmentDraft(event.target.value)}
                        placeholder="用 | 标出拆分边界"
                      />
                    </label>
                    <label>
                      <span>词元</span>
                      <input value={activeToken.lemma} onChange={(event) => updateActiveToken("lemma", event.target.value)} />
                    </label>
                    <label>
                      <span>读音</span>
                      <input value={activeToken.reading} onChange={(event) => updateActiveToken("reading", event.target.value)} />
                    </label>
                    <label>
                      <span>词性</span>
                      <input value={activeToken.pos} onChange={(event) => updateActiveToken("pos", event.target.value)} />
                    </label>
                    <label>
                      <span>词法</span>
                      <input
                        value={(activeToken.morphology || []).join("，")}
                        onChange={(event) => updateActiveToken(
                          "morphology",
                          event.target.value.split(/[，,]/u).map((item) => item.trim()).filter(Boolean),
                        )}
                      />
                    </label>
                    <label>
                      <span>中心词</span>
                      <select
                        value={activeToken.headId || "root"}
                        disabled={activeToken.headId === null}
                        onChange={(event) => updateSyntaxHead(event.target.value)}
                      >
                        {activeToken.headId === null && <option value="root">ROOT</option>}
                        {syntaxParentOptions.map((token) => (
                          <option key={token.id} value={token.id}>{token.form}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>依存</span>
                      <input
                        value={activeToken.dependency || ""}
                        disabled={activeToken.headId === null}
                        onChange={(event) => updateActiveToken("dependency", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>角色</span>
                      <input value={activeToken.role} onChange={(event) => updateActiveToken("role", event.target.value)} />
                    </label>
                    <label className="token-editor-wide">
                      <span>释义</span>
                      <input value={activeToken.gloss} onChange={(event) => updateActiveToken("gloss", event.target.value)} />
                    </label>
                    <label className="token-editor-wide">
                      <span>句法</span>
                      <input value={activeToken.relation} onChange={(event) => updateActiveToken("relation", event.target.value)} />
                    </label>
                    <div className="token-segmentation-actions">
                      <button disabled={activeTokenIndex <= 0} onClick={() => mergeActiveToken(-1)}>合并前词</button>
                      <button disabled={!segmentDraft.includes("|")} onClick={splitActiveToken}>应用分词</button>
                      <button disabled={activeTokenIndex < 0 || activeTokenIndex >= tokens.length - 1} onClick={() => mergeActiveToken(1)}>合并后词</button>
                    </div>
                    <button onClick={() => {
                      setEditingToken(false);
                      showToast("人工校订已写入当前 CTS 标注");
                    }}>完成校订</button>
                  </div>
                )}
                <dl>
                  {hasDependencyEvidence ? (
                    <>
                      <div><dt>句法角色</dt><dd>{activeToken.role}</dd></div>
                      <div><dt>依存关系</dt><dd>{activeToken.dependency}{activeToken.headId ? ` → ${tokens.find((token) => token.id === activeToken.headId)?.form || "—"}` : " · ROOT"}</dd></div>
                    </>
                  ) : (
                    <div><dt>句法状态</dt><dd>待解析；当前没有可验证的依存关系</dd></div>
                  )}
                  {(activeToken.originalForm || activeToken.originalLemma) && (
                    <div>
                      <dt>录入原值</dt>
                      <dd>
                        {activeToken.originalForm || activeToken.form}
                        {(activeToken.originalLemma || activeToken.lemma) !== (activeToken.originalForm || activeToken.form)
                          ? ` · 词元 ${activeToken.originalLemma || activeToken.lemma}`
                          : ""}
                      </dd>
                    </div>
                  )}
                  <div><dt>来源</dt><dd>{activeToken.source}</dd></div>
                </dl>
                <div className="lexicon-inline" aria-live="polite">
                  {activeLexicon.status === "loading" && <span>正在查询 Wiktionary…</span>}
                  {activeLexicon.status === "ok" && (
                    <>
                      <a href={activeLexicon.sourceUrl} target="_blank" rel="noreferrer">
                        Wiktionary · {activeLexicon.sourceLanguage}
                      </a>
                      <span>{activeLexicon.entries.map((entry) => entry.partOfSpeech).filter((value, index, values) => values.indexOf(value) === index).join(" / ")}</span>
                      {activeLexiconDefinitions.length > 0 && <p>{activeLexiconDefinitions.join("；")}</p>}
                      {activeLexiconCandidates.length > 0 && (
                        <div className="wiktionary-candidates">
                          {activeLexiconCandidates.map((candidate) => {
                            const key = candidate.lgrTags.join(".");
                            const selected = activeToken.lexicon?.selectedCandidate?.lgrTags?.join(".") === key;
                            return (
                              <button
                                className={selected ? "active" : ""}
                                key={key}
                                title={candidate.labels.join(" · ")}
                                aria-label={`${selected ? "已采用" : "采用"} ${key}`}
                                aria-pressed={selected}
                                onClick={() => applyMorphologyCandidate(candidate)}
                              >
                                <b>{key}</b><small>{selected ? "已采用" : "采用"}</small>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                  {["not_found", "unavailable"].includes(activeLexicon.status) && (
                    <span>Wiktionary 暂无可用义项 · 使用本地标注</span>
                  )}
                  {activeLexicon.status === "not_configured" && (
                    <span>该语言尚未配置 Wiktionary 映射 · 使用初始化词表</span>
                  )}
                </div>
                {activeParadigm && (
                  <div className="grammar-paradigm-inline">
                    <div>
                      <strong>{activeParadigm.type === "conjugation" ? "变位规则" : "变格规则"}</strong>
                      <span>{activeParadigm.title}</span>
                    </div>
                    <table aria-label={`${activeToken.lemma}的${activeParadigm.type === "conjugation" ? "变位" : "变格"}规则`}>
                      <tbody>
                        {activeParadigm.rows.map((row, rowIndex) => (
                          <tr key={`${row.join("-")}-${rowIndex}`}>
                            {row.map((cell, cellIndex) => (
                              cellIndex === 0
                                ? <th scope="row" key={`${cell}-${cellIndex}`}>{cell || "—"}</th>
                                : <td key={`${cell}-${cellIndex}`}>{cell || "—"}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {activeFixedExpressions.length > 0 && (
                  <div className="fixed-expressions-inline">
                    <strong>固定搭配与常用组合</strong>
                    <ul>
                      {activeFixedExpressions.map((item) => (
                        <li className={item.translation ? "has-translation" : "term-only"} key={item.form}>
                          <b>{item.form}</b>
                          {item.translation && <span>{item.translation}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {activeGrammarRules.length > 0 && (
                  <div className="grammar-context-inline">
                    <div>
                      <strong>语言语法补充</strong>
                      <a
                        href={activeLanguageProfile.grammarReference.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Grambank
                      </a>
                    </div>
                    <ul>
                      {activeGrammarRules.map((rule) => (
                        <li key={rule.id}>
                          <span>{rule.category}</span>
                          <p>{rule.summary}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : <p className="muted-note">选择一个词项查看详情。</p>}
            <button
              className="reader-link-action"
              onClick={() => onOpenReader(languageId, { ctsUrn, text, tokens })}
            >
              {activeLanguageProfile ? "在阅读器中查看当前语料" : "在阅读器中查看当前标注"}<Icon name="arrowRight" size={14} />
            </button>
          </aside>
        </section>
        <footer className="lab-page-actions">
          <span>CTS 定位段落与词位；JSON 保留完整结构，CEX 用于 CITE 工具交换</span>
          <div>
            <button className="page-copy-action" onClick={downloadAnalysis}><Icon name="download" size={15} />导出 CTS JSON</button>
            <button className="page-copy-action" onClick={downloadCex}><Icon name="download" size={15} />导出 CEX</button>
            <button className="page-copy-action" onClick={copyAnalysis}><Icon name="copy" size={15} />复制 CTS JSON</button>
          </div>
        </footer>
        </>
      )}
    </main>
  );
}

export default function ReaderPage() {
  const [view, setView] = useState("reader");
  const [languageId, setLanguageId] = useState("greek");
  const [selectedTokenId, setSelectedTokenId] = useState("g1");
  const [selectedLineIndex, setSelectedLineIndex] = useState(0);
  const [passageIndex, setPassageIndex] = useState(0);
  const [segmented, setSegmented] = useState(true);
  const [translation, setTranslation] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [mobilePanel, setMobilePanel] = useState(null);
  const [tab, setTab] = useState("word");
  const [fontSize, setFontSize] = useState(25);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [toast, setToast] = useState("");
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [analysisPassage, setAnalysisPassage] = useState(null);
  const [analysisDraft, setAnalysisDraft] = useState(null);
  const [languageWorkspace, setLanguageWorkspace] = useState({
    profiles: [],
    pdfJobs: [],
    grammarJobs: [],
    dictionaryImports: [],
    libraryImports: [],
    lexicons: {},
    analysisPipelines: {},
    analysisRulePacks: [],
    corpora: [],
  });
  const [storedLocalWorks, setStoredLocalWorks] = useState([]);
  const [modelConfig, setModelConfig] = useState(() => normalizeModelConfig());
  const [modelDraft, setModelDraft] = useState(() => normalizeModelConfig());
  const [modelSettingsOpen, setModelSettingsOpen] = useState(false);
  const [modelErrors, setModelErrors] = useState({});
  const [modelTestState, setModelTestState] = useState({ status: "idle" });
  const [hydrated, setHydrated] = useState(false);
  const searchRef = useRef(null);

  const isAnalysisLayer = analysisPassage?.languageId === languageId;
  const baseWork = isAnalysisLayer
    ? analysisPassage?.baseWork
    : library[languageId] || analysisPassage?.baseWork;
  const localLibraryContext = isAnalysisLayer ? analysisPassage?.localLibrary : null;
  const localWorks = useMemo(() => {
    const byId = new Map(storedLocalWorks.map((work) => [work.id, work]));
    (languageWorkspace.libraryImports || []).forEach((work) => byId.set(work.id, work));
    return [...byId.values()].sort((a, b) => String(b.importedAt).localeCompare(String(a.importedAt)));
  }, [languageWorkspace.libraryImports, storedLocalWorks]);
  const work = useMemo(() => {
    if (!isAnalysisLayer) return baseWork;
    const parsed = parseCtsPassageUrn(analysisPassage.ctsUrn || "");
    return {
      ...baseWork,
      passage: localLibraryContext
        ? `本地书库 · ${localLibraryContext.citation}`
        : `CTS 标注 · ${parsed?.passage || "当前段落"}`,
      edition: localLibraryContext ? baseWork.edition : `${baseWork.edition} · CTS 标注层`,
      lines: [{
        n: localLibraryContext?.citation || parsed?.passage || "标注",
        translation: "",
        tokens: analysisPassage.tokens,
      }],
    };
  }, [analysisPassage, baseWork, isAnalysisLayer, localLibraryContext]);
  const passageSize = work.lines.length > 4 ? 3 : 2;
  const passages = useMemo(() => {
    const chunks = [];
    for (let index = 0; index < work.lines.length; index += passageSize) {
      chunks.push(work.lines.slice(index, index + passageSize).map((line, offset) => ({ line, lineIndex: index + offset })));
    }
    return chunks;
  }, [work, passageSize]);
  const visibleLines = passages[passageIndex] || passages[0];
  const firstVisibleLine = visibleLines[0]?.line.n;
  const lastVisibleLine = visibleLines[visibleLines.length - 1]?.line.n;
  const passageLabel = localLibraryContext
    ? `${localLibraryContext.index + 1} / ${localLibraryContext.work.passageCount} · ${localLibraryContext.citation}`
    : `${work.passage.split(" · ")[0]} · ${firstVisibleLine}${firstVisibleLine !== lastVisibleLine ? `–${lastVisibleLine}` : ""}`;
  const readingProgress = localLibraryContext
    ? ((localLibraryContext.index + 1) / localLibraryContext.work.passageCount) * 100
    : ((passageIndex + 1) / passages.length) * 100;
  const allTokens = useMemo(() => work.lines.flatMap((line, lineIndex) => line.tokens.map((token) => ({ ...token, lineIndex }))), [work]);
  const selectedToken = allTokens.find((token) => token.id === selectedTokenId) || allTokens[0];
  const currentLine = work.lines[selectedToken?.lineIndex ?? selectedLineIndex];
  const currentSyntaxTokens = withSyntaxLinks(currentLine?.tokens || []);
  const currentSyntaxRoot = currentSyntaxTokens.find((token) => token.headId === null) || currentSyntaxTokens[0];
  const currentSyntaxChildren = new Map();
  currentSyntaxTokens.forEach((token) => {
    if (!token.headId) return;
    const children = currentSyntaxChildren.get(token.headId) || [];
    children.push(token);
    currentSyntaxChildren.set(token.headId, children);
  });
  const currentPassageUrn = isAnalysisLayer
    ? parseCtsPassageUrn(analysisPassage.ctsUrn || "")?.urn || ""
    : readerPassageUrn(languageId, currentLine?.n || "");
  const selectedTokenIndex = currentLine?.tokens.findIndex((token) => token.id === selectedToken?.id) ?? -1;
  const selectedTokenCtsTarget = selectedTokenIndex >= 0 && currentPassageUrn
    ? selectedToken.ctsTarget?.startsWith(`${currentPassageUrn}@`)
      ? selectedToken.ctsTarget
      : ctsTokenTarget(currentPassageUrn, currentLine.tokens, selectedTokenIndex)
    : "";
  const selectedBookmarkKey = `${languageId}:${selectedToken?.id}`;
  const isBookmarked = bookmarks.some((item) => item.key === selectedBookmarkKey);
  const selectedLanguageProfile = languageWorkspace.profiles.find((profile) => profile.id === languageId);
  const selectedLexicon = useWiktionaryLookup(
    selectedToken,
    languageId,
    true,
    selectedLanguageProfile,
  );
  const selectedLexiconDefinitions = wiktionaryDefinitions(selectedLexicon, 3);
  const selectedLexiconCandidates = wiktionaryMorphologyCandidates(selectedLexicon);
  const selectedPronunciations = selectedLexicon.pronunciations || [];
  const selectedIpa = selectedLexicon.ipa || [];
  const selectedLgr = selectedToken ? leipzigRecord(selectedToken) : { tags: [] };
  const selectedSyntaxToken = currentSyntaxTokens.find((token) => token.id === selectedToken?.id);
  const selectedSyntaxHead = currentSyntaxTokens.find((token) => token.id === selectedSyntaxToken?.headId);
  const selectedGrammarJobs = languageWorkspace.grammarJobs.filter((job) => job.language === languageId);
  const selectedImportedLexicon = findLanguageLexiconEntry(
    selectedLanguageProfile || { lexicon: languageWorkspace.lexicons?.[languageId] || [] },
    selectedToken?.form,
  );
  const modelConnection = {
    configured: Boolean(modelConfig.endpoint && modelConfig.model && modelConfig.apiKey),
    tested: modelTestState.status === "ok" && modelTestState.modelAvailable !== false,
    model: modelConfig.model,
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "{}");
      const currentUrl = new URL(window.location.href);
      const sharedUrn = currentUrl.searchParams.get("urn");
      const requestedView = currentUrl.searchParams.get("view");
      const sharedTarget = sharedUrn ? resolveReaderCtsTarget(sharedUrn) : null;
      if (sharedTarget?.status === "ok") {
        const { location, targetToken } = sharedTarget;
        const sharedPassageSize = location.work.lines.length > 4 ? 3 : 2;
        setAnalysisPassage(null);
        setLanguageId(location.languageId);
        setSelectedTokenId(targetToken.id);
        setSelectedLineIndex(location.lineIndex);
        setPassageIndex(Math.floor(location.lineIndex / sharedPassageSize));
        setView("reader");
        setTab("word");
      } else if (saved.languageId && library[saved.languageId]) {
        const savedWork = library[saved.languageId];
        const savedTokenId = saved.selectedTokenId || savedWork.lines[0].tokens[0].id;
        const savedLineIndex = savedWork.lines.findIndex((line) => line.tokens.some((token) => token.id === savedTokenId));
        setLanguageId(saved.languageId);
        setSelectedTokenId(savedTokenId);
        setSelectedLineIndex(Math.max(0, savedLineIndex));
        if (Number.isFinite(saved.passageIndex)) setPassageIndex(Math.max(0, saved.passageIndex));
      }
      if (Number.isFinite(saved.fontSize)) setFontSize(saved.fontSize);
      if (typeof saved.segmented === "boolean") setSegmented(saved.segmented);
      if (typeof saved.translation === "boolean") setTranslation(saved.translation);
      if (Array.isArray(saved.notes)) setNotes(saved.notes);
      if (Array.isArray(saved.bookmarks)) setBookmarks(saved.bookmarks);
      if (!sharedUrn && ["reader", "library", "lab", "languages"].includes(requestedView)) {
        setView(requestedView);
      }
      const savedLanguageWorkspace = JSON.parse(
        window.localStorage.getItem(LANGUAGE_WORKSPACE_KEY) || "{}",
      );
      const restoredLanguageWorkspace = {
        profiles: Array.isArray(savedLanguageWorkspace.profiles) ? savedLanguageWorkspace.profiles : [],
        pdfJobs: Array.isArray(savedLanguageWorkspace.pdfJobs) ? savedLanguageWorkspace.pdfJobs : [],
        grammarJobs: Array.isArray(savedLanguageWorkspace.grammarJobs) ? savedLanguageWorkspace.grammarJobs : [],
        dictionaryImports: Array.isArray(savedLanguageWorkspace.dictionaryImports)
          ? savedLanguageWorkspace.dictionaryImports
          : [],
        libraryImports: Array.isArray(savedLanguageWorkspace.libraryImports)
          ? savedLanguageWorkspace.libraryImports
          : [],
        lexicons: savedLanguageWorkspace.lexicons && typeof savedLanguageWorkspace.lexicons === "object"
          ? savedLanguageWorkspace.lexicons
          : {},
        analysisPipelines: savedLanguageWorkspace.analysisPipelines
          && typeof savedLanguageWorkspace.analysisPipelines === "object"
          ? savedLanguageWorkspace.analysisPipelines
          : {},
        analysisRulePacks: Array.isArray(savedLanguageWorkspace.analysisRulePacks)
          ? savedLanguageWorkspace.analysisRulePacks
          : [],
        corpora: Array.isArray(savedLanguageWorkspace.corpora)
          ? savedLanguageWorkspace.corpora
          : [],
      };
      setLanguageWorkspace(restoredLanguageWorkspace);
      void listLocalLibraryWorks()
        .then(setStoredLocalWorks)
        .catch(() => setStoredLocalWorks(restoredLanguageWorkspace.libraryImports));
      if (restoredLanguageWorkspace.dictionaryImports.length) {
        void Promise.all(
          [...restoredLanguageWorkspace.dictionaryImports]
            .reverse()
            .map(async (metadata) => ({
              metadata,
              stored: await getDictionaryLexicon(metadata.id).catch(() => null),
            })),
        ).then((records) => {
          setLanguageWorkspace((current) => {
            let profiles = current.profiles;
            let lexicons = current.lexicons || {};
            records.forEach(({ metadata, stored }) => {
              if (!stored?.entries?.length) return;
              const targetProfile = profiles.find((profile) => profile.id === metadata.language);
              if (targetProfile) {
                profiles = profiles.map((profile) => profile.id === targetProfile.id ? {
                  ...profile,
                  lexicon: metadata.mergeMode === "replace"
                    ? stored.entries
                    : mergeDictionaryEntries(profile.lexicon, stored.entries),
                } : profile);
              } else {
                lexicons = {
                  ...lexicons,
                  [metadata.language]: metadata.mergeMode === "replace"
                    ? stored.entries
                    : mergeDictionaryEntries(lexicons[metadata.language], stored.entries),
                };
              }
            });
            return { ...current, profiles, lexicons };
          });
        });
      }
      const savedModelConfig = JSON.parse(
        window.localStorage.getItem(MODEL_CONFIG_STORAGE_KEY) || "{}",
      );
      const savedModelSecret = window.sessionStorage.getItem(MODEL_SECRET_SESSION_KEY) || "";
      const restoredModelConfig = normalizeModelConfig({
        ...savedModelConfig,
        apiKey: savedModelSecret,
      });
      setModelConfig(restoredModelConfig);
      setModelDraft(restoredModelConfig);
      setHydrated(true);
      if (sharedTarget && sharedTarget.status !== "ok") {
        const message = {
          invalid: "分享链接中的 CTS URN 格式无效",
          "unsupported-work": "分享链接所指 CTS 版本尚未接入",
          "missing-passage": "分享链接所指 CTS 段落尚未载入",
          "missing-token": "分享链接所指 CTS 词位不存在",
        }[sharedTarget.status];
        if (message) showToast(message);
      }
    } catch {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      languageId,
      selectedTokenId,
      passageIndex,
      fontSize,
      segmented,
      translation,
      notes,
      bookmarks,
    }));
  }, [bookmarks, fontSize, hydrated, languageId, notes, passageIndex, segmented, selectedTokenId, translation]);

  useEffect(() => {
    if (!hydrated) return;
    const importedIds = new Set(
      (languageWorkspace.dictionaryImports || []).map((item) => item.id),
    );
    const withoutImportedEntries = (entries = []) => entries.filter(
      (entry) => !importedIds.has(entry.sourceJobId),
    );
    const compactWorkspace = {
      ...languageWorkspace,
      profiles: languageWorkspace.profiles.map((profile) => ({
        ...profile,
        lexicon: withoutImportedEntries(profile.lexicon),
      })),
      lexicons: Object.fromEntries(
        Object.entries(languageWorkspace.lexicons || {}).map(([language, entries]) => (
          [language, withoutImportedEntries(entries)]
        )),
      ),
    };
    window.localStorage.setItem(
      LANGUAGE_WORKSPACE_KEY,
      JSON.stringify(compactWorkspace),
    );
  }, [hydrated, languageWorkspace]);

  useEffect(() => {
    if (!hydrated || view !== "reader" || isAnalysisLayer || !selectedTokenCtsTarget) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("urn") === selectedTokenCtsTarget) return;
    url.searchParams.set("urn", selectedTokenCtsTarget);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [hydrated, isAnalysisLayer, selectedTokenCtsTarget, view]);

  useEffect(() => {
    if (passageIndex >= passages.length) setPassageIndex(Math.max(0, passages.length - 1));
  }, [passageIndex, passages.length]);

  useEffect(() => {
    const handleKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobilePanel(null);
        setModelSettingsOpen(false);
      }
      if (!["ArrowLeft", "ArrowRight"].includes(event.key) || ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
      const index = allTokens.findIndex((token) => token.id === selectedTokenId);
      const next = event.key === "ArrowRight" ? Math.min(index + 1, allTokens.length - 1) : Math.max(index - 1, 0);
      if (allTokens[next]) {
        setSelectedTokenId(allTokens[next].id);
        setSelectedLineIndex(allTokens[next].lineIndex);
        setPassageIndex(Math.floor(allTokens[next].lineIndex / passageSize));
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [allTokens, passageSize, selectedTokenId]);

  useEffect(() => {
    if (!searchOpen) return;
    setSearchIndex(0);
    setTimeout(() => searchRef.current?.focus(), 30);
  }, [searchOpen]);

  const chooseLanguage = (id) => {
    const next = library[id];
    setAnalysisPassage(null);
    setLanguageId(id);
    setSelectedTokenId(next.lines[0].tokens[0].id);
    setSelectedLineIndex(0);
    setPassageIndex(0);
    setSearchOpen(false);
    setTab("word");
    setView("reader");
    showToast(`已切换至${next.language}`);
  };

  const openAnalysisInReader = (id, payload) => {
    const profile = languageWorkspace.profiles.find((item) => item.id === id);
    const next = library[id] || (profile ? buildLanguageProfileWork(profile, payload) : null);
    const nextTokens = withSyntaxLinks((payload?.tokens || []).map((token) => ({ ...token })));
    if (!next || !nextTokens.length) {
      showToast("当前没有可放入阅读器的标注");
      return;
    }
    setAnalysisPassage({
      languageId: id,
      ctsUrn: payload.ctsUrn,
      text: payload.text,
      tokens: nextTokens,
      baseWork: next,
    });
    setLanguageId(id);
    setSelectedTokenId(nextTokens[0].id);
    setSelectedLineIndex(0);
    setPassageIndex(0);
    setTranslation(false);
    setSearchOpen(false);
    setTab("word");
    setView("reader");
    showToast("已加载当前 CTS 标注层");
  };

  const openLocalLibraryWork = async (workMetadata, requestedIndex = 0) => {
    const index = Math.max(0, Math.min(
      Number(requestedIndex) || 0,
      Math.max(0, workMetadata.passageCount - 1),
    ));
    try {
      const passage = await getLocalLibraryPassage(workMetadata.id, index);
      if (!passage) throw new Error("该段落尚未写入本地数据库");
      const profile = languageWorkspace.profiles.find(
        (item) => item.id === workMetadata.languageId,
      );
      const sourceTokens = tokenizeCustomText(
        passage.text,
        workMetadata.languageId,
        profile,
      );
      if (!sourceTokens.length) throw new Error("该段落没有可识别的正文");
      const prefix = `local-${workMetadata.id}-${index}`;
      const tokens = remapPassageTokens(sourceTokens, prefix);
      const safeWorkId = String(workMetadata.id).replace(/[^\p{L}\p{N}._-]+/gu, "-");
      setAnalysisPassage({
        languageId: workMetadata.languageId,
        ctsUrn: `urn:cts:local:${safeWorkId}.text.v1:${index + 1}`,
        text: passage.text,
        tokens,
        baseWork: buildLocalLibraryWork(workMetadata),
        localLibrary: {
          work: workMetadata,
          index,
          citation: passage.citation,
        },
      });
      setLanguageId(workMetadata.languageId);
      setSelectedTokenId(tokens[0].id);
      setSelectedLineIndex(0);
      setPassageIndex(0);
      setTranslation(false);
      setSearchOpen(false);
      setTab("word");
      setView("reader");
      requestAnimationFrame(() => document.querySelector(".reader-main")?.scrollTo({ top: 0 }));
    } catch (error) {
      showToast(error?.message || "无法读取本地作品");
    }
  };

  const restoreBaseEdition = () => {
    if (localLibraryContext) {
      setView("library");
      showToast("已返回书库");
      return;
    }
    const next = library[languageId];
    if (!next) {
      setView("languages");
      showToast("当前语言只有工作语料版本");
      return;
    }
    setAnalysisPassage(null);
    setSelectedTokenId(next.lines[0].tokens[0].id);
    setSelectedLineIndex(0);
    setPassageIndex(0);
    setTab("word");
    showToast("已返回原版文本");
  };

  const openVisiblePassageInLab = () => {
    const lines = visibleLines.map(({ line }) => line);
    const draftTokens = isAnalysisLayer
      ? analysisPassage.tokens.map((token) => ({ ...token }))
      : null;
    const draftText = isAnalysisLayer
      ? analysisPassage.text
      : lines.map((line) => (
        line.tokens.map((token) => token.form).join(languageId === "chinese" ? "" : " ")
      )).join("\n");
    const draftUrn = isAnalysisLayer
      ? analysisPassage.ctsUrn
      : readerPassageRangeUrn(languageId, lines.map((line) => line.n));
    setAnalysisDraft({
      id: `${languageId}-${draftUrn}-${Date.now()}`,
      languageId,
      text: draftText,
      ctsUrn: draftUrn,
      tokens: draftTokens,
      autoRun: !isAnalysisLayer,
    });
    setView("lab");
  };

  const openLanguageProfileInLab = (profileId) => {
    const profile = languageWorkspace.profiles.find((item) => item.id === profileId);
    if (!profile) return;
    setAnalysisDraft({
      id: `${profile.id}-${Date.now()}`,
      languageId: profile.id,
      text: profile.sample,
      ctsUrn: `urn:cts:lingua:custom.${profile.code}.v1:1.1`,
      autoRun: true,
    });
    setView("lab");
  };

  const navigateToCtsUrn = (source = searchQuery) => {
    const target = resolveReaderCtsTarget(source);
    if (target.status === "invalid") {
      showToast("CTS URN 格式无效");
      return;
    }
    if (target.status === "unsupported-work") {
      showToast("当前书库尚未接入该 CTS 版本");
      return;
    }
    if (target.status === "missing-passage") {
      showToast("已识别作品，但该 CTS 段落尚未载入");
      return;
    }
    if (target.status === "missing-token") {
      showToast("段落已找到，但 CTS 词位不存在");
      return;
    }

    const { location, parsed, targetToken } = target;
    const nextPassageSize = location.work.lines.length > 4 ? 3 : 2;
    setAnalysisPassage(null);
    setLanguageId(location.languageId);
    setSelectedTokenId(targetToken.id);
    setSelectedLineIndex(location.lineIndex);
    setPassageIndex(Math.floor(location.lineIndex / nextPassageSize));
    setSearchOpen(false);
    setSearchQuery("");
    setTab("word");
    setView("reader");
    showToast(parsed.subreference ? "已定位 CTS 词位" : "已定位 CTS 段落");
  };

  const copyCtsUrn = async (value, label) => {
    if (!value) return;
    try {
      if (!navigator.clipboard) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(value);
      showToast(`${label}已复制`);
    } catch {
      showToast("无法访问剪贴板，请从悬浮提示复制");
    }
  };

  const copyReaderLine = async (line) => {
    const value = readerLineText(line, languageId, selectedLanguageProfile);
    if (!value) {
      showToast("本行没有可复制的原文");
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard-unavailable");
      await navigator.clipboard.writeText(value);
      showToast(`第 ${line.n} 行原文已复制`);
    } catch {
      const field = document.createElement("textarea");
      field.value = value;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand?.("copy");
      field.remove();
      showToast(copied ? `第 ${line.n} 行原文已复制` : "无法访问剪贴板");
    }
  };

  const chooseToken = (token, lineIndex) => {
    setSelectedTokenId(token.id);
    setSelectedLineIndex(lineIndex);
    setTab("word");
    if (window.innerWidth <= 900) setMobilePanel("right");
  };

  const openModelSettings = () => {
    setModelDraft(modelConfig);
    setModelErrors({});
    setModelSettingsOpen(true);
  };

  const persistModelSettings = (draft = modelDraft) => {
    const errors = validateModelConfig(draft, { requireKey: false });
    setModelErrors(errors);
    if (Object.keys(errors).length) {
      showToast(Object.values(errors)[0]);
      return null;
    }
    const normalized = normalizeModelConfig(draft);
    window.localStorage.setItem(
      MODEL_CONFIG_STORAGE_KEY,
      JSON.stringify(persistentModelConfig(normalized)),
    );
    if (normalized.apiKey) {
      window.sessionStorage.setItem(MODEL_SECRET_SESSION_KEY, normalized.apiKey);
    } else {
      window.sessionStorage.removeItem(MODEL_SECRET_SESSION_KEY);
    }
    setModelConfig(normalized);
    setModelDraft(normalized);
    return normalized;
  };

  const saveModelSettings = () => {
    const saved = persistModelSettings();
    if (!saved) return;
    setModelTestState({ status: "idle" });
    setModelSettingsOpen(false);
    showToast(saved.apiKey ? "模型设置已保存，密钥仅限当前会话" : "模型终点已保存，尚未设置会话密钥");
  };

  const testConfiguredModel = async () => {
    const errors = validateModelConfig(modelDraft);
    setModelErrors(errors);
    if (Object.keys(errors).length) {
      showToast(Object.values(errors)[0]);
      return;
    }
    setModelTestState({ status: "testing" });
    try {
      const normalized = persistModelSettings(modelDraft);
      if (!normalized) return;
      const result = await testModelConnection(normalized);
      setModelTestState({ status: "ok", ...result });
      showToast(result.modelAvailable === false ? "终点可用，但模型 ID 尚未匹配" : "模型连接测试通过");
    } catch (error) {
      setModelTestState({ status: "error", message: error?.message || "模型连接测试失败" });
    }
  };

  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(window.__linguaToast);
    window.__linguaToast = window.setTimeout(() => setToast(""), 2200);
  };

  const addNote = () => {
    if (!noteText.trim()) return;
    setNotes([{
      id: Date.now(),
      text: noteText.trim(),
      token: selectedToken.form,
      tokenId: selectedToken.id,
      languageId,
      passage: currentLine.n,
    }, ...notes]);
    setNoteText("");
    showToast("笔记已保存在此设备");
  };

  const toggleBookmark = () => {
    if (isBookmarked) {
      setBookmarks(bookmarks.filter((item) => item.key !== selectedBookmarkKey));
      showToast(`已取消收藏“${selectedToken.form}”`);
      return;
    }
    setBookmarks([{
      key: selectedBookmarkKey,
      languageId,
      tokenId: selectedToken.id,
      form: selectedToken.form,
      lemma: selectedToken.lemma,
      work: work.title,
      passage: currentLine.n,
    }, ...bookmarks]);
    showToast(`已收藏“${selectedToken.form}”`);
  };

  const openBookmark = (item) => {
    const nextWork = library[item.languageId]
      || (analysisPassage?.languageId === item.languageId ? work : null);
    if (!nextWork) {
      showToast("该收藏所对应的临时语料已不在当前会话");
      return;
    }
    const lineIndex = nextWork.lines.findIndex((line) => line.tokens.some((token) => token.id === item.tokenId));
    if (library[item.languageId]) setAnalysisPassage(null);
    setLanguageId(item.languageId);
    setSelectedTokenId(item.tokenId);
    setSelectedLineIndex(Math.max(0, lineIndex));
    setPassageIndex(Math.max(0, Math.floor(Math.max(0, lineIndex) / (nextWork.lines.length > 4 ? 3 : 2))));
    setTab("word");
    setView("reader");
  };

  const navigatePassage = (nextIndex) => {
    if (localLibraryContext) {
      void openLocalLibraryWork(localLibraryContext.work, nextIndex);
      return;
    }
    if (nextIndex < 0 || nextIndex >= passages.length) return;
    const first = passages[nextIndex][0];
    setPassageIndex(nextIndex);
    setSelectedLineIndex(first.lineIndex);
    setSelectedTokenId(first.line.tokens[0].id);
    document.querySelector(".reader-main")?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const searchWorks = [
    ...searchableWorks.map((item) => ({ ...item, kind: "built-in" })),
    ...localWorks.map((work) => ({
      id: work.id,
      kind: "local",
      title: work.title,
      titleZh: work.titleZh,
      author: work.author,
      language: work.languageName,
      meta: `${work.format.toUpperCase()} · ${work.passageCount.toLocaleString()} 段 · 本地`,
      localWork: work,
    })),
  ];
  const filteredWorks = searchWorks.filter((item) => {
    const haystack = `${item.title} ${item.titleZh} ${item.author} ${item.language}`.toLowerCase();
    return haystack.includes(searchQuery.toLowerCase());
  });
  const isCtsSearch = searchQuery.trim().toLocaleLowerCase().startsWith("urn:cts:");
  const parsedSearchCts = isCtsSearch ? parseCtsNavigationUrn(searchQuery) : null;
  const ctsSearchLocation = resolveReaderCtsLocation(parsedSearchCts);
  const hasCtsSearchResult = Boolean(parsedSearchCts && ctsSearchLocation?.lineIndex >= 0);
  const searchResultCount = isCtsSearch ? Number(hasCtsSearchResult) : filteredWorks.length;
  const selectedSearchResultId = searchResultCount
    ? isCtsSearch
      ? "reader-search-result-cts"
      : `reader-search-result-${filteredWorks[Math.min(searchIndex, filteredWorks.length - 1)].id}`
    : undefined;

  const handleSearchKeyDown = (event) => {
    if (["ArrowDown", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      if (!searchResultCount) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setSearchIndex((current) => (current + direction + searchResultCount) % searchResultCount);
      return;
    }
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (isCtsSearch) {
      navigateToCtsUrn();
      return;
    }
    const selectedWork = filteredWorks[Math.min(searchIndex, filteredWorks.length - 1)];
    if (selectedWork) {
      if (selectedWork.kind === "local") void openLocalLibraryWork(selectedWork.localWork);
      else chooseLanguage(selectedWork.id);
    }
  };

  return (
    <div className="app-shell" data-hydrated={hydrated ? "true" : "false"}>
      <header className="topbar">
        <div className="brand-zone">
          <button className="mobile-icon" onClick={() => setMobilePanel("left")} aria-label="打开目录"><Icon name="menu" /></button>
          <button className="brand" onClick={() => setView("reader")}>
            <span className="brand-mark">L</span>
            <span className="brand-name">Lingua</span>
            <span className="brand-product">Reader</span>
          </button>
        </div>
        <nav className="topnav" aria-label="主导航">
          {primaryNavigation.map((item) => (
            item.view ? (
              <button
                className={`nav-link ${view === item.view ? "active" : ""}`}
                onClick={() => {
                  if (item.view === "lab") setAnalysisDraft(null);
                  setView(item.view);
                }}
                key={item.id}
              >
                {item.label}
              </button>
            ) : (
              <a
                className={`nav-link ${item.secondary ? "nav-link-secondary" : ""}`}
                href={item.href}
                key={item.id}
              >
                {item.label}
              </a>
            )
          ))}
        </nav>
        <div className="top-actions">
          <button className="search-trigger" onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={16} />
            <span>搜索作品、作者或段落</span>
            <kbd>⌘ K</kbd>
          </button>
          <button
            className={`top-model-settings ${modelConnection.tested ? "connected" : modelConnection.configured ? "configured" : ""}`}
            onClick={openModelSettings}
            aria-label="模型设置"
            title={modelConnection.tested ? `${modelConnection.model} 已连接` : "配置模型终点与密钥"}
          >
            <Icon name="settings" size={17} />
            <i aria-hidden="true" />
          </button>
          <button className="avatar" onClick={() => showToast("当前为原型访客会话")}>游</button>
        </div>
      </header>

      {view === "reader" ? (
        <>
      <main className={`reader-layout ${leftOpen ? "" : "left-collapsed"} ${rightOpen ? "" : "right-collapsed"}`}>
        <aside className="left-sidebar">
          <div className="work-card">
            <div className="book-mark">{work.coverMark}</div>
            <div className="work-summary">
              <div className="eyebrow">{work.language}</div>
              <h2 lang={work.lang}>{work.title}</h2>
              <p>{work.titleZh} · {work.author.split(" · ").slice(-1)}</p>
            </div>
          </div>
          <div className="progress-row">
            <span>阅读进度</span>
            <span>{Math.round(readingProgress)}%</span>
            <div className="progress-track"><i style={{ width: `${readingProgress}%` }} /></div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">卷目</div>
            <div className="chapter-list">
              {work.chapters.map((chapter, index) => (
                <button key={chapter.label} className={`chapter-row ${index === 0 ? "active" : "unavailable"}`} onClick={() => index === 0 ? navigatePassage(0) : showToast(`${chapter.label}尚未接入语料`)}>
                  <span className="chapter-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="chapter-copy"><strong>{chapter.label}</strong><small>{chapter.detail}</small></span>
                  <Icon name="chevronRight" size={15} />
                </button>
              ))}
            </div>
            <div className="section-label subsection-label">本章段落</div>
            <div className="passage-short-list">
              {localLibraryContext
                ? Array.from({
                  length: Math.min(7, localLibraryContext.work.passageCount),
                }, (_, offset) => {
                  const start = Math.max(0, Math.min(
                    localLibraryContext.index - 3,
                    localLibraryContext.work.passageCount - 7,
                  ));
                  return start + offset;
                }).map((index) => (
                  <button
                    key={index}
                    className={localLibraryContext.index === index ? "active" : ""}
                    onClick={() => void openLocalLibraryWork(localLibraryContext.work, index)}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {index === localLibraryContext.index ? localLibraryContext.citation : `第 ${index + 1} 段`}
                  </button>
                ))
                : passages.map((passage, index) => {
                  const first = passage[0].line.n;
                  const last = passage[passage.length - 1].line.n;
                  return <button key={index} className={passageIndex === index ? "active" : ""} onClick={() => navigatePassage(index)}><span>{String(index + 1).padStart(2, "0")}</span>{first}{first !== last ? `–${last}` : ""}</button>;
                })}
            </div>
          </div>
          <div className="sidebar-footer">
            <div><Icon name="info" size={15} /><span>版本</span></div>
            <button onClick={() => showToast(work.edition)}>{work.edition}</button>
          </div>
        </aside>

        <button className="rail-toggle rail-left" onClick={() => setLeftOpen(!leftOpen)} aria-label="收起或展开目录">
          <Icon name={leftOpen ? "arrowLeft" : "arrowRight"} size={15} />
        </button>

        <section className="reader-main">
          <div className="reader-toolbar">
            <div className="breadcrumbs">
              <span>{work.author.split(" · ")[0]}</span><Icon name="chevronRight" size={13} /><strong>{work.title}</strong><Icon name="chevronRight" size={13} /><span>{work.passage.split(" · ")[0]}</span>
            </div>
            <div className="reader-controls">
              <div className="language-select-wrap">
                <select value={languageId} onChange={(event) => chooseLanguage(event.target.value)} aria-label="切换文本语言">
                  {Object.values(library).map((item) => <option value={item.id} key={item.id}>{item.language}</option>)}
                  {!library[languageId] && baseWork && <option value={languageId}>{baseWork.language} · 工作语料</option>}
                </select>
                <Icon name="chevronDown" size={14} />
              </div>
              <span className="toolbar-divider" />
              <Toggle active={segmented} onClick={() => setSegmented(!segmented)} icon="rows" label="分词" />
              <Toggle active={translation} onClick={() => setTranslation(!translation)} icon="translate" label="译文" />
              <button className="tool-toggle passage-analysis-action" onClick={openVisiblePassageInLab}>
                <Icon name="spark" size={16} /><span>{isAnalysisLayer ? "继续分析" : "分析本段"}</span>
              </button>
              <span className="toolbar-divider" />
              <div className="font-controls" aria-label="字号调整">
                <button onClick={() => setFontSize(Math.max(19, fontSize - 2))}>A−</button>
                <button onClick={() => setFontSize(Math.min(35, fontSize + 2))}>A+</button>
              </div>
              <button className="icon-button compact" onClick={() => showToast("阅读偏好已自动保存")} aria-label="阅读设置"><Icon name="settings" size={17} /></button>
            </div>
          </div>

          <div className="passage-nav">
            <button
              disabled={localLibraryContext ? localLibraryContext.index === 0 : passageIndex === 0}
              onClick={() => localLibraryContext
                ? void openLocalLibraryWork(localLibraryContext.work, localLibraryContext.index - 1)
                : navigatePassage(passageIndex - 1)}
            >
              <Icon name="arrowLeft" size={16} />上一段
            </button>
            {localLibraryContext ? (
              <span className="local-passage-position" aria-label="当前本地书库段落">
                <strong>{localLibraryContext.citation}</strong>
                <small>{localLibraryContext.index + 1} / {localLibraryContext.work.passageCount}</small>
              </span>
            ) : (
              <label className="passage-picker">
                <select aria-label="选择段落" value={passageIndex} onChange={(event) => navigatePassage(Number(event.target.value))}>
                  {passages.map((passage, index) => {
                    const first = passage[0].line.n;
                    const last = passage[passage.length - 1].line.n;
                    return <option value={index} key={index}>{work.passage.split(" · ")[0]} · {first}{first !== last ? `–${last}` : ""}</option>;
                  })}
                </select>
                <Icon name="chevronDown" size={14} />
              </label>
            )}
            <button
              disabled={localLibraryContext
                ? localLibraryContext.index === localLibraryContext.work.passageCount - 1
                : passageIndex === passages.length - 1}
              onClick={() => localLibraryContext
                ? void openLocalLibraryWork(localLibraryContext.work, localLibraryContext.index + 1)
                : navigatePassage(passageIndex + 1)}
            >
              下一段<Icon name="arrowRight" size={16} />
            </button>
          </div>

          <article className="text-stage" style={{ "--reader-font-size": `${fontSize}px` }}>
            <header className="text-heading">
              <div className="edition-kicker">{work.edition}</div>
              <h1 lang={work.lang}>{work.title} <span>{work.titleZh}</span></h1>
              <p>{passageLabel}</p>
            </header>
            <div className={`original-text ${segmented ? "is-segmented" : ""}`} lang={work.lang} dir={work.direction}>
              {visibleLines.map(({ line, lineIndex }) => (
                <div className={`text-line ${selectedLineIndex === lineIndex ? "current-line" : ""}`} key={line.n}>
                  <div className="line-gutter">
                    <button
                      className="line-number"
                      onClick={() => copyCtsUrn(
                        isAnalysisLayer ? currentPassageUrn : readerPassageUrn(languageId, line.n),
                        "CTS 段落 URN",
                      )}
                      aria-label={`第 ${line.n} 行`}
                      title={isAnalysisLayer ? currentPassageUrn : readerPassageUrn(languageId, line.n)}
                    >
                      {line.n}
                    </button>
                    <button
                      className="line-copy-button"
                      onClick={() => void copyReaderLine(line)}
                      aria-label={`复制本行原文，行号 ${line.n}`}
                      title="复制本行原文"
                    >
                      <Icon name="copy" size={12} />
                    </button>
                  </div>
                  <div className="line-content">
                    <div className="token-row">
                      {line.tokens.map((token) => (
                        <button
                          key={token.id}
                          className={`token ${selectedTokenId === token.id ? "selected" : ""}`}
                          onClick={() => chooseToken(token, lineIndex)}
                          title={`${token.lemma} · ${token.pos}`}
                        >
                          <span>{token.form}</span>
                          {segmented && <small>{token.pos}</small>}
                        </button>
                      ))}
                    </div>
                    {translation && <p className="translation-line">{line.translation}</p>}
                  </div>
                </div>
              ))}
            </div>
            <footer className="text-footer">
              <div><span className="status-dot" />本段 {visibleLines.reduce((sum, item) => sum + item.line.tokens.length, 0)} 个词项 · 全章 {allTokens.length} 个</div>
              {isAnalysisLayer ? (
                <p className="annotation-layer-status">
                  {localLibraryContext ? "本地书库 · IndexedDB 按段加载" : `CTS 标注层 · ${analysisPassage.ctsUrn}`}
                  <button onClick={restoreBaseEdition}>
                    {localLibraryContext ? "返回书库" : library[languageId] ? "返回原版" : "返回语言工作台"}
                  </button>
                </p>
              ) : <p>提示：点击词语查看词形信息，使用 ← → 快速切换</p>}
            </footer>
          </article>
        </section>

        <button className="rail-toggle rail-right" onClick={() => setRightOpen(!rightOpen)} aria-label="收起或展开分析面板">
          <Icon name={rightOpen ? "arrowRight" : "arrowLeft"} size={15} />
        </button>

        <aside className="analysis-panel">
          <div className="analysis-tabs" role="tablist">
            <button className={tab === "word" ? "active" : ""} onClick={() => setTab("word")}>词语</button>
            <button className={tab === "syntax" ? "active" : ""} onClick={() => setTab("syntax")}>句法</button>
            <button className={tab === "grammar" ? "active" : ""} onClick={() => setTab("grammar")}>语法</button>
            <button className={tab === "notes" ? "active" : ""} onClick={() => setTab("notes")}>笔记{notes.length > 0 && <i>{notes.length}</i>}</button>
            <button className={tab === "saved" ? "active" : ""} onClick={() => setTab("saved")}>收藏{bookmarks.length > 0 && <i>{bookmarks.length}</i>}</button>
            <button className="close-mobile" onClick={() => setMobilePanel(null)} aria-label="关闭"><Icon name="close" size={18} /></button>
          </div>

          {tab === "word" && selectedToken && (
            <div className="analysis-scroll">
              <div className="word-hero">
                <div>
                  <span className="analysis-label">已选择 · 第 {work.lines[selectedToken.lineIndex].n} 行</span>
                  <h2 lang={work.lang}>{selectedToken.form}</h2>
                  <p>{selectedIpa[0] || selectedToken.reading}</p>
                </div>
                <div className="word-hero-actions">
                  {selectedTokenCtsTarget && (
                    <button
                      className="cts-target-button"
                      onClick={() => copyCtsUrn(selectedTokenCtsTarget, "CTS 词位")}
                      aria-label="复制 CTS 词位"
                      title={selectedTokenCtsTarget}
                    >
                      CTS
                    </button>
                  )}
                  <button className={`bookmark-button ${isBookmarked ? "active" : ""}`} onClick={toggleBookmark} aria-label={isBookmarked ? "取消收藏词语" : "收藏词语"}><Icon name="bookmark" /></button>
                </div>
              </div>

              <div className="lemma-row">
                <span>词元</span>
                <strong lang={work.lang}>{selectedToken.lemma}</strong>
                <button onClick={() => { navigator.clipboard?.writeText(selectedToken.lemma); showToast("词元已复制"); }} aria-label="复制词元"><Icon name="copy" size={15} /></button>
              </div>

              {(selectedIpa.length > 0 || selectedPronunciations.length > 0) && (
                <div className="pronunciation-row">
                  <span>发音</span>
                  <div>
                    {selectedIpa.length > 0 && <strong>{selectedIpa.join(" · ")}</strong>}
                    {selectedPronunciations.slice(0, 2).map((item) => (
                      <span className="pronunciation-audio" key={item.url}>
                        <audio controls preload="none" src={item.url} aria-label={`${selectedToken.form}的发音`} />
                        <a href={item.sourceUrl} target="_blank" rel="noreferrer" title={item.file}>
                          {item.provider}
                        </a>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <section className="analysis-section">
                <div className="analysis-section-title">
                  <span>词法分析</span>
                  {selectedLexicon.status === "ok"
                    ? <a className="wiktionary-source-link" href={selectedLexicon.sourceUrl} target="_blank" rel="noreferrer">Wiktionary · {selectedLexicon.sourceLanguage}</a>
                    : <em>{selectedLexicon.status === "loading" ? "查询 Wiktionary…" : "本地回退"}</em>}
                </div>
                <div className="pos-line">
                  <span className="pos-badge">{selectedToken.pos}</span>
                  <span>{selectedToken.role}</span>
                </div>
                {selectedLexiconCandidates.length > 0 && (
                  <div className="wiktionary-candidate-list">
                    <small>Wiktionary 屈折候选</small>
                    {selectedLexiconCandidates.map((candidate, index) => (
                      <div key={candidate.lgrTags.join(".")}>
                        <i>{index + 1}</i>
                        <span>{candidate.labels.join(" · ")}</span>
                        <b>{candidate.lgrTags.join(".")}</b>
                      </div>
                    ))}
                  </div>
                )}
                <div className="morph-grid">
                  {selectedToken.morphology.map((item, index) => (
                    <div key={`${item}-${index}`}><small>{["属性", "数/体", "格/态", "人称"][index] || "特征"}</small><strong>{item}</strong></div>
                  ))}
                </div>
              </section>

              <section className="analysis-section">
                <div className="analysis-section-title"><span>词典与语境</span><button onClick={() => showToast("已保留本地语境分析")}><Icon name="spark" size={14} />语境分析</button></div>
                <p className="definition">{selectedToken.gloss}</p>
                <div className="wiktionary-senses" aria-live="polite">
                  {selectedLexicon.status === "loading" && <span>正在查询 Wiktionary 词条…</span>}
                  {selectedLexicon.status === "ok" && (
                    <>
                      <span className="wiktionary-pos">
                        {selectedLexicon.entries.map((entry) => entry.partOfSpeech).filter((value, index, values) => values.indexOf(value) === index).join(" / ")}
                      </span>
                      <ol>
                        {selectedLexiconDefinitions.map((definition) => <li key={definition}>{definition}</li>)}
                      </ol>
                    </>
                  )}
                  {selectedLexicon.status === "not_found" && <span>Wiktionary 暂无对应义项，显示本地释义。</span>}
                  {selectedLexicon.status === "unavailable" && <span>Wiktionary 暂时不可用，显示本地释义。</span>}
                  {selectedLexicon.status === "not_configured" && <span>该语言尚未配置 Wiktionary 映射，显示初始化词表。</span>}
                </div>
                <div className="context-note"><Icon name="spark" size={16} /><p>在本句中充当<strong>{selectedToken.role}</strong>，{selectedToken.relation}。</p></div>
              </section>

              <section className="analysis-section">
                <div className="analysis-section-title"><span>分析可信度</span><strong>{selectedToken.confidence}%</strong></div>
                <div className="confidence-track"><i style={{ width: `${selectedToken.confidence}%` }} /></div>
                <p className="muted-note">
                  {selectedLexicon.status === "not_configured"
                    ? "当前使用语言初始化词表；词形特征与句中功能保留本地校订结果。"
                    : "词典义项以 Wiktionary 为主；词形特征与句中功能保留本地校订结果。"}
                </p>
              </section>
            </div>
          )}

          {tab === "syntax" && (
            <div className="analysis-scroll">
              <div className="syntax-head">
                <span className="analysis-label">当前句 · 第 {currentLine.n} 行</span>
                <h2>依存关系</h2>
                {currentLine.translation && <p>{currentLine.translation}</p>}
              </div>
              <div className="syntax-canvas reader-syntax-tree">
                <div className="syntax-tree-scroll">
                  <div className="syntax-tree" role="tree" aria-label="阅读器依存树">
                    {currentSyntaxRoot && (
                      <SyntaxTreeBranch
                        token={currentSyntaxRoot}
                        childrenByHead={currentSyntaxChildren}
                        activeTokenId={selectedTokenId}
                        onSelect={(token) => chooseToken(token, selectedToken.lineIndex)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "grammar" && selectedToken && (
            <div className="analysis-scroll grammar-reference-pane">
              <div className="grammar-reference-word">
                <span className="analysis-label">第 {work.lines[selectedToken.lineIndex].n} 行</span>
                <h2 lang={work.lang}>{selectedToken.form}</h2>
                <span>{selectedToken.lemma}</span>
              </div>

              <table className="grammar-analysis-table" aria-label={`${selectedToken.form}的词法分析`}>
                <tbody>
                  <tr>
                    <th scope="row">词性</th>
                    <td>
                      {selectedLexicon.status === "ok"
                        ? selectedLexicon.entries.map((entry) => entry.partOfSpeech)
                          .filter((value, index, values) => values.indexOf(value) === index)
                          .join(" / ") || selectedToken.pos
                        : selectedToken.pos}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">Leipzig</th>
                    <td className="grammar-lgr-tags">
                      {selectedLgr.tags.length ? selectedLgr.tags.map((tag) => (
                        <span className="lgr-tag" key={tag} tabIndex={0} aria-label={`${tag}：${leipzigTagDescription(tag)}`}>
                          <b>{tag}</b>
                          <span className="lgr-tag-tooltip" role="tooltip">{leipzigTagDescription(tag)}</span>
                        </span>
                      )) : "—"}
                    </td>
                  </tr>
                  <tr>
                    <th scope="row">词法特征</th>
                    <td>{selectedToken.morphology.join(" · ") || "—"}</td>
                  </tr>
                  <tr>
                    <th scope="row">释义</th>
                    <td>{selectedLexiconDefinitions[0] || selectedImportedLexicon?.gloss || selectedToken.gloss}</td>
                  </tr>
                  <tr>
                    <th scope="row">来源</th>
                    <td>
                      {selectedLexicon.status === "loading" && "正在查询 Wiktionary…"}
                      {selectedLexicon.status === "ok" && (
                        <a className="wiktionary-source-link" href={selectedLexicon.sourceUrl} target="_blank" rel="noreferrer">
                          Wiktionary · {selectedLexicon.sourceLanguage}
                        </a>
                      )}
                      {["not_found", "unavailable"].includes(selectedLexicon.status) && (
                        selectedImportedLexicon
                          ? `${selectedImportedLexicon.sourceTitle || "扫描词典"}${selectedImportedLexicon.page ? ` · 第 ${selectedImportedLexicon.page} 页` : ""}`
                          : "Wiktionary 无可用结果 · 本地校订"
                      )}
                      {selectedLexicon.status === "not_configured" && (
                        selectedImportedLexicon
                          ? `${selectedImportedLexicon.sourceTitle || "初始化词表"}${selectedImportedLexicon.page ? ` · 第 ${selectedImportedLexicon.page} 页` : ""}`
                          : "初始化词表 · 本地校订"
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>

              {selectedLexiconCandidates.length > 0 && (
                <table className="grammar-analysis-table grammar-candidate-table" aria-label="Wiktionary 词形候选">
                  <thead>
                    <tr><th>候选</th><th>标签</th></tr>
                  </thead>
                  <tbody>
                    {selectedLexiconCandidates.map((candidate, index) => (
                      <tr key={candidate.lgrTags.join(".")}>
                        <th scope="row">{index + 1}</th>
                        <td>
                          <span>{candidate.labels.join(" · ")}</span>
                          <small>{candidate.lgrTags.join(".")}</small>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <table className="grammar-analysis-table syntax-reference-table" aria-label="句中语法关系">
                <tbody>
                  <tr><th scope="row">句法成分</th><td>{selectedToken.role || "—"}</td></tr>
                  <tr><th scope="row">依存关系</th><td>{selectedSyntaxToken?.dependency || "—"}</td></tr>
                  <tr><th scope="row">支配词</th><td>{selectedSyntaxHead ? `${selectedSyntaxHead.form} · ${selectedSyntaxHead.lemma}` : "ROOT"}</td></tr>
                  <tr><th scope="row">语境说明</th><td>{selectedToken.relation || "—"}</td></tr>
                </tbody>
              </table>

              <div className="grammar-reference-sources">
                {selectedGrammarJobs.length ? selectedGrammarJobs.map((job) => (
                  <div key={job.id}>
                    <span><strong>{job.title}</strong><small>{job.meta}</small></span>
                    <em>{job.status === "waiting-model" ? "等待模型生成" : job.status}</em>
                  </div>
                )) : (
                  <p>尚未为该语言建立语法参考；当前表格来自词典查询与句中校订。</p>
                )}
              </div>
            </div>
          )}

          {tab === "notes" && (
            <div className="analysis-scroll notes-pane">
              <div className="notes-head">
                <span className="analysis-label">阅读随记</span>
                <h2>我的笔记</h2>
                <p>笔记会关联到当前词语与段落。</p>
              </div>
              <div className="note-editor">
                <div className="note-context">关联词语：<strong lang={work.lang}>{selectedToken.form}</strong></div>
                <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="写下释义、疑问或阅读心得…" />
                <button onClick={addNote}><Icon name="note" size={16} />保存笔记</button>
              </div>
              <div className="notes-list">
                {notes.length === 0 ? (
                  <div className="empty-notes"><Icon name="note" size={24} /><p>还没有笔记</p><span>选中正文中的词语，然后在这里记录。</span></div>
                ) : notes.map((note) => (
                  <div className="saved-note" key={note.id}>
                    <div><span>{note.token}</span><small>{library[note.languageId]?.title || work.title} · {note.passage || "当前段"}</small></div>
                    <button onClick={() => setNotes(notes.filter((item) => item.id !== note.id))} aria-label={`删除关于${note.token}的笔记`}><Icon name="close" size={14} /></button>
                    <p>{note.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "saved" && (
            <div className="analysis-scroll saved-pane">
              <div className="notes-head">
                <span className="analysis-label">设备本地收藏</span>
                <h2>收藏词语</h2>
                <p>点击收藏项可返回对应文本位置。</p>
              </div>
              {bookmarks.length === 0 ? (
                <div className="empty-notes"><Icon name="bookmark" size={24} /><p>还没有收藏词语</p><span>在词法面板中点击书签图标即可收藏。</span></div>
              ) : (
                <div className="bookmark-list">
                  {bookmarks.map((item) => (
                    <div className="bookmark-item" key={item.key}>
                      <button onClick={() => openBookmark(item)}>
                        <strong>{item.form}</strong><span>{item.lemma}</span><small>{item.work} · {item.passage}</small>
                      </button>
                      <button onClick={() => setBookmarks(bookmarks.filter((bookmark) => bookmark.key !== item.key))} aria-label={`删除收藏${item.form}`}><Icon name="close" size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </main>

      <div className="mobile-bar">
        <button onClick={() => setMobilePanel("left")}><Icon name="library" /><span>目录</span></button>
        <button className="active"><Icon name="type" /><span>正文</span></button>
        <button onClick={() => setMobilePanel("right")}><Icon name="spark" /><span>分析</span></button>
      </div>

      {mobilePanel && <div className="mobile-backdrop" onClick={() => setMobilePanel(null)} />}
      {mobilePanel === "left" && (
        <div className="mobile-drawer show-left">
          <div className="drawer-inner drawer-toc">
            <div className="drawer-title"><strong>目录</strong><button onClick={() => setMobilePanel(null)}><Icon name="close" /></button></div>
            <div className="work-card"><div className="book-mark">{work.coverMark}</div><div className="work-summary"><div className="eyebrow">{work.language}</div><h2>{work.title}</h2><p>{work.titleZh}</p></div></div>
            <div className="chapter-list">{work.chapters.map((chapter, index) => <button key={chapter.label} className={`chapter-row ${chapter.active ? "active" : ""}`} onClick={() => { showToast(index === 0 ? "已在当前章节" : `${chapter.label}示例内容尚未载入`); setMobilePanel(null); }}><span className="chapter-index">{String(index + 1).padStart(2, "0")}</span><span className="chapter-copy"><strong>{chapter.label}</strong><small>{chapter.detail}</small></span><Icon name="chevronRight" size={15} /></button>)}</div>
          </div>
        </div>
      )}
        </>
      ) : view === "library" ? (
        <LibraryView
          onOpenWork={chooseLanguage}
          onOpenLocalWork={openLocalLibraryWork}
          localWorks={localWorks}
          bookmarks={bookmarks}
          notes={notes}
          lastLanguage={languageId}
        />
      ) : view === "lab" ? (
        <AnalysisLab
          key={analysisDraft?.id || "blank-analysis"}
          initialDraft={analysisDraft}
          onOpenReader={openAnalysisInReader}
          showToast={showToast}
          languageProfiles={languageWorkspace.profiles}
          analysisPipelines={languageWorkspace.analysisPipelines}
          analysisRulePacks={languageWorkspace.analysisRulePacks}
          corpora={languageWorkspace.corpora}
          modelConfig={modelConfig}
        />
      ) : (
        <LanguageWorkspace
          workspace={languageWorkspace}
          setWorkspace={setLanguageWorkspace}
          showToast={showToast}
          onOpenLab={openLanguageProfileInLab}
          modelConnection={modelConnection}
          onOpenModelSettings={openModelSettings}
        />
      )}

      {modelSettingsOpen && (
        <ModelSettingsDialog
          config={modelDraft}
          errors={modelErrors}
          testState={modelTestState}
          onChange={(next) => {
            setModelDraft(next);
            setModelErrors({});
            if (modelTestState.status !== "testing") setModelTestState({ status: "idle" });
          }}
          onClose={() => setModelSettingsOpen(false)}
          onSave={saveModelSettings}
          onTest={testConfiguredModel}
        />
      )}

      {searchOpen && (
        <div className="command-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
          <div className="command-dialog" role="dialog" aria-modal="true" aria-label="搜索书库">
            <div className="command-input">
              <Icon name="search" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSearchIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                aria-controls="reader-search-results"
                aria-activedescendant={selectedSearchResultId}
                placeholder="搜索作品、作者、语言或 CTS URN…"
              />
              <button onClick={() => setSearchOpen(false)}>ESC</button>
            </div>
            <div className="command-label">{isCtsSearch ? "CTS 定位" : "可阅读作品"}</div>
            <div id="reader-search-results" className="search-results" role="listbox" aria-label="搜索结果">
              {isCtsSearch ? (
                parsedSearchCts && ctsSearchLocation?.lineIndex >= 0 ? (
                  <button
                    id="reader-search-result-cts"
                    className={`cts-search-result ${searchIndex === 0 ? "selected" : ""}`}
                    onMouseEnter={() => setSearchIndex(0)}
                    onClick={() => navigateToCtsUrn()}
                    role="option"
                    aria-selected={searchIndex === 0}
                  >
                    <span className="result-mark">@</span>
                    <span>
                      <strong>CTS {parsedSearchCts.passage}{parsedSearchCts.subreference ? ` · ${parsedSearchCts.subreference.form}[${parsedSearchCts.subreference.occurrence}]` : ""}</strong>
                      <small>{parsedSearchCts.urn}{parsedSearchCts.subreference ? `@${parsedSearchCts.subreference.form}[${parsedSearchCts.subreference.occurrence}]` : ""}</small>
                    </span>
                    <em>{library[ctsSearchLocation.languageId].language}</em>
                  </button>
                ) : (
                  <div className="empty-search">
                    {!parsedSearchCts
                      ? "CTS URN 格式无效"
                      : ctsSearchLocation
                        ? "作品已识别，但该段落尚未载入"
                        : "当前书库尚未接入该 CTS 版本"}
                  </div>
                )
              ) : (
                <>
                  {filteredWorks.map((item, index) => (
                    <button
                      id={`reader-search-result-${item.id}`}
                      className={searchIndex === index ? "selected" : ""}
                      key={item.id}
                      onMouseEnter={() => setSearchIndex(index)}
                      onClick={() => item.kind === "local"
                        ? void openLocalLibraryWork(item.localWork)
                        : chooseLanguage(item.id)}
                      role="option"
                      aria-selected={searchIndex === index}
                    >
                      <span className="result-mark">
                        {item.kind === "local" ? item.localWork.coverMark : library[item.id].coverMark}
                      </span>
                      <span><strong>{item.title} <i>《{item.titleZh}》</i></strong><small>{item.author} · {item.meta}</small></span>
                      <em>{item.language}</em>
                    </button>
                  ))}
                  {filteredWorks.length === 0 && <div className="empty-search">没有找到匹配的作品</div>}
                </>
              )}
            </div>
            <div className="command-footer"><span>↑↓ 选择</span><span>↵ {isCtsSearch ? "定位" : "打开"}</span><span>ESC 关闭</span></div>
          </div>
        </div>
      )}

      {mobilePanel === "right" && <div className="analysis-mobile-clone" onClick={(e) => e.stopPropagation()}>
        <div className="mobile-analysis-head"><strong>语言学分析</strong><button onClick={() => setMobilePanel(null)}><Icon name="close" /></button></div>
        <div className="mobile-word-card">
          <span>第 {work.lines[selectedToken.lineIndex].n} 行 · {selectedToken.pos}</span>
          <h2 lang={work.lang}>{selectedToken.form}</h2>
          <p className="mobile-lemma">{selectedToken.lemma} · {selectedToken.reading}</p>
          <div className="mobile-tags">{selectedToken.morphology.map((item) => <i key={item}>{item}</i>)}</div>
          <h3>语境释义</h3><p>{selectedToken.gloss}</p>
          <div className="wiktionary-senses mobile-wiktionary" aria-live="polite">
            {selectedLexicon.status === "loading" && <span>正在查询 Wiktionary…</span>}
            {selectedLexicon.status === "ok" && (
              <>
                <a className="wiktionary-source-link" href={selectedLexicon.sourceUrl} target="_blank" rel="noreferrer">
                  Wiktionary · {selectedLexicon.sourceLanguage}
                </a>
                {selectedLexiconDefinitions[0] && <p>{selectedLexiconDefinitions[0]}</p>}
              </>
            )}
            {["not_found", "unavailable"].includes(selectedLexicon.status) && <span>Wiktionary 无可用结果 · 本地释义</span>}
            {selectedLexicon.status === "not_configured" && <span>初始化词表 · 本地释义</span>}
          </div>
          <div className="context-note"><Icon name="spark" size={16} /><p>在本句中充当<strong>{selectedToken.role}</strong>，{selectedToken.relation}。</p></div>
          <button className="mobile-full-analysis" onClick={() => { setMobilePanel(null); showToast("桌面端可查看完整句法分析"); }}>查看完整分析</button>
        </div>
      </div>}

      <div className={`toast ${toast ? "show" : ""}`} role="status"><Icon name="check" size={16} />{toast}</div>
    </div>
  );
}
