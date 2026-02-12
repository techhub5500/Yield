# Produto — Lançamento Manual de Investimentos

## Visão do Produto
O lançamento manual permite que o usuário registre ativos reais da sua carteira e mantenha o painel de patrimônio alinhado ao que ele tem no banco/corretora.

Objetivos da experiência:

- Cadastro guiado e simples.
- Terminologia não técnica.
- Rastreabilidade das movimentações.
- Recalcular patrimônio automaticamente após cada evento.

## Estrutura de Dados (Backend)
A modelagem continua em três camadas:

1. **Cadastro do ativo**: identificação do ativo (`assetClass`, `category`, `name`, metadados).
2. **Posição**: snapshot da posição em uma `referenceDate`.
3. **Movimentação**: evento de carteira que explica a evolução da posição.

Todo dado é vinculado ao `userId` autenticado.

## Correção Estrutural do Cadastro
Não existe mais formulário único para todas as classes.

O fluxo de cadastro muda dinamicamente conforme:

- Classe escolhida.
- Tipo/subtipo escolhido.

Cada classe possui campos obrigatórios e opcionais próprios, com validações específicas.

## UX de Cadastro
Todos os campos exibem texto auxiliar abaixo do input com:

- O que significa o campo.
- Como preencher na prática.
- Linguagem clara para usuário final.

## Formulários por Classe de Ativo

### 1) Renda Variável (Ações, FIIs, ETFs, BDRs)
Base de cálculo: **Quantidade × Preço Unitário**.

Campos:

- Ticker (obrigatório)
- Tipo de operação (Compra, Venda, Bonificação, Grupamento/Desdobramento)
- Data da operação
- Quantidade
- Preço unitário
- Taxas (opcional)
- Corretora (opcional)

### 2) Renda Fixa (CDB, LCI, LCA, Tesouro, Debêntures)
Base de cálculo: **Indexador + Prazo**.

Campos:

- Nome do ativo/emissor
- Valor aplicado
- Indexador (CDI, IPCA, Pré-fixado, SELIC)
- Taxa do ativo
- Data de aplicação
- Data de vencimento
- Liquidez (No Vencimento ou Diária)
- Instituição/corretora (opcional)

### 3) Fundos (Multimercado, Ações, Cambial, Previdência)
Base de cálculo: **valor da transação e, opcionalmente, cotas**.

Campos:

- Nome do fundo/CNPJ
- Valor da transação
- Quantidade de cotas (opcional)
- Data da cotização
- Tipo (Aplicação ou Resgate)

### 4) Criptoativos (BTC, ETH, etc.)
Base de cálculo: **Quantidade (alta precisão) × Preço Unitário**.

Campos:

- Ativo (ticker)
- Data da operação
- Quantidade (até 8 casas decimais)
- Moeda de compra (BRL ou USD)
- Preço unitário
- Taxa da exchange (opcional)
- Exchange (opcional)

## Edição como Evento de Carteira (Nova Movimentação)
Edição não altera “total” diretamente.

Toda alteração entra como nova movimentação:

1. **Compra/Aporte**
	- Aumenta posição.
	- Recalcula preço médio.

2. **Venda/Resgate**
	- Reduz posição.
	- Registra resultado realizado (lucro/prejuízo).

3. **Proventos (Dividendos/JCP)**
	- Registra entrada de caixa.
	- Não altera preço médio ou quantidade.

4. **Atualizar Saldo Atual (Renda Fixa)**
	- Corrige posição pelo saldo informado no app do banco.
	- Calcula rendimento automático no período.

5. **Apagar Ativo por Completo**
	- Remove o ativo e todo o histórico de posições e transações.
	- Exige confirmação explícita digitando "APAGAR AGORA".
	- Operação destrutiva e definitiva.

O usuário escolhe o ativo e seleciona o evento para atualizar seu patrimônio sem erro de cálculo no histórico.

2. **Venda/Resgate**
	- Reduz posição.
	- Registra realizado da operação.

3. **Proventos (Dividendos/JCP)**
	- Lança valor recebido com data.
	- Não altera preço médio.

4. **Atualizar Saldo Atual (Renda Fixa)**
	- Usuário informa saldo atual visto no banco.
	- Sistema calcula diferença versus saldo anterior.

## Fluxo da Interface (Modal)
Entrada pelo botão `+` no card de patrimônio.

### Cadastro
1. Escolher classe.
2. Escolher subtipo.
3. Preencher formulário específico da classe.

### Nova Movimentação
1. Buscar ativo do usuário.
2. Escolher tipo de movimentação permitido para a classe.
3. Preencher dados da movimentação.

Ao salvar, o card de patrimônio é atualizado imediatamente.

## Consistência e Evolução
Princípios preservados:

- Vínculo obrigatório por usuário em todas as operações.
- Fluxo progressivo com validação por etapa.
- Persistência em trilha histórica (ativo + posição + movimentação).
- Estrutura preparada para novos subtipos e regras fiscais futuras.
