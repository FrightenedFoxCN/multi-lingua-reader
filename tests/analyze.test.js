import test from "node:test";
import assert from "node:assert/strict";
import {
  findConlluSentence,
  normalizeTreebankText,
  normalizeRequestedAnalysisEngines,
  parseConllu,
} from "../app/api/analyze/route.js";
import { resolveWiktionaryLanguage } from "../app/api/lexicon/route.js";

test("custom language codes resolve to English Wiktionary section names", () => {
  assert.deepEqual(
    resolveWiktionaryLanguage({ language: "custom-cs", code: "cs" }),
    {
      id: "custom-cs",
      code: "cs",
      languageName: "Czech",
      wiki: "en",
      headingIds: ["Czech"],
    },
  );
  assert.equal(
    resolveWiktionaryLanguage({ language: "custom-x-test", code: "x-test" }),
    null,
  );
  assert.equal(
    resolveWiktionaryLanguage({ language: "custom-ja", code: "ja" }).languageName,
    "Japanese",
  );
  assert.equal(
    resolveWiktionaryLanguage({ language: "custom-ab", code: "ab" }).languageName,
    "Abkhaz",
  );
});

test("CoNLL-U parsing retains layered argument indexing used by polysynthetic languages", () => {
  const [token] = parseConllu(
    "1\tисиҭаз\tа́-ҭа-ра\tVERB\t_\tGender[subj]=Masc|Number[io]=Sing|Person[io]=1|Person[obj]=Rel|Person[subj]=3\t0\troot\t_\t_",
  );

  assert.deepEqual(token.features, {
    "Gender[subj]": "Masc",
    "Number[io]": "Sing",
    "Person[io]": "1",
    "Person[obj]": "Rel",
    "Person[subj]": "3",
  });
});

test("UD corpus lookup matches case-normalized polysynthetic sample sentences", () => {
  const source = [
    "# sent_id = abnc-demo",
    "# text = аҵабырг мҩа иқъиҵарц.",
    "1\tаҵабырг\tа-ҵа́бырг\tNOUN\t_\tNumber=Sing\t2\tobj\t_\t_",
    "2\tиқъиҵарц\tа́-қәҵара\tVERB\t_\tMood=Prp|Person[obj]=3|Person[subj]=3\t0\troot\t_\tSpaceAfter=No",
    "3\t.\t.\tPUNCT\t_\t_\t2\tpunct\t_\t_",
    "",
  ].join("\n");

  const match = findConlluSentence(source, "Аҵабырг мҩа иқъиҵарц.");
  assert.equal(match.metadata.sent_id, "abnc-demo");
  assert.equal(match.tokens.length, 3);
  assert.equal(match.tokens[0].dependency, "obj");
  assert.equal(normalizeTreebankText("  Аҵабырг   мҩа  "), "аҵабырг мҩа");
});

test("CoNLL-U results retain lemmas, UD features, and dependency heads", () => {
  const tokens = parseConllu([
    "# text = A tak to přišlo.",
    "1\tA\ta\tCCONJ\tJ^\t_\t4\tcc\t_\t_",
    "2-3\tmulti\t_\t_\t_\t_\t_\t_\t_\t_",
    "2\tpřišlo\tpřijít\tVERB\tVpNS\tAspect=Perf|Gender=Neut|Number=Sing|Tense=Past\t0\troot\t_\tSpaceAfter=No",
    "",
  ].join("\n"));

  assert.equal(tokens.length, 2);
  assert.deepEqual(tokens[1], {
    id: 2,
    form: "přišlo",
    lemma: "přijít",
    upos: "VERB",
    xpos: "VpNS",
    features: {
      Aspect: "Perf",
      Gender: "Neut",
      Number: "Sing",
      Tense: "Past",
    },
    head: 0,
    dependency: "root",
    misc: "SpaceAfter=No",
  });
});

test("server analysis only runs the explicitly ordered compatible engines", () => {
  assert.deepEqual(
    normalizeRequestedAnalysisEngines(["udpipe", "llm", "ud-corpus", "udpipe"]),
    ["udpipe", "ud-corpus"],
  );
  assert.deepEqual(normalizeRequestedAnalysisEngines(undefined), ["ud-corpus", "udpipe"]);
  assert.deepEqual(normalizeRequestedAnalysisEngines([]), []);
});
