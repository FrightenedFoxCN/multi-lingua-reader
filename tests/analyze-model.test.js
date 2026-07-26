import assert from "node:assert/strict";
import test from "node:test";
import { extractModelTokens } from "../app/api/analyze/model/route.js";

test("normalizes model JSON into a bounded UD token sequence", () => {
  const tokens = extractModelTokens(`\`\`\`json
  {"tokens":[
    {"form":"Я","lemma":"я","upos":"PRON","features":{"Case":"Nom"},"head":2,"dependency":"nsubj"},
    {"form":"читаю","lemma":"читать","upos":"VERB","features":{"Tense":"Pres"},"head":0,"dependency":"root"}
  ]}
  \`\`\``);

  assert.equal(tokens.length, 2);
  assert.equal(tokens[0].id, 1);
  assert.equal(tokens[0].head, 2);
  assert.deepEqual(tokens[1].features, { Tense: "Pres" });
});

test("repairs impossible model heads and rejects empty forms", () => {
  const [token] = extractModelTokens({
    tokens: [{ form: "test", upos: "NOUN", head: 9, dependency: "nsubj" }],
  });
  assert.equal(token.head, 0);
  assert.equal(token.dependency, "root");
  assert.throws(
    () => extractModelTokens({ tokens: [{ form: "", head: 0 }] }),
    /空词形/u,
  );
});
