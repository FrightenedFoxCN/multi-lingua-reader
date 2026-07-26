const WORD_PATTERN = /[\p{L}\p{M}\p{N}]+(?:[’᾽'][\p{L}\p{M}\p{N}]*)?/gu;
const PUNCTUATION_PATTERN = /^[\p{P}\p{S}\s]+$/u;

export const segmentationStrategies = [
  {
    id: "whitespace",
    label: "空格与标点",
    description: "适合以空格分隔词语的文字。",
  },
  {
    id: "character",
    label: "逐字切分",
    description: "将每个非标点字符视为一个初始词项。",
  },
  {
    id: "lexicon-longest",
    label: "词表最长匹配",
    description: "优先匹配粘贴词表中的最长词形。",
  },
  {
    id: "delimiter",
    label: "自定义定界符",
    description: "按指定符号或空白划分词项。",
  },
];

function cleanField(value) {
  return String(value ?? "").trim();
}

function slugify(value) {
  return cleanField(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

export function parseLanguageLexicon(source) {
  const rows = Array.isArray(source) ? source : cleanField(source).split(/\r?\n/u);
  const entries = rows
    .map((row) => {
      if (typeof row === "object" && row) {
        const definitions = Array.isArray(row.definitions)
          ? row.definitions.map(cleanField).filter(Boolean)
          : [];
        return {
          form: cleanField(row.form),
          lemma: cleanField(row.lemma || row.form),
          reading: cleanField(row.reading),
          pos: cleanField(row.pos),
          gloss: cleanField(row.gloss) || definitions.join("；"),
          definitions,
          lgrTags: Array.isArray(row.lgrTags) ? row.lgrTags.map(cleanField).filter(Boolean) : [],
          morphologyCandidates: Array.isArray(row.morphologyCandidates) ? row.morphologyCandidates : [],
          page: cleanField(row.page),
          confidence: Number.isFinite(Number(row.confidence)) ? Number(row.confidence) : null,
          sourceTitle: cleanField(row.sourceTitle),
          sourceJobId: cleanField(row.sourceJobId),
        };
      }
      const [form, lemma, pos, ...gloss] = String(row).split(/\t/u);
      return {
        form: cleanField(form),
        lemma: cleanField(lemma || form),
        pos: cleanField(pos),
        gloss: cleanField(gloss.join("\t")),
      };
    })
    .filter((entry) => entry.form);

  return entries.filter((entry, index) => (
    entries.findIndex((candidate) => candidate.form.normalize("NFC") === entry.form.normalize("NFC")) === index
  ));
}

export function createLanguageProfile(input, existingIds = []) {
  const name = cleanField(input.name);
  const code = cleanField(input.code).toLocaleLowerCase();
  const strategy = segmentationStrategies.some((item) => item.id === input.strategy)
    ? input.strategy
    : "whitespace";
  const baseId = `custom-${slugify(code || name) || "language"}`;
  let id = cleanField(input.id) || baseId;
  let suffix = 2;
  while (existingIds.includes(id) && id !== input.id) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return {
    id,
    name,
    code,
    script: cleanField(input.script) || "未指定",
    direction: input.direction === "rtl" ? "rtl" : "ltr",
    identity: {
      bcp47: cleanField(input.identity?.bcp47 || code),
      iso6393: cleanField(input.identity?.iso6393),
      glottocode: cleanField(input.identity?.glottocode),
      glottologName: cleanField(input.identity?.glottologName),
    },
    orthography: {
      script: cleanField(input.orthography?.script || input.script) || "未指定",
      direction: input.direction === "rtl" ? "rtl" : "ltr",
      exemplars: cleanField(input.orthography?.exemplars),
    },
    segmentation: {
      strategy,
      delimiter: cleanField(input.delimiter) || "|",
      source: cleanField(input.segmentation?.source || input.segmentationSource || "manual"),
    },
    sample: cleanField(input.sample),
    lexicon: parseLanguageLexicon(input.lexicon || input.lexiconText || ""),
    resources: Array.isArray(input.resources)
      ? input.resources.map((resource) => ({
        id: cleanField(resource.id),
        version: cleanField(resource.version),
        category: cleanField(resource.category),
        status: cleanField(resource.status),
        url: cleanField(resource.url),
        license: cleanField(resource.license),
      })).filter((resource) => resource.id)
      : [],
    grammarReference: input.grammarReference && typeof input.grammarReference === "object"
      ? {
        provider: cleanField(input.grammarReference.provider),
        language: cleanField(input.grammarReference.language),
        glottocode: cleanField(input.grammarReference.glottocode),
        sourceUrl: cleanField(input.grammarReference.sourceUrl),
        license: cleanField(input.grammarReference.license),
        acknowledgement: cleanField(input.grammarReference.acknowledgement),
        coverage: {
          coded: Number(input.grammarReference.coverage?.coded) || 0,
          total: Number(input.grammarReference.coverage?.total) || 0,
        },
        rules: Array.isArray(input.grammarReference.rules)
          ? input.grammarReference.rules.map((rule) => ({
            id: cleanField(rule.id),
            category: cleanField(rule.category),
            summary: cleanField(rule.summary),
            value: cleanField(rule.value),
            question: cleanField(rule.question),
            evidence: cleanField(rule.evidence),
            source: cleanField(rule.source),
            sourceUrl: cleanField(rule.sourceUrl),
          })).filter((rule) => rule.id && rule.summary)
          : [],
      }
      : null,
    initialization: {
      mode: input.initialization?.mode === "database-assisted" ? "database-assisted" : "manual",
      catalogMatched: Boolean(input.initialization?.catalogMatched),
      catalogReleaseDate: cleanField(input.initialization?.catalogReleaseDate),
    },
    initializedAt: input.initializedAt || new Date().toISOString(),
  };
}

export function validateLanguageProfile(input) {
  const errors = {};
  if (!cleanField(input.name)) errors.name = "请输入语言名称";
  const code = cleanField(input.code);
  const isStandardTag = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u.test(code);
  const isPrivateUseTag = /^x(?:-[a-zA-Z0-9]{1,8})+$/u.test(code);
  if (!isStandardTag && !isPrivateUseTag) {
    errors.code = "请输入 BCP 47 风格的语言代码";
  }
  if (!cleanField(input.sample)) errors.sample = "请提供一段分词样例";
  if (input.strategy === "delimiter" && !cleanField(input.delimiter)) {
    errors.delimiter = "请输入定界符";
  }
  if (input.strategy === "lexicon-longest" && parseLanguageLexicon(input.lexiconText || input.lexicon).length === 0) {
    errors.lexicon = "最长匹配至少需要一个词表条目";
  }
  return errors;
}

function wordTokens(value) {
  return value.match(WORD_PATTERN) || [];
}

function segmentRunByLexicon(run, lexiconForms) {
  const forms = [];
  for (let cursor = 0; cursor < run.length;) {
    const character = run[cursor];
    if (PUNCTUATION_PATTERN.test(character)) {
      cursor += character.length;
      continue;
    }
    const match = lexiconForms.find((candidate) => run.startsWith(candidate, cursor));
    const form = match || character;
    forms.push(form);
    cursor += form.length;
  }
  return forms;
}

export function tokenizeLanguageText(text, profile) {
  const source = cleanField(text);
  if (!source) return [];
  const strategy = profile?.segmentation?.strategy || profile?.strategy || "whitespace";

  if (strategy === "character") {
    return Array.from(source).filter((character) => !PUNCTUATION_PATTERN.test(character));
  }

  if (strategy === "delimiter") {
    const delimiter = profile?.segmentation?.delimiter || profile?.delimiter || "|";
    return source
      .split(delimiter)
      .flatMap((section) => wordTokens(section))
      .filter(Boolean);
  }

  if (strategy === "lexicon-longest") {
    const lexiconForms = parseLanguageLexicon(profile?.lexicon || [])
      .map((entry) => entry.form)
      .sort((a, b) => b.length - a.length);
    return source
      .split(/\s+/u)
      .flatMap((run) => segmentRunByLexicon(run, lexiconForms))
      .filter(Boolean);
  }

  return wordTokens(source);
}

export function findLanguageLexiconEntry(profile, form) {
  const normalized = cleanField(form).normalize("NFC").toLocaleLowerCase();
  return parseLanguageLexicon(profile?.lexicon || []).find((entry) => (
    entry.form.normalize("NFC").toLocaleLowerCase() === normalized
  )) || null;
}
