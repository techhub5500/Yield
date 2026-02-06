/**
 * @module agents/memory/summarizer
 * @description Agente de IA para resumir ciclos de memória.
 * 
 * Modelo: GPT-5-nano (sem reasoning/verbosity)
 * Tarefa: Resumir ciclo preservando valores numéricos, datas e decisões.
 * Justificativa: Tarefa simples e repetitiva, alto volume, baixo custo de erro.
 * 
 * PONTO DE IA conforme constituição — separado da lógica.
 */

const ModelFactory = require('../../utils/ai/model-factory');
const logger = require('../../utils/logger');

const SYSTEM_PROMPT = `Você é um assistente de síntese de memória.

Sua tarefa é resumir uma interação (pergunta do usuário + resposta da IA) em um resumo conciso.

REGRAS ABSOLUTAS:
1. PRESERVE todos os valores numéricos exatos (R$ 150,00, 30%, etc.)
2. PRESERVE todas as datas e períodos mencionados
3. PRESERVE decisões importantes tomadas pelo usuário
4. PRESERVE metas financeiras e limites declarados
5. PRESERVE nomes de categorias, ativos e instituições financeiras
6. O resumo deve ter no MÁXIMO 80 palavras
7. Use linguagem direta e objetiva
8. NÃO adicione informações que não estão no ciclo original

Retorne APENAS o resumo, sem formatação especial.`;

/**
 * Resume um ciclo completo de interação.
 * @param {Object} cycle - Ciclo com { userInput, aiResponse, timestamp }
 * @returns {Promise<string>} Resumo do ciclo
 */
async function summarizeCycle(cycle) {
  const nano = ModelFactory.getNano();

  const userPrompt = [
    `CICLO DE INTERAÇÃO (${cycle.timestamp}):`,
    ``,
    `USUÁRIO: ${cycle.userInput}`,
    ``,
    `IA: ${cycle.aiResponse}`,
    ``,
    `Resuma esta interação de forma concisa.`,
  ].join('\n');

  try {
    const summary = await nano.complete(SYSTEM_PROMPT, userPrompt, {
      maxTokens: 200,
      temperature: 0.2,
    });

    logger.ai('DEBUG', 'MemorySummarizer', `Ciclo ${cycle.id} resumido com sucesso`);
    return summary.trim();
  } catch (error) {
    // FALLBACK: preservar ciclo completo como string se IA falhar
    logger.error('MemorySummarizer', 'ai', `Falha ao resumir ciclo ${cycle.id}, usando fallback`, {
      error: error.message,
    });

    return `[${cycle.timestamp}] Usuário: ${cycle.userInput} | IA: ${cycle.aiResponse}`;
  }
}

module.exports = { summarizeCycle };
