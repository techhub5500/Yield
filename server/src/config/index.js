/**
 * @module config
 * @description Configuração centralizada do sistema.
 * Carrega variáveis de ambiente e define constantes do sistema.
 * Lógica pura — sem IA.
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  // --- MongoDB ---
  mongodb: {
    uri: process.env.MONGODB_URI,
    dbName: process.env.MONGODB_DB_NAME || 'yield',
  },

  // --- OpenAI ---
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
  },

  // --- APIs Externas (Fase 2) ---
  apis: {
    serper: { apiKey: process.env.SERPER_API_KEY },
    brapi:  { apiKey: process.env.BRAPI_API_KEY },
    tavily: { apiKey: process.env.TAVILY_API_KEY },
  },

  // --- Modelos de IA ---
  models: {
    nano: 'gpt-5-nano',      // Placeholder até GPT-5-nano estar disponível
    mini: 'gpt-5-mini',      // Placeholder até GPT-5-mini estar disponível
    full: 'gpt-5.2',           // Placeholder até GPT-5.2 estar disponível
  },

  // --- Memória ---
  memory: {
    maxWords: 2500,
    compressionThreshold: 0.9,        // 90% do limite = 2250 palavras
    compressionTarget: 1000,          // Alvo pós-compressão: ~1000 palavras
    maxRecentCycles: 2,               // Últimos 2 ciclos completos
    maxCompressedWords: 1500,         // Máximo após compressão
  },

  // --- Servidor ---
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    env: process.env.NODE_ENV || 'development',
  },

  // --- Timeouts ---
  timeouts: {
    search: parseInt(process.env.SEARCH_TIMEOUT, 10) || 10000,
    agent: parseInt(process.env.AGENT_TIMEOUT, 10) || 80000,
    aiRetry: {
      maxRetries: 3,
      baseDelay: 1000,    // 1s, 2s, 4s (exponential backoff)
    },
  },

  // --- Caminhos de arquivos ---
  paths: {
    despesasJson: path.resolve(__dirname, '../../docs/jsons/lançamentos/despesas e receitas/despesas.json'),
    receitasJson: path.resolve(__dirname, '../../docs/jsons/lançamentos/despesas e receitas/receitas.json'),
    logsDir: path.resolve(__dirname, '../../logs'),
  },
};

module.exports = config;
