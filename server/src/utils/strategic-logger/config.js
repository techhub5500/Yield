/**
 * Configurações do Sistema de Logs Estratégico
 * 
 * Este arquivo centraliza todas as configurações do sistema de logs.
 * Modifique aqui para ajustar comportamentos globais.
 */

const path = require('path');

/**
 * Níveis de log disponíveis (ordem de severidade)
 */
const LOG_LEVELS = {
  CRITICAL: { value: 0, label: 'CRITICAL', emoji: '🔴' },
  ERROR: { value: 1, label: 'ERROR', emoji: '❌' },
  WARNING: { value: 2, label: 'WARNING', emoji: '⚠️' },
  INFO: { value: 3, label: 'INFO', emoji: '✅' }
};

/**
 * Categorias de logs para organização
 */
const LOG_CATEGORIES = {
  SYSTEM: 'system',           // Inicialização, shutdown, saúde
  REQUEST: 'request',         // Ciclo de requisições
  AGENT: 'agent',             // Fluxo de agentes (Junior, Orquestrador, Coordenadores)
  FINANCE_BRIDGE: 'bridge',   // Operações do Finance Bridge
  MEMORY: 'memory',           // Sistema de memória
  AUTH: 'auth',               // Autenticação
  DATABASE: 'database'        // Operações de banco
};

/**
 * Configurações de arquivos
 */
const FILE_CONFIG = {
  // Diretório base para logs (relativo ao root do server)
  logsDir: path.join(__dirname, '../../../logs'),
  
  // Formato de nome do arquivo de log diário
  dailyLogPattern: 'yield-{date}.md',
  
  // Máximo de arquivos de log a manter (rotação)
  maxFiles: 7,
  
  // Tamanho máximo por arquivo antes de rotacionar (em bytes)
  maxFileSize: 5 * 1024 * 1024, // 5MB
  
  // Criar novo arquivo por dia
  rotateDaily: true
};

/**
 * Configurações de comportamento
 */
const BEHAVIOR_CONFIG = {
  // Nível mínimo de log a registrar (CRITICAL=0, ERROR=1, WARNING=2, INFO=3)
  minLevel: process.env.LOG_MIN_LEVEL || 'INFO',
  
  // Também imprimir no console
  consoleOutput: process.env.LOG_CONSOLE !== 'false',
  
  // Registrar stack trace completo para erros
  includeStackTrace: true,
  
  // Buffer de escrita (agrupa logs antes de escrever)
  bufferSize: 5,
  
  // Tempo máximo para flush do buffer (ms)
  bufferFlushInterval: 3000,
  
  // Habilitar logs (false desabilita tudo)
  enabled: process.env.LOG_ENABLED !== 'false'
};

/**
 * Templates Markdown para formatação
 */
const MARKDOWN_TEMPLATES = {
  // Cabeçalho do arquivo de log diário
  fileHeader: `# 📋 Logs do Sistema Yield

> **Data:** {date}
> **Ambiente:** {env}

---

`,

  // Separador de seção (nova hora)
  hourSection: `
## ⏰ {hour}

`,

  // Template de entrada de log
  logEntry: `### {emoji} {level} | {time}

**Categoria:** \`{category}\`  
**Componente:** {component}

{message}

{details}

---

`,

  // Template para erros com stack trace
  errorDetails: `
<details>
<summary>🔍 Detalhes do Erro</summary>

\`\`\`
{stack}
\`\`\`

</details>
`,

  // Template para dados adicionais
  metaDetails: `
| Campo | Valor |
|-------|-------|
{rows}
`
};

/**
 * Eventos estratégicos a sempre logar (independente do nível)
 */
const STRATEGIC_EVENTS = [
  // Ciclo de vida do sistema
  'server.start',
  'server.stop',
  'server.error',
  
  // Fluxo de agentes
  'agent.junior.classify',
  'agent.junior.escalate',
  'agent.orchestrator.plan',
  'agent.coordinator.complete',
  'agent.response.deliver',
  
  // Decisões críticas
  'decision.route',
  'decision.fallback',
  
  // Operações importantes
  'finance.operation.complete',
  'memory.compress',
  
  // Erros e falhas
  'error.unhandled',
  'error.timeout',
  'error.validation'
];

module.exports = {
  LOG_LEVELS,
  LOG_CATEGORIES,
  FILE_CONFIG,
  BEHAVIOR_CONFIG,
  MARKDOWN_TEMPLATES,
  STRATEGIC_EVENTS
};
