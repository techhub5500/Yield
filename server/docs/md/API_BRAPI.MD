# Comece a Usar a API da brapi.dev
URL: /docs.mdx

Guia completo para começar a usar a API da brapi.dev. Aprenda sobre autenticação, endpoints principais e veja exemplos práticos para integrar dados financeiros do Brasil em suas aplicações.

***

title: 'Comece a Usar a API da brapi.dev'
description:
'Guia completo para começar a usar a API da brapi.dev. Aprenda sobre
autenticação, endpoints principais e veja exemplos práticos para integrar
dados financeiros do Brasil em suas aplicações.'
howToSteps:

* name: 'Obtenha sua chave de API (opcional para teste)'
  text: 'Para testar, use as 4 ações gratuitas (PETR4, MGLU3, VALE3, ITUB4) sem token. Para produção, crie uma conta no dashboard para gerar seu token.'
* name: 'Faça sua primeira requisição'
  text: 'Execute curl "[https://brapi.dev/api/quote/PETR4](https://brapi.dev/api/quote/PETR4)" no terminal para testar sem token, ou adicione o header Authorization: Bearer SEU\_TOKEN para acessar todas as ações.'
* name: 'Receba os dados em JSON'
  text: 'A API retorna um objeto JSON com array results contendo symbol, regularMarketPrice, regularMarketChangePercent e outros dados da cotação.'
  howToTools:
* 'Terminal ou linha de comando'
* 'cURL ou cliente HTTP'
* 'Navegador web'
  howToSupplies:
* 'Conta brapi.dev (opcional para teste)'
* 'Token de API brapi.dev (opcional para teste)'

***

import { Callout } from 'fumadocs-ui/components/callout';
import { Card, Cards } from 'fumadocs-ui/components/card';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';

<Callout title="O que é a brapi.dev?" type="info">
  A **brapi.dev** é uma API REST completa para o mercado financeiro brasileiro.
  Fornecemos dados em tempo real e históricos de ações, FIIs, BDRs, ETFs,
  criptomoedas, câmbio e indicadores econômicos. Nossos dados são obtidos de
  fontes oficiais: **B3** (cotações), **CVM** (demonstrações financeiras),
  **IBGE** (inflação) e **Banco Central do Brasil** (SELIC, câmbio).
</Callout>

Bem-vindo à documentação da **brapi.dev**. Nossa API foi projetada para ser
**simples, robusta e confiável**, permitindo que você integre dados financeiros
do mercado brasileiro em suas aplicações com o mínimo de esforço.

Este guia vai te mostrar como fazer sua primeira requisição em minutos.

## Teste Agora - Sem Cadastro!

Para facilitar o desenvolvimento e testes, você pode experimentar nossa API
**imediatamente** com estas 4 ações brasileiras populares - **sem precisar de
token ou cadastro**:

<Callout title="Ações de Teste Gratuitas" type="info">
  **PETR4** (Petrobras) • **MGLU3** (Magazine Luiza) • **VALE3** (Vale) •
  **ITUB4** (Itaú)
</Callout>

```bash title="Experimente agora mesmo!"
# Cotação simples - funciona sem token
curl "https://brapi.dev/api/quote/PETR4"

# Múltiplas ações com histórico
curl "https://brapi.dev/api/quote/PETR4,VALE3,MGLU3?range=1mo&interval=1d"

# Com dados fundamentalistas e dividendos
curl "https://brapi.dev/api/quote/ITUB4?fundamental=true&dividends=true"
```

Essas ações têm **acesso completo** a todos os recursos da API, incluindo dados
históricos, módulos avançados e dividendos!

<Steps>
  <Step>
    #### Obtenha sua Chave de API (Token) - Opcional para Teste

    **Para testar:** Use as 4 ações gratuitas (PETR4, MGLU3, VALE3, ITUB4) sem precisar de token.

    **Para produção:** Crie sua conta em nosso dashboard para gerar seu token e acessar todas as +4.000 ações disponíveis.

    <Callout title="Onde encontrar seu token?" type="info">
      Seu token estará disponível na seção "Chaves de API" do seu **[Dashboard](/dashboard)** após o login.
    </Callout>
  </Step>

  <Step>
    #### Faça sua Primeira Requisição

    **Teste sem token (ações gratuitas):**

    ```bash title="Terminal (cURL) - Teste Imediato"
    curl "https://brapi.dev/api/quote/PETR4"
    ```

    **Com token (todas as ações):**

    ```bash title="Terminal (cURL) - Produção"
    curl --request GET \
      --url 'https://brapi.dev/api/quote/PETR4' \
      --header 'Authorization: Bearer SEU_TOKEN'
    ```
  </Step>

  <Step>
    #### Receba os Dados

    Pronto! Você receberá uma resposta em formato JSON, estruturada e pronta para ser utilizada.

    ```jsonc title="Resposta da API (JSON)"
    {
      "results": [
        {
          "symbol": "PETR4",
          "shortName": "PETROBRAS PN",
          "longName": "Petróleo Brasileiro S.A. - Petrobras",
          "currency": "BRL",
          "regularMarketPrice": 38.50,
          "regularMarketDayHigh": 39.00,
          "regularMarketDayLow": 38.20,
          "regularMarketChange": 0.30,
          "regularMarketChangePercent": 0.78,
          "regularMarketTime": "2024-10-26T17:08:00.000Z",
          "marketCap": 503100000000,
          "regularMarketVolume": 45678901,
          "logourl": "https://icons.brapi.dev/logos/PETR4.png",
        }
      ]
    }
    ```
  </Step>
</Steps>

## Autenticação

Todas as requisições à API devem ser autenticadas. Recomendamos enviar seu token
através do header `Authorization` por ser mais seguro.

<Tabs items={['Header (Recomendado)', 'Query Param']}>
  <Tab value="Header (Recomendado)">`Authorization: Bearer SEU_TOKEN `</Tab>
  <Tab value="Query Param">`?token=SEU_TOKEN`</Tab>
</Tabs>

<Callout title="Atenção" type="warn">
  Nunca exponha seu token no código do lado do cliente (frontend). Em aplicações
  web, faça as chamadas para a API da brapi.dev a partir do seu backend.
</Callout>

## Principais Conceitos

* **URL Base:** Todas as requisições usam a URL base `https://brapi.dev/api`.
* **Múltiplos Ativos:** A maioria dos endpoints permite a consulta de múltiplos
  ativos em uma única requisição, separando os tickers por vírgula. Ex:
  `PETR4,VALE3,MGLU3`.
* **Módulos Adicionais:** Use o parâmetro `modules` para enriquecer suas
  respostas com dados fundamentalistas e mais (disponível conforme seu plano).

## Explore Nossos Endpoints

Navegue pelas seções para descobrir todos os dados que você pode acessar.

<Cards>
  <Card href="/docs/mcp" title="Servidor MCP para IAs" description="Integre dados financeiros brasileiros diretamente em assistentes de IA compatíveis com MCP." />

  <Card href="/docs/openapi" title="OpenAPI" description="Acesse a documentação da API em formato OpenAPI." />

  <Card href="/docs/examples" title="Exemplos" description="Veja exemplos práticos de como usar a API em diferentes cenários e linguagens." />

  <Card href="/docs/x402" title="Protocolo x402" description="Pague por requisição com USDC. Ideal para uso esporádico, agentes de IA e crypto-native." />

  <Card href="/docs/acoes" title="Ações e Fundos" description="Obtenha cotações, dados históricos, dividendos e fundamentos de Ações, FIIs, ETFs e BDRs." />

  <Card href="/docs/criptomoedas" title="Criptomoedas" description="Acesse cotações e informações das principais criptomoedas do mercado." />

  <Card href="/docs/moedas" title="Moedas (Câmbio)" description="Consulte taxas de câmbio atualizadas para mais de 50 pares de moedas." />

  <Card href="/docs/inflacao" title="Inflação" description="Acesse séries históricas de indicadores de inflação como IPCA e IGP-M." />

  <Card href="/docs/taxa-basica-de-juros" title="Taxa SELIC" description="Consulte a série histórica da taxa básica de juros do Brasil." />
</Cards>

## SDKs Oficiais

Use nossas bibliotecas oficiais para integração mais rápida e fácil com tipos completos e retry automático.

<Cards>
  <Card href="/docs/sdks/typescript" title="TypeScript / JavaScript" description="SDK oficial com tipos completos, suporte a Node.js e navegador. Instale com: npm install brapi" />

  <Card href="/docs/sdks/python" title="Python" description="SDK oficial Python 3.8+ com suporte síncrono e assíncrono. Instale com: pip install brapi" />
</Cards>

**Por que usar as SDKs?**

* ✅ **60% menos código** - Sintaxe simples e direta
* ✅ **Tipos completos** - IntelliSense e autocomplete
* ✅ **Retry automático** - Tratamento inteligente de falhas
* ✅ **Erros tipados** - Exceções específicas por status

## Exemplos Práticos

Veja como é fácil buscar dados em diferentes linguagens.

<Tabs items={['SDK TypeScript', 'SDK Python', 'cURL (Teste)', 'cURL (Produção)', 'Python Manual', 'JavaScript Manual']}>
  <Tab value="SDK TypeScript">
    ```typescript
    import Brapi from 'brapi';

    const client = new Brapi({
      apiKey: process.env.BRAPI_API_KEY,
    });

    // Buscar cotações - Tipos completos!
    const quote = await client.quote.retrieve('PETR4,VALE3');
    console.log(quote.results[0].regularMarketPrice);

    // Com múltiplos ativos
    const quotes = await client.quote.retrieve('ITUB4,BBDC4,MGLU3');
    quotes.results.forEach(stock => {
      console.log(`${stock.symbol}: R$ ${stock.regularMarketPrice}`);
    });
    ```

    📚 [Ver documentação completa da SDK TypeScript](/docs/sdks/typescript)
  </Tab>

  <Tab value="SDK Python">
    ```python
    from brapi import Brapi

    client = Brapi(api_key="seu_token")

    # Buscar cotações - Type hints completos!
    quote = client.quote.retrieve(tickers="PETR4,VALE3")
    print(quote.results[0].regular_market_price)

    # Com múltiplos ativos
    quotes = client.quote.retrieve(tickers="ITUB4,BBDC4,MGLU3")
    for stock in quotes.results:
        print(f"{stock.symbol}: R$ {stock.regular_market_price}")
    ```

    📚 [Ver documentação completa da SDK Python](/docs/sdks/python)
  </Tab>

  <Tab value="cURL (Teste)">
    ```bash
    # Teste imediato - ações gratuitas (sem token)
    curl "https://brapi.dev/api/quote/PETR4,MGLU3"

    # Com histórico e módulos avançados
    curl "https://brapi.dev/api/quote/VALE3?range=1mo&interval=1d&modules=summaryProfile"
    ```
  </Tab>

  <Tab value="cURL (Produção)">
    ```bash
    # Qualquer ação (com token)
    curl -H "Authorization: Bearer SEU_TOKEN" \
      "https://brapi.dev/api/quote/ITUB4,BBDC4?range=1mo&interval=1d"
    ```
  </Tab>

  <Tab value="Python Manual">
    ```python
    import requests

    # Para ações de teste (sem token)
    url = "https://brapi.dev/api/quote/PETR4,MGLU3"
    response = requests.get(url, params={"range": "1mo", "interval": "1d"})

    # Para outras ações (com token)
    token = "SEU_TOKEN"
    url = "https://brapi.dev/api/quote/ITUB4,BBDC4"
    response = requests.get(
        url,
        headers={"Authorization": f"Bearer {token}"},
        params={"range": "1mo", "interval": "1d"}
    )

    if response.status_code == 200:
        data = response.json()
        print(data['results'])
    else:
        print(f"Erro: {response.status_code}")
    ```
  </Tab>

  <Tab value="JavaScript Manual">
    ```javascript
    // Para ações de teste (sem token)
    const testUrl = 'https://brapi.dev/api/quote/PETR4,VALE3?range=1mo&interval=1d';

    async function fetchTestQuotes() {
      try {
        const response = await fetch(testUrl);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log(data.results);
      } catch (error) {
        console.error('Falha ao buscar cotações de teste:', error);
      }
    }

    // Para outras ações (com token)
    const token = 'SEU_TOKEN';
    const url = 'https://brapi.dev/api/quote/ITUB4,BBDC4?range=1mo&interval=1d';

    async function fetchQuotes() {
      try {
        const response = await fetch(url, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log(data.results);
      } catch (error) {
        console.error('Falha ao buscar cotações:', error);
      }
    }
    ```
  </Tab>
</Tabs>

## Próximos Passos

Agora que você já entendeu o básico, o que acha de explorar mais a fundo?

* **[Use nossas SDKs oficiais](/docs/sdks):** Integração mais rápida com tipos completos e retry automático (TypeScript e Python).
* **[Explore os endpoints de Ações](/docs/acoes):** A seção mais completa, com dados fundamentalistas e dividendos.
* **[Veja todos os exemplos](/docs/examples):** Descubra como aplicar a API em casos de uso mais complexos.

