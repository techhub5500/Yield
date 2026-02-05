/**
 * Configurações do Sistema de Memória Contextual
 * Fase 2 - Sistema Multi-Agente
 */

module.exports = {
  // Limites de memória
  memory: {
    maxWords: 2500,                    // Limite máximo de palavras
    compressionThreshold: 0.90,        // 90% - gatilho de compressão
    targetAfterCompression: 0.40,      // 40% - meta após compressão
    recentCyclesCount: 2               // Quantidade de ciclos recentes mantidos intactos
  },
  
  // Configurações do GPT-5 Nano para resumos
  summarizer: {
    model: process.env.SUMMARIZER_MODEL || 'gpt-4o-mini',
    verbosity: 'low',
    reasoning: 'low',
    maxSummaryWords: 50,               // Máximo de palavras em resumos
    maxCompressedWords: 20,            // Máximo de palavras em compressão extrema
    timeout: 10000,                    // 10 segundos
    maxRetries: 1
  },
  
  // Persistência
  persistence: {
    autoSaveInterval: 30000,           // 30 segundos (fallback)
    retryAttempts: 3,
    retryDelay: 1000                   // 1 segundo entre tentativas
  },
  
  // Detecção de dados críticos
  criticalData: {
    enableAutoDetection: true,
    patterns: {
      financial_goals: [
        /quero\s+(juntar|economizar|poupar|guardar)/i,
        /minha\s+meta\s+[eé]/i,
        /objetivo\s+de/i,
        /até\s+(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/i,
        /meta\s+de\s+R?\$?\s*[\d.,]+/i,
        /economizar\s+R?\$?\s*[\d.,]+/i
      ],
      configured_limits: [
        /me\s+avise\s+(quando|se)/i,
        /limite\s+de/i,
        /não\s+(gastar|passar\s+de)/i,
        /alerta\s+quando/i,
        /máximo\s+de\s+R?\$?\s*[\d.,]+/i,
        /teto\s+de/i
      ],
      declared_preferences: [
        /prefiro/i,
        /não\s+gosto\s+de/i,
        /sempre\s+quero/i,
        /nunca\s+faça/i,
        /minha\s+preferência/i,
        /gosto\s+mais\s+de/i
      ],
      important_decisions: [
        /decidi/i,
        /vou\s+(cancelar|parar|começar|iniciar)/i,
        /a\s+partir\s+de\s+(hoje|agora|amanhã)/i,
        /resolvi/i,
        /optei\s+por/i,
        /escolhi/i
      ]
    }
  },

  // Valores calculados (não editar manualmente)
  get compressionThresholdWords() {
    return Math.floor(this.memory.maxWords * this.memory.compressionThreshold);
  },
  
  get targetWordsAfterCompression() {
    return Math.floor(this.memory.maxWords * this.memory.targetAfterCompression);
  }
};
