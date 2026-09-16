import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/server/auth";

// Rotas que não precisam de sessão: login e as que serviços externos chamam
// (cada uma verifica o seu próprio segredo).
const PUBLIC = ["/login", "/api/login", "/api/telegram", "/api/stripe/webhook", "/api/cron"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  if (verifySession(req.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  // desenvolvimento sem password definida: entra direto (em produção nunca acontece)
  if (process.env.NODE_ENV !== "production" && !process.env.APP_PASSWORD) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Sessão terminada. Entra outra vez." }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
