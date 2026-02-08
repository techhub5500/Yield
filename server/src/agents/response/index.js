/**
 * @module agents/response/index
 * @description Agente de Resposta — Final Synthesizer do sistema.
 * 
 * Sintetiza outputs de múltiplos agentes coordenadores em uma resposta
 * clara, coerente e otimizada para humanos.
 * 
 * Modelo: GPT-5.2 (Reasoning: High, Verbosity: High)
 * Conforme constituição — síntese complexa + resposta para HUMANO.
 * 
 * PONTO DE IA: Síntese, integração de outputs e formatação para humanos.
 * Justificativa:
 *   - Reasoning High: Decisão complexa (integrar múltiplos outputs), avaliação de trade-offs
 *   - Verbosity High: Resposta será lida por HUMANOS, precisa de clareza e transparência
 */

const ModelFactory = require('../../utils/ai/model-factory');
const { RESPONSE_SYSTEM_PROMPT, DIRECT_RESPONSE_PROMPT, SIMPLE_RESPONSE_PROMPT } = require('./prompt');
const { integrateOutputs, formatIntegratedContext, formatDirectResult } = require('./integrator');
const { suggestFormat } = require('./format-selector');
const logger = require('../../utils/logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * Sintetiza outputs de coordenadores em resposta final para o usuário.
 * Usado quando há escalada (Orquestrador → Coordenadores → Resposta).
 * 
 * @param {string} query - Query original do usuário
 * @param {Object} memory - Memória completa do chat
 * @param {Object} doc - DOC do Orquestrador
 * @param {Object} outputs - Outputs dos coordenadores ({analysis_output, ...})
 * @returns {Promise<Object>} Resposta estruturada
 * @returns {string} returns.response - Resposta em linguagem natural
 * @returns {string} returns.format - Formato usado
 * @returns {string} returns.tone - Tom usado
 */
async function synthesize(query, memory, doc, outputs) {
  const full = ModelFactory.getFull('high', 'high');

  // LÓGICA: integrar outputs
  const integrated = integrateOutputs(outputs, doc);

  // LÓGICA: sugerir formato
  const formatSuggestion = suggestFormat(query, 'escalate', integrated.totalAgents);

  // LÓGICA: formatar contexto para o prompt
  const context = formatIntegratedContext(integrated, query, doc);

  // Formatar memória
  const memoryContext = formatMemoryForResponse(memory);

  const userPrompt = [
    `MEMÓRIA DO CHAT:`,
    memoryContext,
    ``,
    context,
    ``,
    `SUGESTÃO DE FORMATO: ${formatSuggestion.suggestedFormat} (${formatSuggestion.reason})`,
    ``,
    `Sintetize uma resposta completa para o usuário.`,
  ].join('\n');

  try {
    const result = await full.completeJSON(RESPONSE_SYSTEM_PROMPT, userPrompt, {
      maxTokens: 2500,
      temperature: 0.4,
    });

    // Garantir campos obrigatórios
    const response = {
      response: result.response || 'Desculpe, não consegui formular uma resposta adequada.',
      format: result.format || formatSuggestion.suggestedFormat,
      tone: result.tone || 'neutral',
      key_points: result.key_points || [],
    };

    logger.ai('INFO', 'ResponseAgent', `Resposta sintetizada com sucesso`, {
      format: response.format,
      tone: response.tone,
      agentsIntegrated: integrated.successful.length,
      responseLength: response.response.length,
    });

    return response;
  } catch (error) {
    logger.error('ResponseAgent', 'ai', `Falha ao sintetizar resposta: ${error.message}`, {
      query: query.substring(0, 80),
      errorStatus: error.status,
    });

    // Fallback: tentar construir resposta básica a partir dos outputs
    // Se é erro de API Key, não tenta fallback
    if (error.status === 401 || error.message.includes('API key')) {
      return {
        response: 'Desculpe, estou com dificuldades técnicas no momento (erro de autenticação). Por favor, tente novamente em instantes.',
        format: 'conversational',
        tone: 'apologetic',
        key_points: [],
      };
    }
    return createFallbackResponse(query, integrated);
  }
}

/**
 * Formata resultado de rota direta (sem escalada) para o usuário.
 * Usado quando Junior resolve via bridge_query, bridge_insert ou serper.
 * 
 * @param {string} query - Query original do usuário
 * @param {string} type - Tipo de rota (bridge_query, bridge_insert, serper)
 * @param {Object} data - Dados retornados pela ferramenta
 * @param {Object} memory - Memória do chat
 * @returns {Promise<Object>} Resposta formatada
 */
async function formatDirectResponse(query, type, data, memory) {
  const full = ModelFactory.getFull('high', 'high');

  // LÓGICA: sugerir formato
  const formatSuggestion = suggestFormat(query, type, 0);

  // LÓGICA: formatar resultado para o prompt
  const resultContext = formatDirectResult(type, data, query);

  // Formatar memória (resumida para rotas diretas)
  const memoryContext = formatMemoryForResponse(memory);

  const userPrompt = [
    `MEMÓRIA DO CHAT:`,
    memoryContext,
    ``,
    resultContext,
    ``,
    `SUGESTÃO DE FORMATO: ${formatSuggestion.suggestedFormat} (${formatSuggestion.reason})`,
    ``,
    `Formate uma resposta amigável e clara para o usuário.`,
  ].join('\n');

  try {
    const result = await full.completeJSON(DIRECT_RESPONSE_PROMPT, userPrompt, {
      maxTokens: 1500,
      temperature: 0.4,
    });

    const response = {
      response: result.response || 'Operação concluída.',
      format: result.format || formatSuggestion.suggestedFormat,
      tone: result.tone || 'neutral',
    };

    logger.ai('DEBUG', 'ResponseAgent', `Resposta direta formatada (${type})`, {
      format: response.format,
      responseLength: response.response.length,
    });

    return response;
  } catch (error) {
    logger.error('ResponseAgent', 'ai', `Falha ao formatar resposta direta: ${error.message}`, {
      errorStatus: error.status,
      type,
    });

    // Fallback: resposta genérica
    // Se é erro de API Key, informar o usuário adequadamente
    if (error.status === 401 || error.message.includes('API key')) {
      return {
        response: 'Desculpe, estou temporariamente indisponível (erro de autenticação). Por favor, aguarde um momento e tente novamente.',
        format: 'quick',
        tone: 'apologetic',
      };
    }
    return {
      response: generateDirectFallback(type, data),
      format: 'quick',
      tone: 'neutral',
    };
  }
}

/**
 * Formata a memória para inclusão no prompt de resposta.
 * LÓGICA PURA.
 * @param {Object} memory
 * @returns {string}
 */
function formatMemoryForResponse(memory) {
  if (!memory) return 'Sem memória disponível.';

  const parts = [];

  if (memory.recent && memory.recent.length > 0) {
    parts.push('Conversa recente:');
    for (const cycle of memory.recent) {
      const userInput = typeof cycle.userInput === 'string' ? cycle.userInput : String(cycle.userInput || '');
      const aiResponse = typeof cycle.aiResponse === 'string' ? cycle.aiResponse : String(cycle.aiResponse || '');
      parts.push(`  Usuário: ${userInput.substring(0, 200)}`);
      parts.push(`  IA: ${aiResponse.substring(0, 200)}`);
    }
  }

  if (memory.old && memory.old.length > 0) {
    parts.push('Contexto anterior (resumido):');
    for (const summary of memory.old) {
      const content = typeof summary === 'string' ? summary : summary.content || '';
      parts.push(`  ${content.substring(0, 300)}`);
    }
  }

  return parts.length > 0 ? parts.join('\n') : 'Primeira interação.';
}

/**
 * Cria resposta de fallback quando a IA falha na síntese.
 * LÓGICA PURA.
 * @param {string} query
 * @param {Object} integrated - Resultado de integrateOutputs()
 * @returns {Object}
 */
function createFallbackResponse(query, integrated) {
  let response = 'Desculpe, houve uma dificuldade ao formular a resposta. ';

  if (integrated.successful.length > 0) {
    const summaries = integrated.successful.map(s => {
      const resultStr = typeof s.result === 'string'
        ? s.result
        : JSON.stringify(s.result);
      return `${s.agent}: ${resultStr.substring(0, 200)}`;
    });
    response += 'Aqui está um resumo dos resultados obtidos:\n\n' + summaries.join('\n\n');
  } else {
    response += 'Não foi possível obter resultados dos agentes. Por favor, tente reformular sua pergunta.';
  }

  logger.warn('ResponseAgent', 'ai', 'Resposta de fallback gerada', {
    query: query.substring(0, 80),
    successfulAgents: integrated.successful.length,
  });

  return {
    response,
    format: 'conversational',
    tone: 'neutral',
    key_points: [],
  };
}

/**
 * Gera fallback textual para respostas diretas.
 * LÓGICA PURA.
 * @param {string} type
 * @param {Object} data
 * @returns {string}
 */
function generateDirectFallback(type, data) {
  switch (type) {
    case 'bridge_insert':
      return 'Lançamento registrado com sucesso.';
    case 'bridge_query':
      return `Resultado da consulta: ${JSON.stringify(data).substring(0, 500)}`;
    case 'serper':
      return `Resultado da pesquisa: ${JSON.stringify(data).substring(0, 500)}`;
    default:
      return 'Operação concluída.';
  }
}

/**
 * Formata resposta social/trivial com contexto da memória recente.
 * Usa modelo MINI (mais leve) para interações sociais.
 * Se usuário perguntar sobre o sistema, pode acessar documentação quando pertinente.
 * ADICIONADO: 07/02/2026 (Opção B)
 * 
 * @param {string} query - Query do usuário
 * @param {Object} memory - Memória do chat
 * @returns {Promise<Object>} Resposta formatada
 */
async function formatSimpleResponse(query, memory) {
  // Usa MINI em vez de FULL para economizar
  const mini = ModelFactory.getMini('low', 'medium');
  
  const memoryContext = formatMemoryForResponse(memory);
  
  // LÓGICA: Detectar se usuário está perguntando sobre o sistema
  const isAskingAboutSystem = /como (você|vc) funciona|o que (você|vc) faz|para que serve|quem é você|explica|me ajuda a entender/i.test(query);
  
  let systemInfo = '';
  if (isAskingAboutSystem) {
    // Tentar carregar informações sobre o sistema
    try {
      const sistemaPath = path.join(__dirname, '..', '..', '..', 'docs', 'md_sistema', 'sistema.md');
      systemInfo = await fs.readFile(sistemaPath, 'utf-8');
      logger.logic('DEBUG', 'ResponseAgent', 'Documentação do sistema carregada para contexto');
    } catch (error) {
      logger.warn('ResponseAgent', 'logic', 'Não foi possível carregar documentação do sistema', {
        error: error.message,
      });
      // Continua sem a documentação — IA pode responder baseada em conhecimento
    }
  }

  const systemPrompt = SIMPLE_RESPONSE_PROMPT;

  const userPrompt = [
    systemInfo ? `INFORMAÇÕES SOBRE O SISTEMA:\n${systemInfo}\n` : '',
    `MEMÓRIA RECENTE:`,
    memoryContext,
    ``,
    `QUERY DO USUÁRIO: "${query}"`,
    ``,
    `Responda de forma amigável e contextual.`,
  ].join('\n');

  try {
    const result = await mini.completeJSON(systemPrompt, userPrompt, {
      maxTokens: 300,
      temperature: 0.7, // Mais criativo para interações sociais
    });

    logger.ai('DEBUG', 'ResponseAgent', `Resposta social formatada`, {
      responseLength: result.response?.length || 0,
      usedSystemInfo: isAskingAboutSystem,
    });

    return {
      response: result.response || "Olá! Como posso ajudar você com suas finanças hoje?",
      format: result.format || 'quick',
      tone: result.tone || 'friendly',
    };
  } catch (error) {
    logger.error('ResponseAgent', 'ai', `Falha ao formatar resposta social: ${error.message}`);
    
    // Fallback: resposta genérica
    if (error.status === 401 || error.message.includes('API key')) {
      return {
        response: 'Desculpe, estou temporariamente indisponível (erro de autenticação). Por favor, aguarde um momento e tente novamente.',
        format: 'quick',
        tone: 'apologetic',
      };
    }
    
    return {
      response: "Olá! Como posso ajudar você com suas finanças hoje?",
      format: 'quick',
      tone: 'friendly',
    };
  }
}

module.exports = { synthesize, formatDirectResponse, formatSimpleResponse };
