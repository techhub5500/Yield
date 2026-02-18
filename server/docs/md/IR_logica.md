# Card de Imposto de Renda — Lógica de Funcionamento e Integração

**Yield Server · Documento Interno · Versão 1.0**

> ⚠️ **Atenção:** Os valores exibidos no layout de referência são **fictícios** e servem apenas para validação visual. Todos os dados devem ser substituídos por cálculos dinâmicos baseados nas movimentações reais do usuário autenticado.

---

## 1. Visão Geral do Card

O card de Imposto de Renda é uma seção dedicada à provisão fiscal do portfólio do usuário. Seu objetivo é oferecer clareza sobre quanto de IR foi ou será devido, organizado por categoria tributária, com drill-down por ativo. O card não substitui a declaração oficial, mas funciona como uma ferramenta de planejamento e monitoramento contínuo.

O card opera em dois modos principais:

- **A Realizar:** exibe o IR estimado com base nas posições e movimentações abertas/não liquidadas. Útil para antecipar obrigações futuras.
- **Realizado:** exibe o IR efetivamente incidido sobre eventos já concluídos (resgates, vendas, vencimentos) no período selecionado.

Os filtros de período — **MTD** (mês corrente), **YTD** (ano corrente) e **12M** (últimos 12 meses) — determinam a janela de análise e devem ser respeitados por todos os cálculos do card.

---

## 2. Estrutura de Navegação por Nível

O card é organizado em dois níveis de agregação com navegação drill-down. O usuário parte sempre da visão consolidada e pode aprofundar em qualquer categoria.

### Nível 1 — Consolidado

A raiz do card. Exibe os KPIs gerais de todo o portfólio e uma tabela com uma linha por categoria tributária. As categorias são:

- Renda Fixa Tributada
- Renda Fixa Isenta
- Ações Swing Trade
- Ações Day Trade
- Fundos Imobiliários (FIIs)
- Fundos de Investimento

Cada linha da tabela é clicável e leva ao Nível 2 da categoria correspondente.

### Nível 2 — Por Categoria

Exibe KPIs específicos da categoria selecionada e uma tabela com uma linha por ativo pertencente àquela categoria. As linhas de ativo não são clicáveis neste momento (podem ser evoluídas para um Nível 3 futuramente).

Cada nível possui um botão de voltar que retorna ao nível anterior sem recarregar a página. O histórico de navegação deve ser mantido em memória durante a sessão.

---

## 3. KPIs e Suas Fontes de Dados

Todos os indicadores descritos abaixo devem ser calculados no backend e entregues pelo endpoint de métricas. O frontend apenas renderiza os valores recebidos.

### KPIs Principais (Nível 1 — Consolidado)

| KPI | Descrição | Fonte / Fórmula |
|---|---|---|
| IR Provisionado | Total de IR estimado a pagar ou reter no período | Soma de IR estimado por categoria, calculado sobre rendimentos/ganhos do período filtrado |
| Resultado Líquido | Rendimentos totais após dedução do IR estimado | Soma de rendimentos brutos de todas as categorias menos IR Provisionado |
| Base de Cálculo | Total de rendimentos tributáveis no período | Soma dos rendimentos brutos das categorias tributadas (exclui isentos) |
| Já Retido / Pago | IR que já saiu — retido na fonte ou DARF pago | Leitura de `metadata.irrf` em transactions + DARFs registrados pelo usuário |
| A Recolher (DARF) | IR de renda variável ainda não recolhido | IR Provisionado de RV menos IRRF dedo-duro já retido |
| Alíquota Média | Taxa efetiva ponderada do portfólio | IR Provisionado dividido pela Base de Cálculo total |

### KPI Especial — Prejuízo Acumulado em RV

Exibido como um bloco de destaque, não como KPI numérico padrão. Representa o saldo de perdas em renda variável disponível para compensação contra ganhos futuros. O valor deve ser mantido como estado persistente por usuário — não se zera com filtro de período.

Regra de segregação obrigatória:

- Prejuízo de swing trade compensa apenas ganhos de swing trade
- Prejuízo de day trade compensa apenas ganhos de day trade
- Prejuízo de FIIs compensa apenas ganho de capital de FIIs
- As três "caixinhas" são independentes e nunca se mesclam

---

## 4. Lógica de Cálculo por Categoria Tributária

### 4.1 Renda Fixa Tributada

**Produtos:** CDB, RDB, Tesouro Direto, LF, Letras Financeiras, Debêntures comuns.

O IR é calculado sobre o rendimento bruto do ativo dentro da janela de período selecionada. A alíquota é determinada pela tabela regressiva com base no **tempo total decorrido desde o primeiro aporte** — não desde o início do período filtrado. Isso é importante: o prazo para enquadramento na faixa de alíquota é o prazo do investimento, não do filtro.

**Faixas da tabela regressiva:**

| Prazo | Alíquota |
|---|---|
| Até 180 dias | 22,5% |
| 181 a 360 dias | 20,0% |
| 361 a 720 dias | 17,5% |
| Acima de 720 dias | 15,0% |

O IR é retido na fonte pela instituição financeira no momento do resgate ou vencimento. O campo `metadata.irrf` em cada transação de resgate deve registrar o valor efetivamente retido.

> ℹ️ O cálculo deve usar os mesmos métodos de valorização já existentes na plataforma (prefixado, CDI, IPCA+) descritos na documentação base. A base tributável é o rendimento acumulado no período, que já é calculado pelos cards existentes.

---

### 4.2 Renda Fixa Isenta

**Produtos:** LCI, LCA, CRI, CRA, Debêntures Incentivadas (somente PF).

Não há cálculo de IR. O card deve:

- Exibir o rendimento bruto acumulado como resultado líquido (são a mesma coisa)
- Calcular e mostrar o **benefício fiscal equivalente**: quanto seria o IR se o mesmo rendimento fosse tributado à alíquota regressiva aplicável ao prazo do ativo
- Identificar o tipo do ativo pelo campo `assetClass` e `subclass/taxType` nos metadados

> ⚠️ **PJ não tem isenção** em LCI, LCA, CRI e CRA — usa a tabela regressiva padrão. O card deve verificar se o usuário está configurado como PF ou PJ. Se PJ, esses produtos entram na categoria tributada.

---

### 4.3 Ações — Swing Trade

A apuração de IR em ações swing trade é **mensal** e segue regras específicas que exigem estado persistente por usuário e por mês.

**Regra da isenção de R$ 20.000:**

- Se o total de vendas no mês for menor ou igual a R$ 20.000, o resultado é isento, independentemente do lucro obtido
- Se o total de vendas no mês superar R$ 20.000, o ganho líquido integral é tributado à alíquota de **15%**

O ganho líquido é calculado como: receita das vendas menos o custo médio de aquisição das ações vendidas, menos corretagens e taxas operacionais aplicáveis.

**Compensação de prejuízos:** prejuízos de meses anteriores (swing trade) reduzem a base tributável do mês corrente antes da aplicação da alíquota. O saldo de prejuízo nunca expira e deve ser carregado indefinidamente até ser consumido por ganhos futuros.

**IRRF (dedo-duro):** a corretora retém 0,005% sobre o valor da venda quando há ganho no mês. Esse valor é abatido do DARF a recolher.

> ℹ️ O DARF deve ser recolhido pelo próprio investidor até o **último dia útil do mês seguinte** ao ganho. O card deve alertar sobre essa obrigação e o prazo, mas não deve emitir o DARF (integração futura).

---

### 4.4 Ações — Day Trade

Day trade segue a mesma lógica de apuração mensal, mas com diferenças críticas:

- Alíquota: **20%** (não 15%)
- **Sem isenção** de R$ 20.000 — qualquer ganho é tributado
- IRRF: **0,015%** sobre o valor da venda (maior que o swing)
- Prejuízo acumulado em day trade só compensa ganhos de day trade — nunca de swing

Internamente, o sistema precisa distinguir operações day trade (abertura e fechamento no mesmo dia) de swing trade. Essa classificação deve vir do campo `metadata.operationType` nas transactions ou ser derivada das datas de compra e venda.

---

### 4.5 Fundos Imobiliários (FIIs)

FIIs têm dois fluxos tributários distintos e o card deve tratá-los separadamente:

**Dividendos (rendimentos distribuídos):**
- Isentos de IR para PF, desde que o fundo tenha mais de 50 cotistas, cotas em bolsa e o investidor tenha menos de 10% do fundo
- Para o investidor comum, a isenção pode ser assumida por padrão
- Exibir como rendimento líquido isento

**Ganho de capital (venda de cotas):**
- Alíquota: **20%** sobre o lucro
- **Sem isenção** de R$ 20.000 (benefício exclusivo de ações ordinárias)
- Compensação de prejuízos funciona apenas dentro da categoria FII
- IRRF: 0,005% sobre o valor da venda

O DARF de FIIs deve ser recolhido da mesma forma que ações: último dia útil do mês seguinte.

---

### 4.6 Fundos de Investimento

Fundos têm tributação variável conforme o tipo. O campo `metadata.fundType` deve classificar cada fundo em uma das categorias abaixo:

| Tipo | Alíquota | Come-Cotas | Observação |
|---|---|---|---|
| Fundos de Ações | 15% fixo | Não | IR apenas no resgate |
| Longo Prazo (MM, RF LP, Cambial) | Regressiva até 15% | 15% (mai/nov) | Complemento no resgate se aplicável |
| Curto Prazo (RF CP) | 22,5% a 20% | 20% (mai/nov) | Menor faixa é 20% |

**Come-cotas:** ocorre no último dia útil de maio e novembro. O sistema deve:

- Calcular o rendimento acumulado desde o último come-cotas
- Aplicar a alíquota mínima da categoria (15% LP, 20% CP)
- Registrar o valor como IR retido e reduzir a quantidade de cotas equivalente
- No resgate, calcular o complemento de IR se a alíquota final (pelo prazo) for maior que a alíquota do come-cotas

> ℹ️ Fundos de Ações **não sofrem come-cotas**. O IR é cobrado apenas no resgate, com alíquota fixa de 15%, independentemente do prazo.

---

## 5. Dados Necessários e Campos de Suporte

O card de IR consome dados das coleções já existentes na plataforma, com alguns campos adicionais a serem incorporados ao schema.

### Campos a adicionar nas coleções existentes

| Coleção | Campo | Tipo | Descrição |
|---|---|---|---|
| `investments_assets` | `metadata.taxType` | string | `taxable \| exempt \| equity \| fii \| fund_equity \| fund_lp \| fund_sp` |
| `investments_assets` | `metadata.taxExemptReason` | string | `LCI \| LCA \| CRI \| CRA \| DEB_INCENTIVADA` (só para isentos) |
| `investments_assets` | `metadata.personType` | string | `PF \| PJ` — determina isenção em renda fixa isenta |
| `investments_assets` | `metadata.fundType` | string | `equity \| long_term \| short_term` (só para fundos) |
| `investments_transactions` | `metadata.irrf` | number | Valor de IR retido na fonte nessa transação |
| `investments_transactions` | `metadata.operationType` | string | `swing \| daytrade` (para ações) |
| `investments_transactions` | `metadata.darfPaid` | boolean | Flag de DARF recolhido pelo usuário |

### Nova coleção sugerida — `ir_monthly_rv`

Para suportar a lógica de apuração mensal de renda variável (isenção de R$ 20k, compensação de prejuízos), é necessária uma coleção de estado mensal por usuário com os campos:

- `userId`
- `yearMonth` (ex: `"2025-11"`)
- `category`: `swing | daytrade | fii`
- `totalSales`: valor total de vendas no mês
- `grossGain`: ganho bruto do mês
- `prejudizoCompensado`: valor de prejuízo abatido neste mês
- `baseCalc`: base tributável efetiva após compensação
- `irDue`: IR calculado sobre a base
- `irrfRetained`: IRRF dedo-duro retido no mês
- `darfAmount`: DARF a recolher (irDue menos irrfRetained)
- `darfPaid`: boolean

O saldo de prejuízo acumulado por categoria deve ser mantido em uma coleção separada (`ir_carry_forward`), já que persiste além dos meses exibidos no filtro ativo.

---

## 6. Integração com a Arquitetura da Plataforma

O card de IR deve seguir exatamente o mesmo padrão arquitetural dos cards já existentes (Patrimônio, Rentabilidade, Resultado Financeiro, Alocação, Volatilidade).

### Registro de Métricas

Uma nova métrica deve ser registrada no registry com os aliases:

- `investments.income_tax`
- `investments.ir_provisionado`
- `investments.tax_provision`

O handler da métrica recebe os filtros normalizados (período, modo A Realizar / Realizado) e retorna um widget com a estrutura completa de dados que o frontend renderiza. Toda a lógica de cálculo fica no handler — o frontend não realiza cálculos.

### Rota de Consumo

O frontend consumirá a rota `POST /api/investments/cards/query` com um card de configuração similar aos demais:

```json
{
  "cardId": "card-ir",
  "title": "Imposto de Renda",
  "metricIds": ["investments.ir_provisionado"],
  "presentation": "table-drill"
}
```

Os filtros adicionais específicos do IR (`mode: "a_realizar" | "realizado"`) serão passados no objeto de filtros global da query, seguindo o padrão de normalização já existente em `core/investments/filters.js`.

### Estrutura do Widget Retornado

O widget retornado pelo backend deve conter:

- **`kpis`**: objeto com os valores dos indicadores principais (IRProvisionado, ResultadoLiquido, BaseCalculo, JaRetido, ARecolherDARF, AliquotaMedia)
- **`prejudizoCarry`**: objeto com saldo por categoria (swing, daytrade, fii)
- **`categories`**: array de objetos de categoria com dados para a tabela do Nível 1
- **`drill`**: mapa de `categoryId → array de ativos` com dados para a tabela do Nível 2
- **`alerts`**: array de mensagens de alerta contextuais para exibição no card
- **`period`**: objeto com a janela de período efetiva calculada

---

## 7. Refresh e Ciclo de Vida do Card

O card de IR deve ser registrado em `window.YieldInvestments.cards.ir` e participar do mesmo ciclo global de refresh dos demais cards. Isso significa:

- Após qualquer operação no modal de Lançamento Manual (create, edit, delete), o card deve recalcular automaticamente
- O controller deve expor o método `fetchAndRenderLiveData()` para participar do ciclo de refresh
- O card **não precisa de refresh automático por tempo** (diferente da Alocação) — seu recálculo é orientado a eventos

Na inicialização da página, o card pode carregar seus dados junto com os demais cards durante o `preloadManifest()`, ou de forma lazy quando o usuário navegar para a aba de IR.

---

## 8. Alertas e Disclaimers Obrigatórios

O card deve sempre exibir dois níveis de alerta:

### Alerta Fixo (sempre visível)

Um banner permanente no topo do card informando que os valores são estimativas e que o usuário deve consultar um contador para a declaração oficial. Esse alerta **não pode ser fechado ou ocultado** pelo usuário.

### Alertas Contextuais (dinâmicos)

Alertas específicos calculados pelo backend e entregues no array `alerts` do widget. Situações que devem gerar alertas:

- Ativo de renda fixa prestes a mudar de faixa da tabela regressiva nos próximos 30 dias
- DARF de renda variável com prazo de vencimento se aproximando
- Come-cotas estimado para o próximo evento (mai/nov) com valor e data
- Vendas acumuladas em ações próximas do limite de isenção de R$ 20.000 no mês corrente
- Prejuízo acumulado disponível para compensação (lembrete de que o saldo existe)

Os alertas são exibidos no nível de agregação onde são relevantes. Alertas globais aparecem no Nível 1; alertas de ativo específico aparecem apenas no drill-down da categoria correspondente.

---

## 9. O que o Card NÃO Cobre (Escopo Deliberado)

Para manter a confiabilidade das estimativas e evitar cálculos incompletos, o card não deve tentar cobrir:

- **Previdência privada (PGBL/VGBL):** regime tributário próprio com tabelas progressiva e regressiva independentes
- **Ativos internacionais e offshores:** legislação específica e complexidade elevada
- **Criptomoedas:** regras próprias, mudanças frequentes de legislação
- **Declaração completa de IR:** o card é provisão, não declaração
- **IOF:** incide apenas em resgates em menos de 30 dias; pode ser sinalizado como alerta contextual, mas não deve compor o IR Provisionado principal

Esses limites devem ser comunicados ao usuário de forma proativa, com sugestão de consultar um profissional para esses casos.

---

## 10. Simulador — Planejamento para Fase Futura

O simulador é uma evolução natural do card, a ser implementado em fase posterior. Esta seção documenta a intenção de design para orientar a arquitetura atual.

**Modos previstos:**

- **"Se eu resgatar hoje":** calcula IR e líquido de um ativo específico com base na data atual
- **"Melhor momento para resgatar":** linha do tempo de como o IR varia com o prazo para ativos de renda fixa, marcando as datas de mudança de faixa
- **"Planejamento de vendas em ações":** simulação de distribuição de vendas em múltiplos meses para otimizar o uso da isenção de R$ 20.000 e a compensação de prejuízos
- **"Comparativo CDB vs LCI/LCA":** calcula rentabilidade líquida de dois ativos considerando o impacto do IR

Para suportar o simulador futuramente, a arquitetura do handler de IR deve expor as funções de cálculo de forma **isolada** (sem depender de dados reais do usuário), permitindo chamadas com parâmetros hipotéticos.

---

*Yield Server — Documento de uso interno — Versão 1.0*