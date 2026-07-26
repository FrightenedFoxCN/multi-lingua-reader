import { normalizeLgrTags } from "../../lgr.js";

const USER_AGENT = "LinguaReader/0.1 (local research prototype)";
const MAX_TERM_LENGTH = 80;
const UPSTREAM_TIMEOUT_MS = 6500;

const builtInWiktionaryLanguages = {
  greek: { code: "grc", languageName: "Ancient Greek", wiki: "en" },
  latin: { code: "la", languageName: "Latin", wiki: "en" },
  chinese: { code: "lzh", languageName: "漢語", wiki: "zh", headingIds: ["漢語", "汉语", "Chinese"] },
};

const wiktionaryLanguageNameOverrides = {
  ab: "Abkhaz",
  abk: "Abkhaz",
};

function normalizedLanguageCode(value) {
  return String(value || "").trim().toLocaleLowerCase().replaceAll("_", "-");
}

function englishLanguageName(code) {
  const normalized = normalizedLanguageCode(code);
  const candidates = [normalized, normalized.split("-")[0]].filter(Boolean);
  const displayNames = new Intl.DisplayNames(["en"], {
    type: "language",
    fallback: "none",
  });
  for (const candidate of candidates) {
    if (wiktionaryLanguageNameOverrides[candidate]) {
      return wiktionaryLanguageNameOverrides[candidate];
    }
    try {
      const name = displayNames.of(candidate);
      if (name) return name;
    } catch {
      // Continue to the base language subtag.
    }
  }
  return "";
}

export function resolveWiktionaryLanguage({ language, code } = {}) {
  const builtIn = builtInWiktionaryLanguages[language];
  if (builtIn) {
    return {
      id: language,
      ...builtIn,
      headingIds: builtIn.headingIds || [builtIn.languageName.replaceAll(" ", "_")],
    };
  }
  const normalizedCode = normalizedLanguageCode(code);
  const languageName = englishLanguageName(normalizedCode);
  if (!normalizedCode || !languageName || normalizedCode.startsWith("x-")) return null;
  return {
    id: language || normalizedCode,
    code: normalizedCode,
    languageName,
    wiki: "en",
    headingIds: [languageName.replaceAll(" ", "_")],
  };
}

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\"",
  };

  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, code) => {
    if (code[0] === "#") {
      const base = code[1]?.toLocaleLowerCase() === "x" ? 16 : 10;
      const numeric = Number.parseInt(code.slice(base === 16 ? 2 : 1), base);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : entity;
    }
    return named[code.toLocaleLowerCase()] ?? entity;
  });
}

function htmlToText(value) {
  return decodeHtml(
    String(value ?? "")
      .replace(/<!--[\s\S]*?-->/gu, " ")
      .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/giu, " ")
      .replace(/<br\s*\/?>/giu, " ")
      .replace(/<\/?(?:li|p|div|dd|dt)[^>]*>/giu, " ")
      .replace(/<[^>]+>/gu, " "),
  )
    .replace(/\[[^\]]*编辑[^\]]*\]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function escapePattern(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function languageHtmlSection(html, descriptor) {
  const headingIds = descriptor?.headingIds || [];
  const matches = headingIds
    .map((heading) => new RegExp(`<h2\\b[^>]*\\bid=["']${escapePattern(heading)}["'][^>]*>`, "iu").exec(html))
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
  if (!matches.length) return "";
  const start = matches[0].index;
  const next = /<h2\b[^>]*\bid=["'][^"']+["'][^>]*>/iu.exec(html.slice(start + matches[0][0].length));
  return html.slice(start, next ? start + matches[0][0].length + next.index : html.length);
}

function mediaUrl(value) {
  const decoded = decodeHtml(String(value || ""));
  if (decoded.startsWith("//")) return `https:${decoded}`;
  return decoded;
}

function extractWikimediaPronunciations(html, descriptor) {
  const section = languageHtmlSection(html, descriptor);
  if (!section) return { ipa: [], pronunciations: [] };
  const ipa = [...section.matchAll(/<span\b[^>]*class=["'][^"']*\bIPA\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/giu)]
    .map((match) => htmlToText(match[1]))
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 4);
  const pronunciations = [...section.matchAll(/<audio\b([^>]*)>([\s\S]*?)<\/audio>/giu)]
    .map((match) => {
      const attributes = match[1];
      const body = match[2];
      const file = decodeHtml(/\bdata-mwtitle=["']([^"']+)["']/iu.exec(attributes)?.[1] || "");
      const sources = [...body.matchAll(/<source\b[^>]*\bsrc=["']([^"']+)["'][^>]*\btype=["']([^"']+)["'][^>]*>/giu)]
        .map((sourceMatch) => ({
          url: mediaUrl(sourceMatch[1]),
          type: decodeHtml(sourceMatch[2]),
        }));
      const preferred = sources.find((source) => source.type.startsWith("audio/mpeg"))
        || sources.find((source) => source.type.startsWith("audio/ogg"))
        || sources[0];
      if (!preferred?.url) return null;
      return {
        file,
        url: preferred.url,
        type: preferred.type.split(";")[0],
        provider: file.startsWith("LL-") ? "Lingua Libre · Wikimedia Commons" : "Wikimedia Commons",
        sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file)}`,
      };
    })
    .filter(Boolean)
    .filter((item, index, values) => values.findIndex((value) => value.url === item.url) === index)
    .slice(0, 3);
  return { ipa, pronunciations };
}

function headingBlocks(section) {
  const headings = [...section.matchAll(/<h([3-6])\b[^>]*>([\s\S]*?)<\/h\1>/giu)]
    .map((match) => ({
      level: Number(match[1]),
      label: htmlToText(match[2]).replace(/\s*\[edit\]\s*$/iu, "").trim(),
      start: match.index,
      contentStart: match.index + match[0].length,
    }));
  return headings.map((heading, index) => {
    const next = headings.slice(index + 1).find((candidate) => candidate.level <= heading.level);
    return {
      ...heading,
      html: section.slice(heading.contentStart, next?.start || section.length),
    };
  });
}

const paradigmCellLabels = {
  singular: "单数",
  dual: "双数",
  plural: "复数",
  nominative: "主格",
  genitive: "属格",
  dative: "与格",
  accusative: "宾格",
  instrumental: "工具格",
  prepositional: "前置格",
  locative: "方位格",
  vocative: "呼格",
  present: "现在时",
  past: "过去时",
  future: "将来时",
  imperative: "祈使式",
  participle: "分词",
  infinitive: "不定式",
  "katsuyōkei (\"stem forms\")": "活用形（词干形）",
  "mizenkei (\"imperfective\")": "未然形",
  "ren’yōkei (\"continuative\")": "连用形",
  "shūshikei (\"terminal\")": "终止形",
  "rentaikei (\"attributive\")": "连体形",
  "kateikei (\"hypothetical\")": "假定形",
  "meireikei (\"imperative\")": "命令形",
  "key constructions": "主要构式",
  passive: "被动态",
  causative: "使役态",
  potential: "可能形",
  volitional: "意志形",
};

function paradigmCellText(value) {
  const withoutTransliteration = String(value || "")
    .replace(/<span\b[^>]*class=["'][^"']*\btr\b[^"']*["'][^>]*>[\s\S]*?<\/span>/giu, " ");
  const text = htmlToText(withoutTransliteration);
  return paradigmCellLabels[text.toLocaleLowerCase()] || text;
}

function extractParadigms(section) {
  return headingBlocks(section)
    .filter((heading) => /^(?:Declension|Conjugation|Inflection)$/iu.test(heading.label))
    .map((heading) => {
      const table = /<table\b[^>]*\bclass=["'][^"']*\binflection(?:-table)?\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/iu.exec(heading.html)
        || /<table\b[^>]*>([\s\S]*?)<\/table>/iu.exec(heading.html);
      if (!table) return null;
      const rows = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/giu)]
        .map((row) => [...row[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/giu)]
          .map((cell) => paradigmCellText(cell[1]))
          .slice(0, 6))
        .filter((row) => row.some(Boolean))
        .slice(0, 12);
      if (!rows.length) return null;
      const navTitle = /<div\b[^>]*class=["'][^"']*\bNavHead\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/iu
        .exec(heading.html)?.[1];
      return {
        type: heading.label.toLocaleLowerCase(),
        title: htmlToText(navTitle) || heading.label,
        rows,
      };
    })
    .filter(Boolean)
    .slice(0, 2);
}

function extractUsageExamples(section) {
  return [...section.matchAll(
    /<span\b[^>]*class=["'][^"']*\bh-usage-example\b[^"']*["'][^>]*>([\s\S]*?)<\/span>\s*<\/dd>/giu,
  )]
    .map((match) => {
      const form = /<i\b[^>]*class=["'][^"']*\be-example\b[^"']*["'][^>]*>([\s\S]*?)<\/i>/iu
        .exec(match[1])?.[1];
      const translation = /<span\b[^>]*class=["'][^"']*\be-translation\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/iu
        .exec(match[1])?.[1];
      return {
        form: htmlToText(form),
        translation: htmlToText(translation),
      };
    })
    .filter((item) => item.form && item.form.length <= 120)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.form === item.form) === index)
    .slice(0, 6);
}

function extractRelatedTerms(section) {
  return headingBlocks(section)
    .filter((heading) => /^(?:Derived terms|Related terms|Compounds|Idioms|Phraseology|Proverbs)$/iu.test(heading.label))
    .flatMap((heading) => [...heading.html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/giu)]
      .map((match) => htmlToText(match[1]))
      .filter((term) => term && term.length <= 100))
    .filter((term, index, terms) => terms.indexOf(term) === index)
    .slice(0, 10);
}

function extractWiktionaryGrammarDetails(html, descriptor) {
  const section = languageHtmlSection(html, descriptor);
  if (!section) return { paradigms: [], fixedExpressions: [], relatedTerms: [] };
  return {
    paradigms: extractParadigms(section),
    fixedExpressions: extractUsageExamples(section),
    relatedTerms: extractRelatedTerms(section),
  };
}

function extractInlineWiktionaryEntries(html, descriptor, queryTerm) {
  const section = languageHtmlSection(html, descriptor);
  if (!section) return [];
  const partsOfSpeech = {
    adjective: "Adjective",
    adverb: "Adverb",
    noun: "Noun",
    pronoun: "Pronoun",
    verb: "Verb",
  };
  return [...section.matchAll(/<dd\b[^>]*>([\s\S]*?)<\/dd>/giu)]
    .map((match) => htmlToText(match[1]))
    .map((text) => {
      const parsed = /^\[(adjective|adverb|noun|pronoun|verb)\]\s*(.+)$/iu.exec(text);
      if (!parsed) return null;
      return {
        partOfSpeech: partsOfSpeech[parsed[1].toLocaleLowerCase()],
        definitions: [parsed[2]],
        morphologyCandidates: [],
        kind: "lemma",
        queryTerm,
      };
    })
    .filter(Boolean)
    .slice(0, 6);
}

function softRedirectTerm(html, descriptor) {
  const section = languageHtmlSection(html, descriptor);
  const table = /<table\b[^>]*class=["'][^"']*\bja-see\b[^"']*["'][^>]*>([\s\S]*?)<\/table>/iu
    .exec(section)?.[1] || "";
  const encoded = /href=["']\/wiki\/([^"'#?]+)#Japanese["']/iu.exec(table)?.[1];
  if (!encoded) return "";
  try {
    return decodeURIComponent(decodeHtml(encoded));
  } catch {
    return "";
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
      },
      signal: controller.signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Wiktionary responded with ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function uniqueEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.partOfSpeech}\u0000${entry.definitions.join("\u0000")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const morphologyTerms = [
  ["first-person", "1", "第一人称"],
  ["second-person", "2", "第二人称"],
  ["third-person", "3", "第三人称"],
  ["singular", "SG", "单数"],
  ["dual", "DU", "双数"],
  ["plural", "PL", "复数"],
  ["present", "PRS", "现在时"],
  ["imperfect", ["PST", "IPFV"], "未完成过去时"],
  ["aorist", ["PST", "PFV"], "不定过去时"],
  ["pluperfect", ["PST", "PRF"], "过去完成时"],
  ["perfect", "PRF", "完成时"],
  ["future", "FUT", "将来时"],
  ["active", "ACT", "主动态"],
  ["middle", "MID", "中动态"],
  ["passive", "PASS", "被动态"],
  ["indicative", "IND", "陈述语气"],
  ["subjunctive", "SBJV", "虚拟语气"],
  ["optative", "OPT", "愿望语气"],
  ["imperative", "IMP", "祈使语气"],
  ["infinitive", "INF", "不定式"],
  ["participle", "PTCP", "分词"],
  ["nominative", "NOM", "主格"],
  ["genitive", "GEN", "属格"],
  ["dative", "DAT", "与格"],
  ["accusative", "ACC", "宾格"],
  ["vocative", "VOC", "呼格"],
  ["ablative", "ABL", "夺格"],
  ["locative", "LOC", "方位格"],
  ["masculine", "M", "阳性"],
  ["feminine", "F", "阴性"],
  ["neuter", "N", "中性"],
  ["comparative", "CMPR", "比较级"],
  ["superlative", "SPRL", "最高级"],
];

function morphologyCandidate(definition) {
  const normalized = definition.toLocaleLowerCase();
  if (normalized.includes("inflection of") && normalized.includes(":")) return null;
  const features = morphologyTerms
    .filter(([term]) => new RegExp(`(?<![a-z])${term}(?![a-z])`, "u").test(normalized))
    .map(([, tag, label]) => ({ tags: Array.isArray(tag) ? tag : [tag], label }));
  if (features.length < 2) return null;

  const person = features.find((feature) => ["1", "2", "3"].includes(feature.tags[0]));
  const number = features.find((feature) => ["SG", "DU", "PL"].includes(feature.tags[0]));
  const lgrTags = features
    .filter((feature) => feature !== person && feature !== number)
    .flatMap((feature) => feature.tags);
  if (person && number) lgrTags.unshift(`${person.tags[0]}${number.tags[0]}`);
  else {
    if (person) lgrTags.unshift(person.tags[0]);
    if (number) lgrTags.unshift(number.tags[0]);
  }

  return {
    labels: features.map((feature) => feature.label),
    lgrTags: normalizeLgrTags(lgrTags).tags,
  };
}

function normalizeEnglishEntries(payload, languageName, kind, queryTerm) {
  if (!payload || typeof payload !== "object") return [];
  return Object.values(payload)
    .flatMap((group) => Array.isArray(group) ? group : [])
    .filter((entry) => entry?.language === languageName)
    .map((entry) => {
      const definitions = (entry.definitions || [])
        .map((definition) => htmlToText(definition?.definition))
        .filter(Boolean)
        .slice(0, 4);
      const morphologyCandidates = definitions
        .map(morphologyCandidate)
        .filter(Boolean)
        .filter((candidate, index, candidates) => (
          candidates.findIndex((item) => item.lgrTags.join(".") === candidate.lgrTags.join(".")) === index
        ));
      return {
        partOfSpeech: htmlToText(entry.partOfSpeech) || "Unclassified",
        definitions: definitions.slice(0, 3),
        morphologyCandidates,
        kind,
        queryTerm,
      };
    })
    .filter((entry) => entry.definitions.length > 0)
    .slice(0, 4);
}

export async function lookupEnglishWiktionary(
  term,
  lemma,
  languageName,
  { formFallbackOnly = false } = {},
) {
  const queries = [...new Set([lemma, term].map((value) => value.trim()).filter(Boolean))];
  const fetchEntries = async (queryTerm, index) => {
    const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(queryTerm)}`;
    const payload = await fetchJson(url);
    return normalizeEnglishEntries(payload, languageName, index === 0 ? "lemma" : "form", queryTerm);
  };
  let results;
  if (formFallbackOnly && queries.length > 1) {
    try {
      const lemmaEntries = await fetchEntries(queries[0], 0);
      results = lemmaEntries.length
        ? [lemmaEntries]
        : [lemmaEntries, await fetchEntries(queries[1], 1)];
    } catch {
      results = [await fetchEntries(queries[1], 1)];
    }
  } else {
    const settled = await Promise.allSettled(queries.map(fetchEntries));
    if (settled.every((item) => item.status === "rejected")) {
      throw settled[0].reason;
    }
    results = settled
      .filter((item) => item.status === "fulfilled")
      .map((item) => item.value);
  }
  const entries = uniqueEntries(results.flat()).slice(0, 6);
  const sourceTerm = entries.find((entry) => entry.kind === "lemma")?.queryTerm || entries[0]?.queryTerm || lemma || term;

  return {
    entries,
    sourceWiki: "en",
    sourceLanguage: languageName,
    sourceUrl: `https://en.wiktionary.org/wiki/${encodeURIComponent(sourceTerm)}`,
  };
}

function normalizeHeading(value) {
  return htmlToText(value).replace(/\s+/gu, "");
}

function extractChineseEntries(html, queryTerm) {
  const positions = [];
  const headingPattern = /<h3\b[^>]*>([\s\S]*?)<\/h3>/giu;
  let headingMatch;
  while ((headingMatch = headingPattern.exec(html))) {
    positions.push({
      end: headingPattern.lastIndex,
      label: normalizeHeading(headingMatch[1]),
      start: headingMatch.index,
    });
  }

  const partOfSpeechPattern = /^(?:動詞|动词|名詞|名词|形容詞|形容词|副詞|副词|代詞|代词|介詞|介词|連詞|连词|助詞|助词|語氣詞|语气词|感嘆詞|感叹词|數詞|数词|量詞|量词|冠詞|冠词|專有名詞|专有名词)$/u;
  return positions
    .filter((heading) => partOfSpeechPattern.test(heading.label))
    .map((heading) => {
      const nextHeading = positions.find((candidate) => candidate.start > heading.start);
      const block = html.slice(heading.end, nextHeading?.start ?? html.length);
      const list = /<ol\b[^>]*>([\s\S]*?)<\/ol>/iu.exec(block)?.[1] || "";
      const definitions = [...list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/giu)]
        .map((match) => htmlToText(match[1]))
        .filter(Boolean)
        .slice(0, 3);
      return {
        partOfSpeech: heading.label,
        definitions,
        kind: "lemma",
        queryTerm,
      };
    })
    .filter((entry) => entry.definitions.length > 0)
    .slice(0, 5);
}

async function lookupChineseWiktionary(term, lemma) {
  const queryTerm = lemma || term;
  const api = "https://zh.wiktionary.org/w/api.php";
  const tocUrl = new URL(api);
  tocUrl.search = new URLSearchParams({
    action: "parse",
    page: queryTerm,
    prop: "tocdata",
    format: "json",
    formatversion: "2",
  }).toString();
  const tocPayload = await fetchJson(tocUrl);
  if (!tocPayload?.parse) {
    return {
      entries: [],
      sourceWiki: "zh",
      sourceLanguage: "漢語",
      sourceUrl: `https://zh.wiktionary.org/wiki/${encodeURIComponent(queryTerm)}`,
    };
  }

  const section = tocPayload.parse.tocdata?.sections?.find((item) => {
    const line = normalizeHeading(item.line);
    return item.hLevel === 2 && (line === "漢語" || line === "汉语");
  });
  if (!section?.index) {
    return {
      entries: [],
      sourceWiki: "zh",
      sourceLanguage: "漢語",
      sourceUrl: `https://zh.wiktionary.org/wiki/${encodeURIComponent(queryTerm)}`,
    };
  }

  const sectionUrl = new URL(api);
  sectionUrl.search = new URLSearchParams({
    action: "parse",
    page: queryTerm,
    section: section.index,
    prop: "text",
    format: "json",
    formatversion: "2",
  }).toString();
  const sectionPayload = await fetchJson(sectionUrl);
  const html = sectionPayload?.parse?.text || "";

  return {
    entries: extractChineseEntries(html, queryTerm),
    sourceWiki: "zh",
    sourceLanguage: "漢語",
    sourceUrl: `https://zh.wiktionary.org/wiki/${encodeURIComponent(queryTerm)}`,
  };
}

async function lookupWiktionaryPageDetails(term, lemma, descriptor, followRedirect = true) {
  const queryTerm = lemma || term;
  const wiki = descriptor.wiki;
  const api = `https://${wiki}.wiktionary.org/w/api.php`;
  const url = new URL(api);
  url.search = new URLSearchParams({
    action: "parse",
    page: queryTerm,
    prop: "text",
    format: "json",
    formatversion: "2",
  }).toString();
  const payload = await fetchJson(url);
  if (!payload?.parse?.text) {
    return {
      ipa: [],
      pronunciations: [],
      paradigms: [],
      fixedExpressions: [],
      relatedTerms: [],
    };
  }
  const details = {
    ...extractWikimediaPronunciations(payload.parse.text, descriptor),
    ...extractWiktionaryGrammarDetails(payload.parse.text, descriptor),
    fallbackEntries: extractInlineWiktionaryEntries(payload.parse.text, descriptor, queryTerm),
  };
  const redirectTerm = followRedirect ? softRedirectTerm(payload.parse.text, descriptor) : "";
  if (!redirectTerm || redirectTerm === queryTerm) return details;
  const redirected = await lookupWiktionaryPageDetails(
    redirectTerm,
    redirectTerm,
    descriptor,
    false,
  ).catch(() => null);
  if (!redirected) return details;
  return {
    ipa: redirected.ipa?.length ? redirected.ipa : details.ipa,
    pronunciations: redirected.pronunciations?.length
      ? redirected.pronunciations
      : details.pronunciations,
    paradigms: redirected.paradigms?.length ? redirected.paradigms : details.paradigms,
    fixedExpressions: redirected.fixedExpressions?.length
      ? redirected.fixedExpressions
      : details.fixedExpressions,
    relatedTerms: redirected.relatedTerms?.length
      ? redirected.relatedTerms
      : details.relatedTerms,
    fallbackEntries: details.fallbackEntries?.length
      ? details.fallbackEntries
      : redirected.fallbackEntries,
  };
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

export async function lookupWiktionary(
  term,
  lemma,
  descriptor,
  { includePronunciation = true } = {},
) {
  const isCustomLanguage = !Object.hasOwn(builtInWiktionaryLanguages, descriptor.id);
  const [result, pageDetails] = await Promise.all([
    descriptor.id === "chinese"
      ? lookupChineseWiktionary(term, lemma)
      : lookupEnglishWiktionary(term, lemma, descriptor.languageName, {
        formFallbackOnly: isCustomLanguage,
      }),
    includePronunciation
      ? lookupWiktionaryPageDetails(term, lemma, descriptor).catch(() => ({
        ipa: [],
        pronunciations: [],
        paradigms: [],
        fixedExpressions: [],
        relatedTerms: [],
      }))
      : Promise.resolve({
        ipa: [],
        pronunciations: [],
        paradigms: [],
        fixedExpressions: [],
        relatedTerms: [],
      }),
  ]);
  const { fallbackEntries = [], ...grammarDetails } = pageDetails;
  const entries = result.entries.length ? result.entries : fallbackEntries;
  return {
    status: entries.length ? "ok" : "not_found",
    source: "Wiktionary",
    license: "CC BY-SA",
    term,
    lemma,
    detailsLoaded: includePronunciation,
    ...grammarDetails,
    ...result,
    entries,
  };
}

function normalizedInput(termValue, lemmaValue) {
  const term = String(termValue || "").normalize("NFC").trim();
  const lemma = String(lemmaValue || term).normalize("NFC").trim();
  return { term, lemma };
}

function isValidInput(term, lemma) {
  return Boolean(term) && term.length <= MAX_TERM_LENGTH && lemma.length <= MAX_TERM_LENGTH;
}

async function mapWithConcurrency(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const { term, lemma } = normalizedInput(searchParams.get("term"), searchParams.get("lemma"));
  const language = searchParams.get("language") || "";
  const descriptor = resolveWiktionaryLanguage({
    language,
    code: searchParams.get("code") || "",
  });

  if (!isValidInput(term, lemma)) {
    return json({ status: "invalid", message: "词形不能为空，且不得超过 80 个字符。" }, 400);
  }
  if (!descriptor) {
    return json({ status: "invalid", message: "不支持的语言。" }, 400);
  }

  try {
    return json(await lookupWiktionary(term, lemma, descriptor));
  } catch {
    return json({
      status: "unavailable",
      source: "Wiktionary",
      term,
      lemma,
      entries: [],
      message: "Wiktionary 暂时不可用，已保留本地词法结果。",
    });
  }
}

export async function POST(request) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ status: "invalid", message: "请求体必须是 JSON。" }, 400);
  }

  const language = payload?.language || "";
  const descriptor = resolveWiktionaryLanguage({
    language,
    code: payload?.code || "",
  });
  const items = Array.isArray(payload?.items) ? payload.items : [];
  if (!descriptor) {
    return json({ status: "invalid", message: "不支持的语言。" }, 400);
  }
  if (!items.length || items.length > 24) {
    return json({ status: "invalid", message: "每次可查询 1–24 个词项。" }, 400);
  }

  const normalizedItems = items.map((item, index) => ({
    id: String(item?.id || `token-${index + 1}`),
    ...normalizedInput(item?.term, item?.lemma),
  }));
  if (normalizedItems.some((item) => !isValidInput(item.term, item.lemma))) {
    return json({ status: "invalid", message: "批量词项不能为空，且不得超过 80 个字符。" }, 400);
  }

  const results = await mapWithConcurrency(normalizedItems, 3, async (item) => {
    try {
      return {
        id: item.id,
        ...(await lookupWiktionary(item.term, item.lemma, descriptor, {
          includePronunciation: false,
        })),
      };
    } catch {
      return {
        id: item.id,
        status: "unavailable",
        source: "Wiktionary",
        term: item.term,
        lemma: item.lemma,
        entries: [],
        message: "Wiktionary 暂时不可用，已保留本地词法结果。",
      };
    }
  });

  return json({
    status: "ok",
    language,
    languageName: descriptor.languageName,
    results,
  });
}
