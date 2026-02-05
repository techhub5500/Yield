/**
 * Formatador Markdown para Logs
 * 
 * Responsável por transformar entradas de log em texto
 * Markdown estilizado, legível e bem organizado.
 */

const { LOG_LEVELS, MARKDOWN_TEMPLATES } = require('../config');

class MarkdownFormatter {
  constructor() {
    this.lastHour = null;
  }

  /**
   * Formata o cabeçalho do arquivo de log
   */
  formatFileHeader() {
    const now = new Date();
    const date = this.formatDate(now);
    const env = process.env.NODE_ENV || 'development';

    return MARKDOWN_TEMPLATES.fileHeader
      .replace('{date}', date)
      .replace('{env}', env);
  }

  /**
   * Formata uma entrada de log completa
   * 
   * @param {Object} entry - Entrada de log
   * @param {string} entry.level - Nível (CRITICAL, ERROR, WARNING, INFO)
   * @param {string} entry.category - Categoria do log
   * @param {string} entry.component - Componente que gerou o log
   * @param {string} entry.message - Mensagem principal
   * @param {Object} entry.meta - Dados adicionais (opcional)
   * @param {Error} entry.error - Objeto de erro (opcional)
   * @param {Date} entry.timestamp - Data/hora do log
   * @returns {string} Log formatado em Markdown
   */
  formatEntry(entry) {
    const { level, category, component, message, meta, error, timestamp } = entry;
    
    let output = '';
    
    // Verifica se precisa adicionar separador de hora
    const hourSection = this.checkHourSection(timestamp);
    if (hourSection) {
      output += hourSection;
    }

    const levelConfig = LOG_LEVELS[level] || LOG_LEVELS.INFO;
    const time = this.formatTime(timestamp);
    
    // Formata detalhes adicionais
    let details = '';
    
    // Adiciona metadados se existirem
    if (meta && Object.keys(meta).length > 0) {
      details += this.formatMeta(meta);
    }
    
    // Adiciona stack trace se for erro
    if (error && error.stack) {
      details += this.formatError(error);
    }

    // Monta entrada completa
    output += MARKDOWN_TEMPLATES.logEntry
      .replace('{emoji}', levelConfig.emoji)
      .replace('{level}', levelConfig.label)
      .replace('{time}', time)
      .replace('{category}', category)
      .replace('{component}', component)
      .replace('{message}', this.formatMessage(message))
      .replace('{details}', details);

    return output;
  }

  /**
   * Verifica se precisa adicionar seção de hora
   */
  checkHourSection(timestamp) {
    const currentHour = timestamp.getHours();
    
    if (this.lastHour !== currentHour) {
      this.lastHour = currentHour;
      const hourStr = `${String(currentHour).padStart(2, '0')}:00`;
      return MARKDOWN_TEMPLATES.hourSection.replace('{hour}', hourStr);
    }
    
    return null;
  }

  /**
   * Formata a mensagem principal
   */
  formatMessage(message) {
    if (typeof message !== 'string') {
      return '```json\n' + JSON.stringify(message, null, 2) + '\n```';
    }
    
    // Destaca valores importantes
    let formatted = message
      // Destaca números com R$
      .replace(/R\$\s?[\d.,]+/g, '**$&**')
      // Destaca porcentagens
      .replace(/\d+[.,]?\d*%/g, '**$&**')
      // Destaca tempos de execução
      .replace(/(\d+\.?\d*)\s?(ms|s|segundos)/g, '`$&`')
      // Destaca IDs
      .replace(/\b(id|ID|Id):\s?[\w-]+/g, '`$&`');
    
    return formatted;
  }

  /**
   * Formata metadados como tabela Markdown
   */
  formatMeta(meta) {
    const rows = Object.entries(meta)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => {
        const formattedValue = this.formatValue(value);
        return `| ${this.humanizeKey(key)} | ${formattedValue} |`;
      })
      .join('\n');

    if (!rows) return '';

    return MARKDOWN_TEMPLATES.metaDetails.replace('{rows}', rows);
  }

  /**
   * Formata erro com stack trace
   */
  formatError(error) {
    const stack = error.stack || error.message || String(error);
    return MARKDOWN_TEMPLATES.errorDetails.replace('{stack}', stack);
  }

  /**
   * Formata um valor para exibição
   */
  formatValue(value) {
    if (value === null || value === undefined) {
      return '_vazio_';
    }
    
    if (typeof value === 'boolean') {
      return value ? '✓ Sim' : '✗ Não';
    }
    
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return `\`${value}\``;
      }
      return `\`${value.toFixed(2)}\``;
    }
    
    if (value instanceof Date) {
      return this.formatDateTime(value);
    }
    
    if (Array.isArray(value)) {
      if (value.length <= 3) {
        return value.map(v => `\`${v}\``).join(', ');
      }
      return `${value.length} itens`;
    }
    
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length <= 2) {
        return keys.map(k => `${k}: ${value[k]}`).join(', ');
      }
      return `{${keys.length} campos}`;
    }
    
    // String
    const str = String(value);
    if (str.length > 50) {
      return str.substring(0, 47) + '...';
    }
    return str;
  }

  /**
   * Humaniza nome de chave (camelCase -> Camel Case)
   */
  humanizeKey(key) {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/[_-]/g, ' ')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }

  /**
   * Formata data para exibição
   */
  formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  /**
   * Formata hora para exibição
   */
  formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Formata data e hora completa
   */
  formatDateTime(date) {
    return `${this.formatDate(date)} ${this.formatTime(date)}`;
  }

  /**
   * Formata resumo de execução (para final de ciclos)
   */
  formatExecutionSummary(summary) {
    const { 
      requestId, 
      startTime, 
      endTime, 
      duration, 
      success, 
      agentsInvolved,
      operations 
    } = summary;

    let output = `
## 📊 Resumo da Execução

| Métrica | Valor |
|---------|-------|
| Request ID | \`${requestId}\` |
| Início | ${this.formatDateTime(startTime)} |
| Fim | ${this.formatDateTime(endTime)} |
| Duração | \`${duration}ms\` |
| Status | ${success ? '✅ Sucesso' : '❌ Falha'} |
`;

    if (agentsInvolved && agentsInvolved.length > 0) {
      output += `| Agentes | ${agentsInvolved.join(' → ')} |\n`;
    }

    if (operations && operations.length > 0) {
      output += `\n### Operações Executadas\n\n`;
      operations.forEach((op, i) => {
        output += `${i + 1}. **${op.name}** - \`${op.duration}ms\` ${op.success ? '✓' : '✗'}\n`;
      });
    }

    output += '\n---\n';
    return output;
  }

  /**
   * Reseta estado (para novo arquivo)
   */
  reset() {
    this.lastHour = null;
  }
}

module.exports = new MarkdownFormatter();
