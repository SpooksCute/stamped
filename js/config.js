// Stamped site settings. SETUP.md explains where each value comes from.
window.STAMPED_CONFIG = {
  // Supabase (accounts, saved scores, leagues). Leave blank to run in test mode.
  // Both values are safe to publish: the anon key only allows what the database rules allow.
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",

  // Stripe Payment Links for the Stamped Pass. Leave blank until Stripe is set up.
  STRIPE_MONTHLY_LINK: "",
  STRIPE_YEARLY_LINK: "",
  // Stripe customer portal link, where Pass holders cancel or change plans.
  STRIPE_PORTAL_LINK: "",

  PRICE_MONTHLY: "$3.99",
  PRICE_YEARLY: "$24.99",

  // Test mode adds a "Try the Pass" switch so you can check paid features before payments are live.
  // Set this to false when you launch.
  TEST_MODE: true,

  // Free players get this many plays of each extra mode per day.
  FREE_LAYOVERS_PER_DAY: 2,
  FREE_PLAYS_PER_MODE_PER_DAY: 1,

  // Day 1 of the daily trip numbering.
  LAUNCH_DATE: "2026-10-14"
};
