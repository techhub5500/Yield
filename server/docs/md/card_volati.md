1. Volatilidade Anualizada

A volatilidade é o desvio padrão dos retornos. Para anualizá-la, é necessário ajustar a escala temporal.

Calcule os retornos diários (rᵢ):
Utilize a variação percentual (ou o log-retorno) entre o preço atual (Pₜ) e o preço do dia anterior (Pₜ₋₁):

rᵢ = (Pₜ − Pₜ₋₁) / Pₜ₋₁

Calcule o desvio padrão diário (σ_diário):
Aplique a fórmula do desvio padrão sobre a série de retornos do período selecionado (por exemplo, os últimos 12 meses).

Anualize o resultado:
Como a volatilidade cresce com a raiz quadrada do tempo, multiplique o desvio padrão diário pela raiz quadrada do número de dias úteis do ano (geralmente 252 no Brasil):

σ_anual = σ_diário × √252
​
 
2. Máximo Drawdown (Max DD)

Este índice não analisa a média, mas sim o pior momento da série. Ele mede a maior queda entre um pico e o vale subsequente.

Crie uma série de valor acumulado:
Simule a evolução de R$ 1,00 investido na carteira ao longo do tempo.

Calcule o pico histórico (Picoₜ):
Para cada dia t, identifique o maior valor que a carteira atingiu até aquele momento.

Calcule o drawdown diário (DDₜ):

DDₜ = (Valor_Atualₜ − Picoₜ) / Picoₜ

O máximo drawdown será o menor valor (mais negativo) observado nessa série de drawdowns ao longo do período analisado.

Encontre o Máximo: O menor valor (mais negativo) encontrado nessa série será o seu Máximo Drawdown.


3. Índice Sharpe

O Índice de Sharpe responde à pergunta: “O retorno obtido compensou o risco assumido?”

Defina o retorno da carteira (Rₚ):
A rentabilidade total acumulada no período analisado (por exemplo, 12 meses).

Defina o retorno livre de risco (R𝒻):
No Brasil, normalmente utiliza-se o CDI acumulado no mesmo período.

Aplique a fórmula:

Sharpe = (Rₚ − R𝒻) / σₚ

Onde σₚ é a volatilidade anualizada calculada no item 1.

4. Beta (β)

O Beta mede a correlação e a sensibilidade da carteira em relação a um índice de referência (como o IBOV).

Séries de dados necessárias:
Você precisa da série de retornos diários da carteira (Rₚ) e da série de retornos diários do benchmark (Rₘ).

Cálculo estatístico:
O Beta é calculado como a covariância entre os retornos da carteira e os retornos do mercado, dividida pela variância dos retornos do mercado:

β = Cov(Rₚ, Rₘ) / Var(Rₘ)

Interpretação:

β = 1 → A carteira tende a subir e cair na mesma proporção que o IBOV.

β = 1,5 → Se o IBOV subir 10%, a carteira tende a subir 15%. Se o IBOV cair 10%, a carteira tende a cair 15%.

β < 1 → A carteira é mais defensiva e oscila menos que o mercado.

Esse indicador é fundamental para entender se o desempenho da carteira vem de habilidade do gestor ou simplesmente da exposição ao risco de mercado.