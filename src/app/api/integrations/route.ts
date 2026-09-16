import { NextResponse } from "next/server";
import { loadState, saveSettings, usingSupabase } from "@/lib/server/db";
import { botInfo, send, setWebhook, telegramConfigured } from "@/lib/server/telegram";
import { platformMonth, type PlatformMonth } from "@/lib/server/stripe";
import { morningDigest } from "@/lib/server/messages";

export const dynamic = "force-dynamic";

/** Estado das ligações, para a página Definições. */
export async function GET() {
  const s = await loadState().catch(() => null);
  const pm = await platformMonth();
  return NextResponse.json({
    storage: usingSupabase() ? "supabase" : "local",
    password: !!process.env.APP_PASSWORD,
    appUrl: process.env.APP_URL ?? null,
    stripe: !pm.configured ? { configured: false } : "error" in pm ? { configured: true, error: pm.error } : { configured: true, active: (pm as PlatformMonth).active },
    stripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    telegram: telegramConfigured() ? { configured: true, bot: await botInfo(), linked: !!s?.settings.telegramChatId } : { configured: false },
    cron: !!process.env.CRON_SECRET,
  });
}

export async function POST(req: Request) {
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    if (action === "telegram-webhook") {
      const base = process.env.APP_URL;
      if (!base || base.includes("localhost")) return NextResponse.json({ error: "Isto só funciona com a app online (APP_URL público)." }, { status: 400 });
      if (!process.env.TELEGRAM_WEBHOOK_SECRET) return NextResponse.json({ error: "Falta TELEGRAM_WEBHOOK_SECRET." }, { status: 400 });
      const me = await setWebhook(`${base}/api/telegram`);
      return NextResponse.json({ ok: true, username: me.username });
    }
    if (action === "telegram-test") {
      const s = await loadState();
      if (!s.settings.telegramChatId) return NextResponse.json({ error: "Ainda não carregaste em Start no bot." }, { status: 400 });
      const pm = await platformMonth();
      const d = morningDigest(s, "recv" in pm ? (pm as PlatformMonth) : null);
      await send(s.settings.telegramChatId, d.text, d.buttons);
      return NextResponse.json({ ok: true });
    }
    if (action === "telegram-unlink") {
      await saveSettings({ telegramChatId: null });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
