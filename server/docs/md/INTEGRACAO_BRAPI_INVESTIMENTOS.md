# Integração Brapi na Seção de Investimentos

## 1) O que foi implementado

Foi implementado um fluxo complementar de integração com a Brapi para a área de investimentos, preservando o comportamento já existente.

Principais entregas:

- Consulta de ativo por ticker e data para o fluxo de Lançamento Manual.
- Consulta de ativo por `assetId` e data para o fluxo de Edição de ativo.
- Atualização da métrica do card de Patrimônio Total com suporte a histórico de preços via Brapi (quando o ativo possui ticker elegível).
- Cálculo de patrimônio total considerando:
  - valor dos ativos em aberto (não realizado), e
  - caixa realizado.
- Cálculo separado de resultado realizado e não realizado para exibição no card.
- Correção da regra de capital investido:
  - aumenta apenas em compras/aportes,
  - não diminui em vendas.
- Regras de ajuste de data para fim de semana:
  - sábado → sexta anterior,
  - domingo → segunda seguinte.
- Correção de parsing de datas históricas da Brapi (epoch e ISO com timezone).
- Uso de histórico no endpoint de quotes da Brapi para candles (`/api/quote/...` com `range` e `interval`).
- Atualização automática no frontend do preço sugerido ao informar/alterar data em lançamento manual e edição.

---

## 2) Como foi implementado

### 2.1 Backend (API e serviço)

Foram adicionadas duas rotas autenticadas em investimentos:

- `GET /api/investments/brapi/quote?ticker=...&date=YYYY-MM-DD`
  - Usada no Lançamento Manual antes da confirmação do ativo.
- `GET /api/investments/assets/:assetId/quote?date=YYYY-MM-DD`
  - Usada na Edição de movimentação, sem necessidade de confirmar ativo novamente.

No serviço de investimentos:

- Foi injetado o cliente da Brapi (via `searchManager.brapi`).
- Foram criados métodos para:
  - consultar ticker + data,
  - consultar ativo já cadastrado por `assetId` + data.
- A resolução do ticker foi padronizada a partir de `payload.ticker`, `metadata.ticker` ou nome do ativo.
- O ticker passou a ser persistido no cadastro do ativo para facilitar edição e cálculo do card.

### 2.2 Utilitários de integração Brapi

Foi criado um módulo utilitário para padronizar:

- normalização e validação de ticker,
- normalização e validação de datas ISO,
- ajuste de datas de fim de semana,
- extração do histórico diário de formatos variados de resposta da Brapi,
- seleção de preço para uma data alvo com fallback para data útil próxima,
- geração de âncoras mensais para série histórica do gráfico.

Também foi incluída geração adaptativa de pontos por janela temporal (não apenas mês fechado), para evitar gráfico achatado em filtros curtos.

### 2.3 Card Patrimônio Total

A métrica `investments.net_worth` foi evoluída para:

- consolidar posições, transações e cadastro de ativos;
- recalcular quantidade e preço médio por ativo com base no histórico de transações;
- buscar histórico diário da Brapi para ativos elegíveis (equity com ticker válido);
- calcular o valor da posição por data para formar a série do gráfico;
- separar:
  - caixa realizado,
  - resultado realizado,
  - resultado não realizado;
- calcular patrimônio total como:
  - **Patrimônio total = ativos em aberto + caixa realizado**.
- calcular `capital investido` como acumulado histórico de compras (sem redução por vendas).

Comportamento de período no gráfico:

- **Padrão**: início da carteira até a data atual.
- **Com filtro selecionado** (1M, 3M, 6M, 12M, 2A):
  - fim sempre na data atual,
  - início calculado retroativamente em janela rolante (ex.: 3M ≈ 89 dias, 12M = 365 dias, 2A = 730 dias).

Foi mantido fallback para ativos sem histórico/ticker elegível, utilizando os dados já existentes na base.

### 2.4 Frontend (modal e API do dashboard)

No frontend de investimentos:

- Foram adicionados métodos de API para chamar os novos endpoints da Brapi.
- No Lançamento Manual (classes com ticker):
  - ao digitar ticker/data, o frontend consulta automaticamente a Brapi;
  - exibe dados do ativo e preço da data;
  - exige confirmação do ativo antes de salvar;
  - ao confirmar, preenche automaticamente o preço unitário.
- Na Edição (`add_buy` e `add_sell`):
  - ao entrar na etapa de formulário e ao alterar a data, consulta a Brapi automaticamente;
  - aplica preço sugerido no campo de preço da movimentação.

---

## 3) Quais arquivos foram criados

- `server/src/core/investments/brapi-utils.js`
- `server/docs/md/INTEGRACAO_BRAPI_INVESTIMENTOS.md`

---

## 4) Quais arquivos foram alterados

Backend:

- `server/src/tools/search/brapi.js`
- `server/src/core/investments/repository.js`
- `server/src/core/investments/service.js`
- `server/src/api/routes/investments.js`
- `server/src/core/investments/metrics-registry.js`
- `server/src/index.js`

Frontend:

- `client/js/invest-dash.js`
- `client/js/invest-dash.manual-modal.js`

---

## 5) Fluxo completo da integração

### 5.1 Lançamento Manual

1. Usuário informa ticker e data de operação.
2. Frontend chama `GET /api/investments/brapi/quote`.
3. Backend consulta Brapi, aplica regra de ajuste de fim de semana e retorna preço de referência.
4. Frontend exibe dados do ativo para confirmação.
5. Após confirmação, preço unitário é preenchido automaticamente.
6. Usuário salva ativo.
7. Backend persiste ativo (incluindo ticker), posição inicial e transação inicial.
8. Frontend força atualização do card de patrimônio.

### 5.2 Edição de ativo

1. Usuário seleciona ativo existente.
2. Usuário escolhe operação (`add_buy` ou `add_sell`).
3. Ao informar/alterar data, frontend chama `GET /api/investments/assets/:assetId/quote`.
4. Backend resolve ticker do ativo e consulta Brapi para a data.
5. Frontend preenche automaticamente o preço sugerido.
6. Usuário confirma movimentação.
7. Backend grava transação e novo snapshot de posição.
8. Frontend atualiza o card de patrimônio.

### 5.3 Card Patrimônio Total

1. Frontend chama `POST /api/investments/cards/query`.
2. Métrica `investments.net_worth` consolida:
   - ativos,
   - transações,
   - posições atuais.
3. Para ativos elegíveis, backend consulta histórico da Brapi e aplica preços por data útil ajustada.
4. Sistema calcula:
   - valor em aberto por ativo,
   - série histórica para o gráfico,
   - caixa realizado,
   - resultado realizado e não realizado,
   - patrimônio total.
5. Widget retorna para o frontend e o card é renderizado automaticamente.

Detalhes técnicos relevantes:

- Histórico diário usa endpoint `/api/quote/...` da Brapi com `range` e `interval` explícitos.
- Datas históricas aceitam formatos epoch e ISO com timezone antes da normalização para `YYYY-MM-DD`.
- Série do gráfico considera evolução da posição e caixa realizado por data, não apenas o snapshot atual.

---

## 6) Compatibilidade e preservação do comportamento atual

- As rotas existentes de investimentos foram preservadas.
- O novo fluxo foi implementado como extensão complementar.
- Onde não houver ticker válido ou histórico aplicável, o sistema mantém fallback para dados já persistidos.
- Testes existentes do backend permanecem passando.
