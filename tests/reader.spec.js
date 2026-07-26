import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

function wiktionaryResult(language, term, lemma) {
  const isInflectedGreekVerb = term === "ἄειδε";
  const isCzech = language === "custom-cs";
  const isJapanese = language === "custom-ja";
  const sourceLanguage = language === "greek"
    ? "Ancient Greek"
    : language === "latin"
      ? "Latin"
      : isCzech
        ? "Czech"
        : isJapanese
          ? "Japanese"
          : "漢語";
  const czechPartOfSpeech = ["přijít", "setkat", "být"].includes(lemma)
    ? "Verb"
    : ["tak", "osobně", "nikdy"].includes(lemma)
      ? "Adverb"
      : ["a", "že"].includes(lemma)
        ? "Conjunction"
        : "Noun";
  const partOfSpeech = language === "chinese"
    ? "動詞"
    : isJapanese
      ? "Verb"
    : isCzech
      ? czechPartOfSpeech
      : isInflectedGreekVerb
        ? "Verb"
        : "Noun";
  const definition = isInflectedGreekVerb
    ? "to sing, chant, praise"
    : isJapanese
      ? "to drink"
    : isCzech && lemma === "přijít"
      ? "to reach a place by walking; to come"
      : isCzech && lemma === "setkat"
        ? "to meet, encounter"
        : `Wiktionary definition for ${lemma || term}`;
  return {
    status: "ok",
    source: "Wiktionary",
    sourceWiki: language === "chinese" ? "zh" : "en",
    sourceLanguage,
    sourceUrl: `https://${language === "chinese" ? "zh" : "en"}.wiktionary.org/wiki/${encodeURIComponent(lemma || term)}`,
    license: "CC BY-SA",
    term,
    lemma,
    ipa: language === "chinese" ? ["/ɕy̯ɛ³⁵/"] : [],
    pronunciations: language === "chinese" ? [{
      file: "zh-xué.ogg",
      url: "data:audio/ogg;base64,T2dnUw==",
      type: "audio/ogg",
      provider: "Wikimedia Commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/File:Zh-xu%C3%A9.ogg",
    }] : [],
    paradigms: [],
    fixedExpressions: [],
    relatedTerms: [],
    entries: [{
      partOfSpeech,
      definitions: [definition],
      morphologyCandidates: isInflectedGreekVerb ? [
        {
            labels: ["第二人称", "单数", "现在时", "主动态", "祈使语气"],
            lgrTags: ["2SG", "PRS", "ACT", "IMP"],
        },
        {
          labels: ["第三人称", "单数", "未完成过去时", "主动态", "陈述语气"],
          lgrTags: ["3SG", "PST", "IPFV", "ACT", "IND"],
        },
      ] : [],
      kind: isInflectedGreekVerb ? "form" : "lemma",
      queryTerm: lemma || term,
    }],
  };
}

async function mockUdpipe(page) {
  const rows = [
    ["A", "a", "CCONJ", {}, 4, "cc"],
    ["tak", "tak", "ADV", { PronType: "Dem" }, 4, "advmod"],
    ["to", "ten", "DET", { Case: "Nom", Gender: "Neut", Number: "Sing", PronType: "Dem" }, 4, "nsubj"],
    ["přišlo", "přijít", "VERB", { Aspect: "Perf", Gender: "Neut", Number: "Sing", Tense: "Past", VerbForm: "Part", Voice: "Act" }, 0, "root"],
    [",", ",", "PUNCT", {}, 13, "punct"],
    ["že", "že", "SCONJ", {}, 13, "mark"],
    ["s", "s", "ADP", { Case: "Ins" }, 8, "case"],
    ["Wagnerem", "Wagner", "PROPN", { Case: "Ins", Gender: "Masc", Number: "Sing" }, 13, "obl:arg"],
    ["osobně", "osobně", "ADV", {}, 13, "advmod"],
    ["jsem", "být", "AUX", { Aspect: "Imp", Mood: "Ind", Number: "Sing", Person: "1", Tense: "Pres", Voice: "Act" }, 13, "aux"],
    ["nikdy", "nikdy", "ADV", {}, 13, "advmod"],
    ["se", "se", "PRON", { Case: "Acc", Reflex: "Yes" }, 13, "expl:pv"],
    ["nesetkal", "setkat", "VERB", { Aspect: "Perf", Gender: "Masc", Number: "Sing", Polarity: "Neg", Tense: "Past", VerbForm: "Part", Voice: "Act" }, 4, "ccomp"],
    [".", ".", "PUNCT", {}, 4, "punct"],
  ];
  await page.route("**/api/analyze", async (route) => {
    const payload = route.request().postDataJSON();
    await route.fulfill({
      json: {
        status: "ok",
        code: payload.code,
        model: "czech-pdtc-ud-test",
        license: "CC BY-NC-SA",
        acknowledgements: ["https://ufal.mff.cuni.cz/udpipe/2"],
        sourceUrl: "https://lindat.mff.cuni.cz/services/udpipe/",
        tokens: rows.map(([form, lemma, upos, features, head, dependency], index) => ({
          id: index + 1,
          form,
          lemma,
          upos,
          xpos: "",
          features,
          head,
          dependency,
          misc: "",
        })),
      },
    });
  });
}

async function mockWiktionary(page) {
  await page.route("**/api/lexicon**", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        json: {
          status: "ok",
          language: payload.language,
          results: payload.items.map((item) => ({
            id: item.id,
            ...wiktionaryResult(payload.language, item.term, item.lemma),
            detailsLoaded: false,
          })),
        },
      });
      return;
    }

    const url = new URL(route.request().url());
    await route.fulfill({
      json: {
        ...wiktionaryResult(
          url.searchParams.get("language"),
          url.searchParams.get("term"),
          url.searchParams.get("lemma"),
        ),
        detailsLoaded: true,
      },
    });
  });
}

test("a Czech language profile uses UDPipe context before Wiktionary lemma lookup", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await mockUdpipe(page);
  await mockWiktionary(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("lingua-language-workspace-v1", JSON.stringify({
      profiles: [{
        id: "custom-cs",
        name: "捷克语",
        code: "cs",
        script: "Latn",
        direction: "ltr",
        sample: "A tak to přišlo.",
        segmentation: { strategy: "whitespace", delimiter: "" },
        lexicon: [],
        resources: [{ id: "udpipe", selected: true }, { id: "kaikki", selected: true }],
      }],
      pdfJobs: [],
      grammarJobs: [],
      dictionaryImports: [],
      libraryImports: [],
      lexicons: {},
    }));
  });
  await page.goto("/?view=lab");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  await page.getByLabel("文本语言").selectOption("custom-cs");
  await page.locator(".lab-input-panel textarea").fill(
    "A tak to přišlo, že s Wagnerem osobně jsem nikdy se nesetkal.",
  );
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.locator(".lab-input-foot")).toContainText("UDPipe 上下文分析");
  await expect(page.locator(".lab-input-foot")).toContainText("Wiktionary 14/14");
  await page.getByRole("treeitem", { name: /přišlo/ }).click();
  await expect(page.locator(".lab-lemma")).toContainText("přijít");
  await expect(page.locator(".token-summary-line")).toContainText("动词");
  await expect(page.locator(".token-summary-line")).toContainText("to come");
  await expect(page.locator(".token-summary-line")).toContainText("SG");
  await expect(page.locator(".token-summary-line")).toContainText("PST");
  await expect(page.locator(".lab-inspector dl")).toContainText("UDPipe");
  expect(consoleErrors).toEqual([]);
});

test("fixed expressions keep readings and translations aligned without overflowing the inspector", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      json: {
        status: "ok",
        kind: "udpipe",
        code: "ja",
        model: "japanese-layout-test",
        sourceUrl: "https://lindat.mff.cuni.cz/services/udpipe/",
        tokens: [{
          id: 1,
          form: "飲ん",
          lemma: "飲む",
          upos: "VERB",
          xpos: "",
          features: {},
          head: 0,
          dependency: "root",
          misc: "",
        }],
      },
    });
  });
  await page.route("**/api/lexicon**", async (route) => {
    const isBatch = route.request().method() === "POST";
    const payload = isBatch ? route.request().postDataJSON() : null;
    const result = {
      ...wiktionaryResult("custom-ja", "飲ん", "飲む"),
      detailsLoaded: !isBatch,
      relatedTerms: isBatch ? [] : [
        "飲 ( の ) み 物 ( もの ) ( nomimono , “ a drink ” )",
        "固唾 ( かたず ) を 呑 ( の ) む ( katazu o nomu )",
      ],
    };
    await route.fulfill({
      json: isBatch
        ? { status: "ok", language: "custom-ja", results: payload.items.map((item) => ({ ...result, id: item.id })) }
        : result,
    });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("lingua-language-workspace-v1", JSON.stringify({
      profiles: [{
        id: "custom-ja",
        name: "日语",
        code: "ja",
        script: "Jpan",
        direction: "ltr",
        sample: "私は飲んでいます。",
        segmentation: { strategy: "character", delimiter: "" },
        lexicon: [],
        resources: [{ id: "udpipe", selected: true }, { id: "kaikki", selected: true }],
      }],
      pdfJobs: [],
      grammarJobs: [],
      dictionaryImports: [],
      libraryImports: [],
      lexicons: {},
    }));
  });

  await page.goto("/?view=lab");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByLabel("文本语言").selectOption("custom-ja");
  await page.locator(".lab-input-panel textarea").fill("飲ん");
  await page.getByRole("button", { name: "开始分析" }).click();

  const expressions = page.locator(".fixed-expressions-inline li");
  await expect(expressions).toHaveCount(2);
  await expect(expressions.nth(0).locator("b")).toHaveText("飲(の)み物(もの)");
  await expect(expressions.nth(0).locator("span")).toHaveText("a drink");
  await expect(expressions.nth(1).locator("b")).toHaveText("固唾(かたず)を呑(の)む");
  await expect(expressions.nth(1).locator("span")).toHaveText("katazu o nomu");
  await expect(expressions.nth(0)).toHaveClass(/has-translation/);

  const sourceText = await page.locator(".lab-inspector dl dd").last().textContent();
  expect(sourceText.match(/Wiktionary · Japanese/gu)).toHaveLength(1);

  await page.setViewportSize({ width: 390, height: 844 });
  const hasOverflow = await page.locator(".fixed-expressions-inline").evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  expect(hasOverflow).toBe(false);
});

test("a user corpus and DSL rule pack participate in the configured analysis pipeline", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await mockWiktionary(page);
  await page.addInitScript(() => {
    window.localStorage.setItem("lingua-language-workspace-v1", JSON.stringify({
      profiles: [{
        id: "custom-ru",
        name: "俄语",
        code: "ru",
        script: "Cyrl",
        direction: "ltr",
        sample: "Я читаю книгу.",
        segmentation: { strategy: "whitespace", delimiter: "" },
        lexicon: [],
        resources: [{ id: "kaikki", selected: true }],
      }],
      pdfJobs: [],
      grammarJobs: [],
      dictionaryImports: [],
      libraryImports: [],
      lexicons: {},
      analysisPipelines: {},
      analysisRulePacks: [],
      corpora: [],
    }));
  });

  await page.goto("/?view=languages");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("tab", { name: "分析管线" }).click();
  await page.getByLabel("配置语言").selectOption("custom-ru");
  await page.getByLabel("选择 CoNLL-U 语料文件").setInputFiles({
    name: "russian-demo.conllu",
    mimeType: "text/plain",
    buffer: Buffer.from([
      "# sent_id = russian-demo-1",
      "# text = Я читаю книгу.",
      "1\tЯ\tя\tPRON\t_\tCase=Nom|Number=Sing|Person=1\t2\tnsubj\t_\t_",
      "2\tчитаю\tчитать\tVERB\t_\tMood=Ind|Number=Sing|Person=1|Tense=Pres\t0\troot\t_\t_",
      "3\tкнигу\tкнига\tNOUN\t_\tCase=Acc|Gender=Fem|Number=Sing\t2\tobj\t_\tSpaceAfter=No",
      "4\t.\t.\tPUNCT\t_\t_\t2\tpunct\t_\t_",
      "",
    ].join("\n")),
  });
  await page.getByRole("button", { name: "导入并启用" }).click();
  await expect(page.locator(".corpus-import-status")).toContainText("已导入 1 句");
  await expect(page.locator(".corpus-list")).toContainText("russian-demo");

  await page.getByLabel("分析 DSL 源码").fill([
    "version 1",
    "language ru",
    "",
    "rule reading_gloss priority 20",
    "when lemma = \"читать\"",
    "set gloss \"阅读（DSL）\"",
    "add tags PRS",
    "end",
    "",
  ].join("\n"));
  await page.getByRole("button", { name: "保存并启用" }).click();
  await expect(page.locator(".analysis-rule-pack-list")).toContainText("1 条规则");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )).toBe(true);
  await expect(page.locator(".analysis-engine-panel")).toBeVisible();
  await expect(page.locator(".analysis-rule-pack-list")).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 820 });

  await page.getByRole("button", { name: /分析实验室/ }).click();
  await page.getByLabel("文本语言").selectOption("custom-ru");
  await page.locator(".lab-input-panel textarea").fill("Я читаю книгу.");
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.locator(".lab-input-foot")).toContainText("本地 UD 语料命中");
  await expect(page.locator(".lab-input-foot")).toContainText("DSL 修正 1 词项");
  await page.getByRole("treeitem", { name: /читаю/ }).click();
  await expect(page.locator(".token-summary-line")).toContainText("阅读（DSL）");
  await expect(page.locator(".token-summary-line")).toContainText("PRS");
  await expect(page.locator(".lab-inspector dl")).toContainText("DSL · reading_gloss");
  expect(consoleErrors).toEqual([]);
});

test("desktop reader supports word, syntax, language, translation, search, and notes", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await mockWiktionary(page);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  await expect(page.locator(".text-heading h1")).toContainText("Ἰλιάς");
  await expect(page.locator(".token.selected")).toContainText("Μῆνιν");
  await expect(page.locator(".word-hero h2")).toHaveText("Μῆνιν");

  const segmentationToggle = page.getByRole("button", { name: "分词" });
  await expect(segmentationToggle).toHaveAttribute("aria-pressed", "true");
  await segmentationToggle.click();
  await expect(page.locator(".original-text")).not.toHaveClass(/is-segmented/);
  await expect(page.locator(".token small")).toHaveCount(0);
  await segmentationToggle.click();
  await expect(page.locator(".original-text")).toHaveClass(/is-segmented/);

  await page.getByRole("button", { name: "ἄειδε" }).click();
  await expect(page.locator(".word-hero h2")).toHaveText("ἄειδε");
  await expect(page.locator(".definition")).toContainText("歌唱");
  await expect(page.locator(".wiktionary-source-link")).toContainText("Wiktionary");
  await expect(page.locator(".wiktionary-senses")).toContainText("to sing");
  await expect(page.locator(".wiktionary-candidate-list")).toContainText("2SG.PRS.ACT.IMP");
  await expect(page.getByRole("button", { name: "复制 CTS 词位" })).toHaveAttribute(
    "title",
    "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1@ἄειδε[1]",
  );
  await page.screenshot({ path: "artifacts/reader-desktop-word.png", fullPage: true });

  await page.getByRole("button", { name: "句法" }).click();
  await expect(page.getByRole("heading", { name: "依存关系" })).toBeVisible();
  await expect(page.locator(".reader-syntax-tree .syntax-tree-root")).toContainText("ἄειδε");

  await page.getByLabel("切换文本语言").selectOption("latin");
  await expect(page.locator(".text-heading h1")).toContainText("Aeneis");
  await expect(page.locator(".token.selected")).toContainText("Arma");

  await page.getByRole("button", { name: /译文/ }).click();
  await expect(page.locator(".translation-line").first()).toBeVisible();

  await page.getByRole("button", { name: /搜索作品/ }).click();
  await page.getByPlaceholder("搜索作品、作者、语言或 CTS URN…").fill("论语");
  await expect(page.locator(".search-results")).toContainText("論語");
  await page.locator(".search-results button").click();
  await expect(page.locator(".text-heading h1")).toContainText("論語");
  await expect(page.locator(".pronunciation-row")).toContainText("/ɕy̯ɛ³⁵/");
  await expect(page.locator(".pronunciation-row")).toContainText("Wikimedia Commons");

  await page.getByRole("button", { name: /笔记/ }).click();
  await page.getByPlaceholder("写下释义、疑问或阅读心得…").fill("“學”与“習”形成承接关系。");
  await page.getByRole("button", { name: "保存笔记" }).click();
  await expect(page.locator(".saved-note")).toContainText("承接关系");

  await page.getByRole("button", { name: /搜索作品/ }).click();
  await page.getByPlaceholder("搜索作品、作者、语言或 CTS URN…").fill(
    "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1@ἄειδε[1]",
  );
  await expect(page.locator(".cts-search-result")).toContainText("CTS 1.1 · ἄειδε[1]");
  await page.locator(".cts-search-result").click();
  await expect(page.locator(".text-heading h1")).toContainText("Ἰλιάς");
  await expect(page.locator(".word-hero h2")).toHaveText("ἄειδε");
  await expect(page.getByLabel("第 1 行")).toHaveAttribute(
    "title",
    "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1",
  );

  await page.screenshot({ path: "artifacts/reader-desktop.png", fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("CTS token URNs work as shareable reader deep links", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await mockWiktionary(page);
  const sharedUrn = "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1@ἄειδε[1]";
  await page.goto(`/?urn=${encodeURIComponent(sharedUrn)}`);
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator(".text-heading h1")).toContainText("Ἰλιάς");
  await expect(page.locator(".word-hero h2")).toHaveText("ἄειδε");
  expect(new URL(page.url()).searchParams.get("urn")).toBe(sharedUrn);

  await page.getByRole("button", { name: "θεὰ" }).click();
  const nextUrn = "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1@θεὰ[1]";
  await expect.poll(() => new URL(page.url()).searchParams.get("urn")).toBe(nextUrn);
  await page.reload();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator(".word-hero h2")).toHaveText("θεὰ");

  expect(consoleErrors).toEqual([]);
});

test("reader copies one original-text line without analysis labels", async ({ page, context }) => {
  await context.grantPermissions(
    ["clipboard-read", "clipboard-write"],
    { origin: "http://localhost:3000" },
  );
  await mockWiktionary(page);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  await page.getByRole("button", { name: "复制本行原文，行号 1" }).click();
  await expect(page.locator(".toast")).toContainText("第 1 行原文已复制");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(
    "Μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος",
  );
});

test("reader search supports keyboard selection for works and CTS targets", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await mockWiktionary(page);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  await page.getByRole("button", { name: /搜索作品/ }).click();
  const searchInput = page.getByPlaceholder("搜索作品、作者、语言或 CTS URN…");
  const searchResults = page.getByRole("listbox", { name: "搜索结果" });
  await expect(searchResults.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await searchInput.press("ArrowDown");
  await expect(searchResults.getByRole("option", { name: /Aeneis/ })).toHaveAttribute("aria-selected", "true");
  await searchInput.press("Enter");
  await expect(page.locator(".text-heading h1")).toContainText("Aeneis");

  await page.getByRole("button", { name: /搜索作品/ }).click();
  await searchInput.fill("urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1@ἄειδε[1]");
  await expect(searchResults.getByRole("option", { name: /CTS 1.1/ })).toHaveAttribute("aria-selected", "true");
  await searchInput.press("Enter");
  await expect(page.locator(".text-heading h1")).toContainText("Ἰλιάς");
  await expect(page.locator(".word-hero h2")).toHaveText("ἄειδε");

  expect(consoleErrors).toEqual([]);
});

test("the visible CTS passage can round-trip through the analysis lab", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await mockWiktionary(page);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  await page.getByRole("button", { name: "分析本段" }).click();
  await expect(page.getByRole("heading", { name: /分析实验室/ })).toBeVisible();
  await expect(page.getByLabel("CTS URN")).toHaveValue(
    "urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1-1.3",
  );
  await expect(page.locator(".lab-input-panel textarea")).toHaveValue(/Μῆνιν ἄειδε/);
  await expect(page.getByRole("tree", { name: "语法树" })).toBeVisible();
  await expect(page.locator(".lab-input-foot")).toContainText("Wiktionary 17/17");

  await page.getByRole("treeitem", { name: /ἄειδε/ }).click();
  await page.getByRole("button", { name: "采用 3SG.PST.IPFV.ACT.IND" }).click();
  await page.getByRole("button", { name: /在阅读器中查看当前标注/ }).click();
  await expect(page.locator(".annotation-layer-status")).toContainText("1.1-1.3");

  await page.getByRole("button", { name: "继续分析" }).click();
  await expect(page.getByRole("tree", { name: "语法树" })).toBeVisible();
  await page.getByRole("treeitem", { name: /ἄειδε/ }).click();
  await expect(page.locator(".token-summary-line")).toContainText("3SG");
  await expect(page.locator(".lab-inspector dl")).toContainText("人工校订 · Wiktionary");

  expect(consoleErrors).toEqual([]);
});

test("mobile reader opens analysis and contents drawers", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await mockWiktionary(page);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  await page.getByRole("button", { name: "ἄειδε" }).click();
  await expect(page.locator(".analysis-mobile-clone")).toBeVisible();
  await expect(page.locator(".mobile-word-card h2")).toHaveText("ἄειδε");
  await page.screenshot({ path: "artifacts/reader-mobile-analysis.png", fullPage: true });
  await page.locator(".mobile-analysis-head button").click();

  await page.locator(".mobile-bar").getByRole("button", { name: /目录/ }).click();
  await expect(page.locator(".mobile-drawer")).toHaveClass(/show-left/);
  await page.locator(".drawer-title button").click();

  await page.screenshot({ path: "artifacts/reader-mobile.png", fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("library, passages, bookmarks, and Leipzig analysis are functional", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await mockWiktionary(page);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  await page.getByRole("button", { name: "ἄειδε" }).click();
  await page.getByLabel("收藏词语").click();
  await expect(page.getByLabel("取消收藏词语")).toBeVisible();

  await page.getByRole("button", { name: /下一段/ }).click();
  await expect(page.getByLabel("第 4 行")).toBeVisible();
  await expect(page.getByLabel("第 1 行")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByLabel("第 4 行")).toBeVisible();
  await page.locator(".analysis-tabs").getByRole("button", { name: /收藏/ }).click();
  await expect(page.locator(".bookmark-list")).toContainText("ἄειδε");

  await page.getByRole("button", { name: "书库", exact: true }).click();
  await expect(page.getByRole("heading", { name: "书库" })).toBeVisible();
  await page.getByRole("button", { name: "拉丁语" }).click();
  await expect(page.locator(".library-list")).toContainText("Aeneis");
  await expect(page.locator(".library-list")).not.toContainText("Ἰλιάς");

  await page.getByRole("button", { name: /打开作品/ }).click();
  await expect(page.locator(".text-heading h1")).toContainText("Aeneis");

  await page.getByRole("button", { name: /分析实验室/ }).click();
  await expect(page.getByRole("heading", { name: /分析实验室/ })).toBeVisible();
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.locator(".lab-results-main")).toHaveAttribute("aria-label", /个词项的语法树/);
  await expect(page.locator(".igt-card")).toHaveCount(0);
  await expect(page.locator(".token-summary-line")).toContainText("名词");
  await expect(page.locator(".token-summary-line")).toContainText("愤怒");
  await expect(page.locator(".lgr-tag").first()).toContainText(/阴性|阳性|中性|第一人称|第二人称|第三人称|单数|复数|宾格|主格/);
  await expect(page.getByRole("tree", { name: "语法树" })).toBeVisible();
  await expect(page.locator(".lab-inspector")).not.toContainText("复制 JSON");
  await expect(page.locator(".lab-page-actions")).toContainText("复制 CTS JSON");
  await expect(page.locator(".lab-input-foot")).toContainText("Wiktionary 5/5");
  await expect(page.locator(".lexicon-inline")).toContainText("Wiktionary");
  await page.getByRole("treeitem", { name: /Πηληϊάδεω/ }).click();
  await page.getByRole("button", { name: "校订" }).click();
  await page.locator(".token-editor label").filter({ hasText: "中心词" }).locator("select").selectOption({ label: "θεὰ" });
  await page.locator(".token-editor label").filter({ hasText: "依存" }).locator("input").fill("nmod:poss");
  await page.getByRole("button", { name: "完成校订" }).click();
  await expect(page.getByRole("treeitem", { name: /Πηληϊάδεω/ })).toHaveAttribute("data-head-id", "lab-2-g3");
  await expect(page.locator(".lab-inspector dl")).toContainText("nmod:poss → θεὰ");
  await page.getByRole("treeitem", { name: /ἄειδε/ }).click();
  await page.getByRole("button", { name: "采用 3SG.PST.IPFV.ACT.IND" }).click();
  await expect(page.locator(".token-summary-line")).toContainText("3SG");
  await expect(page.locator(".token-summary-line")).toContainText("PST");
  await expect(page.locator(".lab-inspector dl")).toContainText("人工校订");
  await page.getByRole("button", { name: "校订" }).click();
  await page.locator(".token-editor label").filter({ hasText: "释义" }).locator("input").fill("经人工校订的愤怒");
  await page.getByRole("button", { name: "完成校订" }).click();
  await expect(page.locator(".token-summary-line")).toContainText("经人工校订的愤怒");
  await expect(page.locator(".lab-inspector dl")).toContainText("人工校订");

  expect(consoleErrors).toEqual([]);
});

test("analysis segmentation can split, merge, and honor explicit Chinese boundaries", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1280, height: 820 });
  await mockWiktionary(page);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: /分析实验室/ }).click();

  await page.getByLabel("文本语言").selectOption("latin");
  await page.locator(".lab-input-panel textarea").fill("virumque");
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.getByRole("treeitem", { name: /virumque/ })).toBeVisible();
  await page.getByRole("treeitem", { name: /virumque/ }).click();
  await page.getByRole("button", { name: "校订" }).click();
  await page.getByLabel("分词边界").fill("virum|que");
  await page.getByRole("button", { name: "应用分词" }).click();
  await expect(page.locator(".syntax-tree-node")).toHaveCount(2);
  await expect(page.locator(".syntax-tree-node strong")).toHaveText(["virum", "que"]);
  const splitDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CTS JSON" }).click();
  const splitBundle = JSON.parse(await readFile(await (await splitDownloadPromise).path(), "utf8"));
  expect(splitBundle.annotations.map((annotation) => annotation.form)).toEqual(["virum", "que"]);
  expect(splitBundle.annotations[0].target).toContain("@virum[1]");
  expect(splitBundle.annotations[1].target).toContain("@que[1]");
  expect(splitBundle.annotations[1].syntax.head).toBe(splitBundle.annotations[0].target);

  await page.getByRole("treeitem", { name: /que，/ }).click();
  await page.getByRole("button", { name: "校订" }).click();
  await page.getByRole("button", { name: "合并前词" }).click();
  await expect(page.locator(".syntax-tree-node")).toHaveCount(1);
  await expect(page.locator(".syntax-tree-node strong")).toHaveText("virumque");
  await expect(page.locator(".lab-inspector dl")).toContainText("人工分词 · 合并");
  const mergedDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CTS JSON" }).click();
  const mergedBundle = JSON.parse(await readFile(await (await mergedDownloadPromise).path(), "utf8"));
  expect(mergedBundle.annotations).toHaveLength(1);
  expect(mergedBundle.annotations[0].target).toContain("@virumque[1]");

  await page.getByRole("button", { name: "《论语·学而》" }).click();
  await page.locator(".lab-input-panel textarea").fill("學而 | 時習之");
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.locator(".lab-input-foot")).toContainText("Wiktionary 2/2");
  await expect(page.locator(".syntax-tree-node")).toHaveCount(2);
  await expect(page.locator(".syntax-tree-node strong")).toHaveText(["學而", "時習之"]);

  expect(consoleErrors).toEqual([]);
});

test("CTS annotation bundles can be exported and imported", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1280, height: 820 });
  await mockWiktionary(page);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: /分析实验室/ }).click();

  const urnInput = page.getByLabel("CTS URN");
  await expect(urnInput).toHaveValue("urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1");
  await expect(page.locator(".cts-status")).toHaveText("段落定位有效");

  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.getByRole("tree", { name: "语法树" })).toBeVisible();
  await expect(page.locator(".lab-input-foot")).toContainText("词法 Wiktionary 优先 · 句法 本地规则");
  await expect(page.locator(".lab-input-foot")).toContainText("Wiktionary 5/5");
  await page.getByRole("treeitem", { name: /Πηληϊάδεω/ }).click();
  await page.getByRole("button", { name: "校订" }).click();
  await page.locator(".token-editor label").filter({ hasText: "中心词" }).locator("select").selectOption({ label: "θεὰ" });
  await page.locator(".token-editor label").filter({ hasText: "依存" }).locator("input").fill("nmod:poss");
  await page.getByRole("button", { name: "完成校订" }).click();
  await page.getByRole("treeitem", { name: /ἄειδε/ }).click();
  await page.getByRole("button", { name: "采用 3SG.PST.IPFV.ACT.IND" }).click();
  await expect(page.locator(".lab-inspector dl")).toContainText("Wiktionary");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CTS JSON" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("tlg0012-tlg001-perseus-grc2-1-1-annotations.json");
  const jsonBundle = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(jsonBundle.analysis).toEqual({
    segmentation: "local rules with explicit and manual boundary correction",
    morphology: "Wiktionary primary, local fallback, human candidate selection",
    syntax: "local dependency rules with human correction",
    model: null,
  });
  const modifierAnnotation = jsonBundle.annotations.find((annotation) => annotation.form === "Πηληϊάδεω");
  const parentAnnotation = jsonBundle.annotations.find((annotation) => annotation.form === "θεὰ");
  expect(modifierAnnotation.syntax.dependency).toBe("nmod:poss");
  expect(modifierAnnotation.syntax.head).toBe(parentAnnotation.target);

  const cexDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 CEX" }).click();
  const cexDownload = await cexDownloadPromise;
  expect(cexDownload.suggestedFilename()).toBe("tlg0012-tlg001-perseus-grc2-1-1-annotations.cex");
  const cexSource = await readFile(await cexDownload.path(), "utf8");
  expect(cexSource).toContain("#!ctsdata");
  expect(cexSource).toContain("#!citecollections");
  expect(cexSource).toContain("urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1@Μῆνιν[1]");
  expect(cexSource).toContain("Wiktionary provenance JSON");
  expect(cexSource).toContain("selectedCandidate");
  expect(cexSource).toContain("Syntactic head CTS target");
  expect(cexSource).toContain("nmod:poss");

  const importedBundle = {
    format: "Lingua CTS Annotation Bundle",
    profile: "lingua-cts-annotations/1.0",
    cts: {
      passageUrn: "urn:cts:latinLit:demo.work.edition:2.4",
    },
    language: "latin",
    text: "celeriter",
    annotations: [{
      id: "imported-1",
      target: "urn:cts:latinLit:demo.work.edition:2.4@celeriter[1]",
      form: "celeriter",
      lemma: "celeriter",
      reading: "ke-le-ri-ter",
      pos: "副词",
      morphology: [],
      gloss: "快速地",
      lgr: {
        surface: "celeriter",
        gloss: "快速地.ADV",
        tags: ["ADV"],
      },
      syntax: {
        role: "状语",
        relation: "修饰省略的谓语",
      },
    }],
  };

  const importInput = page.getByLabel("导入 CTS 标注 JSON 或 CEX");
  await importInput.setInputFiles({
    name: "latin-demo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(importedBundle)),
  });
  await expect(urnInput).toHaveValue("urn:cts:latinLit:demo.work.edition:2.4");
  await expect(page.locator(".lab-input-panel textarea")).toHaveValue("celeriter");
  await expect(page.getByRole("treeitem", { name: /celeriter/ })).toBeVisible();
  await expect(page.locator(".token-summary-line")).toContainText("ADV");
  await expect(page.locator(".token-summary-line")).toContainText("快速地");

  await importInput.setInputFiles({
    name: "greek-roundtrip.cex",
    mimeType: "text/plain",
    buffer: Buffer.from(cexSource),
  });
  await expect(urnInput).toHaveValue("urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1");
  await expect(page.locator(".lab-input-panel textarea")).toHaveValue("Μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος");
  await expect(page.getByRole("treeitem", { name: /ἄειδε/ })).toBeVisible();
  await expect(page.locator(".lab-inspector")).toContainText("Μῆνιν");
  await page.getByRole("treeitem", { name: /ἄειδε/ }).click();
  await expect(page.locator(".token-summary-line")).toContainText("3SG");
  await expect(page.getByRole("button", { name: "已采用 3SG.PST.IPFV.ACT.IND" })).toBeVisible();
  await page.getByRole("treeitem", { name: /Πηληϊάδεω/ }).click();
  await expect(page.getByRole("treeitem", { name: /Πηληϊάδεω/ })).toHaveAttribute("data-head-id", "lab-2-g3");
  await expect(page.locator(".lab-inspector dl")).toContainText("nmod:poss → θεὰ");
  await page.screenshot({ path: "artifacts/analysis-lab-cts.png", fullPage: true });

  await page.getByRole("button", { name: /在阅读器中查看当前标注/ }).click();
  await expect(page.locator(".text-heading h1")).toContainText("Ἰλιάς");
  await expect(page.locator(".annotation-layer-status")).toContainText("urn:cts:greekLit:tlg0012.tlg001.perseus-grc2:1.1");
  await page.getByRole("button", { name: "Πηληϊάδεω" }).click();
  await expect(page.locator(".word-hero h2")).toHaveText("Πηληϊάδεω");
  await page.locator(".analysis-tabs").getByRole("button", { name: "句法" }).click();
  await expect(page.getByRole("tree", { name: "阅读器依存树" })).toBeVisible();
  await expect(page.getByRole("treeitem", { name: /Πηληϊάδεω/ })).toHaveAttribute("data-head-id", "lab-2-g3");
  await page.screenshot({ path: "artifacts/reader-cts-layer.png", fullPage: true });

  await page.getByRole("button", { name: "返回原版" }).click();
  await expect(page.locator(".annotation-layer-status")).toHaveCount(0);
  await expect(page.locator(".token.selected")).toContainText("Μῆνιν");

  expect(consoleErrors).toEqual([]);
});

test("invalid CTS annotation structures are rejected before import", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: /分析实验室/ }).click();

  await page.getByLabel("导入 CTS 标注 JSON 或 CEX").setInputFiles(
    "tests/fixtures/invalid-cts.json",
  );
  await expect(page.locator(".cts-status")).toContainText("CTS 词位");
  await expect(page.locator(".cts-status")).toContainText("重复");
  await expect(page.getByRole("tree", { name: "语法树" })).toHaveCount(0);
  await expect(page.locator(".lab-input-panel textarea")).toHaveValue(
    "Μῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος",
  );
});

test("a language profile initializes segmentation and opens as a CTS reader layer", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await mockWiktionary(page);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "语言工作台" }).click();

  await page.getByLabel("语言名称").fill("测试语");
  await page.getByLabel("语言代码").fill("x-test");
  await page.getByLabel("文字系统").fill("Latin");
  await page.getByRole("button", { name: "查找并继续" }).click();
  await expect(page.locator(".resource-selection-list")).toContainText("Glottolog");
  await expect(page.locator(".resource-selection-list")).toContainText("Kaikki / Wiktextract");
  await page.getByRole("button", { name: "下一步" }).click();

  await page.getByRole("radio", { name: /词表最长匹配/ }).check();
  await page.getByLabel(/初始化词表/).fill(
    "tama\ttama\tN\t人\ntaku\ttaku\tV\t看",
  );
  await page.getByRole("button", { name: "下一步" }).click();
  await page.getByLabel("分词样例").fill("tamataku");
  await expect(page.locator(".tokenization-preview span")).toHaveText(["1tama", "2taku"]);
  await page.getByRole("button", { name: "保存并初始化" }).click();

  await expect(page.locator(".language-registry-list")).toContainText("测试语");
  await expect(page.locator(".language-registry-list")).toContainText("x-test · 词表最长匹配");
  await page.locator(".language-registry-list").getByRole("button", { name: "测试" }).click();
  await expect(page.getByLabel("文本语言")).toHaveValue("custom-x-test");
  await expect(page.locator(".syntax-pending")).toContainText("当前只有分词与词法结果");
  await expect(page.locator(".syntax-pending").getByRole("button", { name: /tama/ })).toBeVisible();
  await expect(page.locator(".lab-input-foot")).toContainText("词表匹配 2/2");
  await expect(page.locator(".token-summary-line")).toContainText("人");

  await page.getByRole("button", { name: "在阅读器中查看当前语料" }).click();
  await expect(page.locator(".text-heading h1")).toContainText("测试语");
  await expect(page.getByLabel("切换文本语言")).toHaveValue("custom-x-test");
  await expect(page.getByRole("button", { name: "tama" })).toBeVisible();
  await expect(page.locator(".word-hero h2")).toHaveText("tama");
  await expect(page.locator(".annotation-layer-status")).toContainText(
    "urn:cts:lingua:custom.x-test.v1:1.1",
  );
  await page.locator(".analysis-tabs").getByRole("button", { name: "句法" }).click();
  await expect(page.getByRole("tree", { name: "阅读器依存树" })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("database-assisted initialization and multi-format dictionary import are traceable", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "语言工作台" }).click();

  await page.getByLabel("语言代码").fill("ain");
  await page.getByRole("button", { name: "查找并继续" }).click();
  await expect(page.locator(".resolved-language-line")).toContainText("阿伊努语");
  await expect(page.locator(".resolved-language-line")).toContainText("ainu1240");
  await expect(page.locator(".resource-selection-list")).toContainText("PHOIBLE");
  await expect(page.locator(".resource-selection-list")).toContainText("目录匹配");

  await page.getByRole("tab", { name: "词典导入" }).click();
  await page.getByLabel("选择离线词典文件").setInputFiles({
    name: "greek-demo.tsv",
    mimeType: "text/tab-separated-values",
    buffer: Buffer.from(
      "form\tlemma\tpos\tdefinition\nΜῆνιν\tμῆνις\tN\t愤怒；神祇的震怒\nἄειδε\tἀείδω\tV\t歌唱",
      "utf8",
    ),
  });
  await expect(page.locator(".dictionary-file-picker")).toContainText("TSV");
  await page.getByRole("button", { name: "解析并导入" }).click();
  await expect(page.locator(".dictionary-import-status")).toContainText("已整理 2 条");
  await expect(page.locator(".dictionary-preview-list")).toContainText("Μῆνιν");
  await expect(page.locator(".dictionary-preview-list")).toContainText("愤怒");
  await expect(page.locator(".dictionary-history-list")).toContainText("greek-demo");

  await page.reload();
  await page.getByRole("button", { name: "语言工作台" }).click();
  await page.getByRole("tab", { name: "词典导入" }).click();
  await expect(page.locator(".dictionary-history-list")).toContainText("2 条");

  await page.goto("/sources");
  await expect(page.getByRole("heading", { name: "数据来源与致谢" })).toBeVisible();
  await expect(page.locator(".source-row")).toHaveCount(21);
  await expect(page.getByRole("link", { name: "LINDAT UDPipe" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Forvo Pronunciation API" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Wiktionary Audio / Lingua Libre" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Glottolog" })).toHaveAttribute(
    "href",
    "https://glottolog.org/meta/downloads",
  );
  await expect(page.locator(".acknowledgement-copy")).toContainText("Universal Dependencies");

  expect(consoleErrors).toEqual([]);
});

test("MDX-style entries can become a persistent local work and travel in a database backup", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "语言工作台" }).click();
  await page.getByRole("tab", { name: "词典导入" }).click();
  await page.getByLabel("导入到").selectOption("library");
  await page.getByLabel("作品标题").fill("Loeb 阅读样本");
  await page.getByLabel("作者 / 版本").fill("Homer · Loeb");
  await page.getByLabel("选择离线词典文件").setInputFiles({
    name: "loeb-sample.tsv",
    mimeType: "text/tab-separated-values",
    buffer: Buffer.from(
      "form\tdefinition\n1.1\tΜῆνιν ἄειδε θεὰ Πηληϊάδεω Ἀχιλῆος\n1.2\tἄνδρα μοι ἔννεπε, Μοῦσα",
      "utf8",
    ),
  });
  await page.getByRole("button", { name: "导入书库" }).click();
  await expect(page.locator(".dictionary-import-status")).toContainText("已写入书库 2 段");
  await expect(page.locator(".dictionary-history-list")).toContainText("Loeb 阅读样本");

  await page.getByRole("button", { name: "书库", exact: true }).click();
  const localWork = page.locator(".library-item").filter({ hasText: "Loeb 阅读样本" });
  await expect(localWork).toContainText("本地数据库");
  await localWork.getByRole("button", { name: "打开作品" }).click();
  await expect(page.locator(".text-heading h1")).toContainText("Loeb 阅读样本");
  await expect(page.getByRole("button", { name: "Μῆνιν" })).toBeVisible();
  await expect(page.locator(".local-passage-position")).toContainText("1 / 2");
  await page.getByRole("button", { name: "下一段" }).click();
  await expect(page.getByRole("button", { name: "ἄνδρα" })).toBeVisible();
  await expect(page.locator(".local-passage-position")).toContainText("2 / 2");

  await page.getByRole("button", { name: "语言工作台" }).click();
  await page.getByRole("tab", { name: "本地数据库" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出本地数据库" }).click();
  const download = await downloadEvent;
  const backupPath = `/tmp/lingua-reader-${Date.now()}.linguadb`;
  await download.saveAs(backupPath);
  const bytes = await readFile(backupPath);
  expect(bytes.subarray(0, 24).toString("utf8")).toContain("LINGUA-LOCAL-DATABASE/1");
  await expect(page.locator(".dictionary-import-status")).toContainText("已导出");

  await page.getByLabel("选择 Lingua 本地数据库").setInputFiles(backupPath);
  await expect(page.locator(".dictionary-import-status")).toContainText("lingua-reader-");
  await page.getByRole("button", { name: "恢复备份" }).click();
  await expect(page.locator(".dictionary-import-status")).toContainText("重新载入后生效");
  await page.getByRole("button", { name: "重新载入" }).click();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "书库" }).click();
  await expect(page.locator(".library-item").filter({ hasText: "Loeb 阅读样本" })).toBeVisible();
});

test("PDF intake and grammar reference queues stay explicit while the model is disconnected", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "语言工作台" }).click();

  await page.getByRole("tab", { name: "PDF 导入" }).click();
  await expect(page.getByText("多模态模型未连接")).toBeVisible();
  await page.getByRole("button", { name: "加入识别队列" }).click();
  await expect(page.getByRole("status")).toContainText("请选择一个 PDF 文件");
  await page.getByLabel("选择双语、语法或扫描词典 PDF").setInputFiles(
    "tests/fixtures/storage-sample.pdf",
  );
  await page.getByRole("button", { name: "加入识别队列" }).click();
  await expect(page.locator(".workspace-queue")).toContainText("storage-sample");
  await expect(page.locator(".workspace-queue")).toContainText("文件已就绪 · 等待模型");

  await page.reload();
  await page.getByRole("button", { name: "语言工作台" }).click();
  await page.getByRole("tab", { name: "PDF 导入" }).click();
  await expect(page.locator(".workspace-queue")).toContainText("storage-sample");
  await expect(page.locator(".workspace-queue")).toContainText("文件已就绪 · 等待模型");

  await page.getByRole("tab", { name: "语法参考" }).click();
  await page.getByLabel("参考标题").fill("古希腊语语法提要");
  await page.getByRole("button", { name: "加入生成队列" }).click();
  await expect(page.locator(".workspace-queue")).toContainText("古希腊语语法提要");
  await expect(page.locator(".workspace-queue")).toContainText("等待模型连接");
});

test("model settings test an endpoint while keeping the secret session-only", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockWiktionary(page);
  await page.route("https://models.example.test/v1/models", async (route) => {
    await route.fulfill({
      json: {
        object: "list",
        data: [{ id: "lingua-vision" }, { id: "lingua-text" }],
      },
    });
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  await page.getByRole("button", { name: "模型设置" }).click();
  await expect(page.getByRole("dialog", { name: "模型设置" })).toBeVisible();
  await page.getByLabel("模型终点").fill("https://models.example.test/v1");
  await page.getByLabel("模型 ID").fill("lingua-vision");
  await page.getByLabel(/API 密钥/).fill("session-secret");
  await page.getByRole("button", { name: "测试连接" }).click();
  await expect(page.getByRole("dialog", { name: "模型设置" }).getByRole("status")).toContainText("连接通过");
  await expect(page.getByRole("dialog", { name: "模型设置" }).getByRole("status")).toContainText("2 个模型");

  const storedConfig = await page.evaluate(() => (
    window.localStorage.getItem("lingua-model-config-v1")
  ));
  const sessionSecret = await page.evaluate(() => (
    window.sessionStorage.getItem("lingua-model-secret-v1")
  ));
  expect(storedConfig).not.toContain("session-secret");
  expect(sessionSecret).toBe("session-secret");

  await page.getByRole("button", { name: "关闭模型设置" }).click();
  await page.getByRole("button", { name: "ἄειδε" }).click();
  await page.locator(".analysis-tabs").getByRole("button", { name: "语法", exact: true }).click();
  const morphologyTable = page.getByRole("table", { name: "ἄειδε的词法分析" });
  await expect(morphologyTable).toContainText("Verb");
  await expect(morphologyTable).toContainText("ACT");
  await expect(morphologyTable).toContainText("Wiktionary");
  await morphologyTable.locator(".lgr-tag").filter({ hasText: "ACT" }).hover();
  await expect(morphologyTable.getByRole("tooltip", { name: /主动态/ })).toBeVisible();
});

test("a scanned dictionary result imports into the selected language lexicon with page provenance", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.route("**/api/lexicon**", async (route) => {
    await route.fulfill({
      json: {
        status: "not_found",
        source: "Wiktionary",
        entries: [],
      },
    });
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("button", { name: "语言工作台" }).click();
  await page.getByRole("tab", { name: "PDF 导入" }).click();
  await page.getByLabel("材料类型").selectOption("dictionary");
  await page.getByLabel("材料标题").fill("扫描希腊语词典");
  await page.getByLabel("选择双语、语法或扫描词典 PDF").setInputFiles(
    "tests/fixtures/storage-sample.pdf",
  );
  await page.getByRole("button", { name: "加入识别队列" }).click();
  await expect(page.locator(".workspace-queue")).toContainText("扫描希腊语词典");
  await expect(page.locator(".workspace-queue")).toContainText("扫描件已就绪");

  await page.getByLabel("选择词典识别结果 JSON").setInputFiles(
    "tests/fixtures/dictionary-result.json",
  );
  await expect(page.locator(".workspace-queue")).toContainText("已导入 1 条词目");

  await page.getByRole("button", { name: "阅读器" }).click();
  await page.locator(".analysis-tabs").getByRole("button", { name: "语法", exact: true }).click();
  const morphologyTable = page.getByRole("table", { name: "Μῆνιν的词法分析" });
  await expect(morphologyTable).toContainText("愤怒；尤指神祇的震怒");
  await expect(morphologyTable).toContainText("扫描希腊语词典 · 第 12 页");
});
