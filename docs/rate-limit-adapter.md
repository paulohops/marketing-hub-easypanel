# Adapter de rate limiting compartilhado

O login local usa atualmente um armazenamento em memória, adequado para um único processo. Em um deploy com múltiplas réplicas, cada instância mantém uma visão diferente das tentativas e um atacante pode alternar entre pods. A migração para um armazenamento compartilhado deve preservar o mesmo contrato funcional: chave normalizada, contador de tentativas, expiração absoluta e remoção após login válido.

## Contrato recomendado

| Operação | Entrada | Saída | Regra |
|---|---|---|---|
| `get` | chave | contador e `expiresAt` ou vazio | Nunca retornar dados de outra chave |
| `increment` | chave, janela | contador e expiração | Operação atômica com TTL definido na primeira tentativa |
| `delete` | chave | vazio | Executar após credencial válida |

A chave de login deve continuar separada por e-mail normalizado e endereço IP resolvido pelo proxy confiável. O adapter Redis deve usar uma operação atômica de incremento com expiração, ou Lua/script equivalente, para evitar condição de corrida entre réplicas. O valor de `Retry-After` pode ser calculado a partir de `expiresAt`, mas a API não deve revelar se uma conta existe.

## Requisitos de produção

A URL e a credencial do Redis devem ser fornecidas pelo ambiente de deploy, nunca versionadas no repositório. O serviço deve ter política de TLS, limite de conexões, timeout curto, tratamento de indisponibilidade e métricas de erro. Em caso de falha do Redis, a política de segurança deve ser escolhida explicitamente: fail-closed para endpoints de autenticação sensíveis ou fallback limitado em memória com alerta operacional. Não é seguro esconder uma indisponibilidade compartilhada como se fosse proteção distribuída.

## Critérios de aceite

A implementação poderá substituir o mapa local quando houver um Redis acessível a partir do serviço e um teste de integração com duas instâncias ou dois clientes concorrentes. O teste deve demonstrar que cinco falhas acumuladas em uma instância bloqueiam a sexta tentativa em outra, que a expiração libera a chave e que um login válido remove os contadores de e-mail e IP.

## Referências internas

[1]: ../server/routers/localAuth.ts "Implementação atual do rate limiting local"
[2]: ../docs/optimization-rollout.md "Notas de rollout e limitações de infraestrutura"
