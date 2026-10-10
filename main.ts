// ============================================================================
// RELÉ REBOCL — o IP fresco da casa (grátis: Deno Deploy, login COM O GITHUB, sem cartão)
// O que faz: recebe os pedidos dos robôs e repassa para a llm7 usando o IP DELE (não o do Actions).
// Como publicar (5 min, o dono):
//   1. https://deno.com/deploy  → "Sign in with GitHub" (usa a conta que você já tem)
//   2. "New Playground" → apaga tudo → cola ESTE arquivo → "Save & Deploy"
//   3. Copia o endereço (https://algo.deno.dev) e manda no chat: "relé: https://algo.deno.dev/v1"
// Pronto: os 67 robôs do GitHub passam a atirar com IP fresco.
// ============================================================================
const ALVO = "https://api.llm7.io";
const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "Content-Type, Authorization",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  try {
    const r = await fetch(ALVO + url.pathname + url.search, {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": req.headers.get("authorization") ?? "Bearer unused",
        "User-Agent": "Mozilla/5.0",
      },
      body: req.method === "POST" ? await req.text() : undefined,
    });
    const corpo = await r.text();
    return new Response(corpo, { status: r.status,
      headers: { "content-type": "application/json", ...CORS } });
  } catch (e) {
    return new Response(JSON.stringify({ erro: String(e).slice(0, 120) }),
      { status: 502, headers: { "content-type": "application/json", ...CORS } });
  }
});
