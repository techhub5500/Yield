const memoryConfig = require('../../../config/memory-config');
const logger = require('../../../utils/logger');

/**
 * Sistema de Preservação de Dados Críticos
 * Identifica e protege informações que nunca devem ser apagadas
 */
class PreservationRules {
  constructor() {
    this.patterns = memoryConfig.criticalData.patterns;
    this.enableAutoDetection = memoryConfig.criticalData.enableAutoDetection;
  }

  /**
   * Tipos de dados críticos
   */
  static TYPES = {
    FINANCIAL_GOALS: 'financial_goals',
    CONFIGURED_LIMITS: 'configured_limits',
    DECLARED_PREFERENCES: 'declared_preferences',
    IMPORTANT_DECISIONS: 'important_decisions'
  };

  /**
   * Extrai todos os dados críticos de um texto
   * @param {string} text - Texto para analisar
   * @param {number} sourceCycleId - ID do ciclo fonte (opcional)
   * @returns {Object} Dados críticos extraídos por categoria
   */
  extractCriticalData(text, sourceCycleId = null) {
    if (!this.enableAutoDetection || !text) {
      return {
        financial_goals: [],
        configured_limits: [],
        declared_preferences: [],
        important_decisions: []
      };
    }

    const result = {
      financial_goals: [],
      configured_limits: [],
      declared_preferences: [],
      important_decisions: []
    };

    // Analisa cada categoria
    for (const [category, patterns] of Object.entries(this.patterns)) {
      const matches = this.findMatches(text, patterns);
      
      for (const match of matches) {
        const item = this.createCriticalItem(match, sourceCycleId, text);
        result[category].push(item);
      }
    }

    // Log se encontrou dados críticos
    const totalFound = Object.values(result).flat().length;
    if (totalFound > 0) {
      logger.info('Dados críticos extraídos', {
        goals: result.financial_goals.length,
        limits: result.configured_limits.length,
        preferences: result.declared_preferences.length,
        decisions: result.important_decisions.length
      });
    }

    return result;
  }

  /**
   * Encontra matches de padrões no texto
   * @param {string} text - Texto para buscar
   * @param {Array} patterns - Padrões regex
   * @returns {Array} Matches encontrados
   */
  findMatches(text, patterns) {
    const matches = [];
    const sentences = this.splitIntoSentences(text);

    for (const sentence of sentences) {
      for (const pattern of patterns) {
        if (pattern.test(sentence)) {
          matches.push(sentence.trim());
          break; // Uma sentença só entra uma vez por categoria
        }
      }
    }

    return [...new Set(matches)]; // Remove duplicatas
  }

  /**
   * Divide texto em sentenças
   * @param {string} text - Texto
   * @returns {Array} Sentenças
   */
  splitIntoSentences(text) {
    // Divide por pontuação final ou quebras de linha
    return text
      .split(/[.!?\n]+/)
      .map(s => s.trim())
      .filter(s => s.length > 5); // Ignora fragmentos muito curtos
  }

  /**
   * Cria item de dado crítico
   * @param {string} content - Conteúdo
   * @param {number} sourceCycleId - ID do ciclo
   * @param {string} fullText - Texto completo para extração
   * @returns {Object} Item formatado
   */
  createCriticalItem(content, sourceCycleId, fullText) {
    return {
      content: content,
      extracted_at: new Date(),
      source_cycle_id: sourceCycleId,
      numerical_value: this.extractNumericalValue(content),
      date_value: this.extractDateValue(content)
    };
  }

  /**
   * Extrai valor numérico principal do texto
   * @param {string} text - Texto
   * @returns {number|null} Valor ou null
   */
  extractNumericalValue(text) {
    // Busca valores monetários primeiro
    const monetaryMatch = text.match(/R\$\s*([\d.,]+)/);
    if (monetaryMatch) {
      const value = monetaryMatch[1]
        .replace(/\./g, '')  // Remove separador de milhar
        .replace(',', '.');   // Troca vírgula decimal por ponto
      return parseFloat(value);
    }

    // Busca porcentagens
    const percentMatch = text.match(/([\d.,]+)\s*%/);
    if (percentMatch) {
      return parseFloat(percentMatch[1].replace(',', '.'));
    }

    // Busca números simples
    const numberMatch = text.match(/\b(\d+(?:[.,]\d+)?)\b/);
    if (numberMatch) {
      return parseFloat(numberMatch[1].replace(',', '.'));
    }

    return null;
  }

  /**
   * Extrai data do texto
   * @param {string} text - Texto
   * @returns {string|null} Data ou null
   */
  extractDateValue(text) {
    // Meses por extenso
    const monthNames = {
      'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
      'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
      'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
    };

    // Busca "até dezembro" ou "em junho de 2026"
    for (const [month, num] of Object.entries(monthNames)) {
      const regex = new RegExp(`(?:até|em|de)\\s+${month}(?:\\s+de\\s+(\\d{4}))?`, 'i');
      const match = text.match(regex);
      if (match) {
        const year = match[1] || new Date().getFullYear();
        return `${year}-${num}`;
      }
    }

    // Busca datas no formato DD/MM/YYYY
    const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (dateMatch) {
      const day = dateMatch[1].padStart(2, '0');
      const month = dateMatch[2].padStart(2, '0');
      let year = dateMatch[3];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${month}-${day}`;
    }

    return null;
  }

  /**
   * Classifica dado crítico em uma categoria
   * @param {string} text - Texto do dado
   * @returns {string|null} Categoria ou null
   */
  classifyCriticalData(text) {
    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          return category;
        }
      }
    }
    return null;
  }

  /**
   * Mescla dados críticos sem duplicar
   * @param {Object} existing - Dados existentes
   * @param {Object} newData - Novos dados
   * @returns {Object} Dados mesclados
   */
  mergeCriticalData(existing, newData) {
    const merged = {
      financial_goals: [...(existing.financial_goals || [])],
      configured_limits: [...(existing.configured_limits || [])],
      declared_preferences: [...(existing.declared_preferences || [])],
      important_decisions: [...(existing.important_decisions || [])]
    };

    for (const category of Object.keys(merged)) {
      if (newData[category]) {
        for (const newItem of newData[category]) {
          // Verifica se já existe item similar
          const isDuplicate = merged[category].some(existingItem => 
            this.isSimilarContent(existingItem.content, newItem.content)
          );

          if (!isDuplicate) {
            merged[category].push(newItem);
          }
        }
      }
    }

    return merged;
  }

  /**
   * Verifica se dois conteúdos são similares
   * @param {string} a - Primeiro conteúdo
   * @param {string} b - Segundo conteúdo
   * @returns {boolean} True se similares
   */
  isSimilarContent(a, b) {
    if (!a || !b) return false;

    // Normaliza textos
    const normalize = (text) => text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const normA = normalize(a);
    const normB = normalize(b);

    // Verifica se são exatamente iguais
    if (normA === normB) return true;

    // Verifica se um contém o outro
    if (normA.includes(normB) || normB.includes(normA)) return true;

    // Calcula similaridade simples (palavras em comum)
    const wordsA = new Set(normA.split(' '));
    const wordsB = new Set(normB.split(' '));
    
    let common = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) common++;
    }

    const similarity = (2 * common) / (wordsA.size + wordsB.size);
    return similarity > 0.7; // 70% de palavras em comum
  }

  /**
   * Verifica se dado é protegido (não pode ser apagado)
   * @param {Object} item - Item de dado crítico
   * @returns {boolean} True se protegido
   */
  isProtectedData(item) {
    // Todos os dados críticos são protegidos por padrão
    return true;
  }

  /**
   * Obtém resumo dos dados críticos
   * @param {Object} memory - Documento de memória
   * @returns {Object} Resumo
   */
  getCriticalDataSummary(memory) {
    const criticalData = memory.critical_data || {};

    return {
      total_items: 
        (criticalData.financial_goals?.length || 0) +
        (criticalData.configured_limits?.length || 0) +
        (criticalData.declared_preferences?.length || 0) +
        (criticalData.important_decisions?.length || 0),
      breakdown: {
        financial_goals: criticalData.financial_goals?.length || 0,
        configured_limits: criticalData.configured_limits?.length || 0,
        declared_preferences: criticalData.declared_preferences?.length || 0,
        important_decisions: criticalData.important_decisions?.length || 0
      },
      items: {
        goals: criticalData.financial_goals?.map(g => ({
          content: g.content,
          value: g.numerical_value,
          date: g.date_value
        })) || [],
        limits: criticalData.configured_limits?.map(l => ({
          content: l.content,
          value: l.numerical_value
        })) || [],
        preferences: criticalData.declared_preferences?.map(p => p.content) || [],
        decisions: criticalData.important_decisions?.map(d => ({
          content: d.content,
          date: d.extracted_at
        })) || []
      }
    };
  }

  /**
   * Analisa ciclo e extrai dados críticos
   * @param {Object} cycle - Ciclo de conversação
   * @returns {Object} Dados críticos do ciclo
   */
  analyzeCycle(cycle) {
    // Analisa tanto a mensagem do usuário quanto a resposta
    const fullText = `${cycle.user_message || ''} ${cycle.ai_response || ''}`;
    return this.extractCriticalData(fullText, cycle.cycle_id);
  }

  /**
   * Adiciona dados críticos à memória
   * @param {Object} memory - Documento de memória
   * @param {Object} newCriticalData - Novos dados críticos
   * @returns {Object} Memória atualizada
   */
  addCriticalDataToMemory(memory, newCriticalData) {
    memory.critical_data = this.mergeCriticalData(
      memory.critical_data || {},
      newCriticalData
    );

    logger.debug('Dados críticos adicionados à memória', {
      chatId: memory.chat_id,
      newItems: Object.values(newCriticalData).flat().length
    });

    return memory;
  }

  /**
   * Remove dados críticos antigos (com cuidado)
   * Usado apenas em casos extremos de limite
   * @param {Object} memory - Documento de memória
   * @param {number} maxItemsPerCategory - Máximo por categoria
   * @returns {Object} Memória limpa
   */
  pruneOldCriticalData(memory, maxItemsPerCategory = 10) {
    const categories = ['financial_goals', 'configured_limits', 'declared_preferences', 'important_decisions'];

    for (const category of categories) {
      if (memory.critical_data[category]?.length > maxItemsPerCategory) {
        // Mantém os mais recentes
        memory.critical_data[category] = memory.critical_data[category]
          .sort((a, b) => new Date(b.extracted_at) - new Date(a.extracted_at))
          .slice(0, maxItemsPerCategory);

        logger.warn(`Dados críticos podados: ${category}`, {
          chatId: memory.chat_id,
          kept: maxItemsPerCategory
        });
      }
    }

    return memory;
  }
}

module.exports = new PreservationRules();
