# Marketing HUB MCP Server
Conexão oficial com a API do Marketing HUB Trade Marketing.
Endpoint: http://10.159.245.28:8978/api/mcp

Ferramentas disponíveis:
- mcp_status: Retorna o status da instância do Marketing HUB, a versão, o usuário autenticado e suas permissões ativas.
- consultar_territorio: Consulta empresas, regionais e cidades cadastradas no Marketing HUB. Essencial para mapear nomes de cidades ou códigos de regional vindos de planilhas de trade.
- consultar_tipos_operacao: Retorna as taxonomias e tipos de operação cadastrados: tipos de ação, tipos de campanha, tipos de evento, supervisores comerciais e tipos de mídia.
- listar_campanhas: Lista as campanhas de trade marketing com opção de filtros por status, empresa, datas e busca textual.
- obter_detalhe_campanha: Obtém todos os detalhes de uma campanha específica, incluindo regionais, cidades atendidas, promoções, planos e ações vinculadas.
- criar_campanha: Cria uma nova campanha de trade marketing com suporte a regionais, cidades, promoções e planos.
- atualizar_status_campanha: Atualiza o status de uma campanha e opcionalmente adiciona notas de debriefing e avaliação de resultado.
- listar_acoes: Lista as ações de trade marketing com filtros por campanha, cidade, tipo de ação, status e datas.
- criar_acao: Cria uma nova ação de trade marketing vinculada a uma cidade, data e opcionalmente a uma campanha.
- atualizar_status_acao: Atualiza o status de uma ação de trade (ex: iniciar execução, pausar, concluir ou cancelar) e opcionalmente adiciona debriefing.
- preencher_dados_trade_lote: Ferramenta otimizada para importação/preenchimento automático a partir de planilhas de trade. Permite criar múltiplas ações e campanhas em lote, resolvendo nomes de cidades e tipos de ação automaticamente.
- obter_indicadores_trade: Calcula métricas agregadas da operação de trade: total de campanhas por status, ações realizadas vs planejadas, investimentos e cobertura de cidades.
- agendar_panfletagem: Agenda uma operação de panfletagem (leafleting) com volume de panfletos, rotas, datas, bairros (opcional), equipes de distribuição e vínculo com campanha comercial (tradeCampaignId).
- cadastrar_ponto_midia: Cadastra ponto de mídia urbana (outdoors, frontlights, painéis, painel de led, etc.), endereço, cidade, fornecedor e valores.
- cadastrar_veiculacao_midia: Registra veiculação de campanha em ponto de mídia urbana ou tradicional com datas de início/fim e valores.
- cadastrar_midia_audiovisual: Cadastra veiculação audiovisual (emissoras de rádio e TV, programas, quantidade de spots, horários e custos de veiculação).
- cadastrar_midia_volante: Cadastra veiculação de mídia volante (carros de som, rotas, dias de rodagem, horários e custos).
- cadastrar_influenciador: Cadastra influenciadores, cidades de atuação, rede social, @, pacotes de postagens/stories e cachês.
- cadastrar_evento: Cadastra evento de trade/marketing com nome do evento, local/endereço, datas de início/fim, público estimado, alvará e custos.
- cadastrar_item_estoque: Cadastra item no catálogo de materiais de estoque (tendas, uniformes, brindes, panfletos, faixas) e saldo inicial por cidade/regional.
- lancar_movimentacao_estoque: Registra movimentação de estoque (entrada, saída, ajuste) de um item para determinada cidade/regional.
- cadastrar_despesa_financeira: Lança despesa financeira/custo operacional vinculada a uma ação, evento ou mídia, com centro de custo, categoria e fornecedor.
- obter_configuracoes_sistema: Retorna as configurações gerais e de branding ativas no sistema.
- atualizar_configuracoes_sistema: Atualiza parâmetros de configuração do sistema e branding.
- cadastrar_bairro: Cadastra um novo bairro vinculado a uma cidade (cityId, name).
