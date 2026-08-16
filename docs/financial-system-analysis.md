# Análise técnica do eixo financeiro

## Escopo

Esta análise revisa o modelo persistente e os fluxos que já armazenam valores monetários no aplicativo, com foco em compatibilidade com um módulo financeiro centralizado. A análise é estrutural: não avalia dados reais nem recomenda decisões financeiras.

## Inventário de valores

| Entidade | Campos monetários | Precisão | Relação operacional |
|---|---|---:|---|
| `supplier_contracts` | `expectedAmount` | numeric(14,2) | Contratos de fornecedores, com recorrência, dia e forma de pagamento |
| `supplier_offerings` | `unitPrice` | numeric(14,2) | Produtos, serviços e ofertas vinculadas a fornecedores |
| `monthly_budgets` | `totalAmount` | numeric(14,2) | Orçamento mensal por competência e tipo (`trade_events`, `branding_b2c`) |
| `operation_costs` | `investmentBase`, `permitCost`, `storeCost`, `otherCosts` | numeric(14,2) | Custos por operação, com status de aprovação e orçamento |
| `invoices` | `amount` | numeric(14,2) | Contas de fornecedores, vencimento, status e vínculo opcional a operação |
| `payments` | `amount` | numeric(14,2) | Baixas de faturas, método, referência e usuário executor |
| `partners` | não possui valor absoluto | — | Possui tipo de parceria, método e recorrência de pagamento |
| `media_spots` | valores operacionais devem ser auditados no fluxo | — | Depende de campanhas e contratos de mídia |

## Conclusão de compatibilidade

A base já possui uma fundação adequada para um módulo financeiro: usa `numeric(14,2)` no PostgreSQL, separa faturas de pagamentos, mantém status de fatura e possui custos operacionais aprováveis. O ponto mais importante é evitar duplicar valores em módulos de operação. O financeiro deve ser a fonte de consolidação, enquanto operações mantêm apenas valores de planejamento ou referência.

## Riscos identificados

O vínculo de `invoices` com operações é polimórfico (`operationType` + `operationId`) e não uma foreign key única. O módulo financeiro deverá validar esses pares no backend. `supplier_contracts.expectedAmount` e `monthly_budgets.totalAmount` representam expectativas ou limites, não caixa realizado. `payments.amount` deve ser validado contra o saldo aberto da fatura, impedindo pagamento acima do saldo sem uma regra explícita de crédito.

A categoria financeira atualmente é uma entidade de cadastro, mas ainda não aparece como foreign key em custos, faturas ou pagamentos. Para relatórios por categoria, deve ser adicionada uma coluna opcional em `operation_costs` e `invoices` em uma migração futura. A moeda não está persistida por registro; se o aplicativo permanecer exclusivamente em BRL, isso deve ser declarado como regra global. Caso haja expansão, a moeda deverá ser adicionada antes de qualquer dado em outra moeda.

## Fluxo recomendado

O fluxo consistente é: orçamento mensal → custo planejado por operação → aprovação → fatura de fornecedor → pagamentos parciais ou totais → conciliação e indicadores. Contratos e ofertas devem alimentar valores sugeridos, mas não gerar pagamentos automaticamente sem confirmação.

## Dependências para evolução

Os serviços e subserviços precisam carregar `mediaTypeId` opcional e `parentServiceTypeId` para que ofertas de fornecedores possam ser classificadas por tipo de mídia, serviço e subserviço. Esta camada foi iniciada no schema e possui migração incremental separada. Notificações de pagamento devem apontar para fatura e vencimento, além de permitir canal interno e e-mail com registro de tentativa.

## Próximas validações

Antes de colocar o financeiro em produção, é necessário cobrir com testes: saldo da fatura após pagamentos parciais, bloqueio de pagamentos acima do saldo, consistência entre contrato e fatura, orçamento mensal por competência, aprovação de custos, classificação por categoria e rastreabilidade em auditoria.
