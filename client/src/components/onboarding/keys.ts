/** localStorage keys that record first-run consent. Read by App.tsx to decide which onboarding steps remain. */
export const ONBOARDING_KEYS = {
  termsAcceptedAt: 'coride_terms_accepted_at',
  ageConfirmed: 'coride_age_confirmed',
  onboarded: 'coride_onboarded',
  locationChoice: 'coride_location_choice',
} as const;
