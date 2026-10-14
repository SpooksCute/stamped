// Supabase Edge Function: turns the Stamped Pass on and off when Stripe says so.
// Deploy with:  supabase functions deploy stripe-webhook --no-verify-jwt
// Needs secrets: STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (see SETUP.md).
import Stripe from "npm:stripe@14.25.0";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2024-04-10" });
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const ACTIVE = new Set(["active", "trialing", "past_due"]);

async function setPassByCustomer(customerId: string, isPass: boolean, until: number | null) {
  const { error } = await db.from("profiles")
    .update({ is_pass: isPass, pass_until: until ? new Date(until * 1000).toISOString() : null })
    .eq("stripe_customer_id", customerId);
  if (error) throw error;
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, cryptoProvider);
  } catch (err) {
    return new Response(`Bad signature: ${(err as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const userId = s.client_reference_id;
        const customerId = typeof s.customer === "string" ? s.customer : s.customer?.id;
        if (!userId || !customerId) break;
        let until: number | null = null;
        if (s.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof s.subscription === "string" ? s.subscription : s.subscription.id);
          until = sub.current_period_end;
        }
        const { error } = await db.from("profiles")
          .update({ is_pass: true, stripe_customer_id: customerId, pass_until: until ? new Date(until * 1000).toISOString() : null })
          .eq("id", userId);
        if (error) throw error;
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await setPassByCustomer(sub.customer as string, ACTIVE.has(sub.status), sub.current_period_end);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await setPassByCustomer(sub.customer as string, false, null);
        break;
      }
    }
  } catch (err) {
    console.error(err);
    return new Response("Update failed", { status: 500 });
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
