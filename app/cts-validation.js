function clean(value) {
  return String(value ?? "").trim();
}

export function parseCtsPassageReference(value) {
  const source = clean(value);
  const match = /^urn:cts:([^:\s]+):([^:\s]+):([^@\s]+)$/u.exec(source);
  if (!match) return null;
  const workParts = match[2].split(".");
  if (workParts.length < 3 || workParts.length > 4) return null;
  if (!match[3] || match[3].includes("..")) return null;
  return {
    urn: source,
    namespace: match[1],
    work: match[2],
    workUrn: `urn:cts:${match[1]}:${match[2]}`,
    passage: match[3],
  };
}

function issue(code, message, annotationIndex = null) {
  return { code, message, annotationIndex };
}

function annotationTarget(annotation) {
  return clean(annotation?.target);
}

function syntaxHead(annotation) {
  const head = annotation?.syntax?.head;
  return head == null ? null : clean(head);
}

function findSyntaxCycle(annotations, targetIndex) {
  const headByTarget = new Map(
    annotations
      .map((annotation) => [annotationTarget(annotation), syntaxHead(annotation)])
      .filter(([target]) => target),
  );

  for (const target of headByTarget.keys()) {
    const visited = new Set();
    let cursor = target;
    while (cursor && headByTarget.has(cursor)) {
      if (visited.has(cursor)) return targetIndex.get(cursor) ?? null;
      visited.add(cursor);
      cursor = headByTarget.get(cursor);
    }
  }
  return null;
}

export function validateCtsAnnotationBundle(payload) {
  const errors = [];
  const warnings = [];
  const passageUrn = clean(payload?.cts?.passageUrn || payload?.passage?.urn);
  const passage = parseCtsPassageReference(passageUrn);
  const annotations = Array.isArray(payload?.annotations)
    ? payload.annotations
    : Array.isArray(payload?.tokens)
      ? payload.tokens
      : [];

  if (!passage) {
    errors.push(issue("invalid-passage-urn", "CTS 段落 URN 无效或缺少版本与段落"));
  }
  if (!clean(payload?.text)) {
    errors.push(issue("missing-text", "CTS 标注包缺少原文文本"));
  }
  if (!annotations.length) {
    errors.push(issue("missing-annotations", "CTS 标注包不包含词项标注"));
  }

  const ids = new Map();
  const targets = new Map();
  annotations.forEach((annotation, index) => {
    const id = clean(annotation?.id);
    const target = annotationTarget(annotation);

    if (!id) {
      errors.push(issue("missing-id", `第 ${index + 1} 个词项缺少标识符`, index));
    } else if (ids.has(id)) {
      errors.push(issue("duplicate-id", `词项标识符“${id}”重复`, index));
    } else {
      ids.set(id, index);
    }

    if (!target) {
      errors.push(issue("missing-target", `第 ${index + 1} 个词项缺少 CTS 词位`, index));
    } else if (targets.has(target)) {
      errors.push(issue("duplicate-target", `CTS 词位“${target}”重复`, index));
    } else {
      targets.set(target, index);
    }

    if (passage && target && !target.startsWith(`${passage.urn}@`)) {
      errors.push(issue(
        "target-outside-passage",
        `词项“${annotation?.form || index + 1}”的 CTS 词位不属于当前段落`,
        index,
      ));
    }

    if (target) {
      const subreference = target.slice(target.indexOf("@") + 1);
      if (!target.includes("@") || !/^.+\[[1-9]\d*\]$/u.test(subreference)) {
        errors.push(issue(
          "invalid-target-subreference",
          `词项“${annotation?.form || index + 1}”的 CTS 词位缺少合法出现序号`,
          index,
        ));
      }
    }

    if (!clean(annotation?.form)) {
      warnings.push(issue("missing-form", `第 ${index + 1} 个词项缺少表层词形`, index));
    }
    if (annotation?.lgr?.tags != null && !Array.isArray(annotation.lgr.tags)) {
      errors.push(issue("invalid-lgr-tags", `词项“${annotation?.form || index + 1}”的 LGR 标签必须为数组`, index));
    }
  });

  annotations.forEach((annotation, index) => {
    const head = syntaxHead(annotation);
    if (head && !targets.has(head)) {
      errors.push(issue(
        "missing-syntax-head",
        `词项“${annotation?.form || index + 1}”引用了不存在的句法中心词`,
        index,
      ));
    }
    if (head && head === annotationTarget(annotation)) {
      errors.push(issue(
        "self-syntax-head",
        `词项“${annotation?.form || index + 1}”不能以自身为句法中心词`,
        index,
      ));
    }
  });

  if (annotations.length && targets.size) {
    const cycleIndex = findSyntaxCycle(annotations, targets);
    if (cycleIndex != null) {
      errors.push(issue("syntax-cycle", "句法依存关系中存在循环", cycleIndex));
    }
    const roots = annotations.filter((annotation) => (
      annotation?.syntax?.dependency === "root" || syntaxHead(annotation) === null
    ));
    if (roots.length === 0) {
      warnings.push(issue("missing-syntax-root", "句法依存关系没有明确的根词项"));
    } else if (roots.length > 1) {
      warnings.push(issue("multiple-syntax-roots", `句法依存关系包含 ${roots.length} 个根词项`));
    }
  }

  return {
    valid: errors.length === 0,
    passage,
    annotations,
    errors,
    warnings,
  };
}
