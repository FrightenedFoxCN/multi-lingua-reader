import { expect, test } from "@playwright/test";

test("the consolidated manual documents the complete workflow and DSL reference", async ({ page }) => {
  await page.goto("/docs");

  await expect(page.getByRole("heading", { name: "使用文档", exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "使用文档" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link", {
      name: "分析实验室",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("BETA", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "文档目录" }).getByRole("link")).toHaveCount(10);
  await expect(page.getByRole("heading", { name: "分析 DSL" })).toBeVisible();
  await expect(page.getByRole("table", { name: "DSL 全局指令" })).toContainText("replace [all|text|form|lemma]");
  await expect(page.getByRole("table", { name: "DSL 全局指令" })).toContainText("segment /pattern/flags");
  await expect(page.getByRole("table", { name: "DSL 规则指令" })).toContainText("head root");
  await expect(page.locator("#dsl")).toContainText("100规则 / 包");
  await expect(page.locator("#dsl")).toContainText("200替换 / 包");
  await expect(page.locator("#corpus pre")).toContainText("# text = Я читаю книгу.");
  await expect(page.locator("#exchange")).toContainText(".linguadb");

  await page.getByRole("navigation", { name: "文档目录" }).getByRole("link", { name: "分析 DSL" }).click();
  await expect.poll(() => new URL(page.url()).hash).toBe("#dsl");

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )).toBe(true);
  await expect(page.locator(".docs-toc nav")).toBeVisible();
  await expect(page.locator(".docs-command-table").first()).toBeVisible();
});

test("primary and acknowledgement pages share the same navigation configuration", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "使用文档" }).click();
  await expect(page).toHaveURL(/\/docs$/u);

  await page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "数据来源" }).click();
  await expect(page).toHaveURL(/\/sources$/u);
  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "数据来源" }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation", { name: "主导航" }).getByRole("link", { name: "使用文档" }),
  ).toBeVisible();
  await expect(page.locator(".sources-summary")).toHaveCount(0);
  await expect(page.locator(".source-group > header > span")).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  )).toBe(true);
});
