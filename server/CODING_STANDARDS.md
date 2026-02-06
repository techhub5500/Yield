# Padrões de Código — Yield Server

## Nomenclatura

### Arquivos
- `kebab-case.js` para módulos (ex: `model-factory.js`, `memory-manager.js`)
- `PascalCase` para classes internas
- `camelCase` para funções e variáveis

### Classes e Funções
- Classes: `PascalCase` (ex: `Memory`, `MemoryManager`, `OpenAIClient`)
- Funções: `camelCase` (ex: `countWords`, `loadMemory`, `summarizeCycle`)
- Constantes: `UPPER_SNAKE_CASE` (ex: `SYSTEM_PROMPT`, `LOG_LEVELS`)

### Diretórios
- `core/` — Lógica pura (determinística, sem IA)
- `agents/` — Módulos que usam IA (cada arquivo isola um ponto de IA)
- `tools/` — Ferramentas e APIs externas (execução)
- `utils/` — Utilidades transversais (logger, AI client, helpers)
- `config/` — Configurações

## Separação IA vs Lógica

### REGRA FUNDAMENTAL
- Arquivos em `core/` NUNCA importam modelos de IA diretamente
- Arquivos em `agents/` encapsulam exatamente UM ponto de decisão de IA
- A integração entre lógica e IA acontece nos **managers** (ex: `memory/manager.js`)

### Quando usar IA
- Classificação baseada em contexto
- Processamento de linguagem natural
- Raciocínio estratégico
- Síntese e formatação para humanos

### Quando usar Lógica
- Roteamento de execução (`if/else`, `switch`)
- Manipulação de dados (CRUD, arrays, strings)
- Validação de estrutura e tipos
- Controle de fluxo
- Cálculos matemáticos

## Documentação

### Header de arquivo
Todo arquivo deve ter um bloco JSDoc explicando:
```javascript
/**
 * @module nome/do/modulo
 * @description O que este módulo faz (1-2 linhas)
 */
```

### Funções públicas
```javascript
/**
 * Descrição concisa da função.
 * @param {tipo} nome - Descrição
 * @returns {tipo} Descrição
 * @throws {NomeDoErro} Quando X acontece
 */
```

## Exports
- Um export padrão por arquivo (`module.exports = ...`)
- Para múltiplas funções: `module.exports = { fn1, fn2 }`
- Não misturar default export com named exports

## Error Handling
- Sempre capturar erros de chamadas externas (banco, IA, APIs)
- Prover fallbacks quando possível (ex: IA falhou → preservar dados originais)
- Logar erros via `logger.error()` — nunca `console.error` direto
- Nunca silenciar erros sem logging

## Logging
- Todo log passa por `utils/logger.js`
- Usar tipo correto: `logic`, `ai`, `system`
- Logs devem ser úteis, não verbosos
- Cada log responde: "O que tentou?", "Que decisão?", ou "O que deu errado?"
