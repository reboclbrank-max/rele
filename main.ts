// Relé opcional Rebocl. Configuração manual necessária; sem credenciais em código.
const ALVO = "https://api.llm7.io";
const LIMITE_PEDIDO = 256 * 1024;
const LIMITE_RESPOSTA = 2 * 1024 * 1024;

function rejeitar(status, erro, cors = {}) {
  return new Response(JSON.stringify({ erro }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...cors },
  });
}
function mesmoSegredo(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}
async function lerLimitado(body, limite) {
  if (!body) return new Uint8Array();
  const leitor = body.getReader();
  const partes = [];
  let tamanho = 0;
  try {
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > limite) {
        try { await leitor.cancel(); } catch {}
        throw new RangeError("limite");
      }
      partes.push(value);
    }
  } finally { leitor.releaseLock(); }
  const total = new Uint8Array(tamanho);
  let pos = 0;
  for (const parte of partes) { total.set(parte, pos); pos += parte.byteLength; }
  return total;
}

export async function atender(req, opcoes = {}) {
  // Um segredo permanente não pode ser guardado em JavaScript do navegador.
  // Este relé é somente para processos confiáveis do servidor.
  const cors = {};
  if (req.headers.has("origin")) return rejeitar(403, "cliente_navegador_recusado");
  if (req.method === "OPTIONS") return rejeitar(403, "preflight_recusado");
  const chave = String(opcoes.chave || "");
  if (chave.length < 24) return rejeitar(503, "rele_nao_configurado", cors);
  if (!mesmoSegredo(req.headers.get("x-rebocl-relay-key") || "", chave)) {
    return rejeitar(401, "nao_autorizado", cors);
  }
  const url = new URL(req.url);
  const modelos = req.method === "GET" && url.pathname === "/v1/models";
  const chat = req.method === "POST" && url.pathname === "/v1/chat/completions";
  if ((!modelos && !chat) || url.search || url.hash) {
    return rejeitar(404, "rota_nao_permitida", cors);
  }
  let conteudo;
  if (chat) {
    if (!(req.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) {
      return rejeitar(415, "tipo_nao_permitido", cors);
    }
    if (Number(req.headers.get("content-length") || "0") > LIMITE_PEDIDO) {
      return rejeitar(413, "pedido_grande", cors);
    }
    try {
      conteudo = await lerLimitado(req.body, LIMITE_PEDIDO);
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(conteudo));
    } catch (e) {
      return rejeitar(e instanceof RangeError ? 413 : 400, "pedido_invalido", cors);
    }
  }
  const cabecalhos = { "content-type": "application/json", "accept": "application/json" };
  const credencial = req.headers.get("authorization");
  if (credencial) {
    if (!/^Bearer [^\s]{1,4000}$/i.test(credencial)) {
      return rejeitar(400, "credencial_provedor_invalida", cors);
    }
    cabecalhos.authorization = credencial;
  }
  const abortar = new AbortController();
  const tempo = setTimeout(() => abortar.abort(), 50000);
  try {
    const remoto = await (opcoes.buscar || fetch)(ALVO + url.pathname, {
      method: req.method,
      headers: cabecalhos,
      body: chat ? conteudo : undefined,
      redirect: "error",
      signal: abortar.signal,
    });
    if (Number(remoto.headers.get("content-length") || "0") > LIMITE_RESPOSTA) {
      return rejeitar(502, "resposta_grande", cors);
    }
    const dados = await lerLimitado(remoto.body, LIMITE_RESPOSTA);
    const tipo = (remoto.headers.get("content-type") || "").startsWith("text/event-stream")
      ? "text/event-stream" : "application/json";
    return new Response(dados, {
      status: remoto.status,
      headers: { "content-type": tipo, "cache-control": "no-store", ...cors },
    });
  } catch {
    return rejeitar(502, "provedor_indisponivel", cors);
  } finally { clearTimeout(tempo); }
}
if (import.meta.main) {
  Deno.serve((req) => atender(req, {
    chave: Deno.env.get("REBOCL_RELAY_KEY"),
  }));
}
