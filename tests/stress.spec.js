import { expect, test } from "@playwright/test";

function sentence(index) {
  return `# sent_id = browser-stress-${index}
# text = Token${index} reads a book.
1\tToken${index}\ttoken${index}\tPROPN\t_\tNumber=Sing\t2\tnsubj\t_\t_
2\treads\tread\tVERB\t_\tTense=Pres\t0\troot\t_\t_
3\ta\ta\tDET\t_\tDefinite=Ind\t4\tdet\t_\t_
4\tbook\tbook\tNOUN\t_\tNumber=Sing\t2\tobj\t_\tSpaceAfter=No
5\t.\t.\tPUNCT\t_\t_\t2\tpunct\t_\t_`;
}

function maximumBrowserRulePack() {
  return [
    "version 1",
    "language en",
    ...Array.from({ length: 100 }, (_, index) => [
      `rule stress_${index} priority 0`,
      "when lemma = \"book\"",
      `set gloss \"stress-${index}\"`,
      "add tags SG",
      "end",
    ]).flat(),
  ].join("\n");
}

test("stress: imports 5,000 UD sentences and applies a 100-rule DSL in the UI", {
  timeout: 60_000,
}, async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await page.route("**/api/lexicon**", async (route) => {
    if (route.request().method() === "POST") {
      const payload = route.request().postDataJSON();
      await route.fulfill({
        json: {
          status: "ok",
          language: payload.language,
          results: payload.items.map((item) => ({
            id: item.id,
            status: "not_found",
            term: item.term,
            lemma: item.lemma,
          })),
        },
      });
      return;
    }
    await route.fulfill({ json: { status: "not_found" } });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem("lingua-language-workspace-v1", JSON.stringify({
      profiles: [{
        id: "custom-en-stress",
        name: "英语压力样例",
        code: "en",
        script: "Latn",
        direction: "ltr",
        sample: "Token0 reads a book.",
        segmentation: { strategy: "whitespace", delimiter: "" },
        lexicon: [],
        resources: [],
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
  await page.getByLabel("配置语言").selectOption("custom-en-stress");

  const corpus = Array.from({ length: 5_000 }, (_, index) => sentence(index)).join("\n\n");
  const importStarted = Date.now();
  await page.getByLabel("选择 CoNLL-U 语料文件").setInputFiles({
    name: "browser-stress.conllu",
    mimeType: "text/plain",
    buffer: Buffer.from(corpus),
  });
  await page.getByRole("button", { name: "导入并启用" }).click();
  await expect(page.locator(".corpus-import-status")).toContainText("已导入 5,000 句", {
    timeout: 20_000,
  });
  const importDuration = Date.now() - importStarted;
  expect(importDuration).toBeLessThan(20_000);

  await page.getByLabel("分析 DSL 源码").fill(maximumBrowserRulePack());
  await expect(page.locator(".analysis-dsl-editor .workspace-section-head")).toContainText("100 条规则");
  await page.getByRole("button", { name: "保存并启用" }).click();
  await expect(page.locator(".analysis-rule-pack-list")).toContainText("100 条规则");

  await page.getByRole("button", { name: /分析实验室/ }).click();
  await page.getByLabel("文本语言").selectOption("custom-en-stress");
  await page.locator(".lab-input-panel textarea").fill("Token4999 reads a book.");
  const analysisStarted = Date.now();
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.locator(".lab-input-foot")).toContainText("本地 UD 语料命中", {
    timeout: 15_000,
  });
  await expect(page.locator(".lab-input-foot")).toContainText("DSL 修正 1 词项");
  const analysisDuration = Date.now() - analysisStarted;
  expect(analysisDuration).toBeLessThan(15_000);

  await page.getByRole("treeitem", { name: /book/ }).click();
  await expect(page.locator(".token-summary-line")).toContainText("stress-99");
  await expect(page.locator(".token-summary-line")).toContainText("SG");
  await expect(page.locator(".lab-inspector dl")).toContainText("DSL · stress_99");
  expect(consoleErrors).toEqual([]);
});
