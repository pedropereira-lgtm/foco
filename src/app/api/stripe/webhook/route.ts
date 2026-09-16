import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, activeCount } from "@/lib/server/stripe";
import { loadState } from "@/lib/server/db";
import { esc, send } from "@/lib/server/telegram";
import { e2 } from "@/lib/dates";

export const dynamic = "force-dynamic";

const nameOf = async (s: Stripe, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null) => {
  if (!customer) return "Subscritor";
  const c = typeof customer === "string" ? await s.customers.retrieve(customer).catch(() => null) : customer;
  if (!c || (c as Stripe.DeletedCustomer).deleted) return "Subscritor";
  const cc = c as Stripe.Customer;
  const n = cc.name || cc.email?.split("@")[0] || "Subscritor";
  const parts = n.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

export async function POST(req: Request) {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return NextResponse.json({ error: "Stripe por configurar." }, { status: 503 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(body, req.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  const state = await loadState().catch(() => null);
  const chat = state?.settings.telegramChatId;
  if (!chat) return NextResponse.json({ ok: true, note: "Telegram por ligar" });

  try {
    switch (event.type) {
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice;
        if (!inv.amount_paid) break;
        const gross = inv.amount_paid / 100;
        const net = gross - (gross * 0.015 + 0.25);
        const first = inv.billing_reason === "subscription_create";
        const n = await activeCount();
        await send(chat, `💳 <b>${first ? "Novo subscritor" : "Pagamento recebido"}</b>\n${esc(await nameOf(s, inv.customer))} · +${e2(net)} líquidos (aprox.)${n != null ? `\nAgora são ${n} subscritores.` : ""}`);
        break;
      }
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        await send(chat, `⚠️ <b>Pagamento falhou</b>\n${esc(await nameOf(s, inv.customer))} · ${e2((inv.amount_due ?? 0) / 100)}\nA Stripe volta a tentar sozinha.`);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const n = await activeCount();
        await send(chat, `👋 <b>Subscrição terminada</b>\n${esc(await nameOf(s, sub.customer))}${n != null ? `\nFicam ${n} subscritores.` : ""}`);
        break;
      }
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const prev = event.data.previous_attributes as Partial<Stripe.Subscription> | undefined;
        if (sub.cancel_at_period_end && prev && prev.cancel_at_period_end === false)
          await send(chat, `📉 <b>Vai cancelar no fim do período</b>\n${esc(await nameOf(s, sub.customer))}`);
        break;
      }
    }
  } catch (e) {
    console.error("[stripe webhook]", (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}
