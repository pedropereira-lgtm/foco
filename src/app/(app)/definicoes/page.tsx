"use client";
import { useEffect, useState } from "react";
import { foco, useFoco } from "@/lib/store";
import { Hero } from "@/components/ui";

type Info = {
  storage: "supabase" | "local";
  password: boolean;
  appUrl: string | null;
  stripe: { configured: boolean; error?: string; active?: number };
  stripeWebhook: boolean;
  telegram: { configured: boolean; linked?: boolean; bot?: { username?: string; webhook?: string; lastError?: string | null; error?: string } | null };
  cron: boolean;
};

const Dot = ({ ok }: { ok: boolean }) => <span className={`status-dot ${ok ? "ok" : "bad"}`} />;

export default function Definicoes() {
  const f = useFoco();
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => fetch("/api/integrations", { cache: "no-store" }).then((r) => r.json()).then(setInfo).catch(() => null);
  useEffect(() => { load(); }, []);

  const act = async (action: string, ok: string) => {
    setBusy(action);
    const r = await fetch("/api/integrations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    foco.toast(r.ok ? ok : j.error || "Não correu bem.");
    load();
  };

  const tg = info?.telegram;
  const bot = tg?.bot?.username;

  return (
    <>
      <Hero title="Definições" sub="O estado das ligações do Foco. As chaves ficam no ficheiro .env.local (no teu PC) e nas variáveis do Netlify, nunca aqui." />
      {!info ? <div className="loading">A verificar…</div> : (
        <div className="settings-grid">
          <section className="glass panel">
            <div className="panel-h"><h3>Dados</h3></div>
            <p><Dot ok={info.storage === "supabase"} />{info.storage === "supabase" ? "Guardados no Supabase." : "Modo local: os dados estão só no ficheiro .data/foco.json deste PC. Falta a SUPABASE_SERVICE_ROLE_KEY."}</p>
            <p><Dot ok={info.password} />{info.password ? "Protegido com password." : "Sem APP_PASSWORD: qualquer password entra (só em desenvolvimento)."}</p>
            <p className="muted small">{f.s.contacts.length} contactos · {f.s.tasks.filter((t) => !t.done).length} tarefas por fazer · {f.s.projects.length} projetos</p>
          </section>

          <section className="glass panel">
            <div className="panel-h"><h3>Stripe</h3></div>
            {!info.stripe.configured ? <p><Dot ok={false} />Falta a STRIPE_SECRET_KEY (chave restrita, só leitura).</p>
              : info.stripe.error ? <p><Dot ok={false} />Erro: {info.stripe.error}</p>
              : <p><Dot ok />Ligada · {info.stripe.active} subscritores ativos.</p>}
            <p><Dot ok={info.stripeWebhook} />{info.stripeWebhook ? "Webhook configurado: avisos na hora." : "Webhook por configurar (avisos de pagamento na hora)."}</p>
            <p className="hint">Webhook: <span className="code">{info.appUrl ?? "https://…"}/api/stripe/webhook</span></p>
          </section>

          <section className="glass panel">
            <div className="panel-h"><h3>Telegram</h3></div>
            {!tg?.configured ? <p><Dot ok={false} />Falta o TELEGRAM_BOT_TOKEN (cria o bot no @BotFather).</p> : tg.bot?.error ? <p><Dot ok={false} />{tg.bot.error}</p> : (
              <>
                <p><Dot ok={!!tg.bot?.webhook} />{tg.bot?.webhook ? `Bot @${bot} ligado ao Foco.` : `Bot @${bot} encontrado. Falta ligá-lo ao Foco.`}</p>
                {tg.bot?.lastError && <p className="err">Último erro do Telegram: {tg.bot.lastError}</p>}
                <p><Dot ok={!!tg.linked} />{tg.linked ? "A tua conversa está ligada." : <>Abre <a href={`https://t.me/${bot}`} target="_blank" rel="noopener">t.me/{bot}</a> e carrega em <b>Start</b>.</>}</p>
                <div className="actions">
                  <button className="btn sm" disabled={busy === "telegram-webhook"} onClick={() => act("telegram-webhook", "Bot ligado ao Foco.")}>{tg.bot?.webhook ? "Voltar a ligar" : "Ligar bot ao Foco"}</button>
                  {tg.linked && <button className="btn sm primary" disabled={busy === "telegram-test"} onClick={() => act("telegram-test", "Mensagem enviada. Vê o Telegram.")}>Enviar resumo de teste</button>}
                  {tg.linked && <button className="btn sm ghost danger" onClick={() => act("telegram-unlink", "Conversa desligada.")}>Desligar conversa</button>}
                </div>
              </>
            )}
          </section>

          <section className="glass panel">
            <div className="panel-h"><h3>Automático</h3></div>
            <p><Dot ok={info.cron} />{info.cron ? "Tarefas automáticas ativas (de hora a hora)." : "Falta o CRON_SECRET."}</p>
            <ul className="muted small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
              <li>9h: resumo do dia no Telegram e faturas do dia</li>
              <li>Pagamento 3 dias atrasado: tarefa para cobrar</li>
              <li>Sexta 18h: resumo da semana</li>
              <li>Mensalidades: a tarefa do mês seguinte fica sempre criada</li>
            </ul>
          </section>
        </div>
      )}
    </>
  );
}
