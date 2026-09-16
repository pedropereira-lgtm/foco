// Corre de hora a hora no Netlify e chama /api/cron (resumos, cobranças, mensalidades).
export default async () => {
  const base = process.env.APP_URL || process.env.URL;
  const r = await fetch(`${base}/api/cron`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  console.log("cron", r.status, await r.text());
};

export const config = { schedule: "@hourly" };
