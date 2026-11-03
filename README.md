# Relé Rebocl — proposta segura somente entre servidores

A versão atual na branch principal ainda é um proxy sem autenticação própria. Esta PR permanece em **rascunho**, sem implantação ou mudanças em credenciais existentes.

A proposta de atualização exige um segredo novo e exclusivo, `REBOCL_RELAY_KEY`, configurado **fora do código** no servidor. O cliente confiável também deve rodar no servidor e usar o cabeçalho `X-Rebocl-Relay-Key`. **Nunca incluir essa chave em JavaScript de navegador, PWA, apps públicos, URL, logs ou páginas**. Uma origem CORS aprovada não protege uma chave incluída no navegador; por isso, a proposta recusa qualquer requisição com cabeçalho `Origin` e qualquer `OPTIONS`.

Antes de implantar, revisar que todos os clientes sejam processos privados confiáveis. Clientes que precisam funcionar no navegador exigem outro intermediário de autenticação e autorização por usuário, ainda **não implementado**. Não reutilizar PAT do GitHub nem credenciais de mídia/marketing.

O relé só encaminha `GET /v1/models` ou `POST /v1/chat/completions` ao provedor fixo. Rejeita caminhos arbitrários, parâmetros, redirects, pedido acima de 256 KiB, resposta acima de 2 MiB e limita a duração a 50 segundos. Sem segredo com comprimento mínimo configurado, retorna 503.

A CI testa os comportamentos com `fetch` simulado, sem contato real com o provedor. Ela não comprova implantação no Deno, compatibilidade dos clientes, proteção contra abuso distribuído ou adequação de limites para toda saída. Antes de qualquer ativação, o dono deve configurar a chave fora do repositório, planejar a migração e validar a integração ponta a ponta. Um merge no GitHub não altera automaticamente a implantação manual existente.
