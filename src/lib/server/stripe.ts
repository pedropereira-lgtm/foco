import "server-only";
import Stripe from "stripe";
import { addDays, iso, lisbonNow, parse } from "@/lib/dates";
import { dayOf, type PlatformRange } from "@/lib/metrics";

let client: Stripe | null = null;
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!client) client = new Stripe(key);
  return client;
}

const euros = (cents: number) => cents / 100;
const toIso = (unix: number) => new Date(unix * 1000).toISOString();
/** Início de um dia de Lisboa em unix (segundos), tolerante ao horário de verão. */
function lisbonStartUnix(date: string) {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  for (const off of [0, 1, 2]) {
    const t = utcMidnight - off * 3600e3;
    if (dayOf(new Date(t).toISOString()) === date && dayOf(new Date(t - 1000).toISOString()) !== date) return Math.floor(t / 1000);
  }
  return Math.floor(utcMidnight / 1000);
}

type Sub = Stripe.Subscription;
const periodEnd = (s: Sub) => {
  const items = s.items?.data ?? [];
  const ends = items.map((i) => (i as unknown as { current_period_end?: number }).current_period_end).filter((x): x is number => !!x);
  return ends.length ? Math.min(...ends) : (s as unknown as { current_period_end?: number }).current_period_end ?? null;
};
/** Valor bruto por mês de uma subscrição (em €). */
const monthlyAmount = (s: Sub) =>
  (s.items?.data ?? []).reduce((a, it) => {
    const p = it.price;
    const unit = euros(p?.unit_amount ?? 0) * (it.quantity ?? 1);
    const r = p?.recurring;
    if (!r) return a + unit;
    const per = r.interval === "year" ? 12 : r.interval === "week" ? 12 / 52 : r.interval === "day" ? 12 / 365 : 1;
    return a + unit / (per * (r.interval_count || 1));
  }, 0);
const periodAmount = (s: Sub) => (s.items?.data ?? []).reduce((a, it) => a + euros(it.price?.unit_amount ?? 0) * (it.quantity ?? 1), 0);
const customerName = (s: Sub) => {
  const c = s.customer;
  if (typeof c === "string") return "Subscritor";
  const cc = c as Stripe.Customer;
  return cc.name || cc.email?.split("@")[0] || "Subscritor";
};
const shortName = (n: string) => {
  const parts = n.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
};

async function allSubscriptions(s: Stripe) {
  const out: Sub[] = [];
  for await (const sub of s.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] })) out.push(sub);
  return out;
}

async function balanceSince(s: Stripe, fromUnix: number) {
  const out: Stripe.BalanceTransaction[] = [];
  for await (const bt of s.balanceTransactions.list({ created: { gte: fromUnix }, limit: 100 })) {
    if (bt.reporting_category === "charge" || bt.reporting_category === "refund") out.push(bt);
  }
  return out;
}

export interface PlatformMonth {
  configured: true;
  month: string;
  days: number;
  today: number;
  recv: number[];
  exp: number[];
  gross: number;
  fees: number;
  count: number;
  todayNet: number;
  todayCount: number;
  mrr: number;
  mrrNet: number;
  netPerSub: number | null;
  active: number;
  newThisMonth: number;
  canceling: { name: string; date: string; amount: number }[];
  failed: { name: string; amount: number; since: string }[];
  upcoming: { date: string; names: string[]; net: number }[];
  updatedAt: string;
}

let cache: { at: number; data: PlatformMonth } | null = null;

export async function platformMonth(force = false): Promise<PlatformMonth | { configured: false } | { configured: true; error: string }> {
  const s = stripe();
  if (!s) return { configured: false };
  if (!force && cache && Date.now() - cache.at < 20_000) return cache.data;
  try {
    const now = lisbonNow();
    const [y, m] = now.date.split("-").map(Number);
    const monthStart = `${y}-${String(m).padStart(2, "0")}-01`;
    const days = new Date(y, m, 0).getDate();
    const day = Number(now.date.slice(8));
    const [subs, bts] = await Promise.all([allSubscriptions(s), balanceSince(s, lisbonStartUnix(monthStart))]);

    const recv = Array(days + 1).fill(0);
    const exp = Array(days + 1).fill(0);
    let gross = 0, fees = 0, count = 0, todayNet = 0, todayCount = 0;
    for (const bt of bts) {
      const d = dayOf(toIso(bt.created));
      if (d.slice(0, 7) !== monthStart.slice(0, 7)) continue;
      const k = Number(d.slice(8));
      recv[k] += euros(bt.net);
      gross += euros(bt.amount);
      fees += euros(bt.fee);
      if (bt.reporting_category === "charge") count++;
      if (k === day) { todayNet += euros(bt.net); if (bt.reporting_category === "charge") todayCount++; }
    }
    const feeRatio = gross > 0 ? fees / gross : 0.04;

    const live = subs.filter((x) => ["active", "trialing", "past_due"].includes(x.status));
    const monthStartUnix = lisbonStartUnix(monthStart);
    const canceling: PlatformMonth["canceling"] = [];
    const failed: PlatformMonth["failed"] = [];
    const up = new Map<string, { names: string[]; net: number }>();
    const in7 = iso(addDays(parse(now.date), 7));
    let mrr = 0;
    for (const sub of live) {
      const name = shortName(customerName(sub));
      const pe = periodEnd(sub);
      const peDay = pe ? dayOf(toIso(pe)) : null;
      const willCancel = sub.cancel_at_period_end || !!sub.cancel_at;
      if (sub.status === "past_due") failed.push({ name, amount: periodAmount(sub), since: peDay ?? now.date });
      if (willCancel) {
        canceling.push({ name, date: sub.cancel_at ? dayOf(toIso(sub.cancel_at)) : peDay ?? now.date, amount: monthlyAmount(sub) * (1 - feeRatio) });
        continue;
      }
      mrr += monthlyAmount(sub);
      if (peDay && peDay > now.date) {
        const net = periodAmount(sub) * (1 - feeRatio);
        if (peDay.slice(0, 7) === monthStart.slice(0, 7)) exp[Number(peDay.slice(8))] += net;
        if (peDay <= in7) {
          const u = up.get(peDay) ?? { names: [], net: 0 };
          u.names.push(name);
          u.net += net;
          up.set(peDay, u);
        }
      }
    }
    const prices = live.map(periodAmount).filter((x) => x > 0);
    const typical = prices.length ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : null;
    const data: PlatformMonth = {
      configured: true,
      month: monthStart.slice(0, 7),
      days,
      today: day,
      recv,
      exp,
      gross,
      fees,
      count,
      todayNet,
      todayCount,
      mrr,
      mrrNet: mrr * (1 - feeRatio),
      netPerSub: typical ? typical * (1 - feeRatio) : null,
      active: live.length,
      newThisMonth: live.filter((x) => x.created >= monthStartUnix).length,
      canceling,
      failed,
      upcoming: [...up.entries()].sort().map(([date, u]) => ({ date, ...u })),
      updatedAt: new Date().toISOString(),
    };
    cache = { at: Date.now(), data };
    return data;
  } catch (e) {
    return { configured: true, error: (e as Error).message };
  }
}

/** Métricas da plataforma por semana (segunda a domingo), para as N semanas pedidas. */
export async function platformWeeks(mondays: string[]): Promise<Record<string, PlatformRange> | null> {
  const s = stripe();
  if (!s || !mondays.length) return null;
  const first = [...mondays].sort()[0];
  const [bts, subs] = await Promise.all([balanceSince(s, lisbonStartUnix(first)), allSubscriptions(s)]);
  const out: Record<string, PlatformRange> = {};
  for (const mon of mondays) {
    const to = iso(addDays(parse(mon), 6));
    const within = (d: string) => d >= mon && d <= to;
    out[mon] = {
      net: bts.filter((b) => within(dayOf(toIso(b.created)))).reduce((a, b) => a + euros(b.net), 0),
      newSubs: subs.filter((x) => within(dayOf(toIso(x.created)))).length,
      canceledSubs: subs.filter((x) => x.canceled_at && within(dayOf(toIso(x.canceled_at)))).length,
    };
  }
  return out;
}

export async function activeCount() {
  const s = stripe();
  if (!s) return null;
  let n = 0;
  for await (const sub of s.subscriptions.list({ status: "active", limit: 100 })) if (sub) n++;
  return n;
}
