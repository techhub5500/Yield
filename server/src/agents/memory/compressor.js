/**
 * @module agents/memory/compressor
 * @description Agente de IA para comprimir memória antiga.
 * 
 * Modelo: GPT-5.2 (Reasoning: High, Verbosity: Low)
 * Tarefa: Comprimir resumos antigos mantendo informações críticas.
 * Justificativa: Decisão crítica (o que preservar/descartar), alto custo de erro.
 * 
 * PONTO DE IA conforme constituição — separado da lógica.
 */

const ModelFactory = require('../../utils/ai/model-factory');
const { countWords } = require('../../core/memory/counter');
const config = require('../../config');
const logger = require('../../utils/logger');

const SYSTEM_PROMPT = `Você é um compressor de memória financeira.

Sua tarefa é comprimir múltiplos resumos de interações em uma narrativa única e densa.

O QUE PRESERVAR (NUNCA apague):
1. Metas financeiras do usuário (guardar R$ X para Y, etc.)
2. Limites e alertas configurados (teto de gastos, alertas de desvio)
3. Preferências declaradas (perfil de investidor, categorias prioritárias)
4. Decisões importantes (cancelar assinatura, aumentar aporte, etc.)
5. Valores monetários exatos e datas importantes
6. Status de dívidas ou investimentos em andamento
7. Padrões de comportamento identificados

O QUE PODE SER DESCARTADO:
1. Saudações e amenidades conversacionais
2. Detalhes de interação que não afetam decisões futuras
3. Informações repetidas (manter apenas a versão mais recente)
4. Explicações pedagógicas já absorvidas

FORMATO:
- Texto corrido em parágrafos curtos
- Agrupe informações por tema (gastos, investimentos, metas)
- Máximo: ${config.memory.maxCompressedWords} palavras
- Alvo ideal: ${config.memory.compressionTarget} palavras

Retorne APENAS o texto comprimido, sem marcadores ou títulos.`;

/**
 * Comprime resumos antigos de memória.
 * @param {Array<{content: string, timestamp: string}>} oldSummaries - Resumos a comprimir
 * @returns {Promise<string>} Memória comprimida
 */
async function compressMemory(oldSummaries) {
  const full = ModelFactory.getFull('high', 'low');

  const summariesText = oldSummaries
    .map((s, i) => `[Resumo ${i + 1} - ${s.timestamp}]: ${s.content}`)
    .join('\n\n');

  const userPrompt = [
    `RESUMOS ANTIGOS PARA COMPRIMIR (${oldSummaries.length} resumos):`,
    ``,
    summariesText,
    ``,
    `Comprima estes resumos em uma narrativa única de no máximo ${config.memory.maxCompressedWords} palavras.`,
  ].join('\n');

  try {
    const compressed = await full.complete(SYSTEM_PROMPT, userPrompt, {
      maxTokens: 2000,
      temperature: 0.2,
    });

    const result = compressed.trim();
    const wordCount = countWords(result);

    // Validação: garantir que output não excede o limite
    if (wordCount > config.memory.maxCompressedWords) {
      logger.warn('MemoryCompressor', 'ai', `Compressão excedeu limite: ${wordCount} palavras (max: ${config.memory.maxCompressedWords})`);
      // Ainda retorna — será recomprimido no próximo ciclo se necessário
    }

    logger.ai('INFO', 'MemoryCompressor', `Memória comprimida: ${oldSummaries.length} resumos → ${wordCount} palavras`);
    return result;
  } catch (error) {
    // FALLBACK: concatenar resumos como estão, sem perder dados
    logger.error('MemoryCompressor', 'ai', 'Falha na compressão, preservando resumos originais', {
      error: error.message,
    });

    return oldSummaries.map(s => s.content).join(' | ');
  }
}

module.exports = { compressMemory };
