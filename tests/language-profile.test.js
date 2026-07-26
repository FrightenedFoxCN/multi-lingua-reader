import assert from "node:assert/strict";
import test from "node:test";
import {
  createLanguageProfile,
  findLanguageLexiconEntry,
  parseLanguageLexicon,
  tokenizeLanguageText,
  validateLanguageProfile,
} from "../app/language-profile.js";

test("creates a normalized language profile and parses tabular lexicon rows", () => {
  const profile = createLanguageProfile({
    name: "测试语",
    code: "x-test",
    script: "Latin",
    strategy: "whitespace",
    sample: "ana beta",
    lexiconText: "ana\tana\tN\t人\nbeta\tbeta\tV\t看",
  });

  assert.equal(profile.id, "custom-x-test");
  assert.equal(profile.code, "x-test");
  assert.equal(profile.lexicon.length, 2);
  assert.equal(findLanguageLexiconEntry(profile, "ANA").gloss, "人");
});

test("supports whitespace, character, delimiter, and longest-match segmentation", () => {
  assert.deepEqual(
    tokenizeLanguageText("arma, virumque cano", { segmentation: { strategy: "whitespace" } }),
    ["arma", "virumque", "cano"],
  );
  assert.deepEqual(
    tokenizeLanguageText("學而時習之。", { segmentation: { strategy: "character" } }),
    ["學", "而", "時", "習", "之"],
  );
  assert.deepEqual(
    tokenizeLanguageText("ta|ma na|ku", { segmentation: { strategy: "delimiter", delimiter: "|" } }),
    ["ta", "ma", "na", "ku"],
  );
  assert.deepEqual(
    tokenizeLanguageText("语言学习", {
      segmentation: { strategy: "lexicon-longest" },
      lexicon: parseLanguageLexicon("语言学习\t语言学习\tN\tlanguage learning\n语言\t语言\tN\tlanguage"),
    }),
    ["语言学习"],
  );
});

test("validates fields required to initialize a segmentation system", () => {
  assert.deepEqual(validateLanguageProfile({
    name: "",
    code: "not a code",
    sample: "",
    strategy: "lexicon-longest",
    lexiconText: "",
  }), {
    name: "请输入语言名称",
    code: "请输入 BCP 47 风格的语言代码",
    sample: "请提供一段分词样例",
    lexicon: "最长匹配至少需要一个词表条目",
  });
});

test("accepts BCP 47 private-use language tags", () => {
  assert.deepEqual(validateLanguageProfile({
    name: "测试语",
    code: "x-test",
    sample: "tamataku",
    strategy: "whitespace",
  }), {});
});

test("persists a sanitized descriptive grammar reference in a language profile", () => {
  const profile = createLanguageProfile({
    name: "俄语",
    code: "ru",
    sample: "Слово было у Бога.",
    grammarReference: {
      provider: "Grambank",
      language: "Russian",
      glottocode: "russ1263",
      sourceUrl: "https://grambank.clld.org/languages/russ1263",
      license: "CC BY 4.0",
      acknowledgement: "Grambank Consortium",
      coverage: { coded: 193, total: 195 },
      rules: [{
        id: "GB070",
        category: "格与论元",
        summary: "核心名词论元具有形态格标记。",
        value: "1",
        question: "Are core nominal arguments case-marked?",
      }],
    },
  });

  assert.equal(profile.grammarReference.provider, "Grambank");
  assert.deepEqual(profile.grammarReference.coverage, { coded: 193, total: 195 });
  assert.deepEqual(profile.grammarReference.rules[0], {
    id: "GB070",
    category: "格与论元",
    summary: "核心名词论元具有形态格标记。",
    value: "1",
    question: "Are core nominal arguments case-marked?",
    evidence: "",
    source: "",
    sourceUrl: "",
  });
});
