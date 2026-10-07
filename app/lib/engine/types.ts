// The rule language, DSL v2, ported from quolin-main (docs/dsl-spec.md).
// A pack is a list of comparisons: no arithmetic, no loops, nothing a pack can call.

export type Outcome = 'ALLOW' | 'REFER' | 'BLOCK';

/** Where in the journey a rule speaks. Onboarding decides the person, asset decides
 *  one line of a basket, purchase decides one buy against the personal limit. */
export type Stage = 'onboarding' | 'asset' | 'purchase';

export type Scalar = string | number | boolean | null;
export type Value = Scalar | Scalar[];

export type Term =
  | { const: Value }
  | { field: string }
  | { calc: string }
  | { threshold: string }
  | { lookup: string; key: Term };

export type CompareOp =
  | 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte'
  | 'in' | 'not_in' | 'contains' | 'not_contains';

export type Condition =
  | { op: CompareOp; left: Term; right: Term }
  | { op: 'and' | 'or'; of: Condition[] }
  | { op: 'not'; of: Condition };

export interface AppliesTo {
  asset_class?: string[];
  structural_flags_any?: string[];
  when?: Condition;
}

export interface Rule {
  rule_id: string;
  title: string;
  stage: Stage;
  applies_to?: AppliesTo;
  predicate: Condition;
  on_fail: 'REFER' | 'BLOCK';
  reason_code: string;
  severity: number;
}

/** What the person sees when a rule fails. `consumer` splits a BLOCK into
 *  "not yet" (fixable: pay off debt, build a buffer) and "not for you". */
export interface ReasonCode {
  title: string;
  plain_english: string;
  consumer?: 'not_yet' | 'not_for_you';
}

/** How this regime treats one asset. `approval` is per country: the same token can be
 *  approved in Singapore and waiting for a legal opinion in the UK. */
export interface AssetClassification {
  class: 'core' | 'large' | 'steady' | 'speculative';
  volatility_band: number;
  leverage: boolean;
  required_level: number;
  approval: 'approved' | 'opinion_needed' | 'excluded';
  structural_flags: string[];
}

export type ThresholdValue = number | boolean | string[] | Record<string, number>;

export interface Pack {
  pack_id: string;
  version: number;
  dsl_version: 2;
  jurisdiction_name: string;
  regulator: string;
  effective_from: string;
  content_status: 'REVIEWED' | 'PENDING_REVIEW' | 'ILLUSTRATIVE';
  signed_by: string;
  notes: string;
  thresholds: Record<string, ThresholdValue>;
  assets: Record<string, AssetClassification>;
  rules: Rule[];
  reason_codes: Record<string, ReasonCode>;
}

export interface Finding {
  rule_id: string;
  title: string;
  outcome: Outcome;
  reason_code: string;
  reason: ReasonCode;
  severity: number;
  missing_field?: string;
}

export interface Determination {
  outcome: Outcome;
  pack_id: string;
  pack_version: number;
  stage: Stage;
  findings: Finding[];
  rules_passed: string[];
  rules_not_applicable: string[];
  inputs_read: Record<string, unknown>;
}

/** A frozen snapshot. Rules read only this: no clock, no network, no database. */
export type Snapshot = Record<string, unknown>;
