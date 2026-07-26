import assert from "node:assert/strict";
import test from "node:test";
import {
  corpusMetadataRecord,
  normalizeCorpusText,
  parseConlluCorpus,
  parseConlluSentence,
  validateCorpusFile,
} from "../app/corpus-store.js";

const sample = `# sent_id = demo-1
# text = аҵабырг мҩа иақәиҵарц.
1	аҵабырг	а-ҵа́бырг	NOUN	_	Number=Sing	3	obj	_	_
2	мҩа	а́-мҩа	NOUN	_	Number=Sing	3	xcomp	_	_
3	иқәиҵарц	а́-қәҵара	VERB	_	Mood=Prp|Person[obj]=3|Person[subj]=3	0	root	_	SpaceAfter=No
4	.	.	PUNCT	_	_	3	punct	_	_

# sent_id = demo-2
# text = Сара сахьӡуп.
1	Сара	сара́	PRON	_	Person=1|Number=Sing	2	nsubj	_	_
2	сахьӡуп	а-хьӡ	VERB	_	Person[subj]=1	0	root	_	SpaceAfter=No
3	.	.	PUNCT	_	_	2	punct	_	_
`;

test("parses a multi-sentence CoNLL-U corpus with morphology and dependency heads", () => {
  const sentences = parseConlluCorpus(sample);

  assert.equal(sentences.length, 2);
  assert.equal(sentences[0].sentId, "demo-1");
  assert.equal(sentences[0].tokens[2].dependency, "root");
  assert.equal(sentences[0].tokens[2].features["Person[obj]"], "3");
  assert.equal(normalizeCorpusText("  Аҵабырг   Мҩа  "), "аҵабырг мҩа");
});

test("creates compact corpus metadata and validates importable file types", () => {
  const metadata = corpusMetadataRecord({
    id: "corpus-demo",
    title: "Abkhaz demo",
    languageId: "custom-ab",
    languageCode: "ab",
    sentenceCount: 2,
    tokenCount: 7,
  });

  assert.equal(metadata.format, "conllu");
  assert.equal(metadata.sentenceCount, 2);
  assert.equal(validateCorpusFile({ name: "demo.conllu", size: 100 }), "");
  assert.match(validateCorpusFile({ name: "demo.pdf", size: 100 }), /conllu/u);
});

test("normalizes corpus text, forms, and lemmas while retaining source transliteration", () => {
  const sentence = parseConlluSentence(`# sent_id = sa-1
# text = SAntiH
1	SAntiH	SAnti	NOUN	_	Case=Nom	0	root	_	_`, 0, {
    languageCode: "sa",
    normalizationPacks: [{
      id: "slp1",
      name: "SLP1",
      source: `version 1
language sa
replace all /A/gu -> "ā"
replace all /S/gu -> "ś"
replace all /H/gu -> "ḥ"`,
    }],
  });

  assert.equal(sentence.text, "śāntiḥ");
  assert.equal(sentence.originalText, "SAntiH");
  assert.equal(sentence.tokens[0].form, "śāntiḥ");
  assert.equal(sentence.tokens[0].originalForm, "SAntiH");
  assert.equal(sentence.tokens[0].lemma, "śānti");
  assert.equal(sentence.tokens[0].originalLemma, "SAnti");
  assert.equal(sentence.normalizationChanges, 8);
});
