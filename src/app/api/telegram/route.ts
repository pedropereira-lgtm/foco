import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/server/auth";
import { loadState, loadWeeks, saveSettings } from "@/lib/server/db";
import { answer, editButtons, send, sendDocument } from "@/lib/server/telegram";
import { completeTaskServer, lastMondays, markPaidServer, snoozeTaskServer } from "@/lib/server/ops";
import { morningDigest, weeklyMessage } from "@/lib/server/messages";
import { platformMonth, platformWeeks, type PlatformMonth } from "@/lib/server/stripe";
import { CSV_HEADER, computeWeek, csvRow } from "@/lib/metrics";

export const dynamic = "force-dynamic";

type Update = {
  message?: { chat: { id: number }; text?: string };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number } };
};

export async function POST(req: Request) {
  if (!safeEqual(req.headers.get("x-telegram-bot-api-secret-token"), process.env.TELEGRAM_WEBHOOK_SECRET))
    return NextResponse.json({ error: "Sem acesso." }, { status: 401 });
  const u = (await req.json().catch(() => ({}))) as Update;
  const s = await loadState();
  const owner = s.settings.telegramChatId;

  try {
    if (u.message) {
      const chat = u.message.chat.id;
      const text = (u.message.text ?? "").trim();
      if (!owner) {
        if (text.startsWith("/start")) {
          await saveSettings({ telegramChatId: chat });
          await send(chat, "✅ <b>Ligado ao Foco.</b>\nVais receber aqui o resumo da manhã, os pagamentos e os lembretes.\n\nComandos: /hoje e /semana");
        }
        return NextResponse.json({ ok: true });
      }
      if (chat !== owner) {
        await send(chat, "Este bot é privado.");
        return NextResponse.json({ ok: true });
      }
      if (text.startsWith("/hoje") || text.startsWith("/start")) {
        const pm = await platformMonth();
        const d = morningDigest(s, "recv" in pm ? (pm as PlatformMonth) : null);
        await send(chat, d.text, d.buttons);
      } else if (text.startsWith("/semana")) {
        const [cur, prev] = lastMondays(2);
        const pw = await platformWeeks([cur, prev]).catch(() => null);
        const m = computeWeek(s, cur, pw?.[cur] ?? null);
        const p = computeWeek(s, prev, pw?.[prev] ?? null);
        const w = weeklyMessage(m, p);
        await send(chat, w.text, w.buttons);
      } else {
        await send(chat, "Usa /hoje ou /semana. O resto faz-se no Foco.");
      }
      return NextResponse.json({ ok: true });
    }

    const cb = u.callback_query;
    if (cb?.data && cb.message) {
      if (cb.message.chat.id !== owner) return NextResponse.json({ ok: true });
      const [action, id] = cb.data.split(":");
      let res = { ok: true, msg: "" };
      if (action === "done") res = await completeTaskServer(id);
      else if (action === "tmr") res = await snoozeTaskServer(id);
      else if (action === "paid") res = await markPaidServer(id);
      else if (action === "csv") {
        const stored = await loadWeeks();
        const mondays = lastMondays(12);
        const pw = await platformWeeks(mondays).catch(() => null);
        const rows = mondays.map((m) => stored.find((w) => w.id === m)?.data ?? computeWeek(s, m, pw?.[m] ?? null));
        await sendDocument(owner, `foco-semanas-${id}.csv`, [CSV_HEADER.join(";"), ...rows.map(csvRow)].join("\n"), "As últimas 12 semanas. Abre no Excel.");
        res = { ok: true, msg: "Enviado 📈" };
      }
      await answer(cb.id, res.msg || "Feito");
      if (res.ok && action !== "csv") await editButtons(cb.message.chat.id, cb.message.message_id, [[{ text: res.msg, callback_data: "noop:0" }]]);
    }
  } catch (e) {
    console.error("[telegram]", (e as Error).message);
  }
  return NextResponse.json({ ok: true });
}
