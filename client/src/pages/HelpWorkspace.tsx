import { WorkspaceCard, WorkspaceHeader, WorkspaceSection, WorkspaceShell } from "@/components/WorkspaceChrome";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BarChart3, BookOpenCheck, Boxes, CalendarDays, CircleHelp, ClipboardList, Database, FileSpreadsheet, Landmark, Mail, Megaphone, Network, Send, Settings2, ShieldCheck, Workflow } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type KnowledgeCard = {
  id: string;
  title: string;
  area: string;
  summary: string;
  icon: typeof CircleHelp;
  relationship: string;
  howTo: string[];
  fields: string[];
  rules: string[];
};

const knowledgeCards: KnowledgeCard[] = [
  {
    id: "visao-geral",
    title: "Como o Marketing HUB se organiza",
    area: "Visão geral",
    summary: "O sistema separa dados mestres, planejamento, execução, governança e análise. Essa ordem evita cadastros duplicados e permite que cada operação gere histórico, custo e indicador.",
    icon: Network,
    relationship: "Cadastros alimentam Trade; Trade gera notificações, tarefas, evidências e custos; Financeiro e Estoque registram o impacto; BI consolida os resultados.",
    howTo: ["Comece validando os cadastros que serão usados na operação.", "Crie a campanha ou o planejamento antes de registrar ações, eventos ou veiculações.", "Execute usando status, responsáveis e evidências; finalize com debriefing quando aplicável.", "Confira o custo realizado, os materiais movimentados e os indicadores depois da execução."],
    fields: ["Use nomes claros e estáveis; o nome exibido no formulário deve identificar o negócio, não a tabela do banco.", "Preencha cidade, regional, empresa fiscal e fornecedor sempre que a operação tiver impacto territorial ou financeiro.", "Mantenha a versão do processo e dos templates quando uma regra operacional mudar."],
    rules: ["Não crie um novo cadastro para corrigir um erro de digitação; edite o registro original quando isso preservar os vínculos.", "Prefira inativar registros usados em histórico a apagá-los.", "Toda informação operacional importante deve ter responsável e evidência."],
  },
  {
    id: "cadastros-relacionamentos",
    title: "Cadastros e relacionamentos",
    area: "Gestão operacional",
    summary: "Cadastros são a base compartilhada por Trade, Financeiro, Estoque e BI. O relacionamento correto é mais importante do que apenas preencher o registro individual.",
    icon: Database,
    relationship: "Empresa pode possuir várias empresas fiscais; empresa fiscal se relaciona a CNPJ e faturamento; fornecedor pode ofertar vários produtos e serviços; regional contém cidades; cidade pode ser usada em operações, mídias e cobertura.",
    howTo: ["Cadastre primeiro empresas, empresas fiscais, regionais e cidades.", "Depois cadastre fornecedores e suas ofertas, associando cada oferta a produto ou serviço e mantendo preço, unidade e vigência.", "Cadastre tipos de mídia, serviços e SubServiços antes de criar uma veiculação.", "Use os vínculos na ficha do cadastro para conferir se a relação foi gravada corretamente."],
    fields: ["Empresa: razão social, nome exibido, contatos e situação.", "Empresa fiscal: CNPJ, razão social fiscal e empresa proprietária.", "Fornecedor: dados comerciais, cidades atendidas e ofertas.", "Regional e cidade: nome, código, endereço e coordenadas quando houver mapa.", "Serviço e SubServiço: o Serviço é a categoria principal; o SubServiço é a execução específica e pode ser compartilhado por vários Serviços."],
    rules: ["A relação atual entre Serviço e SubServiço é muitos-para-muitos e deve ser mantida em `serviceSubservices`.", "Não use relações legadas para buscar SubServiços; elas podem apontar para tipos de Serviço antigos.", "Produtos, serviços e tipos de mídia devem usar os nomes dos formulários para que importações e relatórios sejam compreensíveis."],
  },
  {
    id: "trade",
    title: "Trade: campanhas, ações e eventos",
    area: "Planejamento e execução",
    summary: "Campanha agrupa iniciativas por objetivo e período. Ação e Evento representam execuções concretas, com responsáveis, fornecedor, cidade, custo, status e histórico.",
    icon: CalendarDays,
    relationship: "Campanha pode ser vinculada a ações, eventos, mídias e panfletagem; ação/evento pode usar fornecedor, serviço, produto de estoque e empresa fiscal; notificações e pendências devem apontar para o registro original.",
    howTo: ["Crie a campanha quando várias execuções compartilharem objetivo, período ou verba.", "Na ação ou evento, registre objetivo, cidade, endereço, agenda, fornecedor, serviços e responsável.", "Atualize o status conforme o fluxo: planejamento, agendado, em execução, concluído, cancelado ou inativo.", "Quando o status exigir justificativa, registre o motivo junto ao histórico e anexe a evidência correspondente.", "Finalize com debriefing: nota, resultado, pontos positivos, pontos de melhoria e aprendizados."],
    fields: ["Datas: informe início e fim reais ou planejados, sem misturar competência financeira com data de execução.", "Fornecedor e serviço: selecione registros cadastrados; não use texto livre quando o custo depender do vínculo.", "Responsável: escolha a pessoa que acompanha a execução, não apenas quem criou o registro.", "Evidências: use fotos, documentos ou comprovantes que provem a execução; o histórico de status é separado das artes e arquivos operacionais."],
    rules: ["Uma ação cancelada não deve ser apagada se já tiver evidência ou custo.", "O debriefing pertence à execução que recebeu a nota, não ao painel geral de mídias.", "A alteração de cidade ou fornecedor deve refletir em todas as telas por meio do cadastro relacionado, evitando cópias desatualizadas."],
  },
  {
    id: "midias",
    title: "Mídias: urbana, audiovisual e externa",
    area: "Trade",
    summary: "As mídias compartilham a identidade visual, mas têm estruturas operacionais diferentes. O ponto/programa representa o ativo; a veiculação representa a execução naquele ativo.",
    icon: Megaphone,
    relationship: "Ponto de mídia urbana → veiculações; programa audiovisual → spots, cidades de sinal e programação; mídia externa → operação de panfletagem ou carro de som. Campanha, Serviço, SubServiço, responsável e arquivos entram na veiculação quando aplicável.",
    howTo: ["Cadastre o ponto ou programa com contrato, cidade, fornecedor, tipo de mídia, localização e coordenadas.", "Na ficha do ponto, use Nova veiculação para registrar a execução sem duplicar o ativo.", "Selecione o Serviço principal e depois o SubServiço filtrado pelos vínculos do tipo de mídia.", "Anexe a arte, spot ou evidência no card próprio da veiculação e mantenha o histórico de reagendamento separado.", "Para audiovisual, informe cidades de sinal, dias da semana e horários; o calendário serve para acompanhar a programação."],
    fields: ["Contrato: início, fim, modalidade Pago/Misto/Permuta e periodicidade de troca.", "Localização: latitude e longitude em campos separados, usando valores copiáveis do Google Maps.", "Veiculação: nome, período, SubServiço, campanha opcional, arquivo utilizado, detalhes e responsável.", "Status: agendada, ativa, inativa ou cancelada; inativo/cancelado exige motivo e, quando necessário, evidência."],
    rules: ["Mídia Urbana e Mídia Audiovisual são módulos independentes; audiovisual apenas usa urbana como referência visual.", "Ao criar uma nova mídia no mesmo local, o sistema deve solicitar confirmação antes de concluir a anterior.", "Não duplique veiculações ao reagendar: mantenha a mesma ficha e registre o evento no histórico.", "A arte da veiculação é diferente da evidência de execução; não misture os dois conjuntos de arquivos."],
  },
  {
    id: "servicos-subservicos",
    title: "Tipos de mídia, Serviços e SubServiços",
    area: "Relacionamentos",
    summary: "O tipo de mídia define o contexto do canal. Serviço representa a categoria de entrega. SubServiço representa a execução específica, como papel, lona, entrevista ou spot.",
    icon: Workflow,
    relationship: "Tipo de mídia → catálogo de serviços → vínculo Serviço/SubServiço. Um SubServiço pode estar vinculado a vários Serviços e um Serviço pode ter vários SubServiços.",
    howTo: ["Cadastre o Serviço principal sem tentar colocar nele todas as variações de execução.", "Cadastre cada SubServiço com nome, descrição e situação própria.", "Na tela de vínculo, selecione vários Serviços para um SubServiço quando a mesma execução puder ser contratada em contextos diferentes.", "Associe o tipo de mídia ao Serviço aplicável e verifique o catálogo antes de cadastrar a veiculação.", "Na veiculação, o filtro do SubServiço deve mostrar apenas as opções válidas para o Serviço e o tipo de mídia selecionados."],
    fields: ["Serviço: nome comercial, categoria, unidade e descrição do que é contratado.", "SubServiço: execução, material, formato ou modalidade específica.", "Catálogo: tipo de mídia, Serviço, SubServiço, unidade, preço de referência e vigência quando aplicável.", "Vínculo: mantenha ativo/inativo sem apagar relações que já aparecem em históricos."],
    rules: ["A fonte oficial dos vínculos é `serviceSubservices`.", "Não crie SubServiço como um segundo Serviço apenas para fazê-lo aparecer no dropdown.", "Se um item não aparece, confira primeiro situação ativa, vínculo no catálogo e tipo de mídia selecionado."],
  },
  {
    id: "estoque",
    title: "Estoque e movimentações",
    area: "Gestão",
    summary: "Estoque registra o saldo físico e financeiro dos materiais. O saldo não deve ser editado como texto: deve resultar de entradas, saídas, ajustes e transferências rastreáveis.",
    icon: Boxes,
    relationship: "Produto → item de estoque → movimentação → saldo por regional/cidade → consumo vinculado a ação, evento ou mídia.",
    howTo: ["Cadastre o produto com SKU, categoria, unidade de medida e estoque mínimo.", "Registre uma entrada para compras e recebimentos; informe quantidade, valor unitário, documento e local.", "Registre uma saída somente quando o material for utilizado, separado ou transferido conforme a regra operacional.", "Use transferência para mover saldo entre cidades, nunca uma saída sem destino.", "Confira saldo atual, mínimo e histórico antes de aprovar nova compra."],
    fields: ["Quantidade: informe número, não texto; use casas decimais apenas quando a unidade permitir.", "Custo unitário e total: o total deve ser calculado a partir da quantidade e do valor unitário.", "Origem/destino: informe regional, cidade, operação e responsável.", "Documento: associe nota fiscal, pedido ou evidência de recebimento quando existir."],
    rules: ["Nunca corrija saldo diretamente sem gerar ajuste com motivo.", "Produto físico entra no estoque a partir da nota ou recebimento confirmado.", "Saldo negativo deve ser tratado como exceção e aparecer em acompanhamento gerencial."],
  },
  {
    id: "financeiro",
    title: "Financeiro integrado",
    area: "Gestão",
    summary: "O Financeiro transforma planejamento e execução em compromissos, notas, pagamentos e análise de caixa. O vínculo operacional permite entender o custo real por ação, mídia, evento ou campanha.",
    icon: Landmark,
    relationship: "Fornecedor/oferta → contrato ou pedido → itens de produto/serviço → nota fiscal → pagamento; produto também pode alimentar Estoque. Operação e campanha são referências de origem do custo.",
    howTo: ["Cadastre categorias, fornecedores, serviços, produtos e empresas fiscais antes do lançamento.", "Use contrato para recorrências e pedido para uma compra delimitada; registre itens separados por produto ou serviço.", "Anexe a nota fiscal à parcela ou documento correspondente e registre vencimento, competência e pagamento.", "Compare planejado, comprometido, realizado e pendente na Memória de Cálculo e na Análise de Caixa.", "Ao receber produto, confirme a entrada no Estoque para manter o saldo físico alinhado."],
    fields: ["Empresa fiscal: escolha o CNPJ correto para faturamento.", "Competência: mês em que o custo pertence ao planejamento, não necessariamente a data de pagamento.", "Itens: produto ou serviço, quantidade, valor unitário, impostos/descontos quando aplicável.", "Status: rascunho, aguardando aprovação, aprovado, recebido, pago ou cancelado."],
    rules: ["Uma ordem de compra não substitui a nota fiscal; são documentos relacionados, mas não iguais.", "Pagamento sem referência deve ser tratado como pendência de conciliação.", "Não altere um lançamento pago para corrigir histórico; faça ajuste documentado."],
  },
  {
    id: "central-dados",
    title: "Central de Dados e importações",
    area: "Administração",
    summary: "A Central de Dados é o ponto de entrada e saída em lote. A planilha deve usar nomes dos formulários e respeitar os relacionamentos, não nomes técnicos de tabela.",
    icon: FileSpreadsheet,
    relationship: "Planilha de cadastro → validação de colunas → resolução de chaves por nome/código → prévia de erros → gravação → auditoria.",
    howTo: ["Exporte ou baixe o modelo do módulo correto antes de preencher.", "Use uma linha por registro e mantenha nomes de empresas, cidades, Serviços e SubServiços exatamente como cadastrados.", "Importe primeiro os cadastros pais e depois os dependentes: empresa, regional, cidade, fornecedor, serviço, SubServiço, produto e operação.", "Revise a prévia; corrija erros de relacionamento antes de confirmar a importação.", "Após importar, abra algumas fichas no sistema para confirmar os vínculos e não apenas a contagem de linhas."],
    fields: ["Identificador: use código estável quando o modelo oferecer; não altere IDs internos manualmente.", "Relacionamento: informe nome/código do registro pai conforme o modelo.", "Datas: use formato indicado na planilha e não misture texto livre com datas.", "Status: use os valores exibidos no dropdown do sistema."],
    rules: ["Uma importação parcial deve ser repetível sem duplicar registros.", "Erros devem indicar linha, coluna e motivo de forma compreensível.", "Nunca importe uma planilha de um módulo em outro; cada modelo tem campos e vínculos próprios."],
  },
  {
    id: "processos",
    title: "Processos e governança operacional",
    area: "Gestão",
    summary: "Processos registram o modo oficial de trabalhar: finalidade, escopo, entradas, saídas, controles, exceções, responsáveis, SLA e indicadores. O arquivo anexo complementa o descritivo.",
    icon: ClipboardList,
    relationship: "Processo → módulos relacionados → responsáveis → tarefas/notificações futuras → documentos oficiais → auditoria de versão.",
    howTo: ["Use um código único e um nome que descreva o resultado, como PROC-TRADE-001 — Planejamento de Ação.", "Escreva o descritivo na ordem: finalidade, gatilho, pré-requisitos, etapas, decisões, exceções, encerramento e evidências.", "Associe responsável, abrangência territorial, vigência e próxima revisão.", "Anexe fluxograma, procedimento visual ou PDF oficial; prefira uma versão consolidada por processo.", "Quando a regra mudar, aumente a versão e mantenha a anterior arquivada para rastreabilidade."],
    fields: ["Objetivo: resultado que o processo garante.", "Escopo: início, fim e áreas envolvidas.", "Entradas/saídas: documentos, dados e entregáveis de cada lado.", "Controles: aprovações, validações, segregação de funções e evidências.", "Exceções/SLA/KPIs: tratamento de desvios, prazos e indicadores de eficiência."],
    rules: ["Rascunho não deve ser tratado como procedimento vigente.", "Processo ativo precisa ter descritivo executável e responsável definido.", "O arquivo anexado é evidência do procedimento, não substitui o descritivo estruturado."],
  },
  {
    id: "status-historico",
    title: "Status, histórico, evidências e debriefing",
    area: "Padrão global",
    summary: "O padrão global separa o estado atual do registro, a justificativa de mudança, os arquivos de comprovação e a avaliação final. Isso preserva contexto e facilita auditoria.",
    icon: ShieldCheck,
    relationship: "Registro operacional → status atual → histórico de eventos → motivo/evidência → debriefing e resultado.",
    howTo: ["Escolha o status que representa a situação real, não o status desejado.", "Ao cancelar ou inativar, explique o motivo na mudança de status.", "Anexe a evidência na própria alteração ou no card operacional correspondente.", "Use reagendamento sem duplicar o registro; altere datas e crie uma entrada de histórico.", "Preencha debriefing depois da execução, com nota, resultado, aprendizados e próximos passos."],
    fields: ["Status: estado atual visível para filtros e dashboards.", "Motivo: por que a alteração aconteceu.", "Evidência: arquivo ou imagem que comprova a situação.", "Debriefing: avaliação estruturada do resultado, diferente de uma simples observação."],
    rules: ["Histórico é imutável do ponto de vista operacional; correções devem gerar novo evento.", "Evidência de arte não é a mesma coisa que evidência de execução.", "A nota precisa ter critério ou comentário para ser útil em indicadores."],
  },
  {
    id: "bi",
    title: "BI e Indicadores",
    area: "Análise",
    summary: "BI transforma registros operacionais em leitura gerencial. A análise deve sempre informar período, território, status e origem do número.",
    icon: BarChart3,
    relationship: "Cadastros e operações → fatos de custo, volume, status e resultado → cards e gráficos de Trade → decisão e plano de ação.",
    howTo: ["Escolha o período e o recorte territorial antes de comparar números.", "Confira se o indicador considera planejado, comprometido, realizado ou pago.", "Use filtros de status para não misturar rascunhos com execução concluída.", "Ao identificar desvio, abra a operação, consulte o histórico e crie uma ação corretiva ou tarefa na próxima rodada."],
    fields: ["Dimensões: módulo, campanha, regional, cidade, fornecedor, Serviço e SubServiço.", "Métricas: quantidade, custo, cobertura, prazo, nota, conversão ou saldo.", "Período: competência financeira ou janela operacional, conforme o indicador.", "Fonte: registro original que permite explicar e auditar o valor exibido."],
    rules: ["Não interprete um card sem conhecer seus filtros e sua definição.", "Dados sem responsável, status ou evidência devem ser tratados como pendentes de validação.", "O módulo de Indicadores Operacionais será substituído pela nova área BI & Indicadores, organizada por Trade."],
  },
];

export default function HelpWorkspace() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const visibleCards = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return knowledgeCards;
    return knowledgeCards.filter(card => `${card.title} ${card.area} ${card.summary} ${card.relationship}`.toLocaleLowerCase("pt-BR").includes(query));
  }, [search]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) return toast.error("Informe o assunto e descreva como podemos ajudar.");
    const body = `Solicitação enviada pelo Trade HUB — Cluster MG\n\nAssunto: ${subject.trim()}\n\nDescrição:\n${message.trim()}`;
    window.location.href = `mailto:suporte@hubtrade.app?subject=${encodeURIComponent(`[Trade HUB] ${subject.trim()}`)}&body=${encodeURIComponent(body)}`;
    toast.success("Seu aplicativo de e-mail foi preparado para enviar a solicitação.");
  };

  return <WorkspaceShell>
    <WorkspaceHeader eyebrow="Central de conhecimento" title="Como trabalhar no Marketing HUB" description="Consulte os relacionamentos entre módulos, o significado dos campos e o modo correto de registrar planejamento, execução, custos, evidências e resultados." icon={CircleHelp} meta={<span className="inline-flex items-center gap-1.5"><BookOpenCheck className="h-3.5 w-3.5" />Documentação operacional por tópicos</span>} />
    <WorkspaceSection title="Mapa de conhecimento" description="Cada card representa um tópico de uso. Pesquise por módulo, relacionamento ou termo do formulário.">
      <div className="hub-filter-panel mb-5"><label className="grid gap-1.5"><span className="text-xs font-semibold text-foreground">Pesquisar na Central de Conhecimento</span><div className="relative"><BookOpenCheck className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ex.: subserviço, nota fiscal, evidência, cidade…" className="h-9 pl-9" /></div></label></div>
      {visibleCards.length ? <div className="grid gap-4 xl:grid-cols-2">{visibleCards.map(card => <KnowledgeTopicCard key={card.id} card={card} />)}</div> : <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Nenhum tópico corresponde à pesquisa.</div>}
    </WorkspaceSection>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <WorkspaceCard><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Princípios para novos módulos</h2></div><div className="mt-4 grid gap-3 md:grid-cols-3"><Principle title="Relacionamento primeiro" text="Antes de criar um campo novo, identifique se a informação já existe em um cadastro mestre e pode ser vinculada." /><Principle title="Histórico sempre" text="Alterações relevantes devem preservar motivo, responsável, data e evidência quando aplicável." /><Principle title="Visual consistente" text="Use o shell, tokens, espaçamentos, filtros ocultos e dropdowns pesquisáveis do sistema." /></div></WorkspaceCard>
      <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" /><h2 className="font-display text-lg font-semibold text-foreground">Solicitar ajuda</h2></div><p className="mt-1 text-sm leading-6 text-muted-foreground">Ao enviar, será aberto um e-mail preenchido para a equipe de suporte.</p><div className="mt-5 space-y-4"><div><Label htmlFor="help-subject">Assunto</Label><Input id="help-subject" value={subject} onChange={event => setSubject(event.target.value)} maxLength={160} placeholder="Ex.: Dúvida sobre vínculo de SubServiço" className="mt-1.5" /></div><div><Label htmlFor="help-message">Descrição</Label><Textarea id="help-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={3000} placeholder="Informe módulo, registro, etapa executada e resultado esperado." className="mt-1.5 min-h-36 resize-y" /></div></div><Button type="submit" className="mt-6 w-full bg-primary hover:bg-primary/90"><Send className="mr-1.5 h-4 w-4" />Preparar solicitação</Button><p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">Nunca inclua senhas ou dados sensíveis.</p></form>
    </div>
  </WorkspaceShell>;
}

function KnowledgeTopicCard({ card }: { card: KnowledgeCard }) {
  const Icon = card.icon;
  return <WorkspaceCard className="h-full"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4.5 w-4.5" /></span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{card.area}</p><h2 className="mt-1 font-display text-lg font-semibold text-foreground">{card.title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{card.summary}</p></div></div><div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">Relacionamento</p><p className="mt-1 text-xs leading-5 text-foreground">{card.relationship}</p></div><div className="mt-4 grid gap-4 md:grid-cols-2"><KnowledgeList title="Como preencher e usar" items={card.howTo} /><KnowledgeList title="Campos importantes" items={card.fields} /></div><div className="mt-4 border-t border-border pt-4"><KnowledgeList title="Regras e cuidados" items={card.rules} /></div></WorkspaceCard>;
}

function KnowledgeList({ title, items }: { title: string; items: string[] }) {
  return <div><h3 className="text-xs font-semibold text-foreground">{title}</h3><ul className="mt-2 space-y-2 text-xs leading-5 text-muted-foreground">{items.map(item => <li key={item} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />{item}</li>)}</ul></div>;
}

function Principle({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-border bg-secondary/30 p-3"><h3 className="text-sm font-semibold text-foreground">{title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div>;
}
