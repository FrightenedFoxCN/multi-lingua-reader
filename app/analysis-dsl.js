import { normalizeLgrTags } from "./lgr.js";
import {
  ANALYSIS_DSL_SCHEMA,
  analysisDslTemplate,
} from "./analysis-dsl-reference.js";

export const ANALYSIS_DSL_VERSION = ANALYSIS_DSL_SCHEMA.version;
export const ANALYSIS_DSL_MAX_RULES = ANALYSIS_DSL_SCHEMA.limits.rules;
export { ANALYSIS_DSL_SCHEMA, analysisDslTemplate };

const conditionFields = new Set(ANALYSIS_DSL_SCHEMA.conditionFields);
const conditionOperators = new Set(ANALYSIS_DSL_SCHEMA.conditionOperators);
const setFields = new Set(ANALYSIS_DSL_SCHEMA.setFields);

function clean(value) {
  return String(value ?? "").trim();
}

function unquote(value) {
  const source = clean(value);
  if (source.startsWith("\"") && source.endsWith("\"")) {
    try {
      return JSON.parse(source);
    } catch {
      return source.slice(1, -1);
    }
  }
  if (source.startsWith("'") && source.endsWith("'")) {
    return source.slice(1, -1).replace(/\\'/gu, "'").replace(/\\\\/gu, "\\");
  }
  return source;
}

function regexLiteral(value) {
  const source = clean(value);
  const match = /^\/((?:\\.|[^/])*)\/([dgimsuvy]*)$/u.exec(source);
  if (!match || match[1].length > ANALYSIS_DSL_SCHEMA.limits.regexLength) return null;
  const hasBackreference = /\\[1-9]/u.test(match[1]);
  const hasNestedRepetition = /(?:\([^)]*[+*][^)]*\)|\[[^\]]+\][+*]|\\[dDsSwW][+*]|\.[+*])(?:[+*]|\{\d+(?:,\d*)?\})/u
    .test(match[1]);
  if (hasBackreference || hasNestedRepetition) return null;
  try {
    new RegExp(match[1], match[2]);
    return {
      source: match[1],
      flags: match[2],
    };
  } catch {
    return null;
  }
}

function diagnostic(line, message, code = "syntax") {
  return { line, message, code };
}

export function parseAnalysisDsl(source) {
  const program = {
    version: ANALYSIS_DSL_VERSION,
    language: "*",
    replacements: [],
    segments: [],
    rules: [],
  };
  const errors = [];
  let currentRule = null;
  const normalizedSource = String(source || "").normalize("NFC");
  if (normalizedSource.length > ANALYSIS_DSL_SCHEMA.limits.sourceLength) {
    return {
      valid: false,
      errors: [diagnostic(
        1,
        `DSL 文本不能超过 ${ANALYSIS_DSL_SCHEMA.limits.sourceLength.toLocaleString()} 个字符`,
        "source-limit",
      )],
      program,
    };
  }
  const lines = normalizedSource.split(/\r?\n/u);

  const closeRule = (line) => {
    if (!currentRule) {
      errors.push(diagnostic(line, "end 前没有开放的 rule", "unexpected-end"));
      return;
    }
    if (!currentRule.conditions.length) {
      errors.push(diagnostic(currentRule.line, `规则 ${currentRule.id} 至少需要一个 when`, "missing-condition"));
    }
    if (!currentRule.actions.length) {
      errors.push(diagnostic(currentRule.line, `规则 ${currentRule.id} 至少需要一个动作`, "missing-action"));
    }
    program.rules.push(currentRule);
    currentRule = null;
  };

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) return;

    if (/^version\s+/iu.test(line)) {
      const version = Number(line.replace(/^version\s+/iu, ""));
      if (version !== ANALYSIS_DSL_VERSION) {
        errors.push(diagnostic(lineNumber, `只支持 DSL version ${ANALYSIS_DSL_VERSION}`, "version"));
      }
      program.version = version;
      return;
    }

    if (/^language\s+/iu.test(line)) {
      if (currentRule) {
        errors.push(diagnostic(lineNumber, "language 必须写在 rule 之外", "scope"));
        return;
      }
      const language = clean(line.replace(/^language\s+/iu, ""));
      if (!language || !/^(?:\*|[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*|custom-[\w-]+)$/u.test(language)) {
        errors.push(diagnostic(lineNumber, "language 需要 BCP 47 代码、custom-* ID 或 *", "language"));
        return;
      }
      program.language = language.toLocaleLowerCase();
      return;
    }

    if (/^segment\s+/iu.test(line)) {
      if (currentRule) {
        errors.push(diagnostic(lineNumber, "segment 必须写在 rule 之外", "scope"));
        return;
      }
      const match = /^segment\s+(.+?)\s*->\s*(.+)$/iu.exec(line);
      const pattern = regexLiteral(match?.[1]);
      if (program.segments.length >= ANALYSIS_DSL_SCHEMA.limits.segments) {
        errors.push(diagnostic(
          lineNumber,
          `segment 数量不能超过 ${ANALYSIS_DSL_SCHEMA.limits.segments}`,
          "segment-limit",
        ));
        return;
      }
      if (!match || !pattern) {
        errors.push(diagnostic(
          lineNumber,
          "segment 需要安全且有效的 /pattern/flags；不支持反向引用或嵌套重复",
          "segment",
        ));
        return;
      }
      program.segments.push({
        line: lineNumber,
        pattern,
        replacement: unquote(match[2]),
      });
      return;
    }

    if (/^replace\s+/iu.test(line)) {
      if (currentRule) {
        errors.push(diagnostic(lineNumber, "replace 必须写在 rule 之外", "scope"));
        return;
      }
      const match = /^replace\s+(?:(all|text|form|lemma)\s+)?(.+?)\s*->\s*(.+)$/iu.exec(line);
      const pattern = regexLiteral(match?.[2]);
      if (program.replacements.length >= ANALYSIS_DSL_SCHEMA.limits.replacements) {
        errors.push(diagnostic(
          lineNumber,
          `replace 数量不能超过 ${ANALYSIS_DSL_SCHEMA.limits.replacements}`,
          "replacement-limit",
        ));
        return;
      }
      if (!match || !pattern) {
        errors.push(diagnostic(
          lineNumber,
          "replace 格式为 replace [all|text|form|lemma] /pattern/flags -> \"replacement\"",
          "replacement",
        ));
        return;
      }
      program.replacements.push({
        line: lineNumber,
        field: match[1]?.toLocaleLowerCase() || "all",
        pattern,
        replacement: unquote(match[3]),
      });
      return;
    }

    if (/^rule\s+/iu.test(line)) {
      if (currentRule) closeRule(lineNumber);
      if (program.rules.length >= ANALYSIS_DSL_MAX_RULES) {
        errors.push(diagnostic(lineNumber, `规则数量不能超过 ${ANALYSIS_DSL_MAX_RULES}`, "limit"));
        return;
      }
      const match = /^rule\s+([a-zA-Z][\w.-]*)(?:\s+priority\s+(-?\d+))?$/iu.exec(line);
      if (!match) {
        errors.push(diagnostic(lineNumber, "rule 格式为 rule id [priority number]", "rule"));
        return;
      }
      currentRule = {
        id: match[1],
        priority: Number(match[2] || 0),
        line: lineNumber,
        conditions: [],
        actions: [],
        stop: false,
      };
      return;
    }

    if (/^end$/iu.test(line)) {
      closeRule(lineNumber);
      return;
    }

    if (!currentRule) {
      errors.push(diagnostic(lineNumber, "该指令必须写在 rule … end 内", "scope"));
      return;
    }

    if (/^when\s+/iu.test(line)) {
      const match = /^when\s+(\w+)\s+(=|is|starts|ends|contains|matches|has)\s+(.+)$/iu.exec(line);
      const field = match?.[1]?.toLocaleLowerCase();
      const operator = match?.[2]?.toLocaleLowerCase();
      if (!match || !conditionFields.has(field) || !conditionOperators.has(operator)) {
        errors.push(diagnostic(lineNumber, "无法识别 when 条件", "condition"));
        return;
      }
      if (currentRule.conditions.length >= ANALYSIS_DSL_SCHEMA.limits.conditionsPerRule) {
        errors.push(diagnostic(
          lineNumber,
          `每条规则最多 ${ANALYSIS_DSL_SCHEMA.limits.conditionsPerRule} 个 when`,
          "condition-limit",
        ));
        return;
      }
      const pattern = operator === "matches" ? regexLiteral(match[3]) : null;
      if (operator === "matches" && !pattern) {
        errors.push(diagnostic(lineNumber, "matches 后需要 /pattern/flags", "regex"));
        return;
      }
      currentRule.conditions.push({
        line: lineNumber,
        field,
        operator,
        value: pattern || unquote(match[3]),
      });
      return;
    }

    if (/^set\s+/iu.test(line)) {
      const match = /^set\s+(\w+)\s+(.+)$/iu.exec(line);
      const field = match?.[1]?.toLocaleLowerCase();
      if (!match || !setFields.has(field)) {
        errors.push(diagnostic(lineNumber, `set 仅支持 ${[...setFields].join("、")}`, "set"));
        return;
      }
      if (currentRule.actions.length >= ANALYSIS_DSL_SCHEMA.limits.actionsPerRule) {
        errors.push(diagnostic(
          lineNumber,
          `每条规则最多 ${ANALYSIS_DSL_SCHEMA.limits.actionsPerRule} 个动作`,
          "action-limit",
        ));
        return;
      }
      currentRule.actions.push({
        type: "set",
        field,
        value: unquote(match[2]),
        line: lineNumber,
      });
      return;
    }

    if (/^(?:add|remove)\s+tags?\s+/iu.test(line)) {
      const match = /^(add|remove)\s+tags?\s+(.+)$/iu.exec(line);
      const tags = clean(match?.[2]).split(/[\s,.|]+/u).filter(Boolean);
      if (!match || !tags.length) {
        errors.push(diagnostic(lineNumber, "add/remove tags 后需要至少一个 Leipzig 标签", "tags"));
        return;
      }
      if (currentRule.actions.length >= ANALYSIS_DSL_SCHEMA.limits.actionsPerRule) {
        errors.push(diagnostic(
          lineNumber,
          `每条规则最多 ${ANALYSIS_DSL_SCHEMA.limits.actionsPerRule} 个动作`,
          "action-limit",
        ));
        return;
      }
      currentRule.actions.push({
        type: match[1].toLocaleLowerCase(),
        field: "tags",
        value: tags,
        line: lineNumber,
      });
      return;
    }

    if (/^head\s+/iu.test(line)) {
      const match = /^head\s+(root|previous|next|form|lemma)(?:\s+(.+))?$/iu.exec(line);
      const mode = match?.[1]?.toLocaleLowerCase();
      if (!match || (["form", "lemma"].includes(mode) && !clean(match[2]))) {
        errors.push(diagnostic(lineNumber, "head 支持 root、previous、next、form \"…\"、lemma \"…\"", "head"));
        return;
      }
      if (currentRule.actions.length >= ANALYSIS_DSL_SCHEMA.limits.actionsPerRule) {
        errors.push(diagnostic(
          lineNumber,
          `每条规则最多 ${ANALYSIS_DSL_SCHEMA.limits.actionsPerRule} 个动作`,
          "action-limit",
        ));
        return;
      }
      currentRule.actions.push({
        type: "head",
        mode,
        value: unquote(match[2] || ""),
        line: lineNumber,
      });
      return;
    }

    if (/^confidence\s+/iu.test(line)) {
      const value = Number(line.replace(/^confidence\s+/iu, ""));
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        errors.push(diagnostic(lineNumber, "confidence 必须在 0–100 之间", "confidence"));
        return;
      }
      if (currentRule.actions.length >= ANALYSIS_DSL_SCHEMA.limits.actionsPerRule) {
        errors.push(diagnostic(
          lineNumber,
          `每条规则最多 ${ANALYSIS_DSL_SCHEMA.limits.actionsPerRule} 个动作`,
          "action-limit",
        ));
        return;
      }
      currentRule.actions.push({ type: "confidence", value, line: lineNumber });
      return;
    }

    if (/^stop$/iu.test(line)) {
      currentRule.stop = true;
      return;
    }

    errors.push(diagnostic(lineNumber, "无法识别该 DSL 指令", "unknown"));
  });

  if (currentRule) closeRule(lines.length || 1);
  const duplicateIds = program.rules
    .map((rule) => rule.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  duplicateIds.forEach((id) => errors.push(diagnostic(
    program.rules.find((rule) => rule.id === id)?.line || 1,
    `规则 ID 重复：${id}`,
    "duplicate-rule",
  )));

  return {
    valid: errors.length === 0,
    errors,
    program,
  };
}

function programFor(input) {
  return typeof input === "string" ? parseAnalysisDsl(input) : {
    valid: true,
    errors: [],
    program: input,
  };
}

function languageMatches(program, context) {
  const language = clean(program?.language).toLocaleLowerCase();
  const contextCodes = [
    context.languageCode,
    context.languageId,
  ].map((value) => clean(value).toLocaleLowerCase()).filter(Boolean);
  return language === "*" || contextCodes.includes(language);
}

export function applyReplacementDsl(value, input, context = {}, field = "text") {
  const parsed = programFor(input);
  if (!parsed.valid || !parsed.program) {
    return { value: String(value || ""), applied: 0, errors: parsed.errors };
  }
  if (!languageMatches(parsed.program, context)) {
    return { value: String(value || ""), applied: 0, errors: [] };
  }
  const normalizedField = clean(field).toLocaleLowerCase() || "text";
  let result = String(value || "");
  let applied = 0;
  (parsed.program.replacements || []).forEach((replacement) => {
    if (replacement.field !== "all" && replacement.field !== normalizedField) return;
    const pattern = new RegExp(replacement.pattern.source, replacement.pattern.flags);
    const next = result.replace(pattern, replacement.replacement);
    if (next !== result) applied += 1;
    result = next;
  });
  return { value: result.normalize("NFC"), applied, errors: [] };
}

export function applySegmentationDsl(text, input, context = {}) {
  const parsed = programFor(input);
  if (!parsed.valid || !parsed.program) {
    return { text: String(text || ""), applied: 0, errors: parsed.errors };
  }
  if (!languageMatches(parsed.program, context)) {
    return { text: String(text || ""), applied: 0, errors: [] };
  }
  const normalized = applyReplacementDsl(text, parsed.program, context, "text");
  let result = normalized.value;
  let applied = normalized.applied;
  (parsed.program.segments || []).forEach((segment) => {
    const pattern = new RegExp(segment.pattern.source, segment.pattern.flags);
    const next = result.replace(pattern, segment.replacement);
    if (next !== result) applied += 1;
    result = next;
  });
  return { text: result, applied, errors: [] };
}

function conditionValue(token, field, index) {
  if (field === "tag") return token.lgrTags || [];
  if (field === "index") return index + 1;
  return token[field] ?? "";
}

function conditionMatches(token, condition, index) {
  const actual = conditionValue(token, condition.field, index);
  if (condition.operator === "has") {
    return Array.isArray(actual) && actual.some((value) => (
      String(value).toLocaleUpperCase() === String(condition.value).toLocaleUpperCase()
    ));
  }
  if (condition.operator === "matches") {
    const pattern = new RegExp(condition.value.source, condition.value.flags.replaceAll("g", ""));
    return pattern.test(String(actual));
  }
  if (condition.field === "index") {
    return Number(actual) === Number(condition.value);
  }
  const left = String(actual).normalize("NFC");
  const right = String(condition.value).normalize("NFC");
  if (condition.operator === "starts") return left.startsWith(right);
  if (condition.operator === "ends") return left.endsWith(right);
  if (condition.operator === "contains") return left.includes(right);
  return left === right;
}

function headFor(tokens, token, index, action) {
  if (action.mode === "root") return null;
  if (action.mode === "previous") return tokens[index - 1]?.id ?? token.headId;
  if (action.mode === "next") return tokens[index + 1]?.id ?? token.headId;
  return tokens.find((candidate) => (
    candidate.id !== token.id
    && String(candidate[action.mode] || "").normalize("NFC") === String(action.value).normalize("NFC")
  ))?.id ?? token.headId;
}

export function applyAnalysisDsl(tokens, input, context = {}) {
  const parsed = programFor(input);
  const original = Array.isArray(tokens) ? tokens : [];
  if (!parsed.valid || !parsed.program) {
    return { tokens: original, diagnostics: [], changes: 0, errors: parsed.errors };
  }
  if (!languageMatches(parsed.program, context)) {
    return { tokens: original, diagnostics: [], changes: 0, errors: [] };
  }

  let changes = 0;
  const diagnostics = parsed.program.rules.map((rule) => ({
    id: rule.id,
    matched: 0,
    changed: 0,
  }));
  const orderedRules = parsed.program.rules
    .map((rule, sourceOrder) => ({ ...rule, sourceOrder }))
    .sort((left, right) => right.priority - left.priority || left.sourceOrder - right.sourceOrder);
  const nextTokens = original.map((sourceToken, index) => {
    let token = { ...sourceToken };
    let tokenChanged = false;
    for (const rule of orderedRules) {
      if (!rule.conditions.every((condition) => conditionMatches(token, condition, index))) continue;
      const report = diagnostics.find((item) => item.id === rule.id);
      report.matched += 1;
      let changed = false;
      rule.actions.forEach((action) => {
        if (action.type === "set" && token[action.field] !== action.value) {
          token[action.field] = action.value;
          changed = true;
        } else if (action.type === "add" && action.field === "tags") {
          const normalized = normalizeLgrTags([...(token.lgrTags || []), ...action.value]);
          if (normalized.tags.join("|") !== (token.lgrTags || []).join("|")) changed = true;
          token.lgrTags = normalized.tags;
          token.lgrIssues = normalized.unregistered;
        } else if (action.type === "remove" && action.field === "tags") {
          const remove = new Set(action.value.map((tag) => tag.toLocaleUpperCase()));
          const normalized = normalizeLgrTags(
            (token.lgrTags || []).filter((tag) => !remove.has(String(tag).toLocaleUpperCase())),
          );
          if (normalized.tags.join("|") !== (token.lgrTags || []).join("|")) changed = true;
          token.lgrTags = normalized.tags;
          token.lgrIssues = normalized.unregistered;
        } else if (action.type === "head") {
          const headId = headFor(original, token, index, action);
          if (token.headId !== headId) {
            token.headId = headId;
            changed = true;
          }
          if (headId === null && token.dependency !== "root") {
            token.dependency = "root";
            changed = true;
          }
        } else if (action.type === "confidence" && token.confidence !== action.value) {
          token.confidence = action.value;
          changed = true;
        }
      });
      if (changed) {
        tokenChanged = true;
        report.changed += 1;
        const source = `DSL · ${rule.id}`;
        token.source = token.source?.includes(source)
          ? token.source
          : `${token.source || "本地分析"} · ${source}`;
      }
      if (rule.stop) break;
    }
    if (tokenChanged) changes += 1;
    return token;
  });

  return { tokens: nextTokens, diagnostics, changes, errors: [] };
}
