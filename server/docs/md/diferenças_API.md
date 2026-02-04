Este documento define as diretrizes para o uso das ferramentas de busca e dados. Os Agentes devem priorizar a ferramenta correta com base na natureza do dado (volátil, histórico ou técnico).

🚀 1. Serper.dev (O "Canivete Suíço")
Foco: Agilidade e fatos imediatos.

O Serper é a interface direta com o Google Search. Deve ser usado para buscas rápidas onde o objetivo é encontrar uma resposta direta ou uma notícia de última hora.

Melhor uso para:

Notícias factuais (Ex: "Preço da gasolina hoje em São Paulo").

Informações de empresas (Ex: "Quem é o CEO da Petrobras").

Tutoriais ou definições (Ex: "Como declarar dividendos no IR").

Prompting Style: Use termos de busca curtos e diretos (keywords).

Limitação: Não fornece análise profunda ou dados financeiros brutos formatados.

📈 2. Brapi (O Especialista em Mercado)
Foco: Dados financeiros estruturados e indicadores.

A Brapi é a fonte de verdade para o mercado financeiro brasileiro e global. Deve ser a primeira escolha para qualquer dado que envolva tickers de ações, moedas ou indicadores macroeconômicos.

Melhor uso para:

Cotações em tempo real: Ações (B3), FIIs, Criptomoedas e Moedas (USD, EUR).

Indicadores Econômicos: Taxa Selic, IPCA, IGP-M, CDI.

Fundamentos: P/L, DY (Dividend Yield), ROE e Balanços de empresas listadas.

Regra de Ouro: Se a query envolve um símbolo (ex: PETR4, BTC, SELIC), use obrigatoriamente a Brapi.

🧠 3. Tavily (O Analista Estratégico)
Foco: Pesquisa profunda, contexto e múltiplos ângulos.

O Tavily é um motor de busca otimizado para LLMs que filtra ruídos e traz apenas conteúdo relevante para análise. Ele "lê" as páginas e retorna o contexto necessário para relatórios complexos.

Melhor uso para:

Análises de Setor: "Tendências do mercado imobiliário para 2026".

Comparações complexas: "Vantagens competitivas da empresa X vs empresa Y".

Relatórios de Riscos: Pesquisar histórico de crises ou eventos geopolíticos que afetam investimentos.

Diferencial: Retorna conteúdo limpo e focado em pesquisa acadêmica/profissional, evitando anúncios e spam de SEO.