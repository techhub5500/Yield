/**
 * Sistema de logs simples e eficiente
 */

const LOG_LEVELS = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || 'INFO';
  }

  /**
   * Formata a mensagem de log
   */
  format(level, message, meta = null) {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  /**
   * Log de erro
   */
  error(message, error = null) {
    const meta = error ? { 
      message: error.message, 
      stack: error.stack,
      ...error 
    } : null;
    console.error(this.format(LOG_LEVELS.ERROR, message, meta));
  }

  /**
   * Log de aviso
   */
  warn(message, meta = null) {
    console.warn(this.format(LOG_LEVELS.WARN, message, meta));
  }

  /**
   * Log de informação
   */
  info(message, meta = null) {
    console.log(this.format(LOG_LEVELS.INFO, message, meta));
  }

  /**
   * Log de debug
   */
  debug(message, meta = null) {
    if (this.level === 'DEBUG') {
      console.log(this.format(LOG_LEVELS.DEBUG, message, meta));
    }
  }

  /**
   * Log de operação com tempo de execução
   */
  logOperation(operation, duration, success = true, meta = null) {
    const message = `${operation} ${success ? 'concluída' : 'falhou'} em ${duration}ms`;
    if (success) {
      this.info(message, meta);
    } else {
      this.error(message, meta);
    }
  }
}

module.exports = new Logger();
