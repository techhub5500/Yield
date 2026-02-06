/**
 * @module logger
 * @description Sistema de logging centralizado e evolutivo.
 * 
 * REGRAS:
 * - Todo log do sistema DEVE passar por este arquivo.
 * - Nenhum outro módulo formata, escreve ou decide nível de log.
 * - Logs são persistidos em arquivo .md para auditoria humana.
 * - Projetado para crescer: novos tipos, níveis e contextos sem refatoração.
 * 
 * Cada log responde a pelo menos uma dessas perguntas:
 *   1. O que o sistema tentou fazer?
 *   2. Qual decisão importante foi tomada?
 *   3. O que deu errado e por quê?
 */

const fs = require('fs');
const path = require('path');
const config = require('../config');

// ============================================================
// Níveis de log — extensível sem refatoração
// ============================================================
const LOG_LEVELS = {
  ERROR: { priority: 0, label: 'ERROR', emoji: '❌' },
  WARN:  { priority: 1, label: 'WARN',  emoji: '⚠️' },
  INFO:  { priority: 2, label: 'INFO',  emoji: '✅' },
  DEBUG: { priority: 3, label: 'DEBUG', emoji: '🔍' },
};

// ============================================================
// Tipos de componente — adicione novos aqui conforme fases futuras
// ============================================================
const COMPONENT_TYPES = {
  LOGIC: 'logic',     // Lógica determinística
  AI:    'ai',        // Inferência por IA
  SYSTEM: 'system',   // Infraestrutura (startup, shutdown, etc.)
};

// ============================================================
// Estado interno do logger
// ============================================================
let _minLevel = LOG_LEVELS.DEBUG.priority;
let _logFilePath = null;
let _consoleEnabled = true;
let _fileEnabled = true;
let _initialized = false;

// ============================================================
// Funções internas
// ============================================================

/**
 * Gera timestamp ISO legível.
 * @returns {string}
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Garante que o diretório de logs existe.
 */
function ensureLogDir() {
  const dir = config.paths.logsDir;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Gera o caminho do arquivo de log do dia.
 * Formato: logs/YYYY-MM-DD.md
 * @returns {string}
 */
function getLogFilePath() {
  const date = new Date().toISOString().split('T')[0];
  return path.join(config.paths.logsDir, `${date}.md`);
}

/**
 * Inicializa o arquivo .md com cabeçalho, se ainda não existe.
 * @param {string} filePath 
 */
function initLogFile(filePath) {
  if (!fs.existsSync(filePath)) {
    const date = new Date().toISOString().split('T')[0];
    const header = [
      `# Yield — Log de Sistema`,
      `**Data:** ${date}  `,
      `**Gerado automaticamente por logger.js**`,
      '',
      '---',
      '',
    ].join('\n');
    fs.writeFileSync(filePath, header, 'utf-8');
  }
}

/**
 * Formata uma entrada de log como bloco Markdown.
 * Estratégico: uma linha por log, sem verbosidade.
 */
function formatMarkdown(level, component, type, message, meta) {
  const parts = [
    `**[${timestamp()}]**`,
    `${level.emoji} \`${level.label}\``,
    `| \`${type}\``,
    `| **${component}**`,
    `— ${message}`,
  ];

  let line = parts.join(' ');

  // Meta só é incluída se presente e relevante
  if (meta && Object.keys(meta).length > 0) {
    const metaStr = JSON.stringify(meta, null, 0);
    // Limita a 200 chars para manter logs concisos
    line += `  \n> ${metaStr.length > 200 ? metaStr.substring(0, 197) + '...' : metaStr}`;
  }

  return line + '\n\n';
}

/**
 * Formata para console: conciso e colorido.
 */
function formatConsole(level, component, type, message) {
  return `[${timestamp()}] ${level.label} (${type}/${component}) ${message}`;
}

/**
 * Escreve no arquivo .md.
 * Append-only, nunca sobrescreve.
 */
function writeToFile(entry) {
  if (!_fileEnabled) return;
  try {
    const filePath = getLogFilePath();
    if (_logFilePath !== filePath) {
      _logFilePath = filePath;
      initLogFile(filePath);
    }
    fs.appendFileSync(filePath, entry, 'utf-8');
  } catch {
    // Falha silenciosa — logging não deve quebrar o sistema
  }
}

// ============================================================
// API Pública
// ============================================================

const logger = {
  /**
   * Inicializa o logger. Chamado uma vez no startup.
   * @param {Object} options
   * @param {string} [options.minLevel='DEBUG'] - Nível mínimo: ERROR, WARN, INFO, DEBUG
   * @param {boolean} [options.console=true] - Habilitar console
   * @param {boolean} [options.file=true] - Habilitar arquivo .md
   */
  init(options = {}) {
    const levelName = (options.minLevel || 'DEBUG').toUpperCase();
    _minLevel = (LOG_LEVELS[levelName] || LOG_LEVELS.DEBUG).priority;
    _consoleEnabled = options.console !== false;
    _fileEnabled = options.file !== false;

    if (_fileEnabled) {
      ensureLogDir();
    }

    _initialized = true;
  },

  /**
   * Log genérico — base de todos os métodos.
   * @param {string} levelName - ERROR | WARN | INFO | DEBUG
   * @param {string} component - Nome do módulo (ex: 'MemoryManager', 'AIClient')
   * @param {string} type - COMPONENT_TYPES: 'logic' | 'ai' | 'system'
   * @param {string} message - Mensagem descritiva
   * @param {Object} [meta] - Metadata adicional (opcional)
   */
  log(levelName, component, type, message, meta = null) {
    if (!_initialized) this.init();

    const level = LOG_LEVELS[levelName.toUpperCase()];
    if (!level || level.priority > _minLevel) return;

    // Console
    if (_consoleEnabled) {
      const consoleFn = level.priority === 0 ? console.error
        : level.priority === 1 ? console.warn
        : console.log;
      consoleFn(formatConsole(level, component, type, message));
    }

    // Arquivo .md
    writeToFile(formatMarkdown(level, component, type, message, meta));
  },

  // --- Atalhos por nível ---

  error(component, type, message, meta) {
    this.log('ERROR', component, type, message, meta);
  },

  warn(component, type, message, meta) {
    this.log('WARN', component, type, message, meta);
  },

  info(component, type, message, meta) {
    this.log('INFO', component, type, message, meta);
  },

  debug(component, type, message, meta) {
    this.log('DEBUG', component, type, message, meta);
  },

  // --- Atalhos por tipo (logic / ai / system) ---

  /** Log de operação de lógica pura */
  logic(levelName, component, message, meta) {
    this.log(levelName, component, COMPONENT_TYPES.LOGIC, message, meta);
  },

  /** Log de operação de IA */
  ai(levelName, component, message, meta) {
    this.log(levelName, component, COMPONENT_TYPES.AI, message, meta);
  },

  /** Log de sistema / infraestrutura */
  system(levelName, component, message, meta) {
    this.log(levelName, component, COMPONENT_TYPES.SYSTEM, message, meta);
  },

  // --- Constantes exportadas para consumidores ---
  LEVELS: LOG_LEVELS,
  TYPES: COMPONENT_TYPES,
};

module.exports = logger;
