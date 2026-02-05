const { ValidationError } = require('../../../utils/error-handler');

/**
 * Sanitizador de Entrada
 * 
 * Remove e escapa conteúdo potencialmente malicioso
 */
class Sanitizer {
  
  /**
   * Sanitiza um objeto completo
   */
  sanitize(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    const sanitized = {};
    
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = this.sanitizeValue(value);
    }

    return sanitized;
  }

  /**
   * Sanitiza um valor individual
   */
  sanitizeValue(value) {
    // Null e undefined passam direto
    if (value === null || value === undefined) {
      return value;
    }

    // Números e booleanos passam direto
    if (typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    // Arrays recursivos
    if (Array.isArray(value)) {
      return value.map(item => this.sanitizeValue(item));
    }

    // Objetos recursivos
    if (typeof value === 'object') {
      return this.sanitize(value);
    }

    // Strings precisam de limpeza
    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    return value;
  }

  /**
   * Sanitiza uma string
   */
  sanitizeString(str) {
    if (typeof str !== 'string') {
      return str;
    }

    let cleaned = str;

    // 1. Remover tags HTML/XML
    cleaned = this.removeHtmlTags(cleaned);

    // 2. Escapar caracteres especiais de SQL injection
    cleaned = this.escapeSqlCharacters(cleaned);

    // 3. Remover caracteres de controle
    cleaned = this.removeControlCharacters(cleaned);

    // 4. Limitar tamanho
    cleaned = this.limitLength(cleaned);

    // 5. Remover scripts maliciosos
    cleaned = this.removeScripts(cleaned);

    return cleaned.trim();
  }

  /**
   * Remove tags HTML
   */
  removeHtmlTags(str) {
    return str.replace(/<[^>]*>/g, '');
  }

  /**
   * Escapa caracteres SQL perigosos
   */
  escapeSqlCharacters(str) {
    // MongoDB usa BSON, mas ainda assim prevenir tentativas
    const dangerous = {
      '$': '＄', // Unicode fullwidth dollar
      '{': '｛',
      '}': '｝'
    };

    return str.replace(/[\${}]/g, char => dangerous[char] || char);
  }

  /**
   * Remove caracteres de controle
   */
  removeControlCharacters(str) {
    // Remove caracteres ASCII de controle (exceto newline, tab)
    return str.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
  }

  /**
   * Limita tamanho da string
   */
  limitLength(str, maxLength = 10000) {
    if (str.length > maxLength) {
      return str.substring(0, maxLength);
    }
    return str;
  }

  /**
   * Remove scripts maliciosos
   */
  removeScripts(str) {
    // Remover javascript:, data:, vbscript:
    const patterns = [
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi // onclick=, onerror=, etc
    ];

    let cleaned = str;
    patterns.forEach(pattern => {
      cleaned = cleaned.replace(pattern, '');
    });

    return cleaned;
  }

  /**
   * Valida que string não contém conteúdo malicioso
   */
  validateSafe(str) {
    if (typeof str !== 'string') {
      return true;
    }

    // Padrões suspeitos
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /\$where/i, // MongoDB injection
      /\$function/i,
      /eval\(/i,
      /exec\(/i
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(str)) {
        throw new ValidationError(
          'Conteúdo potencialmente malicioso detectado',
          { pattern: pattern.toString() }
        );
      }
    }

    return true;
  }

  /**
   * Sanitiza e valida simultaneamente
   */
  sanitizeAndValidate(data) {
    // Primeiro valida
    this.deepValidate(data);
    
    // Depois sanitiza
    return this.sanitize(data);
  }

  /**
   * Validação profunda recursiva
   */
  deepValidate(data) {
    if (typeof data !== 'object' || data === null) {
      if (typeof data === 'string') {
        this.validateSafe(data);
      }
      return;
    }

    if (Array.isArray(data)) {
      data.forEach(item => this.deepValidate(item));
      return;
    }

    for (const value of Object.values(data)) {
      this.deepValidate(value);
    }
  }
}

module.exports = new Sanitizer();
