import { EMPTY_PROFILE, type Profile } from './decide';

const base: Profile = {
  ...EMPTY_PROFILE,
  incomeMonthly: 3200, spendMonthly: 2100, emergencyMonths: 4, highInterestDebt: false, savings: 24_000,
  goal: 'long_term', horizonYears: 10, attitude: 'balanced', fallReaction: 'hurt', vulnerability: false,
  knowledgeScore: 5, knowledgeLevel: 1,
  // An answer to every country's own question, so Sarah can move anywhere and still be assessed.
  local: { investor_category: 'restricted', shariah_preference: false, us_state: 'CA' },
};

/** The demo's main character: the two-pager's numbers (£24,000 savings → £1,200 limit). */
export const SARAH: Profile = { ...base, name: 'Sarah', age: 34, country: 'GB', taxCountry: 'GB' };

/** A book of clients for the bank console: every outcome, across all seven packs. */
export const SEED_CLIENTS: { id: string; profile: Profile }[] = [
  { id: 'NB-10231', profile: { ...base, name: 'Priya Shah', age: 34, country: 'GB', taxCountry: 'GB' } },
  { id: 'NB-10232', profile: { ...base, name: 'Wei Ling Tan', age: 41, country: 'SG', taxCountry: 'SG', fallReaction: 'fine', savings: 60_000, emergencyMonths: 8 } },
  { id: 'NB-10233', profile: { ...base, name: 'James O’Connor', age: 29, country: 'IE', taxCountry: 'IE', highInterestDebt: true, savings: 6_000 } },
  { id: 'NB-10234', profile: { ...base, name: 'Margaret Hughes', age: 71, country: 'GB', taxCountry: 'GB', vulnerability: true, savings: 85_000, emergencyMonths: 12 } },
  { id: 'NB-10235', profile: { ...base, name: 'Chen Yu-hsuan', age: 38, country: 'HK', taxCountry: 'SG', savings: 40_000, emergencyMonths: 6 } },
  { id: 'NB-10236', profile: { ...base, name: 'Tom Baker', age: 19, country: 'GB', taxCountry: 'GB', fallReaction: 'need', savings: 1_500, emergencyMonths: 2 } },
  { id: 'NB-10237', profile: { ...base, name: 'Anna Schmidt', age: 45, country: 'DE', taxCountry: 'DE', savings: 32_000, emergencyMonths: 4 } },
  { id: 'NB-10238', profile: { ...base, name: 'Raj Kumar', age: 36, country: 'SG', taxCountry: 'SG', savings: 18_000, emergencyMonths: 5 } },
  { id: 'NB-10239', profile: { ...base, name: 'Lucy Clarke', age: 52, country: 'GB', taxCountry: 'GB', fallReaction: 'fine', attitude: 'adventurous', savings: 120_000, emergencyMonths: 9 } },
  { id: 'NB-10240', profile: { ...base, name: 'Jack Nguyen', age: 31, country: 'AU', taxCountry: 'AU', horizonYears: 4, savings: 28_000 } },
  { id: 'NB-10241', profile: { ...base, name: 'Aisyah Rahman', age: 33, country: 'MY', taxCountry: 'MY', savings: 22_000, local: { ...base.local, shariah_preference: true } } },
  { id: 'NB-10242', profile: { ...base, name: 'Daniel Ortiz', age: 40, country: 'US', taxCountry: 'US', savings: 50_000, local: { ...base.local, us_state: 'NY' } } },
  { id: 'NB-10243', profile: { ...base, name: 'Emily Carter', age: 47, country: 'US', taxCountry: 'US', fallReaction: 'fine', savings: 75_000, emergencyMonths: 7 } },
  { id: 'NB-10244', profile: { ...base, name: 'Kenji Sato', age: 39, country: 'JP', taxCountry: 'JP', savings: 30_000 } },
];
