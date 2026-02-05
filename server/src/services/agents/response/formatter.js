/**
 * Formatter - Formatador de Resposta Final
 * Fase 6 - Sistema Multi-Agente Financeiro
 * 
 * Responsável por:
 * - Formatar valores monetários no padrão brasileiro (R$ 1.234,56)
 * - Formatar percentuais (12,34%)
 * - Formatar datas (04/02/2026)
 * - Aplicar estilos Markdown
 * - Gerar respostas acionáveis
 * - Truncar respostas muito longas
 */

const logger = require('../../../utils/logger');

/**
 * Emojis para diferentes contextos
 */
const EMOJIS = {
  // Seções
  data: '📊',
  money: '💰',
  spending: '💸',
  income: '💵',
  trend: '📈',
  trendDown: '📉',
  goals: '🎯',
  budget: '📋',
  investments: '💹',
  
  // Alertas
  warning: '⚠️',
  error: '❌',
  success: '✅',
  info: 'ℹ️',
  
  // Ações
  suggestion: '💡',
  action: '✨',
  next: '➡️',
  
  // Categorias comuns
  food: '🍽️',
  transport: '🚗',
  entertainment: '🎮',
  health: '🏥',
  education: '📚',
  home: '🏠',
  shopping: '🛍️'
};

/**
 * Categorias e seus emojis
 */
const CATEGORY_EMOJIS = {
  'alimentação': EMOJIS.food,
  'alimentacao': EMOJIS.food,
  'transporte': EMOJIS.transport,
  'lazer': EMOJIS.entertainment,
  'entretenimento': EMOJIS.entertainment,
  'saúde': EMOJIS.health,
  'saude': EMOJIS.health,
  'educação': EMOJIS.education,
  'educacao': EMOJIS.education,
  'moradia': EMOJIS.home,
  'casa': EMOJIS.home,
  'compras': EMOJIS.shopping
};

class Formatter {
  
  constructor() {
    this.locale = 'pt-BR';
    this.currency = 'BRL';
    this.maxLineLength = 100;
  }

  // ==================== FORMATAÇÃO DE VALORES ====================

  /**
   * Formata valor como moeda brasileira
   * 
   * @param {number|string} value - Valor a formatar
   * @returns {string} Valor formatado (R$ 1.234,56)
   */
  formatCurrency(value) {
    if (value === null || value === undefined) return 'R$ 0,00';
    
    const num = typeof value === 'string' ? parseFloat(value.replace(/[^\d.-]/g, '')) : value;
    
    if (isNaN(num)) return 'R$ 0,00';

    return new Intl.NumberFormat(this.locale, {
      style: 'currency',
      currency: this.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  }

  /**
   * Formata valor como percentual
   * 
   * @param {number} value - Valor (0.1234 = 12,34%)
   * @param {boolean} isDecimal - Se true, multiplica por 100
   * @returns {string} Valor formatado (12,34%)
   */
  formatPercentage(value, isDecimal = false) {
    if (value === null || value === undefined) return '0,00%';
    
    let num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) return '0,00%';

    // Se é decimal (0.12), multiplicar por 100
    if (isDecimal || (num > -1 && num < 1 && num !== 0)) {
      num *= 100;
    }

    return new Intl.NumberFormat(this.locale, {
      style: 'decimal',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num) + '%';
  }

  /**
   * Formata data no padrão brasileiro
   * 
   * @param {Date|string} date - Data a formatar
   * @param {boolean} includeTime - Incluir horário
   * @returns {string} Data formatada (04/02/2026)
   */
  formatDate(date, includeTime = false) {
    if (!date) return '';
    
    const d = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) return '';

    const options = {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    };

    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }

    return new Intl.DateTimeFormat(this.locale, options).format(d);
  }

  /**
   * Formata número com separador de milhar
   * 
   * @param {number} value - Valor a formatar
   * @param {number} decimals - Casas decimais
   * @returns {string} Valor formatado
   */
  formatNumber(value, decimals = 0) {
    if (value === null || value === undefined) return '0';
    
    const num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(num)) return '0';

    return new Intl.NumberFormat(this.locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  }

  // ==================== FORMATAÇÃO DE SEÇÕES ====================

  /**
   * Formata uma seção de dados
   * 
   * @param {Object} section - Seção a formatar
   * @returns {string} Seção formatada em Markdown
   */
  formatSection(section) {
    let output = '';

    // Título da seção
    if (section.title) {
      output += `### ${section.title}\n\n`;
    }

    // Itens da seção
    if (section.items?.length > 0) {
      for (const item of section.items) {
        output += this.formatSectionItem(item, section.type);
      }
      output += '\n';
    }

    return output;
  }

  /**
   * Formata um item de seção
   */
  formatSectionItem(item, sectionType) {
    const label = item.label || '';
    let value = this.formatValue(item.value, sectionType);
    
    // Adicionar emoji de categoria se aplicável
    const emoji = this.getCategoryEmoji(label) || '';
    const prefix = emoji ? `${emoji} ` : '• ';

    return `${prefix}**${label}:** ${value}\n`;
  }

  /**
   * Formata valor baseado no tipo de seção
   */
  formatValue(value, sectionType) {
    if (value === null || value === undefined) return '-';
    
    // Se é um número que parece monetário
    if (typeof value === 'number') {
      if (sectionType === 'data' || sectionType === 'spending') {
        return this.formatCurrency(value);
      }
      if (value < 1 && value > -1) {
        return this.formatPercentage(value, true);
      }
      return this.formatNumber(value, 2);
    }

    // Se já é string formatada
    if (typeof value === 'string') {
      return value;
    }

    // Se é objeto, formatar recursivamente
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return this.formatArrayValue(value);
      }
      return this.formatObjectValue(value);
    }

    return String(value);
  }

  /**
   * Formata array como lista
   */
  formatArrayValue(arr) {
    if (arr.length === 0) return '-';
    
    if (arr.length <= 3) {
      return arr.map(v => {
        if (typeof v === 'object') {
          return v.name || v.label || v.category || JSON.stringify(v);
        }
        return String(v);
      }).join(', ');
    }

    // Para arrays maiores, mostrar primeiros itens
    const shown = arr.slice(0, 3);
    return shown.map(v => {
      if (typeof v === 'object') {
        return v.name || v.label || v.category || JSON.stringify(v);
      }
      return String(v);
    }).join(', ') + ` (+${arr.length - 3} mais)`;
  }

  /**
   * Formata objeto como lista de propriedades
   */
  formatObjectValue(obj) {
    const entries = Object.entries(obj);
    
    if (entries.length === 0) return '-';
    
    if (entries.length <= 3) {
      return entries.map(([k, v]) => {
        const formattedValue = typeof v === 'number' ? this.formatCurrency(v) : String(v);
        return `${k}: ${formattedValue}`;
      }).join(', ');
    }

    // Para objetos maiores, mostrar resumo
    return `${entries.length} itens`;
  }

  /**
   * Obtém emoji para categoria
   */
  getCategoryEmoji(category) {
    if (!category) return null;
    const lower = category.toLowerCase();
    return CATEGORY_EMOJIS[lower] || null;
  }

  // ==================== FORMATAÇÃO DE ALERTAS ====================

  /**
   * Formata lista de alertas
   * 
   * @param {Array} alerts - Lista de alertas
   * @returns {string} Alertas formatados
   */
  formatAlerts(alerts) {
    if (!alerts || alerts.length === 0) return '';

    let output = `### ${EMOJIS.warning} Pontos de Atenção\n\n`;

    for (const alert of alerts) {
      const emoji = alert.level === 'critical' ? EMOJIS.error : EMOJIS.warning;
      const message = typeof alert === 'string' ? alert : alert.message;
      output += `${emoji} ${message}\n`;
    }

    return output;
  }

  /**
   * Formata avisos (warnings do sistema)
   */
  formatWarnings(warnings) {
    if (!warnings || warnings.length === 0) return '';

    let output = `${EMOJIS.info} *Observações:*\n`;
    
    for (const warning of warnings) {
      output += `• ${warning}\n`;
    }

    return output;
  }

  // ==================== FORMATAÇÃO DE SUGESTÕES ====================

  /**
   * Formata lista de sugestões
   * 
   * @param {Array} suggestions - Lista de sugestões
   * @returns {string} Sugestões formatadas
   */
  formatSuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) return '';

    let output = `### ${EMOJIS.suggestion} Sugestões\n\n`;

    for (const suggestion of suggestions) {
      const text = typeof suggestion === 'string' ? suggestion : suggestion.text;
      output += `${EMOJIS.next} ${text}\n`;
    }

    return output;
  }

  // ==================== AÇÕES E MARKDOWN ====================

  /**
   * Torna a resposta mais acionável
   * 
   * @param {string} content - Conteúdo da resposta
   * @param {string} query - Query original
   * @returns {string} Conteúdo com ações claras
   */
  makeActionable(content, query) {
    let result = content;

    // Adicionar call-to-action se não houver sugestões
    if (!content.includes('Sugestões') && !content.includes('Próximos passos')) {
      // Detectar tipo de query para sugerir ações relevantes
      const queryLower = (query || '').toLowerCase();
      
      if (queryLower.includes('gasto') || queryLower.includes('despesa')) {
        result += `\n\n---\n${EMOJIS.suggestion} **Quer que eu crie um orçamento baseado nesses dados?**`;
      } else if (queryLower.includes('investimento') || queryLower.includes('carteira')) {
        result += `\n\n---\n${EMOJIS.suggestion} **Quer uma simulação de aportes futuros?**`;
      } else if (queryLower.includes('meta') || queryLower.includes('objetivo')) {
        result += `\n\n---\n${EMOJIS.suggestion} **Posso criar um plano de ação para sua meta!**`;
      }
    }

    return result;
  }

  /**
   * Aplica formatação Markdown adicional
   * 
   * @param {string} content - Conteúdo a formatar
   * @returns {string} Conteúdo com Markdown
   */
  applyMarkdown(content) {
    let result = content;

    // Destacar valores monetários que não estão formatados
    result = result.replace(/R\$\s*(\d+(?:\.\d{3})*(?:,\d{2})?)/g, '**R$ $1**');

    // Destacar percentuais
    result = result.replace(/(\d+(?:,\d+)?%)/g, '**$1**');

    return result;
  }

  // ==================== TRUNCAMENTO ====================

  /**
   * Trunca conteúdo se muito longo
   * 
   * @param {string} content - Conteúdo a truncar
   * @param {number} maxLength - Tamanho máximo
   * @returns {string} Conteúdo truncado
   */
  truncateIfNeeded(content, maxLength = 4000) {
    if (!content || content.length <= maxLength) return content;

    // Encontrar um ponto de corte natural (fim de parágrafo ou seção)
    let cutPoint = maxLength;
    
    // Tentar cortar em fim de seção
    const sectionBreak = content.lastIndexOf('\n\n', maxLength);
    if (sectionBreak > maxLength * 0.7) {
      cutPoint = sectionBreak;
    } else {
      // Tentar cortar em fim de linha
      const lineBreak = content.lastIndexOf('\n', maxLength);
      if (lineBreak > maxLength * 0.8) {
        cutPoint = lineBreak;
      }
    }

    const truncated = content.substring(0, cutPoint);
    
    logger.debug('Resposta truncada', {
      original: content.length,
      truncated: truncated.length,
      cutPoint
    });

    return truncated + '\n\n---\n*Resposta resumida. Pergunte sobre pontos específicos para mais detalhes.*';
  }

  // ==================== HELPERS ====================

  /**
   * Limpa texto de caracteres problemáticos
   */
  sanitize(text) {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`')
      .trim();
  }

  /**
   * Capitaliza primeira letra
   */
  capitalize(text) {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  /**
   * Formata lista em bullets
   */
  toBulletList(items, emoji = '•') {
    if (!items || items.length === 0) return '';
    return items.map(item => `${emoji} ${item}`).join('\n');
  }

  /**
   * Formata lista numerada
   */
  toNumberedList(items) {
    if (!items || items.length === 0) return '';
    return items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  }

  /**
   * Formata período de datas
   */
  formatPeriod(startDate, endDate) {
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    
    if (start === end) return start;
    return `${start} a ${end}`;
  }

  /**
   * Formata variação (aumento/redução)
   */
  formatVariation(value, isDecimal = false) {
    let num = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isDecimal) num *= 100;
    
    const formatted = this.formatNumber(Math.abs(num), 1) + '%';
    
    if (num > 0) {
      return `${EMOJIS.trend} +${formatted} (aumento)`;
    } else if (num < 0) {
      return `${EMOJIS.trendDown} -${formatted} (redução)`;
    }
    return 'sem variação';
  }
}

module.exports = Formatter;
