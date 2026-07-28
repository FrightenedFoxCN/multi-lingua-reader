"use client";

import { useEffect, useState } from "react";
import {
  builtInLexiconSource,
  mergeLexiconResults,
  normalizeLexiconSources,
  sourceSupportsLanguage,
} from "./lexicon-config.js";

const partOfSpeechLabels = {
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

function wiktionarySupported(languageId, code = "") {
  return ["greek", "latin", "chinese"].includes(languageId)
    || (Boolean(code) && !code.startsWith("x-"));
}

function applicableSources(configuredSources, languageId, code = "") {
  const supportsWiktionary = wiktionarySupported(languageId, code);
  return normalizeLexiconSources(configuredSources).filter((source) => (
    source.enabled
    && sourceSupportsLanguage(source, languageId, code)
    && (source.kind !== "wiktionary" || supportsWiktionary)
  ));
}

function unavailableResult(source, item, message) {
  return {
    status: "unavailable",
    source: source.name,
    sourceId: source.id,
    term: item.term,
    lemma: item.lemma,
    entries: [],
    message,
  };
}

export function lexiconSourceLabel(result, fallback = "在线词典") {
  if (!result) return fallback;
  const sources = result.sources?.map((source) => source.name).filter(Boolean) || [];
  if (sources.length > 1) return sources.join(" · ");
  const name = result.source || sources[0] || fallback;
  return result.sourceLanguage && !name.includes(result.sourceLanguage)
    ? `${name} · ${result.sourceLanguage}`
    : name;
}

async function requestLexiconSource(source, secret, languageId, code, item, signal) {
  if (source.kind === "wiktionary") {
    const parameters = new URLSearchParams({
      language: languageId,
      term: item.term,
      lemma: item.lemma,
      ...(code ? { code } : {}),
    });
    const response = await fetch(`/api/lexicon?${parameters}`, { signal });
    if (!response.ok) throw new Error(`Lexicon request failed with ${response.status}`);
    return response.json();
  }

  const response = await fetch("/api/lexicon/custom", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      source,
      apiKey: secret || "",
      language: languageId,
      code,
      term: item.term,
      lemma: item.lemma,
    }),
    signal,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || `Lexicon request failed with ${response.status}`);
  }
  return response.json();
}

export function useLexiconLookup(
  token,
  languageId,
  enabled = true,
  languageProfile = null,
  configuredSources = [builtInLexiconSource],
  secrets = {},
) {
  const [result, setResult] = useState({ status: "idle", entries: [] });
  const code = languageProfile?.code || "";
  const sources = applicableSources(configuredSources, languageId, code);
  const sourceKey = JSON.stringify(sources);
  const secretKey = JSON.stringify(
    Object.fromEntries(sources.map((source) => [source.id, secrets[source.id] || ""])),
  );
  const tokenId = token?.id;
  const term = token?.form || "";
  const lemma = token?.lemma || term;
  const embedded = token?.lexicon;
  const embeddedMatches = embedded
    && (!embedded.term || embedded.term === term)
    && (!embedded.lemma || embedded.lemma === lemma);
  const embeddedComplete = embeddedMatches
    && embedded.detailsLoaded
    && !sources.some((source) => source.kind === "custom");

  useEffect(() => {
    if (!enabled || embeddedComplete) return undefined;
    if (!tokenId || !term || !sources.length) {
      setResult({ status: "idle", entries: [] });
      return undefined;
    }

    const controller = new AbortController();
    setResult({ status: "loading", entries: [], term, lemma, tokenId });
    Promise.all(sources.map(async (source) => {
      try {
        return await requestLexiconSource(
          source,
          secrets[source.id],
          languageId,
          code,
          { term, lemma },
          controller.signal,
        );
      } catch (error) {
        if (error.name === "AbortError") throw error;
        return unavailableResult(source, { term, lemma }, error.message);
      }
    }))
      .then((payloads) => setResult({
        ...mergeLexiconResults(payloads, { term, lemma }),
        tokenId,
      }))
      .catch((error) => {
        if (error.name !== "AbortError") {
          setResult({
            status: "unavailable",
            entries: [],
            tokenId,
            message: "在线词典暂时不可用，已显示本地词法结果。",
          });
        }
      });

    return () => controller.abort();
  }, [code, embeddedComplete, enabled, languageId, lemma, secretKey, sourceKey, term, tokenId]);

  if (embeddedComplete) return { status: "ok", tokenId, term, lemma, ...embedded };
  if (
    embeddedMatches
    && (result.tokenId !== tokenId || result.status === "loading" || result.status === "idle")
  ) {
    return { status: "ok", tokenId, term, lemma, ...embedded };
  }
  if (tokenId && !sources.length) {
    return { status: "not_configured", entries: [], term, lemma, tokenId };
  }
  if (!enabled && tokenId) return { status: "loading", entries: [], term, lemma, tokenId };
  if (tokenId && result.tokenId !== tokenId) {
    return { status: "loading", entries: [], term, lemma, tokenId };
  }
  return result;
}

async function requestSourceBatch(source, secret, languageId, code, items, signal) {
  try {
    const collected = [];
    for (let start = 0; start < items.length; start += 24) {
      const response = await fetch(
        source.kind === "wiktionary" ? "/api/lexicon" : "/api/lexicon/custom",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...(source.kind === "custom" ? { source, apiKey: secret || "" } : {}),
            language: languageId,
            code,
            items: items.slice(start, start + 24).map((token) => ({
              id: token.id,
              term: token.form,
              lemma: token.lemma,
            })),
          }),
          signal,
        },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.message || `${source.name} batch failed with ${response.status}`);
      }
      const payload = await response.json();
      collected.push(...(payload.results || []));
    }
    return collected;
  } catch (error) {
    if (error.name === "AbortError") throw error;
    return items.map((token) => ({
      id: token.id,
      ...unavailableResult(source, {
        term: token.form,
        lemma: token.lemma,
      }, error.message),
    }));
  }
}

export async function requestLexiconBatch(
  configuredSources,
  secrets,
  languageId,
  languageProfile,
  items,
  signal,
) {
  const code = languageProfile?.code || "";
  const sources = applicableSources(configuredSources, languageId, code);
  const resultsBySource = await Promise.all(sources.map((source) => (
    requestSourceBatch(source, secrets[source.id], languageId, code, items, signal)
  )));

  return items.map((token) => {
    const sourceResults = resultsBySource
      .map((results) => results.find((result) => result.id === token.id))
      .filter(Boolean);
    return {
      id: token.id,
      ...mergeLexiconResults(sourceResults, { term: token.form, lemma: token.lemma }),
    };
  });
}

export function lexiconDefinitions(result, limit = 3) {
  return [...new Set(
    (result?.entries || []).flatMap((entry) => entry.definitions || []).filter(Boolean),
  )].slice(0, limit);
}

export function lexiconMorphologyCandidates(result) {
  const candidates = (result?.entries || []).flatMap((entry) => entry.morphologyCandidates || []);
  return candidates.filter((candidate, index) => (
    candidates.findIndex((item) => item.lgrTags.join(".") === candidate.lgrTags.join(".")) === index
  ));
}

export function compactLexiconRecord(result) {
  if (result?.status !== "ok") return null;
  return {
    source: result.source || "在线词典",
    sourceId: result.sourceId,
    sources: result.sources || [],
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

export function enrichTokenWithLexicon(token, result) {
  const lexicon = compactLexiconRecord(result);
  if (!lexicon) return token;
  const externalPos = result.entries?.[0]?.partOfSpeech || "";
  const normalizedPos = partOfSpeechLabels[externalPos.toLocaleLowerCase()]
    || partOfSpeechLabels[externalPos]
    || externalPos;
  const definition = lexiconDefinitions(result, 1)[0];
  const pendingGloss = /^(?:等待模型|等待词典|等待 Wiktionary|待补充|待析)/u
    .test(token.gloss || "");
  const externalSource = lexiconSourceLabel(lexicon);
  const baseSource = token.source || "本地词法";
  const sourceWithLexicon = baseSource.includes(externalSource)
    ? baseSource
    : `${baseSource} · ${externalSource}`;

  return {
    ...token,
    pos: token.pos === "待识别" && normalizedPos ? normalizedPos : token.pos,
    gloss: pendingGloss && definition ? definition : token.gloss,
    confidence: token.confidence <= 48 ? 70 : token.confidence,
    source: token.source?.startsWith("人工校订")
      ? `人工校订 · ${externalSource}`
      : sourceWithLexicon,
    lexicon: {
      ...lexicon,
      localSource: token.lexicon?.localSource || token.source,
      selectedCandidate: token.lexicon?.selectedCandidate || null,
    },
  };
}
