import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "foco_session";
const MAX_AGE_DAYS = 60;

const secret = () => process.env.AUTH_SECRET || process.env.APP_PASSWORD || "dev-secret";

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function makeSession() {
  const exp = Date.now() + MAX_AGE_DAYS * 864e5;
  const payload = `v1.${exp}`;
  return { value: `${payload}.${sign(payload)}`, maxAge: MAX_AGE_DAYS * 86400 };
}

export function verifySession(token: string | undefined) {
  if (!token) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const good = sign(payload);
  if (sig.length !== good.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return false;
  const exp = Number(payload.split(".")[1]);
  return Number.isFinite(exp) && exp > Date.now();
}

export function checkPassword(pw: string) {
  const real = process.env.APP_PASSWORD;
  if (!real) return process.env.NODE_ENV !== "production"; // sem password definida: só aceita em dev
  const a = Buffer.from(pw);
  const b = Buffer.from(real);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Compara segredos de cabeçalhos (cron, Telegram) sem fugas de tempo. */
export function safeEqual(a: string | null | undefined, b: string | undefined) {
  if (!a || !b) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
