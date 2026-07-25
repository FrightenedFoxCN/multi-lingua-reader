const { test, expect } = require("@playwright/test");

test("desktop reader supports word, syntax, language, translation, search, and notes", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  await expect(page.locator(".text-heading h1")).toContainText("Ἰλιάς");
  await expect(page.locator(".token.selected")).toContainText("Μῆνιν");
  await expect(page.locator(".word-hero h2")).toHaveText("Μῆνιν");

  await page.getByRole("button", { name: "ἄειδε" }).click();
  await expect(page.locator(".word-hero h2")).toHaveText("ἄειδε");
  await expect(page.locator(".definition")).toContainText("歌唱");
  await page.screenshot({ path: "artifacts/reader-desktop-word.png", fullPage: true });

  await page.getByRole("button", { name: "句法" }).click();
  await expect(page.getByRole("heading", { name: "依存关系" })).toBeVisible();
  await expect(page.locator(".syntax-root")).toContainText("ἄειδε");

  await page.getByLabel("切换文本语言").selectOption("latin");
  await expect(page.locator(".text-heading h1")).toContainText("Aeneis");
  await expect(page.locator(".token.selected")).toContainText("Arma");

  await page.getByRole("button", { name: /译文/ }).click();
  await expect(page.locator(".translation-line").first()).toBeVisible();

  await page.getByRole("button", { name: /搜索作品/ }).click();
  await page.getByPlaceholder("搜索作品、作者或语言…").fill("论语");
  await expect(page.locator(".search-results")).toContainText("論語");
  await page.locator(".search-results button").click();
  await expect(page.locator(".text-heading h1")).toContainText("論語");

  await page.getByRole("button", { name: /笔记/ }).click();
  await page.getByPlaceholder("写下释义、疑问或阅读心得…").fill("“學”与“習”形成承接关系。");
  await page.getByRole("button", { name: "保存笔记" }).click();
  await expect(page.locator(".saved-note")).toContainText("承接关系");

  await page.screenshot({ path: "artifacts/reader-desktop.png", fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("mobile reader opens analysis and contents drawers", async ({ page }) => {
  const consoleErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

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
