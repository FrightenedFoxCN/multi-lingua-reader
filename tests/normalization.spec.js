import { expect, test } from "@playwright/test";

const slp1Dsl = `version 1
language sa
replace all /A/gu -> "ā"
replace all /S/gu -> "ś"
replace all /H/gu -> "ḥ"`;

const slp1Corpus = `# sent_id = sa-slp1-1
# text = SAntiH
1\tSAntiH\tSAnti\tNOUN\t_\tCase=Nom|Gender=Fem|Number=Sing\t0\troot\t_\t_`;

test("normalizes corpus and dictionary imports and keeps the corpus rule snapshot queryable", async ({ page }) => {
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
        id: "custom-sa",
        name: "梵语",
        code: "sa",
        script: "Deva",
        direction: "ltr",
        sample: "śāntiḥ",
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
  await page.getByLabel("配置语言").selectOption("custom-sa");
  await page.getByLabel("规则包名称").fill("梵语 SLP1");
  await page.getByLabel("分析 DSL 源码").fill(slp1Dsl);
  await page.getByRole("button", { name: "保存并启用" }).click();
  await expect(page.locator(".analysis-rule-pack-list")).toContainText("3 条替换");

  await page.getByLabel("选择 CoNLL-U 语料文件").setInputFiles({
    name: "sanskrit-slp1.conllu",
    mimeType: "text/plain",
    buffer: Buffer.from(slp1Corpus),
  });
  await page.getByRole("button", { name: "导入并启用" }).click();
  await expect(page.locator(".corpus-import-status")).toContainText("规范化 8 处");
  await expect(page.locator(".corpus-list")).toContainText("3 条录入替换");

  await page.getByRole("tab", { name: "词典导入" }).click();
  await page.getByLabel("词库语言").selectOption("custom-sa");
  await page.getByLabel("选择离线词典文件").setInputFiles({
    name: "sanskrit-slp1.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("headword,lemma,pos,definition\nSAntiH,SAnti,NOUN,寂静"),
  });
  await page.getByRole("button", { name: "解析并导入" }).click();
  await expect(page.locator(".dictionary-import-status")).toContainText("规范化 2 个字段");
  await expect(page.locator(".dictionary-preview-list")).toContainText("śāntiḥ");
  await expect(page.locator(".dictionary-preview-list")).toContainText("śānti");

  await page.getByRole("tab", { name: "分析管线" }).click();
  await page.getByLabel("配置语言").selectOption("custom-sa");
  await page.locator(".analysis-rule-pack-list input[type=checkbox]").uncheck();

  await page.getByRole("button", { name: /分析实验室/u }).click();
  await page.getByLabel("文本语言").selectOption("custom-sa");
  await page.locator(".lab-input-panel textarea").fill("SAntiH");
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.locator(".lab-input-foot")).toContainText("本地 UD 语料命中");
  await expect(page.getByRole("treeitem", { name: /śāntiḥ/u })).toBeVisible();
  await expect(page.locator(".lab-inspector dl")).toContainText("录入原值");
  await expect(page.locator(".lab-inspector dl")).toContainText("SAntiH");
  await expect(page.locator(".lab-input-foot")).not.toContainText("DSL 预处理");
});
