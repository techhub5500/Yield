# Relatório técnico — Persistência de valor de mercado em RV (Patrimônio/Rentabilidade)

## 1) Sintoma confirmado
- No card **Patrimônio Total**, ativos de **Renda Variável** permaneciam com valor próximo ao aporte inicial (sem refletir rendimento de mercado).
- O comportamento persistia mesmo com `cards/query` retornando `200` e `ok` para `investments.net_worth` e `investments.profitability`.

## 2) Auditoria dos logs existentes (`server/logs/2026-02-18.md`)
### 2.1 O que os logs mostraram
- Scheduler oficial inicializado corretamente.
- Requisições de métricas/cards executando sem erro (`ok`, `errors: 0`).
- Consulta manual de preço via `/brapi/quote` com `policyBypass: true` funcionando.

### 2.2 O que os logs não mostravam (lacuna)
- Não havia log do preço efetivamente usado no cálculo de Patrimônio para RV.
- Não havia telemetria de fallback (histórico BRAPI ausente → uso de `position.marketPrice/avgPrice`).
- Não havia rastreio de persistência de `marketPrice` no ciclo automático.

## 3) Causa-raiz técnica (definitiva)
A política BRAPI foi aplicada corretamente ao fluxo de métricas (`queryMetrics/queryCards`), mas o scheduler oficial **não persistia** atualização de preço em `investments_positions`.

Efeito prático:
1. Fora da janela oficial (12h/20h), métricas não podem consultar BRAPI diretamente sem cache/slot válido.
2. Sem histórico disponível no momento da consulta, o valuation cai em fallback de posição.
3. Como `marketPrice` não era atualizado automaticamente no banco, o fallback ficava preso no valor inicial (normalmente próximo ao aporte).

Resultado: Patrimônio de RV sem evolução de mercado em grande parte das consultas.

## 4) Correção aplicada
### 4.1 Persistência automática de preço no scheduler
Arquivo alterado: `server/src/core/investments/brapi-auto-update-scheduler.js`

Implementado no ciclo oficial:
- leitura de cotação por ticker (slot oficial);
- extração de preço resolvido (`history` + fallback para `regularMarketPrice`);
- gravação de novo snapshot em `investments_positions` via `insertPositionSnapshot` com:
	- `source: 'brapi_auto'`
	- `actionType: 'auto_refresh_brapi'`
	- `marketPrice` atualizado
	- `marketValue = quantity * marketPrice`

Isso garante que, fora da janela BRAPI, o fallback em métricas use preço persistido e não fique congelado no aporte.

### 4.2 Logs estratégicos para auditoria de perda de rendimento
Arquivo alterado: `server/src/core/investments/metrics-registry.js`

Adicionado log financeiro **apenas quando há condição suspeita** no Patrimônio:
- RV com ticker e posição aberta,
- sem histórico BRAPI no cálculo,
- usando fallback de preço.

Campos de auditoria registrados:
- contagem RV com ticker / com histórico / em fallback;
- amostra (asset/ticker/data/preços) para identificar o ponto de perda.

## 5) Conformidade com BASE_INVESTIMENTOS (seção 15)
- Não houve quebra da janela oficial (12:00 e 20:00, dias úteis, `America/Sao_Paulo`).
- Não houve bypass automático da policy em métricas/cards.
- A correção reforça a política: atualização externa continua no scheduler oficial; métricas passam a consumir estado persistido atualizado.

## 6) Validação técnica executada
- `get_errors` sem erros nos arquivos alterados.
- Revisão de fluxo confirma:
	- BRAPI manual continua isolada (`policyBypass` apenas no endpoint manual);
	- atualização automática passa a impactar posição persistida e valuation.

## 7) Arquivos alterados nesta etapa
- `server/src/core/investments/brapi-auto-update-scheduler.js`
- `server/src/core/investments/metrics-registry.js`

## 8) Resultado esperado após execução de slot oficial
- Próximo ciclo oficial (12h/20h) grava snapshots com `marketPrice` atualizado para RV elegível.
- Card **Patrimônio Total** passa a refletir rendimento real de mercado de RV no fallback entre slots.
- Logs passam a permitir auditoria objetiva de eventual perda de rendimento.

## 9) Correções complementares (Problema 2 e Problema 3)

### 9.1 Problema 2 — ativo ausente em Rentabilidade Consolidada
Arquivo alterado: `server/src/core/investments/metrics-registry.js`

Causa observada:
- a lista de itens de RV/RF na Rentabilidade Consolidada filtrava apenas `endValue > 0`.
- em cenários com fallback de preço/estado parcial, o ativo podia ficar com `endValue` zerado e ser excluído da lista, mesmo tendo atividade no período.

Correção aplicada:
- novo critério de relevância para listagem consolidada (`endValue`, `openEndValue`, `startValue` ou movimentação no período);
- ordenação por contribuição absoluta para priorizar impacto (positivo/negativo);
- log estratégico quando ativos de RV são excluídos por ausência total de valor/atividade.

Efeito esperado:
- ativo relevante deixa de "sumir" da visão consolidada por causa de filtro estrito em `endValue`.

### 9.2 Problema 3 — ROI Real igual ao ROI Nominal
Arquivo alterado: `server/src/core/investments/metrics-registry.js`

Causa observada:
- o deflator de inflação podia virar `0` quando a consulta BRAPI retornava vazio no recorte estrito `start/end` do período, mantendo ROI Real igual ao nominal.

Correção aplicada:
- resolução de inflação acumulada com fallback de janela estendida (até 18 meses para trás),
- recorte mensal por intervalo efetivo (`startMonth` até `ipcaCutoffMonth`),
- aplicação da fórmula de Fisher com esse acumulado,
- log de diagnóstico no `financial_result` com `inflationPct`, `roiNominalPct` e `roiRealPct`.

Efeito esperado:
- quando houver IPCA disponível para o intervalo efetivo, `ROI Real` passa a divergir corretamente do `ROI Nominal`.
- quando não houver IPCA publicado para o recorte, a resposta mantém transparência via aviso de indisponibilidade.

## 10) Arquivos alterados (consolidação final)
- `server/src/core/investments/brapi-auto-update-scheduler.js`
- `server/src/core/investments/service.js`
- `server/src/core/investments/metrics-registry.js`
