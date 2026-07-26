import assert from "node:assert/strict";
import test from "node:test";
import {
  leipzigTagDescription,
  normalizeLgrTags,
} from "../app/lgr.js";

test("normalizes common morphology aliases into LGR tags", () => {
  const profile = normalizeLgrTags([
    "3S",
    "pres",
    "aorist",
    "active",
    "subjunctive",
  ]);

  assert.deepEqual(profile.tags, ["3SG", "PRS", "PST", "PFV", "ACT", "SBJV"]);
  assert.deepEqual(profile.extensions, ["ACT"]);
  assert.deepEqual(profile.unregistered, []);
});

test("combines separate person and number features and removes duplicates", () => {
  const profile = normalizeLgrTags("1 SG PRF.IND.PRF");

  assert.deepEqual(profile.tags, ["1SG", "PRF", "IND"]);
  assert.deepEqual(profile.unregistered, []);
});

test("keeps unknown extensions visible instead of silently discarding them", () => {
  const profile = normalizeLgrTags(["NOM", "custom-tag"]);

  assert.deepEqual(profile.tags, ["NOM", "CUSTOM-TAG"]);
  assert.deepEqual(profile.unregistered, ["CUSTOM-TAG"]);
  assert.equal(leipzigTagDescription("CUSTOM-TAG"), "未注册的扩展标签");
});

test("describes person-number bundles and registered language extensions", () => {
  assert.equal(leipzigTagDescription("2PL"), "第二人称复数");
  assert.equal(leipzigTagDescription("ACT"), "主动态（语言特定扩展）");
});
