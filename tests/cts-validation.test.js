import assert from "node:assert/strict";
import test from "node:test";
import { validateCtsAnnotationBundle } from "../app/cts-validation.js";

function validBundle() {
  const passageUrn = "urn:cts:latinLit:demo.work.edition:1.1";
  const firstTarget = `${passageUrn}@arma[1]`;
  const secondTarget = `${passageUrn}@cano[1]`;
  return {
    cts: { passageUrn },
    text: "arma cano",
    annotations: [
      {
        id: "a1",
        target: firstTarget,
        form: "arma",
        lgr: { tags: ["ACC", "PL"] },
        syntax: { head: secondTarget, dependency: "obj" },
      },
      {
        id: "a2",
        target: secondTarget,
        form: "cano",
        lgr: { tags: ["1SG", "PRS"] },
        syntax: { head: null, dependency: "root" },
      },
    ],
  };
}

test("accepts a structurally complete CTS annotation bundle", () => {
  const result = validateCtsAnnotationBundle(validBundle());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
});

test("rejects duplicate and cross-passage CTS targets", () => {
  const bundle = validBundle();
  const outsideTarget = "urn:cts:latinLit:demo.work.edition:2.1@arma[1]";
  bundle.annotations[0].target = outsideTarget;
  bundle.annotations[1].target = outsideTarget;

  const result = validateCtsAnnotationBundle(bundle);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((item) => item.code === "target-outside-passage"));
  assert.ok(result.errors.some((item) => item.code === "duplicate-target"));
  assert.ok(result.errors.some((item) => item.code === "missing-syntax-head"));
});

test("rejects dangling heads and syntax cycles", () => {
  const bundle = validBundle();
  bundle.annotations[0].syntax.head = bundle.annotations[1].target;
  bundle.annotations[1].syntax.head = bundle.annotations[0].target;
  bundle.annotations[1].syntax.dependency = "dep";

  const cycle = validateCtsAnnotationBundle(bundle);
  assert.equal(cycle.valid, false);
  assert.ok(cycle.errors.some((item) => item.code === "syntax-cycle"));

  bundle.annotations[0].syntax.head = `${bundle.cts.passageUrn}@missing[1]`;
  const dangling = validateCtsAnnotationBundle(bundle);
  assert.ok(dangling.errors.some((item) => item.code === "missing-syntax-head"));
});
