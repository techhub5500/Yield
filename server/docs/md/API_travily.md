# Tavily

## 1. O que é a Tavily?

A Tavily se autodenomina a "camada de acesso à web para agentes de IA". Ela resolve o problema de fornecer dados atualizados e em tempo real para modelos de IA que, normalmente, possuem uma data de corte no treinamento (conhecimento limitado ao passado).

A principal diferença é que ela não retorna apenas links. Ela processa, filtra e limpa o conteúdo das páginas, entregando apenas o texto relevante para que o modelo de IA possa processar sem desperdiçar tokens com anúncios ou códigos HTML desnecessários.

---

## 2. A API da Tavily

A API é a ferramenta utilizada por desenvolvedores para conectar seus aplicativos à plataforma. Ela oferece diversos recursos:

### Busca otimizada para RAG (Retrieval-Augmented Generation)

Em vez de retornar milhares de resultados, a API foca nas fontes mais relevantes e já resumidas, permitindo que a IA gere respostas baseadas em fatos.

### Diferentes níveis de profundidade

- **Basic**: busca rápida e direta.  
- **Advanced**: busca mais profunda, analisando mais fontes para tarefas de pesquisa complexas.

### Extração de conteúdo

Além de realizar buscas, a API pode extrair o conteúdo completo de uma URL específica e convertê-lo em texto limpo ou Markdown.

### Filtros inteligentes

É possível:

- Filtrar por domínios específicos  
- Incluir ou excluir determinadas fontes  
- Solicitar uma resposta curta gerada por IA junto com os resultados da busca  

---

## 3. Principais diferenciais

### Baixa latência

A API é extremamente rápida, algo essencial para assistentes de chat em tempo real.

### Custo-benefício

É otimizada para reduzir o uso de tokens, pois não envia conteúdo desnecessário (como HTML pesado) para o modelo.

### Integração nativa

É recomendada como ferramenta padrão de busca por grandes frameworks de IA, como LangChain e LlamaIndex.

---

## 4. Exemplos de uso

### Chatbots de notícias

Permite que o bot tenha acesso a acontecimentos recentes, inclusive do mesmo dia.

### Pesquisa acadêmica ou de mercado

Automatiza a coleta de dados sobre concorrentes ou novos temas.

### Verificação de fatos (fact-checking)

Ajuda a conferir se uma afirmação feita pela IA possui base em fontes reais e atualizadas.

DOCUMENTAÇÃO:

npm i @tavily/core

Search the web

const { tavily } = require("@tavily/core");

const tvly = tavily({ apiKey: "tvly-YOUR_API_KEY" });
const response = await tvly.search("Who is Leo Messi?");

console.log(response);


> ## Documentation Index
> Fetch the complete documentation index at: https://docs.tavily.com/llms.txt
> Use this file to discover all available pages before exploring further.

# About

> Welcome to Tavily!

<Note>
  Looking for a step-by-step tutorial to get started in under 5 minutes? Head to our [Quickstart guide](/guides/quickstart) and start coding!
</Note>

## Who are we?

We're a team of AI researchers and developers passionate about helping you build the next generation of AI assistants.
Our mission is to empower individuals and organizations with accurate, unbiased, and factual information.

## What is the Tavily Search Engine?

Building an AI agent that leverages realtime online information is not a simple task. Scraping doesn't scale and requires expertise to refine, current search engine APIs don't provide explicit information to queries but simply potential related articles (which are not always related), and are not very customziable for AI agent needs. This is why we're excited to introduce the first search engine for AI agents - [Tavily](https://app.tavily.com).

Tavily is a search engine optimized for LLMs, aimed at efficient, quick and persistent search results. Unlike other search APIs such as Serp or Google, Tavily focuses on optimizing search for AI developers and autonomous AI agents. We take care of all the burden of searching, scraping, filtering and extracting the most relevant information from online sources. All in a single API call!

To try the API in action, you can now use our hosted version on our [API Playground](https://app.tavily.com/playground).

<Info>
  If you're an AI developer looking to integrate your application with our API, or seek increased API limits, [please reach out!](mailto:support@tavily.com)
</Info>

## Why choose Tavily?

Tavily shines where others fail, with a Search API optimized for LLMs.

<AccordionGroup>
  <Accordion title="Purpose-Built">
    Tailored just for LLM Agents, we ensure the search results are optimized for <a href="https://towardsdatascience.com/retrieval-augmented-generation-intuitively-and-exhaustively-explain-6a39d6fe6fc9">RAG</a>. We take care of all the burden in searching, scraping, filtering and extracting information from online sources. All in a single API call! Simply pass the returned search results as context to your LLM.
  </Accordion>

  <Accordion title="Versatility">
    Beyond just fetching results, the Tavily Search API offers precision. With customizable search depths, domain management, and parsing HTML content controls, you're in the driver's seat.
  </Accordion>

  <Accordion title="Performance">
    Committed to speed and efficiency, our API guarantees real-time and trusted information. Our team works hard to improve Tavily's performance over time.
  </Accordion>

  <Accordion title="Integration-friendly">
    We appreciate the essence of adaptability. That's why integrating our API with your existing setup is a breeze. You can choose our [Python library](https://pypi.org/project/tavily-python/), [JavaScript package](https://www.npmjs.com/package/@tavily/core) or a simple API call. You can also use Tavily through any of our supported partners such as [LangChain](/integrations/langchain) and [LlamaIndex](/integrations/llamaindex).
  </Accordion>

  <Accordion title="Transparent & Informative">
    Our detailed documentation ensures you're never left in the dark. From setup basics to nuanced features, we've got you covered.
  </Accordion>
</AccordionGroup>

## How does the Search API work?

Traditional search APIs such as Google, Serp and Bing retrieve search results based on a user query. However, the results are sometimes irrelevant to the goal of the search, and return simple URLs and snippets of content which are not always relevant. Because of this, any developer would need to then scrape the sites to extract relevant content, filter irrelevant information, optimize the content to fit LLM context limits, and more. This task is a burden and requires a lot of time and effort to complete. The Tavily Search API takes care of all of this for you in a single API call.

The Tavily Search API aggregates up to 20 sites per a single API call, and uses proprietary AI to score, filter and rank the top most relevant sources and content to your task, query or goal.
In addition, Tavily allows developers to add custom fields such as context and limit response tokens to enable the optimal search experience for LLMs.

Tavily can also help your AI agent make better decisions by including a short answer for cross-agent communication.

<Tip>
  With LLM hallucinations, it's crucial to optimize for RAG with the right context and information. This is where Tavily comes in, delivering accurate and precise information for your RAG applications.
</Tip>

## Getting started

[Sign up](https://app.tavily.com) for Tavily to get your API key. You get **1,000 free API Credits every month**. No credit card required.

<Card icon="key" href="https://app.tavily.com" title="Get your free API key" horizontal>
  You get 1,000 free API Credits every month. **No credit card required.**
</Card>

Head to our [API Playground](https://app.tavily.com/playground) to familiarize yourself with our API.

To get started with Tavily's APIs and SDKs using code, head to our [Quickstart Guide](/guides/quickstart) and follow the steps.

<Note>
  Got questions? Stumbled upon an issue? Simply intrigued? Don't hesitate! Our support team is always on standby, eager to assist. Join us, dive deep, and redefine your search experience! [Contact us!](mailto:support@tavily.com)
</Note>

> ## Documentation Index
> Fetch the complete documentation index at: https://docs.tavily.com/llms.txt
> Use this file to discover all available pages before exploring further.

# Quickstart

> Start searching with Tavily in under 5 minutes.

## Get your free Tavily API key

Head to the [Tavily Platform](https://app.tavily.com) and sign in (or create an account). Then, copy one of your API keys from your dashboard.

<Card icon="key" href="https://app.tavily.com" title="Get your free API key" horizontal>
  You get 1,000 free API Credits every month. **No credit card required.**
</Card>

## Install Tavily

Install the Tavily SDK in your language of choice.

<CodeGroup>
  ```bash Python theme={null}
  pip install tavily-python
  ```

  ```bash JavaScript theme={null}
  npm i @tavily/core
  ```
</CodeGroup>

## Start searching with Tavily

Run your first Tavily Search in 4 lines of code. Simply replace the API key in this snippet with your own.

<CodeGroup>
  ```python Python theme={null}
  from tavily import TavilyClient

  tavily_client = TavilyClient(api_key="tvly-YOUR_API_KEY")
  response = tavily_client.search("Who is Leo Messi?")

  print(response)
  ```

  ```js JavaScript theme={null}
  const { tavily } = require("@tavily/core");

  const tvly = tavily({ apiKey: "tvly-YOUR_API_KEY" });
  const response = await tvly.search("Who is Leo Messi?");

  console.log(response);
  ```

  ```bash cURL theme={null}
  curl -X POST https://api.tavily.com/search \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer tvly-YOUR_API_KEY" \
    -d '{"query": "Who is Leo Messi?"}'
  ```
</CodeGroup>

## Next steps

That's all it takes to start using Tavily's basic features!

If you want to learn how to implement more complex workflows in Python, check out our intermediate-level [Getting Started notebook](https://colab.research.google.com/drive/1dWGtS3u4ocCLebuaa8Ivz7BkZ_40IgH1).

Or, dive deep into our API and read about the different parameters on our [API Reference](/documentation/api-reference/introduction) page, and learn how to integrate natively with one of our [SDKs](/sdk).
