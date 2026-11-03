# Relé Rebocl — reforço proposto

O código antigo encaminha pedidos ao provedor LLM7 sem autenticação própria e sem limite de tamanho. Esta PR propõe uma alternativa de padrão restritivo.

**ATENÇÃO: a configuração dos clientes precisa ser revisada antes da implantação.** Não copie nem implante cegamente esta versão: ela falha fechada se a variável de ambiente REBOCL_RELAY_KEY não existir ou tiver menos de 24 caracteres.

Para liberar em ambiente aprovado, o dono precisará configurar um segredo exclusivo REBOCL_RELAY_KEY fora do GitHub e, se houver cliente web, o endereço HTTPS exato em REBOCL_RELAY_ORIGIN. Clientes autorizados precisarão mandar o cabeçalho X-Rebocl-Relay-Key, sem colocar o valor em código, URL, mensagem ou log. Não reutilizar PAT do GitHub.

A execução aceita somente GET /v1/models e POST /v1/chat/completions. Sem redirects ou rotas arbitrárias, com limites de 256 KiB no pedido, 2 MiB na resposta e tempo de 50 s. A validação de CORS exige origem exata. Sem configuração, retorna 503.

A CI usa testes Node 22 com fetch fictício e não chama a API externa. Não há comprovação de implantação real nem de compatibilidade com todos os clientes/modelos. Este repositório possui implantação manual descrita no código original; um commit não muda automaticamente uma instância Deno Deploy existente.

A PR deve permanecer draft até conferência de requisitos e configuração pelo dono. Nenhum segredo, conta, token ou deployment foi modificado.
