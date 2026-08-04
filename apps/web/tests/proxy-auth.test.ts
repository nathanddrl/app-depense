// Garde d'authentification du proxy (apps/web/proxy.ts).
//
// Régression de prod (cron récurrence jamais exécuté) : le cron Vercel appelait
// `/api/cron/recurring` sans session, la garde le redirigeait vers /login (307)
// et le Route Handler n'était jamais atteint. Cette suite verrouille les deux
// côtés du correctif : le cron passe, les routes applicatives restent protégées.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Utilisateur retourné par le client Supabase mocké : `null` = non authentifié.
let currentUser: { id: string } | null = null;
const getUser = vi.fn(async () => ({ data: { user: currentUser } }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

const { proxy } = await import("../proxy");

function request(pathname: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(new URL(pathname, "http://localhost"), { headers });
}

beforeEach(() => {
  currentUser = null;
  getUser.mockClear();
});

describe("proxy — routes cron exclues de la garde de session", () => {
  it("/api/cron/recurring sans session → pas de redirection vers /login", async () => {
    const res = await proxy(request("/api/cron/recurring"));

    expect(res.status).not.toBe(307);
    expect(res.headers.get("location")).toBeNull();
  });

  it("/api/cron/recurring ne déclenche même pas la vérification de session Supabase", async () => {
    await proxy(request("/api/cron/recurring"));

    expect(getUser).not.toHaveBeenCalled();
  });

  it("le header Authorization du cron traverse le proxy intact (secret vérifié par le handler)", async () => {
    const res = await proxy(
      request("/api/cron/recurring", { authorization: "Bearer le-bon-secret" }),
    );

    expect(res.status).toBe(200);
  });
});

describe("proxy — non-régression : les routes applicatives restent protégées", () => {
  it.each(["/", "/admin", "/mouvements", "/reglages"])(
    "%s sans session → 307 vers /login",
    async (pathname) => {
      const res = await proxy(request(pathname));

      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    },
  );

  it("une route qui commence par /api mais n'est pas le cron reste protégée", async () => {
    const res = await proxy(request("/api/cronjob-maison"));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("session valide → pas de redirection", async () => {
    currentUser = { id: "user-1" };

    const res = await proxy(request("/"));

    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
