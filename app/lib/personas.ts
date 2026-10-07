import { EMPTY_PROFILE, type Profile } from './decide';

const base: Profile = {
  ...EMPTY_PROFILE,
  incomeMonthly: 3200, spendMonthly: 2100, emergencyMonths: 4, highInterestDebt: false, savings: 24_000,
  goal: 'long_term', horizonYears: 10, attitude: 'balanced', fallReaction: 'hurt', vulnerability: false,
  knowledgeScore: 5, knowledgeLevel: 1,
};

/** The demo's main character: the two-pager's numbers (£24,000 savings → £1,200 limit). */
export const SARAH: Profile = { ...base, name: 'Sarah', age: 34, country: 'GB', taxCountry: 'GB' };

/** A book of clients for the bank console, one per outcome, across the four packs. */
export const SEED_CLIENTS: { id: string; profile: Profile }[] = [
  { id: 'NB-10231', profile: { ...base, name: 'Sarah Mitchell', age: 34, country: 'GB', taxCountry: 'GB' } },
  { id: 'NB-10232', profile: { ...base, name: 'Wei Ling Tan', age: 41, country: 'SG', taxCountry: 'SG', fallReaction: 'fine', savings: 60_000, emergencyMonths: 8 } },
  { id: 'NB-10233', profile: { ...base, name: 'James O’Connor', age: 29, country: 'IE', taxCountry: 'IE', highInterestDebt: true, savings: 6_000 } },
  { id: 'NB-10234', profile: { ...base, name: 'Margaret Hughes', age: 71, country: 'GB', taxCountry: 'GB', vulnerability: true, savings: 85_000, emergencyMonths: 12 } },
  { id: 'NB-10235', profile: { ...base, name: 'Chen Yu-hsuan', age: 38, country: 'HK', taxCountry: 'SG', savings: 40_000, emergencyMonths: 6 } },
  { id: 'NB-10236', profile: { ...base, name: 'Tom Baker', age: 19, country: 'GB', taxCountry: 'GB', fallReaction: 'need', savings: 1_500, emergencyMonths: 2 } },
  { id: 'NB-10237', profile: { ...base, name: 'Anna Schmidt', age: 45, country: 'DE', taxCountry: 'DE', savings: 32_000, emergencyMonths: 4 } },
  { id: 'NB-10238', profile: { ...base, name: 'Raj Kumar', age: 36, country: 'SG', taxCountry: 'SG', savings: 18_000, emergencyMonths: 5 } },
  { id: 'NB-10239', profile: { ...base, name: 'Lucy Clarke', age: 52, country: 'GB', taxCountry: 'GB', fallReaction: 'fine', attitude: 'adventurous', savings: 120_000, emergencyMonths: 9 } },
];
