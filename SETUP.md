# Stamped setup

The site works the moment it's on GitHub Pages, in **test mode**: profiles are saved on each player's device, and a "Try the Pass" button unlocks paid features so you can check them. Real accounts, leagues, and payments need the two services below. Both have free tiers.

You only do this once. Each step says what to copy and where it goes.

## 1. Supabase: accounts, saved scores, leagues

1. Make a free account at supabase.com and create a new project. Pick any name and a strong database password (save it somewhere).
2. In the project, open **SQL Editor → New query**. Paste all of `supabase/schema.sql` and click **Run**. You should see "Success."
3. Open **Project Settings → API**. Copy the **Project URL** and the **anon public** key.
4. Paste them into `js/config.js`:
   ```js
   SUPABASE_URL: "https://abcd1234.supabase.co",
   SUPABASE_ANON_KEY: "eyJhbGciOi...",
   ```
   Both are safe to publish. The database rules decide what each player can see and change.
5. Open **Authentication → URL Configuration**. Set **Site URL** to your site address, like `https://yourname.github.io/stamped/`. This makes confirmation and password-reset emails link back to your site.

Optional: **Authentication → Providers → Email** has a "Confirm email" switch. With it on, new players confirm their email before signing in.

## 2. Stripe: the Stamped Pass

1. Make an account at stripe.com. Stay in **Test mode** (the switch at the top) until everything works.
2. **Product catalog → Add product**: name it "Stamped Pass" and add two recurring prices: $3.99 monthly and $24.99 yearly.
3. **Payment Links → New**: make one link for each price. Under **After payment**, choose "Don't show confirmation page" and redirect to:
   `https://yourname.github.io/stamped/?checkout=success#/pass`
4. Paste the two links into `js/config.js` as `STRIPE_MONTHLY_LINK` and `STRIPE_YEARLY_LINK`.
5. **Settings → Billing → Customer portal**: turn it on and copy the portal link into `STRIPE_PORTAL_LINK`. Pass holders use it to cancel or switch plans.

## 3. Connect Stripe to Supabase

This is the part that turns a player's Pass on after they pay. It needs the Supabase command-line tool once.

1. Install it: `npm install -g supabase`, then run `supabase login` and `supabase link --project-ref YOUR_PROJECT_REF` inside the repository folder. The project ref is the `abcd1234` part of your Supabase URL.
2. Deploy the function:
   `supabase functions deploy stripe-webhook --no-verify-jwt`
3. In Stripe, open **Developers → Webhooks → Add endpoint**:
   - URL: `https://abcd1234.supabase.co/functions/v1/stripe-webhook`
   - Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Stripe shows a **signing secret** (starts with `whsec_`). In **Developers → API keys**, copy your **secret key** (starts with `sk_test_`). Store both in Supabase, not in the site files:
   ```
   supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_...
   ```
   Never paste the secret key into `config.js` or anywhere in the repository. The repository is public.

Test it: sign up on your site, click **Get the Pass**, and pay with Stripe's test card `4242 4242 4242 4242` (any future date, any CVC). Within a minute the PASS badge appears in the header.

## 4. Launch

1. In `js/config.js`, set `TEST_MODE: false`. This removes the "Try the Pass" button.
2. In Stripe, flip to **Live mode** and repeat steps 2.2–2.5 and 3.3–3.4 with live keys (they start with `sk_live_`). Replace the links in `config.js`.

## Good to know

- **Free-play limits** (Layovers, Sprints, Last Stamp games) are counted on each player's device. Someone determined could reset them by clearing their browser data. That's normal for a first launch.
- **Rarity percentages** are estimates written into `js/data/questions.js`. Once you have real players, the `results` table records every daily answer, and those counts can replace the estimates.
- **Adding questions:** add one line to `js/data/questions.js`. The format is explained at the top of that file. New questions join the daily rotation automatically.
- **Your own domain:** buy one (Namecheap, Cloudflare), then in the GitHub repository go to **Settings → Pages → Custom domain** and follow GitHub's DNS instructions. Update the Supabase Site URL and Stripe redirect links to the new address.
