import test from "node:test";
import assert from "node:assert/strict";
import { atender } from "../main.ts";

const CHAVE = "chave-ficticia-segura-para-testes-sem-segredos";
const CONF = { chave: CHAVE, origemPermitida: "https://chat.exemplo.invalid" };
const URL = "https://rele.exemplo.invalid/v1/chat/completions";
function pedido(url = URL, { chave = CHAVE, origem, metodo = "POST", body = "{}" } = {}) {
  const h = { "x-rebocl-relay-key": chave, "content-type": "application/json" };
  if (origem) h.origin = origem;
  return new Request(url, { method: metodo, headers: h,
    body: metodo === "POST" ? body : undefined });
}
test("sem segredo nao encaminha nenhum pedido", async () => {
  let chamadas = 0;
  const r = await atender(pedido(), { buscar: () => { chamadas++; } });
  assert.equal(r.status, 503); assert.equal(chamadas, 0);
});
test("credencial errada bloqueia antes do provedor", async () => {
  let chamadas = 0;
  const r = await atender(pedido(URL, { chave: "errada" }), { ...CONF,
    buscar: () => { chamadas++; } });
  assert.equal(r.status, 401); assert.equal(chamadas, 0);
});
test("origem diferente nao recebe CORS nem faz chamadas", async () => {
  let chamadas = 0;
  const r = await atender(pedido(URL, { origem: "https://terceiro.invalid" }), {
    ...CONF, buscar: () => { chamadas++; },
  });
  assert.equal(r.status, 403); assert.equal(chamadas, 0);
  assert.equal(r.headers.get("access-control-allow-origin"), null);
});
test("preflight so com origem exata", async () => {
  const r = await atender(new Request(URL, { method: "OPTIONS",
    headers: { origin: CONF.origemPermitida } }), CONF);
  assert.equal(r.status, 204);
  assert.equal(r.headers.get("access-control-allow-origin"), CONF.origemPermitida);
});
test("somente rota e metodo explicitamente autorizados", async () => {
  let chamadas = 0;
  for (const r of [
    pedido("https://rele.exemplo.invalid/admin"),
    pedido(URL + "?token=invalido"),
    pedido(URL, { metodo: "DELETE" }),
  ]) {
    assert.equal((await atender(r, { ...CONF,
      buscar: () => { chamadas++; } })).status, 404);
  }
  assert.equal(chamadas, 0);
});
test("limite de entrada medido pelo corpo", async () => {
  let chamadas = 0;
  const r = await atender(pedido(URL, {
    body: JSON.stringify({ texto: "x".repeat(263000) }),
  }), { ...CONF, buscar: () => { chamadas++; } });
  assert.equal(r.status, 413); assert.equal(chamadas, 0);
});
test("repassa JSON somente ao destino fixo e nao encaminha chave do rele", async () => {
  let chamada;
  const r = await atender(pedido(URL, { origem: CONF.origemPermitida }), { ...CONF,
    buscar: async (url, init) => {
      chamada = { url, ...init };
      return new Response('{"ok":true}', {
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(r.status, 200);
  assert.equal(chamada.url, "https://api.llm7.io/v1/chat/completions");
  assert.equal(chamada.redirect, "error");
  assert.equal(chamada.headers["x-rebocl-relay-key"], undefined);
  assert.deepEqual(await r.json(), { ok: true });
});
test("nao entrega resposta grande", async () => {
  const r = await atender(pedido(), { ...CONF,
    buscar: async () => new Response("x".repeat(2097153)) });
  assert.equal(r.status, 502);
});
test("erro remoto nao revela mensagem privada", async () => {
  const r = await atender(pedido(), { ...CONF,
    buscar: async () => { throw new Error("SENTINELA_PRIVADA"); } });
  assert.equal(r.status, 502);
  assert.doesNotMatch(await r.text(), /SENTINELA_PRIVADA/);
});
