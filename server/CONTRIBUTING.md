# Guia de Contribuição — Yield Server

## Estrutura do Projeto

```
server/src/
├── agents/         # Módulos com IA (1 ponto de IA por arquivo)
├── core/           # Lógica pura (sem IA, determinístico)
├── tools/          # Ferramentas e APIs externas
├── api/            # Servidor HTTP e rotas
├── utils/          # Utilitários (logger, AI client)
└── config/         # Configuração centralizada
```

---

## Como Adicionar um Novo Agente Coordenador

1. **Criar o arquivo em `agents/coordinators/<nome>.js`**
2. **Herdar de `BaseCoordinator`:**
   ```javascript
   const BaseCoordinator = require('./base');

   class NovoCoordinator extends BaseCoordinator {
     constructor(tools) {
       super('NovoCoordinator', 'novo', tools, SYSTEM_PROMPT);
     }
   }
   ```
3. **Definir o prompt de sistema** com as 6 etapas do Chain of Thought
4. **Definir ferramentas disponíveis** no contrato (em `agents/orchestrator/contracts.js`)
5. **Registrar** no `ExecutionManager` (passando no construtor de `coordinators`)
6. **Atualizar** o prompt do Orquestrador para incluir o contrato do novo agente
7. **Exportar** em `src/index.js`

---

## Como Adicionar uma Nova Ferramenta (API Externa)

1. **Criar cliente em `tools/search/<nome>.js`** ou `tools/<nome>/`
2. **Implementar método principal:** `async search(query)` ou equivalente
3. **Incluir error handling:** timeout, retry, fallback
4. **Registrar no `SearchManager`** (se for busca) ou expor diretamente
5. **Atualizar `config/index.js`** com API key via variável de ambiente
6. **Documentar** nos contratos dos coordenadores que podem usá-la
7. **Exportar** em `src/index.js`

---

## Como Modificar Prompts de IA

1. Prompts ficam em arquivos `prompt.js` separados do código de execução
2. **Nunca** altere a lógica de execução ao modificar um prompt
3. Ao alterar prompts de coordenadores, verifique:
   - As 6 etapas do CoT estão presentes
   - As ferramentas listadas correspondem ao contrato
   - O formato de saída JSON está especificado
4. Ao alterar o prompt do Orquestrador, verifique:
   - As 4 etapas estão presentes
   - Os contratos dos coordenadores estão atualizados

---

## Padrões de Código

### Nomenclatura
- Arquivos: `kebab-case.js`
- Classes: `PascalCase`
- Funções: `camelCase`
- Constantes: `UPPER_SNAKE_CASE`

### Exports
- Um export principal por arquivo
- Para múltiplas funções: `module.exports = { fn1, fn2 }`

### Error Handling
- Sempre capturar erros de chamadas externas
- Prover fallbacks quando possível
- Logar via `logger.error()` — nunca `console.error` direto

### Logging
- Todo log passa por `utils/logger.js`
- Tipos: `logic`, `ai`, `system`
- Cada log responde: "O que tentou?", "Que decisão?" ou "O que deu errado?"

---

## Processo de Code Review

1. Verificar separação IA vs Lógica
2. Verificar que arquivos em `core/` não importam IA
3. Verificar que cada arquivo em `agents/` tem exatamente 1 ponto de IA
4. Verificar fallbacks para pontos de IA
5. Verificar logging adequado (útil, não verboso)
6. Verificar testes (unitários para lógica, mocks para IA)
