/**
 * @module config/analise-ativos.config
 * @description Constantes de configuração exclusivas da página analise_ativos.html.
 *
 * Todas as variáveis sensíveis (tokens, chaves de API) são lidas de process.env
 * para que nunca sejam expostas no código-fonte.
 *
 * TTLs numéricos (em segundos) são usados tanto nos índices TTL do MongoDB
 * quanto na lógica de invalidação de cache do brapi.service.js.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  // ── Tokens de API ──────────────────────────────────────────
  brapi: {
    token: process.env.BRAPI_API_KEY || process.env.BRAPI_TOKEN || '',
    baseUrl: 'https://brapi.dev/api',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || process.env.GEMINE_API_KEY || process.env.GEMINI_API_KEY || '',
    /** Modelo utilizado para geração de resumos e dossiê */
    model: 'gpt-5-mini',
  },

  tavily: {
    apiKey: process.env.TAVILY_API_KEY || '',
    searchDepth: 'advanced',
  },

  // ── TTLs (segundos) ────────────────────────────────────────
  ttl: {
    /** Cache de cotação e histórico intraday */
    quote: 30 * 60,          // 30 minutos
    /** Cache de módulos fundamentalistas */
    indices: 12 * 60 * 60,   // 12 horas
    /** Cache do dossiê por ticker */
    dossie: 7 * 24 * 60 * 60,    // 7 dias
    /** Cache de benchmark setorial */
    benchmark: 90 * 24 * 60 * 60, // 90 dias (~3 meses)
  },

  // ── Módulos Brapi usados pela página ──────────────────────
  brapiModules: {
    /** Índices fundamentalistas — P/L, P/VP, LPA, Market Cap, EV, PSR, EV/EBITDA */
    keyStats: 'defaultKeyStatistics',
    /** ROE, Margem Líquida, Crescimento de Receita/Lucro */
    financialData: 'financialData',
    /** Demonstrativo de resultados trimestral */
    incomeQuarterly: 'incomeStatementHistoryQuarterly',
    /** Balanço patrimonial trimestral */
    balanceQuarterly: 'balanceSheetHistoryQuarterly',
    /** Demonstrativo de resultados anual */
    incomeAnnual: 'incomeStatementHistory',
    /** Balanço patrimonial anual */
    balanceAnnual: 'balanceSheetHistory',
    /** Dividendos — usado para calcular DY manualmente */
    dividends: 'dividends',
    /** Perfil da empresa — setor, indústria, descrição */
    summaryProfile: 'summaryProfile',
  },

  // ── Ranges disponíveis nos gráficos ──────────────────────
  chartRanges: [
    { label: '1D',  range: '1d',  interval: '5m'  },
    { label: '5D',  range: '5d',  interval: '15m' },
    { label: '1M',  range: '1mo', interval: '1d'  },
    { label: '3M',  range: '3mo', interval: '1d'  },
    { label: '6M',  range: '6mo', interval: '1wk' },
    { label: '1A',  range: '1y',  interval: '1wk' },
    { label: '2A',  range: '2y',  interval: '1mo' },
    { label: '5A',  range: '5y',  interval: '1mo' },
  ],

  // ── Nomes das Collections MongoDB ─────────────────────────
  collections: {
    userSearches:   'aa_user_searches',
    annotations:    'aa_annotations',
    aiSummaries:    'aa_ai_summaries',
    indexCache:     'aa_index_cache',
    benchmarkCache: 'aa_benchmark_cache',
    dossieCache:    'aa_dossie_cache',
  },
};

module.exports = config;
