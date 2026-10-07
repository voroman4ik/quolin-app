import type {
  Condition, Determination, Finding, Outcome, Pack, Rule, Snapshot, Stage, Term, Value,
} from './types';
import { CALCS } from './calcs';

export class PackError extends Error {}

/** A rule read a field the snapshot does not hold. Never a pass, never a crash: REFER. */
class MissingField extends Error {
  constructor(public field: string) { super(`missing field ${field}`); }
}

const RANK: Record<Outcome, number> = { ALLOW: 0, REFER: 1, BLOCK: 2 };

export const DATA_MISSING = {
  title: 'Something we need is missing',
  plain_english: 'A fact this rule depends on has not been recorded, so a person needs to check it before going on.',
};

function readPath(snapshot: Snapshot, path: string): unknown {
  let cur: unknown = snapshot;
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || !(part in (cur as object))) {
      throw new MissingField(path);
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

interface Ctx {
  pack: Pack;
  snapshot: Snapshot;
  read: Record<string, unknown>;
}

function resolve(term: Term, ctx: Ctx): Value {
  if ('const' in term) return term.const;
  if ('field' in term) {
    const v = readPath(ctx.snapshot, term.field) as Value;
    ctx.read[term.field] = v;
    return v;
  }
  if ('calc' in term) {
    const fn = CALCS[term.calc];
    if (!fn) throw new PackError(`unknown calc ${term.calc}`);
    const v = fn((p) => {
      const val = readPath(ctx.snapshot, p);
      ctx.read[p] = val;
      return val;
    }, ctx.pack.thresholds);
    ctx.read[`calc.${term.calc}`] = v;
    return v;
  }
  if ('threshold' in term) {
    const v = ctx.pack.thresholds[term.threshold];
    if (v === undefined) throw new PackError(`unknown threshold ${term.threshold}`);
    return v as Value;
  }
  const table = ctx.pack.thresholds[term.lookup];
  if (!table || typeof table !== 'object' || Array.isArray(table)) {
    throw new PackError(`lookup ${term.lookup} is not a table`);
  }
  const key = String(resolve(term.key, ctx));
  const row = (table as Record<string, number>)[key];
  if (row === undefined) throw new PackError(`lookup ${term.lookup} has no row ${key}`);
  return row;
}

function compare(op: string, l: Value, r: Value): boolean {
  switch (op) {
    case 'eq': return l === r;
    case 'neq': return l !== r;
    // A comparison against null fails on its own terms (dsl-spec §5).
    case 'lt': return l !== null && r !== null && (l as number) < (r as number);
    case 'lte': return l !== null && r !== null && (l as number) <= (r as number);
    case 'gt': return l !== null && r !== null && (l as number) > (r as number);
    case 'gte': return l !== null && r !== null && (l as number) >= (r as number);
    case 'in':
    case 'not_in': {
      if (!Array.isArray(r)) throw new PackError(`${op} needs a list on the right`);
      const hit = r.includes(l as never);
      return op === 'in' ? hit : !hit;
    }
    case 'contains':
    case 'not_contains': {
      if (!Array.isArray(l)) throw new PackError(`${op} needs a list on the left`);
      const hit = l.includes(r as never);
      return op === 'contains' ? hit : !hit;
    }
  }
  throw new PackError(`unknown operator ${op}`);
}

/** Every branch of and/or is evaluated, so the evidence shows everything the rule read. */
function holds(cond: Condition, ctx: Ctx): boolean {
  if (cond.op === 'and' || cond.op === 'or') {
    const results: boolean[] = [];
    let missing: MissingField | null = null;
    for (const c of cond.of) {
      try { results.push(holds(c, ctx)); } catch (e) {
        if (e instanceof MissingField) { missing ??= e; results.push(false); } else throw e;
      }
    }
    const ok = cond.op === 'and' ? results.every(Boolean) : results.some(Boolean);
    // An `or` that passed on a known branch is a pass; anything else that touched a hole is a hole.
    if (missing && !(cond.op === 'or' && ok)) throw missing;
    return ok;
  }
  if (cond.op === 'not') return !holds(cond.of, ctx);
  const cmp = cond as Extract<Condition, { left: Term }>;
  return compare(cmp.op, resolve(cmp.left, ctx), resolve(cmp.right, ctx));
}

function applies(rule: Rule, ctx: Ctx): boolean {
  const a = rule.applies_to;
  if (!a) return true;
  if (a.asset_class) {
    const cls = readPath(ctx.snapshot, 'asset.class') as string;
    ctx.read['asset.class'] = cls;
    if (!a.asset_class.includes(cls)) return false;
  }
  if (a.structural_flags_any) {
    const flags = readPath(ctx.snapshot, 'asset.structural_flags') as string[];
    if (!a.structural_flags_any.some((f) => flags.includes(f))) return false;
  }
  if (a.when) return holds(a.when, ctx);
  return true;
}

/** Evaluate every rule of one stage. The determination is the worst single outcome:
 *  no scoring, no netting, rule order does not matter. */
export function evaluate(pack: Pack, stage: Stage, snapshot: Snapshot): Determination {
  const ctx: Ctx = { pack, snapshot, read: {} };
  const findings: Finding[] = [];
  const passed: string[] = [];
  const notApplicable: string[] = [];

  for (const rule of pack.rules.filter((r) => r.stage === stage)) {
    try {
      if (!applies(rule, ctx)) { notApplicable.push(rule.rule_id); continue; }
      if (holds(rule.predicate, ctx)) { passed.push(rule.rule_id); continue; }
      const reason = pack.reason_codes[rule.reason_code];
      if (!reason) throw new PackError(`rule ${rule.rule_id} names unknown reason ${rule.reason_code}`);
      findings.push({
        rule_id: rule.rule_id, title: rule.title, outcome: rule.on_fail,
        reason_code: rule.reason_code, reason, severity: rule.severity,
      });
    } catch (e) {
      if (!(e instanceof MissingField)) throw e;
      findings.push({
        rule_id: rule.rule_id, title: rule.title, outcome: 'REFER',
        reason_code: 'DATA_MISSING', reason: DATA_MISSING, severity: rule.severity,
        missing_field: e.field,
      });
    }
  }

  findings.sort((a, b) => RANK[b.outcome] - RANK[a.outcome] || a.severity - b.severity);
  const outcome = findings.reduce<Outcome>(
    (worst, f) => (RANK[f.outcome] > RANK[worst] ? f.outcome : worst), 'ALLOW');

  return {
    outcome, pack_id: pack.pack_id, pack_version: pack.version, stage,
    findings, rules_passed: passed, rules_not_applicable: notApplicable, inputs_read: ctx.read,
  };
}

/** Refuse a pack that could not mean what it says (dsl-spec §1–§8, the subset this demo needs). */
export function validatePack(pack: Pack): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  const walkNumbers = (v: unknown, where: string) => {
    if (typeof v === 'number' && !Number.isInteger(v)) errors.push(`${where}: decimal ${v}`);
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walkNumbers(x, `${where}.${k}`);
  };
  walkNumbers(pack.thresholds, 'thresholds');
  for (const r of pack.rules) {
    if (ids.has(r.rule_id)) errors.push(`duplicate rule ${r.rule_id}`);
    ids.add(r.rule_id);
    if ((r.on_fail as string) === 'ALLOW') errors.push(`${r.rule_id}: on_fail cannot be ALLOW`);
    if (r.reason_code === 'DATA_MISSING') errors.push(`${r.rule_id}: DATA_MISSING is reserved`);
    if (!pack.reason_codes[r.reason_code]) errors.push(`${r.rule_id}: unknown reason ${r.reason_code}`);
    const terms = JSON.stringify(r).matchAll(/"(threshold|lookup)":"([^"]+)"/g);
    for (const [, , name] of terms) {
      if (!(name in pack.thresholds)) errors.push(`${r.rule_id}: unknown threshold ${name}`);
    }
    for (const [, name] of JSON.stringify(r).matchAll(/"calc":"([^"]+)"/g)) {
      if (!CALCS[name]) errors.push(`${r.rule_id}: unknown calc ${name}`);
    }
  }
  return errors;
}
