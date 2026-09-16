# Foco — notas

CRM pessoal: Agora, Contactos, Pipeline, Projetos, Calendário, Finanças (Stripe + serviços), Semanas.
Next.js 16 + Supabase (via servidor) + Stripe + Telegram. Deploy no Netlify.

## Correr no PC

```
npm run dev        # http://localhost:3000
npm run build      # confirma que não há erros antes de enviar
```

Sem `SUPABASE_SERVICE_ROLE_KEY`, os dados ficam em `.data/foco.json` (só neste PC).
Sem `APP_PASSWORD`, em desenvolvimento entra direto. Em produção é obrigatória.

## Como está feito

- **Toda a leitura e escrita passa pelo servidor** (`/api/state`) com a service role key.
  O browser nunca fala com o Supabase diretamente → não há problemas de RLS/sessão como no Nexo.
- `src/lib/store.ts`: estado no browser + fila de gravação (tenta outra vez sozinho se falhar;
  o indicador "Tudo guardado / A guardar / Sem ligação" está na barra lateral).
- `src/lib/actions.ts`: tudo o que muda dados. `src/lib/logic.ts`: regras partilhadas com o servidor.
- `src/lib/server/*`: base de dados, Stripe, Telegram, ações dos botões do Telegram, mensagens.
- `/api/cron` (de hora a hora, `netlify/functions/cron.mts`): mensalidades, cobranças de
  pagamentos com 3+ dias de atraso, resumo das 9h, resumo semanal à sexta às 18h.
- Datas sempre no fuso de Lisboa (`src/lib/dates.ts`).

## Pôr a funcionar (uma vez)

### 1. Supabase
1. Supabase → projeto `cxmdteicccfeeowizvcd` → **SQL Editor** → colar `supabase/schema.sql` → **Run**.
2. **Project Settings → API Keys** → copiar a **service_role** (secreta) para
   `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`.

### 2. Password
`APP_PASSWORD=` no `.env.local` (a password com que entras).

### 3. Stripe (chave só de leitura)
Stripe → **Developers → API keys → Create restricted key**. Dá **Read** a:
Balance, Balance transactions, Charges, Customers, Invoices, Subscriptions, Prices, Products.
Tudo o resto **None**. Copiar para `STRIPE_SECRET_KEY`.

### 4. Telegram
No Telegram, falar com **@BotFather** → `/newbot` → escolher nome → copiar o token para
`TELEGRAM_BOT_TOKEN`.

### 5. Online (GitHub + Netlify)
1. Criar repositório **privado** `foco` no GitHub e:
   ```
   git remote add origin https://github.com/pedropereira-lgtm/foco.git
   git push -u origin main
   ```
2. Netlify → **Add new site → Import from Git** → `foco`.
3. **Site configuration → Environment variables**: copiar TODAS as linhas do `.env.local`,
   com `APP_URL` = endereço público (ex: `https://foco.starmountainflash.pt`).
4. **Domain management** → adicionar `foco.starmountainflash.pt`.
5. Daí em diante: duplo clique em `enviar.bat` para publicar alterações.

### 6. Depois de estar online
- **Stripe webhook**: Developers → Webhooks → Add endpoint →
  `https://<APP_URL>/api/stripe/webhook`, eventos: `invoice.paid`, `invoice.payment_failed`,
  `customer.subscription.updated`, `customer.subscription.deleted`.
  Copiar o **Signing secret** para `STRIPE_WEBHOOK_SECRET` (Netlify) e fazer redeploy.
- **Telegram**: no Foco → Definições → **Ligar bot ao Foco** → abrir o bot → **Start** →
  **Enviar resumo de teste**.

## Faturação
Não emite faturas (em Portugal tem de ser software certificado pela AT). As mensalidades só
criam a tarefa "Emitir fatura" no dia certo e registam o valor por receber.
