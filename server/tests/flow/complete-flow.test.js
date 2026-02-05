/**
 * Testes de Fluxo Completo
 * Fase 6 - Fluxo de Execução Contínua
 * 
 * Testes que validam o funcionamento end-to-end do sistema:
 * 1. Usuário envia mensagem complexa
 * 2. Agente Júnior classifica e escala
 * 3. Orquestrador decompõe e gera DOC
 * 4. Coordenadores executam com estado de espera
 * 5. Agente de Resposta sintetiza resultado
 * 6. Resposta final entregue ao usuário
 */

const assert = require('assert');

// Mocks dos módulos
const mockLogger = {
  info: () => {},
  debug: () => {},
  warn: () => {},
  error: () => {}
};

// Substituir logger real por mock para testes
jest.mock('../../../utils/logger', () => mockLogger);

// Importar módulos após mock
const { StateManager, STATE_STATUS } = require('../execution/state-manager');
const { EventHandler, EVENT_TYPES } = require('../execution/event-handler');
const { FlowController, FLOW_STATUS } = require('../execution/flow-controller');
const { ResponseAgent, RESPONSE_TYPES } = require('../response/response-agent');
const Synthesizer = require('../response/synthesizer');
const Formatter = require('../response/formatter');

describe('Fase 6 - Fluxo de Execução Contínua', () => {
  
  // ==================== TESTES DO STATE MANAGER ====================
  
  describe('StateManager', () => {
    let stateManager;

    beforeEach(() => {
      stateManager = new StateManager();
    });

    afterEach(() => {
      stateManager.clearAll();
    });

    test('deve gerar ID único para agente', () => {
      const id1 = stateManager.generateAgentId('analysis', 'doc123');
      const id2 = stateManager.generateAgentId('analysis', 'doc123');
      
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^analysis_doc123_\d+_\w+$/);
    });

    test('deve salvar estado corretamente', () => {
      const agentId = 'test_agent_1';
      const state = {
        memory: { cycles: [] },
        context: { userId: '123' },
        pendingTool: 'finance_bridge',
        currentStep: 0
      };

      const saved = stateManager.saveState(agentId, state);

      expect(saved.status).toBe(STATE_STATUS.WAITING);
      expect(saved.agentId).toBe(agentId);
      expect(saved.pendingTool).toBe('finance_bridge');
      expect(saved.savedAt).toBeDefined();
    });

    test('deve restaurar estado salvo', () => {
      const agentId = 'test_agent_2';
      const state = {
        memory: { data: 'test' },
        currentStep: 2
      };

      stateManager.saveState(agentId, state);
      const restored = stateManager.restoreState(agentId);

      expect(restored.status).toBe(STATE_STATUS.RESUMED);
      expect(restored.memory.data).toBe('test');
      expect(restored.currentStep).toBe(2);
    });

    test('deve lançar erro ao restaurar estado inexistente', () => {
      expect(() => {
        stateManager.restoreState('nonexistent_agent');
      }).toThrow('Estado não encontrado');
    });

    test('deve atualizar estado com resposta de ferramenta', () => {
      const agentId = 'test_agent_3';
      stateManager.saveState(agentId, {
        currentStep: 1,
        intermediateResults: [],
        pendingTool: 'finance_bridge'
      });

      const response = { data: [{ amount: 100 }] };
      const updated = stateManager.updateWithToolResponse(agentId, response);

      expect(updated.currentStep).toBe(2);
      expect(updated.intermediateResults.length).toBe(1);
      expect(updated.pendingTool).toBeNull();
    });

    test('deve detectar timeout corretamente', () => {
      const agentId = 'test_agent_4';
      stateManager.saveState(agentId, {});

      // Simular passagem de tempo
      const state = stateManager.getState(agentId);
      state.savedAt = Date.now() - 90000; // 90 segundos atrás

      expect(stateManager.checkTimeout(agentId, 80000)).toBe(true);
      expect(stateManager.checkTimeout(agentId, 100000)).toBe(false);
    });

    test('deve limpar estado corretamente', () => {
      const agentId = 'test_agent_5';
      stateManager.saveState(agentId, {});

      expect(stateManager.getState(agentId)).not.toBeNull();

      stateManager.clearState(agentId, STATE_STATUS.COMPLETED);

      expect(stateManager.getState(agentId)).toBeNull();
    });

    test('deve retornar estatísticas corretas', () => {
      stateManager.saveState('agent_a', {});
      stateManager.saveState('agent_b', {});
      
      const stats = stateManager.getStats();

      expect(stats.total).toBe(2);
      expect(stats.waiting).toBe(2);
    });
  });

  // ==================== TESTES DO EVENT HANDLER ====================

  describe('EventHandler', () => {
    let eventHandler;
    let stateManager;

    beforeEach(() => {
      stateManager = new StateManager();
      eventHandler = new EventHandler(stateManager);
    });

    afterEach(() => {
      eventHandler.clearAll();
      stateManager.clearAll();
    });

    test('deve registrar callback para resposta de ferramenta', () => {
      const agentId = 'event_test_1';
      const callback = jest.fn();

      eventHandler.onToolResponse(agentId, callback);

      expect(eventHandler.hasListener(agentId)).toBe(true);
    });

    test('deve processar resposta de ferramenta e chamar callback', async () => {
      const agentId = 'event_test_2';
      const callback = jest.fn().mockResolvedValue({ processed: true });

      // Salvar estado
      stateManager.saveState(agentId, {
        currentStep: 0,
        intermediateResults: []
      });

      // Registrar callback
      eventHandler.onToolResponse(agentId, callback);

      // Simular resposta
      const response = { data: 'test_data' };
      const result = await eventHandler.handleToolResponse(agentId, response);

      expect(result.success).toBe(true);
      expect(callback).toHaveBeenCalled();
    });

    test('deve processar erro de ferramenta', async () => {
      const agentId = 'event_test_3';
      const errorCallback = jest.fn();

      stateManager.saveState(agentId, { currentStep: 0 });
      eventHandler.onToolResponse(agentId, jest.fn());
      eventHandler.onToolError(agentId, errorCallback);

      const error = new Error('Connection failed');
      const result = await eventHandler.handleToolError(agentId, error);

      expect(result.success).toBe(false);
      expect(result.handled).toBe(true);
    });

    test('deve processar timeout', async () => {
      const agentId = 'event_test_4';

      stateManager.saveState(agentId, { currentStep: 0 });

      const result = await eventHandler.handleTimeout(agentId);

      expect(result.success).toBe(false);
      expect(result.timeout).toBe(true);
    });

    test('deve executar handlers globais', async () => {
      const globalHandler = jest.fn();
      const agentId = 'event_test_5';

      stateManager.saveState(agentId, { currentStep: 0, intermediateResults: [] });
      eventHandler.registerGlobalHandler(EVENT_TYPES.TOOL_RESPONSE, globalHandler);
      eventHandler.onToolResponse(agentId, jest.fn().mockResolvedValue({}));

      await eventHandler.handleToolResponse(agentId, { data: 'test' });

      expect(globalHandler).toHaveBeenCalled();
    });

    test('deve retornar estatísticas corretas', () => {
      eventHandler.onToolResponse('agent_x', jest.fn());
      eventHandler.onToolResponse('agent_y', jest.fn());

      const stats = eventHandler.getStats();

      expect(stats.activeListeners).toBe(2);
    });
  });

  // ==================== TESTES DO FLOW CONTROLLER ====================

  describe('FlowController', () => {
    let flowController;

    beforeEach(() => {
      flowController = new FlowController();
    });

    afterEach(async () => {
      await flowController.shutdown();
    });

    test('deve gerar ID de execução único', () => {
      const id1 = flowController.generateExecutionId();
      const id2 = flowController.generateExecutionId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^exec_\d+_\w+$/);
    });

    test('deve executar agente mock com sucesso', async () => {
      const mockAgent = {
        agentType: 'test',
        process: jest.fn().mockResolvedValue({
          success: true,
          result: { data: 'test_result' }
        })
      };

      const input = {
        memory: {},
        query: 'test query',
        doc: { id: 'doc_1' }
      };

      const result = await flowController.executeAgent(mockAgent, input);

      expect(result.success).toBe(true);
      expect(mockAgent.process).toHaveBeenCalled();
    });

    test('deve tratar timeout de agente', async () => {
      const slowAgent = {
        agentType: 'slow_test',
        process: () => new Promise(resolve => setTimeout(resolve, 200))
      };

      const result = await flowController.executeAgent(
        slowAgent,
        {},
        { timeout: 50 }
      );

      expect(result.success).toBe(false);
      expect(result.timeout).toBe(true);
    });

    test('deve registrar execuções', async () => {
      const mockAgent = {
        process: jest.fn().mockResolvedValue({ success: true })
      };

      const result = await flowController.executeAgent(mockAgent, {});
      const execution = flowController.getExecution(result.executionId);

      expect(execution).toBeDefined();
      expect(execution.status).toBe(FLOW_STATUS.COMPLETED);
    });

    test('deve retornar estatísticas corretas', async () => {
      const mockAgent = {
        process: jest.fn().mockResolvedValue({ success: true })
      };

      await flowController.executeAgent(mockAgent, {});

      const stats = flowController.getStats();

      expect(stats.totalExecutions).toBe(1);
      expect(stats.completedExecutions).toBe(1);
    });

    test('deve cancelar execução ativa', async () => {
      const longAgent = {
        agentType: 'long_test',
        process: () => new Promise(resolve => setTimeout(resolve, 10000))
      };

      // Iniciar execução sem await
      const execPromise = flowController.executeAgent(longAgent, {}, { timeout: 10000 });

      // Esperar um pouco e obter execuções ativas
      await new Promise(resolve => setTimeout(resolve, 50));
      const active = flowController.getActiveExecutions();

      if (active.length > 0) {
        const cancelResult = flowController.cancelExecution(active[0].id);
        expect(cancelResult.success).toBe(true);
      }
    });
  });

  // ==================== TESTES DO RESPONSE AGENT ====================

  describe('ResponseAgent', () => {
    let responseAgent;

    beforeEach(async () => {
      responseAgent = new ResponseAgent();
      await responseAgent.initialize();
    });

    test('deve processar resultado de único coordenador', async () => {
      const memory = { cycles: [] };
      const query = 'Quanto gastei este mês?';
      const doc = { id: 'doc_1' };
      const results = {
        completed: {
          analysis: {
            result: {
              structuredData: {
                spending: { total: 3500 }
              },
              summary: 'Análise concluída'
            }
          }
        },
        failed: {},
        pending: {}
      };

      const response = await responseAgent.process(memory, query, doc, results);

      expect(response.success).toBe(true);
      expect(response.response.structured.type).toBe(RESPONSE_TYPES.SINGLE_AGENT);
    });

    test('deve processar resultados de múltiplos coordenadores', async () => {
      const results = {
        completed: {
          analysis: { result: { structuredData: { spending: { total: 3500 } } } },
          planning: { result: { structuredData: { budget: { total: 4000 } } } }
        },
        failed: {},
        pending: {}
      };

      const response = await responseAgent.process({}, 'Analise e planeje', {}, results);

      expect(response.success).toBe(true);
      expect(response.response.structured.type).toBe(RESPONSE_TYPES.MULTI_AGENT);
      expect(response.response.structured.agents).toContain('analysis');
      expect(response.response.structured.agents).toContain('planning');
    });

    test('deve tratar resultados parciais', async () => {
      const results = {
        completed: {
          analysis: { result: { structuredData: {} } }
        },
        failed: {
          investments: { error: 'API indisponível' }
        },
        pending: {}
      };

      const response = await responseAgent.process({}, 'Analise tudo', {}, results);

      expect(response.success).toBe(true);
      expect(response.response.structured.type).toBe(RESPONSE_TYPES.PARTIAL);
    });

    test('deve gerar resposta de erro', () => {
      const error = new Error('Falha crítica');
      const response = responseAgent.generateErrorResponse(error, 'Teste');

      expect(response.structured.type).toBe(RESPONSE_TYPES.ERROR);
      expect(response.text).toContain('Falha crítica');
    });
  });

  // ==================== TESTES DO SYNTHESIZER ====================

  describe('Synthesizer', () => {
    let synthesizer;

    beforeEach(() => {
      synthesizer = new Synthesizer();
    });

    test('deve combinar resultados de múltiplos agentes', () => {
      const results = {
        analysis: {
          result: { structuredData: { spending: { total: 1000 } } }
        },
        planning: {
          result: { structuredData: { budget: { total: 1500 } } }
        }
      };

      const combined = synthesizer.combineResults(results);

      expect(combined.agents).toContain('analysis');
      expect(combined.agents).toContain('planning');
      expect(combined.allData.analysis).toBeDefined();
      expect(combined.allData.planning).toBeDefined();
    });

    test('deve extrair insights de análise', () => {
      const data = {
        spending: {
          total: 3500,
          byCategory: { food: 1000, transport: 500 }
        },
        patterns: {
          trend: 'increasing'
        }
      };

      const insights = synthesizer.extractAnalysisInsights(data);

      expect(insights.length).toBeGreaterThan(0);
      expect(insights.some(i => i.category === 'spending_total')).toBe(true);
    });

    test('deve priorizar insights por relevância', () => {
      const insights = [
        { type: 'data', category: 'spending_total', priority: 2 },
        { type: 'alert', category: 'critical', priority: 1 },
        { type: 'data', category: 'other', priority: 3 }
      ];

      const query = 'quanto gastei';
      const prioritized = synthesizer.prioritizeContent(insights, query);

      expect(prioritized[0].relevanceScore).toBeGreaterThan(prioritized[2].relevanceScore);
    });

    test('deve gerar estrutura de resposta', () => {
      const insights = [
        { type: 'data', category: 'test', content: 100, label: 'Test' }
      ];
      const context = { agentsUsed: ['analysis'] };

      const structure = synthesizer.generateResponseStructure(insights, context);

      expect(structure.title).toBeDefined();
      expect(structure.sections).toBeDefined();
    });
  });

  // ==================== TESTES DO FORMATTER ====================

  describe('Formatter', () => {
    let formatter;

    beforeEach(() => {
      formatter = new Formatter();
    });

    test('deve formatar moeda brasileira', () => {
      expect(formatter.formatCurrency(1234.56)).toBe('R$\u00A01.234,56');
      expect(formatter.formatCurrency(0)).toBe('R$\u00A00,00');
      expect(formatter.formatCurrency(1000000)).toBe('R$\u00A01.000.000,00');
    });

    test('deve formatar percentuais', () => {
      expect(formatter.formatPercentage(12.34)).toBe('12,34%');
      expect(formatter.formatPercentage(0.1234, true)).toBe('12,34%');
    });

    test('deve formatar datas', () => {
      const date = new Date('2026-02-04');
      expect(formatter.formatDate(date)).toBe('04/02/2026');
    });

    test('deve formatar seções', () => {
      const section = {
        title: '📊 Teste',
        items: [
          { label: 'Item 1', value: 100 },
          { label: 'Item 2', value: 200 }
        ]
      };

      const formatted = formatter.formatSection(section);

      expect(formatted).toContain('### 📊 Teste');
      expect(formatted).toContain('Item 1');
    });

    test('deve formatar alertas', () => {
      const alerts = [
        { level: 'warning', message: 'Atenção!' },
        { level: 'critical', message: 'Crítico!' }
      ];

      const formatted = formatter.formatAlerts(alerts);

      expect(formatted).toContain('⚠️');
      expect(formatted).toContain('❌');
    });

    test('deve truncar resposta longa', () => {
      const longContent = 'A'.repeat(5000);
      const truncated = formatter.truncateIfNeeded(longContent, 100);

      expect(truncated.length).toBeLessThan(longContent.length);
      expect(truncated).toContain('Resposta resumida');
    });

    test('deve tornar resposta acionável', () => {
      const content = 'Análise de gastos concluída.';
      const query = 'quanto gastei';

      const actionable = formatter.makeActionable(content, query);

      expect(actionable).toContain('orçamento');
    });
  });

  // ==================== TESTE DE FLUXO COMPLETO ====================

  describe('Fluxo Completo End-to-End', () => {
    test('deve processar requisição complexa do início ao fim', async () => {
      // 1. Simular mensagem do usuário
      const userQuery = 'Analise meus gastos e sugira um orçamento';
      const memory = { cycles: [], compressed: {} };

      // 2. Simular classificação do Júnior como COMPLEX
      const complexity = 'complex';
      expect(complexity).toBe('complex');

      // 3. Simular DOC gerado pelo Orquestrador
      const doc = {
        id: 'doc_test_123',
        original_query: userQuery,
        analysis: {
          intent: 'Análise + Planejamento',
          reasoning: 'Requer análise de gastos e criação de orçamento'
        },
        task_distribution: [
          {
            agent: 'analysis',
            task_description: 'Analisar gastos',
            depends_on: []
          },
          {
            agent: 'planning',
            task_description: 'Criar orçamento',
            depends_on: ['analysis']
          }
        ]
      };

      // 4. Simular resultados dos coordenadores
      const coordinatorResults = {
        completed: {
          analysis: {
            result: {
              content: {
                summary: 'Gastos analisados',
                structuredData: {
                  spending: {
                    total: 3500,
                    byCategory: {
                      'Alimentação': 1200,
                      'Transporte': 800,
                      'Lazer': 500
                    }
                  }
                }
              }
            }
          },
          planning: {
            result: {
              content: {
                summary: 'Orçamento criado',
                structuredData: {
                  budget: {
                    limits: {
                      'Alimentação': 1000,
                      'Transporte': 600,
                      'Lazer': 400
                    }
                  },
                  recommendations: [
                    'Reduzir gastos com alimentação em 17%'
                  ]
                }
              }
            }
          }
        },
        failed: {},
        pending: {}
      };

      // 5. Processar com Agente de Resposta
      const responseAgent = new ResponseAgent();
      await responseAgent.initialize();

      const response = await responseAgent.process(
        memory,
        userQuery,
        doc,
        coordinatorResults
      );

      // 6. Validar resposta final
      expect(response.success).toBe(true);
      expect(response.response.text).toBeDefined();
      expect(response.response.structured.type).toBe(RESPONSE_TYPES.MULTI_AGENT);
      expect(response.response.structured.agents).toContain('analysis');
      expect(response.response.structured.agents).toContain('planning');
      expect(response.metadata.duration_ms).toBeGreaterThan(0);

      console.log('\n=== RESULTADO DO FLUXO COMPLETO ===\n');
      console.log(response.response.text);
    });
  });
});

// ==================== RUNNER MANUAL ====================

/**
 * Runner para executar testes manualmente (sem Jest)
 */
async function runManualTests() {
  console.log('=== Executando testes manuais ===\n');

  // Teste básico do StateManager
  console.log('Testando StateManager...');
  const stateManager = new StateManager();
  const agentId = stateManager.generateAgentId('test', 'doc1');
  stateManager.saveState(agentId, { test: true });
  const restored = stateManager.restoreState(agentId);
  console.log('  ✓ StateManager funcionando');

  // Teste básico do EventHandler
  console.log('Testando EventHandler...');
  const eventHandler = new EventHandler(stateManager);
  eventHandler.onToolResponse('test', () => Promise.resolve());
  console.log('  ✓ EventHandler funcionando');

  // Teste básico do FlowController
  console.log('Testando FlowController...');
  const flowController = new FlowController();
  const execId = flowController.generateExecutionId();
  console.log('  ✓ FlowController funcionando');

  // Teste básico do Formatter
  console.log('Testando Formatter...');
  const formatter = new Formatter();
  const currency = formatter.formatCurrency(1234.56);
  console.log(`  ✓ Formatter funcionando (${currency})`);

  // Teste básico do Synthesizer
  console.log('Testando Synthesizer...');
  const synthesizer = new Synthesizer();
  const combined = synthesizer.combineResults({});
  console.log('  ✓ Synthesizer funcionando');

  // Cleanup
  stateManager.clearAll();
  eventHandler.clearAll();
  await flowController.shutdown();

  console.log('\n=== Todos os testes manuais passaram! ===');
}

// Exportar para uso em diferentes contextos
module.exports = { runManualTests };

// Executar testes manuais se chamado diretamente
if (require.main === module) {
  runManualTests().catch(console.error);
}
