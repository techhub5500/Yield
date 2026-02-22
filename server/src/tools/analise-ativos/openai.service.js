const { OpenAI } = require('openai');
const aaConfig = require('../../config/analise-ativos.config');

class OpenAIService {
  constructor({ logger }) {
    this.logger = logger;
    this.client = aaConfig.openai.apiKey
      ? new OpenAI({ apiKey: aaConfig.openai.apiKey })
      : null;
  }

  ensureClient() {
    if (!this.client) {
      const error = new Error('OPENAI_API_KEY (ou GEMINE_API_KEY) não configurada');
      error.status = 500;
      throw error;
    }
  }

  async summarizeAnnotations(annotations = []) {
    this.ensureClient();

    const entries = annotations
      .map((item) => {
        const cardLabel = String(item.cardLabel || item.cardId || 'Card');
        const annotationText = String(item.annotationText || '').trim();
        if (!annotationText) return null;
        const snapshot = item.cardSnapshot && typeof item.cardSnapshot === 'object' ? item.cardSnapshot : {};
        return {
          role: 'user',
          content: `Anotação sobre ${cardLabel}:\n${annotationText}\n\nDados do card:\n${JSON.stringify(snapshot)}`,
        };
      })
      .filter(Boolean);

    if (!entries.length) {
      const error = new Error('Nenhuma anotação válida encontrada para resumir');
      error.status = 400;
      throw error;
    }

    entries.push({
      role: 'user',
      content: 'Gere um resumo completo e analítico de todas as anotações acima, por tópico, em português-BR. Entregue em Markdown com bullets objetivos.',
    });

    const response = await this.client.chat.completions.create({
      model: aaConfig.openai.model,
      messages: entries,
    });

    const text = String(response.choices?.[0]?.message?.content || '').trim();
    if (!text) {
      const error = new Error('Não foi possível gerar o resumo das anotações');
      error.status = 502;
      throw error;
    }

    this.logger.ai('INFO', 'OpenAIService', 'Resumo de anotações gerado com sucesso', {
      annotations: entries.length - 1,
      model: aaConfig.openai.model,
    });

    return { content: text, model: aaConfig.openai.model };
  }

  async generateBenchmark({ ticker, indexKey, sector, tavilyResults = [] }) {
    this.ensureClient();

    const contextText = Array.isArray(tavilyResults)
      ? tavilyResults
        .slice(0, 8)
        .map((row, idx) => {
          const title = row?.title || 'Fonte sem título';
          const snippet = row?.content || row?.snippet || row?.raw_content || '';
          const url = row?.url || row?.link || '';
          return `${idx + 1}) ${title}\n${snippet}\nFonte: ${url}`;
        })
        .join('\n\n')
      : '';

    const prompt = [
      `Ticker: ${ticker}`,
      `Setor: ${sector || 'Não informado'}`,
      `Indicador: ${indexKey}`,
      '',
      'Com base no contexto abaixo, informe o benchmark médio setorial no Brasil.',
      'Retorne exclusivamente JSON válido com este formato:',
      '{"value": number|null, "unit": "%|x|R$|pontos|outro", "text": "string curta"}',
      '',
      'Contexto pesquisado:',
      contextText || 'Sem contexto retornado pela busca.',
    ].join('\n');

    const response = await this.client.chat.completions.create({
      model: aaConfig.openai.model,
      messages: [
        {
          role: 'system',
          content: 'Você é um analista fundamentalista. Responda apenas JSON válido, sem markdown ou texto extra.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = String(response.choices?.[0]?.message?.content || '').trim();
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    const value = parsed && parsed.value !== undefined && Number.isFinite(Number(parsed.value))
      ? Number(parsed.value)
      : null;

    return {
      value,
      unit: String(parsed?.unit || '').trim() || 'outro',
      text: String(parsed?.text || '').trim() || 'Benchmark setorial estimado via Tavily + GPT-5-mini',
      model: aaConfig.openai.model,
      raw,
    };
  }

  async generateDossie({ ticker, contextByTopic = {} }) {
    this.ensureClient();

    const sections = Object.entries(contextByTopic)
      .map(([topic, rows]) => {
        const text = (rows || [])
          .slice(0, 6)
          .map((row, idx) => {
            const title = row?.title || 'Fonte sem título';
            const content = row?.content || row?.snippet || row?.raw_content || '';
            const url = row?.url || row?.link || '';
            return `${idx + 1}) ${title}\n${content}\nFonte: ${url}`;
          })
          .join('\n\n');

        return `## ${topic}\n${text || 'Sem resultados relevantes.'}`;
      })
      .join('\n\n');

    const response = await this.client.chat.completions.create({
      model: aaConfig.openai.model,
      messages: [
        {
          role: 'system',
          content: 'Você é um analista de governança corporativa. Produza um dossiê objetivo e factual em Markdown.',
        },
        {
          role: 'user',
          content: [
            `Gere um dossiê corporativo estruturado em Markdown para o ticker ${ticker}.`,
            'Organize nas seções: Governança, Estrutura Societária, Remuneração de Diretores, Riscos Regulatórios e Processos Judiciais Relevantes.',
            'No fim, inclua seção "Fontes" com URLs citadas.',
            '',
            'Contexto coletado:',
            sections,
          ].join('\n'),
        },
      ],
    });

    const content = String(response.choices?.[0]?.message?.content || '').trim();
    if (!content) {
      const error = new Error('Não foi possível gerar o dossiê');
      error.status = 502;
      throw error;
    }

    return { content, model: aaConfig.openai.model };
  }
}

module.exports = { OpenAIService };
