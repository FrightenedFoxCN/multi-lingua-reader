const GRAMBANK_ORIGIN = "https://grambank.clld.org";
const USER_AGENT = "LinguaReader/0.1 (local research prototype)";
const UPSTREAM_TIMEOUT_MS = 12000;

const featureSummaries = {
  GB020: {
    category: "名词短语",
    yes: "使用定冠词或特指冠词。",
    no: "不使用定冠词或特指冠词；定指性由其他手段表达。",
  },
  GB027: {
    category: "名词短语",
    yes: "名词并列与伴随关系使用不同的表达手段。",
    no: "名词并列与伴随关系可以使用同一表达手段。",
  },
  GB039: {
    category: "名词形态",
    yes: "名词数标记存在不能只由语音规则预测的异形变化。",
    no: "名词数标记没有非语音条件制约的异形变化。",
  },
  GB044: {
    category: "名词形态",
    yes: "名词具有能产的复数形态标记。",
    no: "名词没有能产的复数形态标记。",
  },
  GB051: {
    category: "名词形态",
    yes: "名词性别或名词类别的划分受到自然性别影响。",
    no: "名词类别不以自然性别为划分因素。",
  },
  GB053: {
    category: "名词形态",
    yes: "生命度参与名词性别或名词类别的划分。",
    no: "生命度不参与名词类别划分。",
  },
  GB070: {
    category: "格与论元",
    yes: "核心名词论元具有形态格标记。",
    no: "核心名词论元没有形态格标记。",
  },
  GB074: {
    category: "格与论元",
    yes: "使用前置介词。",
    no: "不使用前置介词。",
  },
  GB075: {
    category: "格与论元",
    yes: "使用后置介词。",
    no: "不使用后置介词。",
  },
  GB079: {
    category: "复综形态",
    yes: "动词除论元索引外，还可以承载否定、情态、方位或其他前缀与附着成分。",
    no: "动词没有论元索引之外的前缀或前附着成分。",
  },
  GB082: {
    category: "动词形态",
    yes: "动词具有专门的现在时形态标记。",
    no: "动词没有专门的现在时形态标记。",
  },
  GB083: {
    category: "动词形态",
    yes: "动词具有专门的过去时形态标记。",
    no: "动词没有专门的过去时形态标记。",
  },
  GB084: {
    category: "动词形态",
    yes: "动词具有专门的将来时形态标记。",
    no: "动词没有专门的将来时形态标记。",
  },
  GB086: {
    category: "动词形态",
    yes: "动词形态区分完成体与未完成体。",
    no: "动词形态不区分完成体与未完成体。",
  },
  GB089: {
    category: "复综形态",
    yes: "不及物动词可以通过后缀或后附着语索引主语。",
    no: "不及物动词不通过后缀或后附着语索引主语。",
  },
  GB090: {
    category: "复综形态",
    yes: "不及物动词可以通过前缀或前附着语索引主语。",
    no: "不及物动词不通过前缀或前附着语索引主语。",
  },
  GB091: {
    category: "复综形态",
    yes: "及物动词可以通过后缀或后附着语索引施事论元。",
    no: "及物动词不通过后缀或后附着语索引施事论元。",
  },
  GB092: {
    category: "复综形态",
    yes: "及物动词可以通过前缀或前附着语索引施事论元。",
    no: "及物动词不通过前缀或前附着语索引施事论元。",
  },
  GB093: {
    category: "复综形态",
    yes: "及物动词可以通过后缀或后附着语索引受事论元。",
    no: "及物动词不通过后缀或后附着语索引受事论元。",
  },
  GB094: {
    category: "复综形态",
    yes: "及物动词可以通过前缀或前附着语索引受事论元。",
    no: "及物动词不通过前缀或前附着语索引受事论元。",
  },
  GB107: {
    category: "否定",
    yes: "标准否定可以通过动词上的词缀、附着语或词形变化表达。",
    no: "标准否定不依赖动词词缀或词形变化，通常由独立否定成分表达。",
  },
  GB111: {
    category: "动词形态",
    yes: "动词存在不同的变位类别。",
    no: "动词没有可区分的变位类别。",
  },
  GB114: {
    category: "动词形态",
    yes: "动词可以带有语音上依附的反身标记。",
    no: "动词没有语音上依附的反身标记。",
  },
  GB108: {
    category: "复综形态",
    yes: "方向或方位意义可以直接编码在动词形态中。",
    no: "方向或方位意义不直接编码在动词形态中。",
  },
  GB124: {
    category: "复综形态",
    yes: "名词并入动词是能产过程，并可以使及物动词不及物化。",
    no: "没有能产的、可使动词不及物化的名词并入过程。",
  },
  GB130: {
    category: "语序",
    yes: "不及物句的无标记语序为主语在动词之前。",
    no: "不及物句的无标记语序不是主语—动词。",
  },
  GB132: {
    category: "语序",
    yes: "及物句允许或偏好动词居于核心论元之间。",
    no: "及物句不以动词居中为无标记模式。",
  },
  GB136: {
    category: "语序",
    yes: "核心论元的语序相对固定。",
    no: "核心论元语序具有较大灵活性，并可能受信息结构影响。",
  },
  GB170: {
    category: "一致关系",
    yes: "定语性属性词可以与名词进行性别或类别一致。",
    no: "定语性属性词不与名词进行性别或类别一致。",
  },
  GB184: {
    category: "一致关系",
    yes: "定语性属性词可以与名词进行数的一致。",
    no: "定语性属性词不与名词进行数的一致。",
  },
  GB187: {
    category: "构词",
    yes: "名词具有能产的指小构词。",
    no: "名词没有能产的指小构词。",
  },
  GB304: {
    category: "语态",
    yes: "被动句可以显式表达施事。",
    no: "被动句通常不能显式表达施事。",
  },
  GB408: {
    category: "格与论元",
    yes: "论元标记中存在主宾型对齐。",
    no: "论元标记中没有主宾型对齐。",
  },
};

function decodeHtml(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: "\"" };
  return String(value || "").replace(/&(#x[\da-f]+|#\d+|[a-z]+);/giu, (entity, code) => {
    if (code[0] === "#") {
      const base = code[1]?.toLocaleLowerCase() === "x" ? 16 : 10;
      const number = Number.parseInt(code.slice(base === 16 ? 2 : 1), base);
      return Number.isFinite(number) ? String.fromCodePoint(number) : entity;
    }
    return named[code.toLocaleLowerCase()] ?? entity;
  });
}

function htmlToText(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/gu, " "))
    .replace(/\s+/gu, " ")
    .trim();
}

function anchorTitle(value) {
  return decodeHtml(/\btitle=["']([^"']*)["']/iu.exec(String(value || ""))?.[1] || "");
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Grambank responded with ${response.status}`);
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeFeature(row, glottocode) {
  const id = htmlToText(row?.[0]);
  const descriptor = featureSummaries[id];
  if (!descriptor) return null;
  const value = anchorTitle(row?.[2]) || htmlToText(row?.[2]);
  const summary = value === "1"
    ? descriptor.yes
    : value === "0"
      ? descriptor.no
      : "该特征在当前数据中尚未确定。";
  return {
    id,
    category: descriptor.category,
    summary,
    value,
    question: anchorTitle(row?.[1]) || htmlToText(row?.[1]),
    evidence: htmlToText(row?.[4]),
    source: htmlToText(row?.[3]),
    sourceUrl: `${GRAMBANK_ORIGIN}/valuesets/${id}-${glottocode}`,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const glottocode = String(searchParams.get("glottocode") || "").trim().toLocaleLowerCase();
  if (!/^[a-z]{4}\d{4}$/u.test(glottocode)) {
    return Response.json(
      { status: "invalid", message: "需要有效的 Glottocode 才能读取 Grambank。" },
      { status: 400 },
    );
  }

  try {
    const valuesUrl = new URL(`${GRAMBANK_ORIGIN}/values`);
    valuesUrl.search = new URLSearchParams({
      language: glottocode,
      sEcho: "1",
      iDisplayStart: "0",
      iDisplayLength: "500",
    }).toString();
    const [language, values] = await Promise.all([
      fetchJson(`${GRAMBANK_ORIGIN}/languages/${glottocode}.json`),
      fetchJson(valuesUrl, {
        headers: { "x-requested-with": "XMLHttpRequest" },
      }),
    ]);
    const rules = (values?.aaData || [])
      .map((row) => normalizeFeature(row, glottocode))
      .filter(Boolean);
    return Response.json({
      status: rules.length ? "ok" : "not_found",
      provider: "Grambank",
      language: language?.name || glottocode,
      glottocode,
      coverage: {
        coded: language?.nzrepresentation || rules.length,
        total: language?.representation || 195,
      },
      rules,
      sourceUrl: `${GRAMBANK_ORIGIN}/languages/${glottocode}`,
      license: "CC BY 4.0",
      acknowledgement: "Grambank, edited by The Grambank Consortium.",
    }, {
      headers: {
        "cache-control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch {
    return Response.json({
      status: "unavailable",
      provider: "Grambank",
      glottocode,
      rules: [],
      message: "Grambank 暂时无法读取，可稍后重试。",
    }, { status: 503 });
  }
}
