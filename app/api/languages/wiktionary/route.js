import {
  lookupEnglishWiktionary,
  resolveWiktionaryLanguage,
} from "../../../api/lexicon/route.js";

const USER_AGENT = "LinguaReader/0.1 (local research prototype)";
const UPSTREAM_TIMEOUT_MS = 8000;
const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 96;
const titleScriptPatterns = {
  ab: /\p{Script=Cyrillic}/u,
  ja: /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u,
  ru: /\p{Script=Cyrillic}/u,
};

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
    if (!response.ok) throw new Error(`Wiktionary responded with ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function categoryMembers(languageName, code, limit, continuation = "") {
  const url = new URL("https://en.wiktionary.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    list: "categorymembers",
    cmtitle: `Category:${languageName} lemmas`,
    cmnamespace: "0",
    cmtype: "page",
    cmlimit: "500",
    format: "json",
    formatversion: "2",
    ...(continuation ? { cmcontinue: continuation } : {}),
  }).toString();
  const payload = await fetchJson(url);
  const scriptPattern = titleScriptPatterns[code];
  const usefulTitles = (payload?.query?.categorymembers || [])
    .map((item) => item.title)
    .filter((title) => (
      title
      && !title.startsWith("Unsupported titles/")
      && /^[\p{L}\p{M}]/u.test(title)
      && /\p{L}/u.test(title)
      && (!scriptPattern || scriptPattern.test(title))
    ))
    .slice(0, Math.max(limit * 2, 30));
  return {
    titles: usefulTitles,
    continuation: payload?.continue?.cmcontinue || "",
  };
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

function entryFromLookup(title, lookup, languageName) {
  const entry = lookup?.entries?.find((item) => item.definitions?.length);
  if (!entry) return null;
  return {
    form: title,
    lemma: title,
    pos: entry.partOfSpeech || "未分类",
    gloss: entry.definitions.join("；"),
    definitions: entry.definitions,
    sourceTitle: `English Wiktionary · ${languageName}`,
    sourceUrl: lookup.sourceUrl,
    confidence: 70,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code") || "";
  const descriptor = resolveWiktionaryLanguage({ language: "custom", code });
  if (!descriptor || descriptor.wiki !== "en") {
    return Response.json(
      { status: "not_configured", message: "该语言代码暂时无法映射到 Wiktionary 分类。" },
      { status: 400 },
    );
  }
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(searchParams.get("limit") || "", 10) || DEFAULT_LIMIT),
  );
  const continuation = searchParams.get("continue") || "";

  try {
    const category = await categoryMembers(
      descriptor.languageName,
      descriptor.code,
      limit,
      continuation,
    );
    if (!category.titles.length) {
      return Response.json({
        status: "not_found",
        code: descriptor.code,
        languageName: descriptor.languageName,
        category: `Category:${descriptor.languageName} lemmas`,
        entries: [],
      });
    }
    const lookups = await mapWithConcurrency(category.titles, 6, async (title) => {
      try {
        const result = await lookupEnglishWiktionary(title, title, descriptor.languageName);
        return entryFromLookup(title, result, descriptor.languageName);
      } catch {
        return null;
      }
    });
    const entries = lookups.filter(Boolean).slice(0, limit);
    return Response.json({
      status: entries.length ? "ok" : "not_found",
      code: descriptor.code,
      languageName: descriptor.languageName,
      category: `Category:${descriptor.languageName} lemmas`,
      sourceUrl: `https://en.wiktionary.org/wiki/Category:${encodeURIComponent(`${descriptor.languageName} lemmas`)}`,
      license: "CC BY-SA",
      entries,
      continuation: category.continuation,
    }, {
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    return Response.json({
      status: "unavailable",
      code: descriptor.code,
      languageName: descriptor.languageName,
      entries: [],
      message: "Wiktionary 词表暂时无法读取，可稍后重试或手动粘贴词表。",
    }, { status: 503 });
  }
}
