# Modulo Matematico (MathModule) — Explicacao Simples e Detalhada

## 1. Para que ele existe
O modulo matematico e o "motor de calculos" do sistema. Ele serve para fazer contas financeiras com precisao e devolver o resultado pronto para ser apresentado ao usuario, sem depender do raciocinio humano do modelo de IA.

Em resumo: a IA pede a conta, o modulo calcula, e a IA explica o resultado de forma clara.

---

## 2. Onde ele fica no projeto
Ele esta na Fase 3, dentro de:

- server/src/tools/math/index.js (interface do modulo)
- server/src/tools/math/financial.js (contas financeiras)
- server/src/tools/math/formatters.js (formatacao de moeda e percentuais)

---

## 3. Quando ele e usado
O modulo matematico entra em cena quando o usuario pede:
- projeções de aportes
- juros compostos
- calculo de VPL ou TIR
- Sharpe Ratio
- VaR
- qualquer simulacao numerica que precise de precisao

Esses pedidos sao tratados pelos coordenadores (principalmente Planejamento e Investimentos). Eles usam o modulo como ferramenta, em vez de "chutar" valores.

---

## 4. Como o modulo entra no fluxo (passo a passo)
1. O usuario pede algo que envolve calculo.
2. O Junior detecta que e complexo e escala.
3. O Orquestrador decide quais coordenadores vao atuar.
4. O coordenador escolhe a ferramenta MathModule e faz uma solicitacao de calculo.
5. O sistema executa o calculo real no MathModule.
6. O resultado volta para o coordenador.
7. O coordenador monta a resposta final (com explicacao e contexto).

Isso garante que os numeros sejam consistentes e nao inventados.

---

## 5. O que o modulo calcula (em linguagem simples)

### 5.1 Juros compostos
Calcula quanto um valor inicial vira ao longo do tempo com uma taxa mensal.
Exemplo: R$ 1.000 a 1% por 12 meses.

### 5.2 Projecao com aportes
Calcula o valor final quando existe aporte mensal fixo.
Exemplo: Aportar R$ 500 por 24 meses a 1% ao mes.

### 5.3 VPL (Valor Presente Liquido)
Mostra se um investimento compensa, comparando entrada e saidas ao longo do tempo.
Se o VPL for positivo, o investimento tende a ser bom.

### 5.4 TIR (Taxa Interna de Retorno)
Indica a taxa media de retorno de um investimento com varios fluxos.
Serve para comparar com outras taxas.

### 5.5 Sharpe Ratio
Mede o retorno ajustado ao risco. Um Sharpe maior indica melhor relacao risco/retorno.

### 5.6 VaR (Value at Risk)
Estima uma perda maxima esperada dentro de um nivel de confianca.
Exemplo: "Com 95% de confianca, a perda maxima e X".

---

## 6. Como os resultados voltam
O MathModule nao fala com o usuario diretamente. Ele devolve:
- o valor numerico
- a versao formatada em reais (R$)
- percentuais formatados

Depois disso, o coordenador monta a resposta em linguagem humana.

---

## 7. Precisao dos calculos
O modulo usa Decimal.js para evitar erros comuns de ponto flutuante.
Isso garante que valores financeiros fiquem corretos, mesmo com varias casas decimais.

Exemplo real validado no sistema:
- compoundInterest(1000, 0.01, 12) = R$ 1.126,83

---

## 8. Formato das respostas
Os formatadores garantem padrao brasileiro:
- Moeda: R$ 1.234,56
- Percentual: 12,34%
- Numero: 1.234.567

Isso evita respostas confusas ou com formatos estrangeiros.

---

## 9. Limites e cuidados
- Se a TIR nao convergir, o modulo devolve N/A.
- Valores muito grandes ainda sao calculados com precisao, mas podem gerar respostas longas.
- O modulo nao inventa dados: ele so calcula o que foi pedido.

---

## 10. Resumo em uma frase
O MathModule e o componente que faz contas financeiras com precisao, entrega valores formatados e permite que os coordenadores expliquem os resultados de forma clara ao usuario.
