import assert from "node:assert/strict";
import test from "node:test";
import {
  documentationSections,
  languageWorkspaceTabs,
  primaryNavigation,
} from "../app/site-config.js";

test("keeps primary routes, documentation anchors, and workspace tabs unique", () => {
  const unique = (values) => new Set(values).size === values.length;

  assert.equal(unique(primaryNavigation.map((item) => item.id)), true);
  assert.equal(unique(primaryNavigation.map((item) => item.href)), true);
  assert.equal(unique(languageWorkspaceTabs.map((item) => item.id)), true);
  assert.equal(unique(documentationSections.map((item) => item.id)), true);
  assert.ok(primaryNavigation.some((item) => item.id === "docs" && item.href === "/docs"));
  assert.deepEqual(
    languageWorkspaceTabs.map((item) => item.id),
    ["initialize", "dictionaries", "analysis", "pdf", "grammar", "database"],
  );
});

