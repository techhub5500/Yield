/**
 * @module utils/ai/model-factory
 * @description Factory para instanciar modelos de IA conforme a constituição.
 * 
 * Regra central: "Modelos grandes pensam, modelos pequenos executam."
 * 
 * - Full (GPT-5.2)  → Decide o QUE fazer e QUEM faz
 * - Mini (GPT-5-mini) → Executa COM inteligência local
 * - Nano (GPT-5-nano) → Prepara, valida, formata, escala
 * 
 * Nano NÃO suporta parâmetros de Reasoning Level ou Verbosity.
 */

const OpenAIClient = require('./openai-client');

const ModelFactory = {
  /**
   * Cria instância Nano — infraestrutura, conversão e alto volume.
   * NÃO aceita reasoning/verbosity conforme constituição.
   * @returns {OpenAIClient}
   */
  getNano() {
    return new OpenAIClient('nano');
  },

  /**
   * Cria instância Mini — execução inteligente com raciocínio local.
   * @param {string} reasoning - 'high' | 'medium' | 'low'
   * @param {string} verbosity - 'high' | 'low'
   * @returns {OpenAIClient}
   */
  getMini(reasoning = 'medium', verbosity = 'low') {
    return new OpenAIClient('mini', { reasoning, verbosity });
  },

  /**
   * Cria instância Full — decisões estratégicas e raciocínio complexo.
   * @param {string} reasoning - 'high' | 'medium' | 'low'
   * @param {string} verbosity - 'high' | 'low'
   * @returns {OpenAIClient}
   */
  getFull(reasoning = 'high', verbosity = 'low') {
    return new OpenAIClient('full', { reasoning, verbosity });
  },
};

module.exports = ModelFactory;
