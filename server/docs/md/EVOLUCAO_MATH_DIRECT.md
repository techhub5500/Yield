# Evolucao da rota math_direct

## 1. Arquitetura anterior
Antes desta mudanca, o Junior nao tinha uma rota exclusiva para calculos matematicos puros. Quando o usuario pedia um calculo com todos os valores informados, a mensagem seguia caminhos alternativos (bridge_query, simple_response ou escalada).

## 2. Limitacao identificada
O sistema nao separava claramente:
- calculo puro com parametros completos
- consulta a dados pessoais
- analise contextual

Com isso, alguns calculos diretos eram resolvidos por rotas que nao foram feitas para esse tipo de pedido.

## 3. Justificativa da mudanca
A evolucao foi feita para:
- evitar escaladas desnecessarias
- impedir consultas ao banco quando nao precisa
- garantir que o MathModule seja usado de forma direta em calculos puros

## 4. Implementacao da nova rota
Foi criada a rota `math_direct`.

Fluxo:
Junior → Dispatcher → MathDirect → MathModule → ResponseAgent

## 5. Impacto no Dispatcher
O Dispatcher ganhou um novo handler `_handleMathDirect`, que:
- aciona o MathDirect
- nao consulta MongoDB
- nao escala para coordenadores

## 6. Impacto no Junior
O Junior passou a classificar como `math_direct` quando:
- a pergunta e exclusivamente de calculo
- todos os parametros estao explicitos
- nao ha contexto pessoal
- nao ha necessidade de dados do usuario

Calculos basicos ainda podem ser tratados por `simple_response`.

## 7. Ajustes realizados nos testes
Os testes 46 a 50 foram atualizados para:
- rota `math_direct`
- MathModule executado
- toolsExecuted > 0
- sem MongoDB
- sem escalada

## 8. Retrocompatibilidade garantida
Nenhuma rota existente foi removida.
Os fluxos atuais continuam funcionando como antes.
A mudanca e incremental e nao altera a arquitetura previa.
