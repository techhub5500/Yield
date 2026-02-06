/**
 * @module tests/core/memory.test
 * @description Testes unitários para o sistema de memória.
 * Testa: contagem de palavras, ciclos, estrutura de memória, detecção de limite.
 * Todas as funções testadas aqui são LÓGICA PURA — sem IA.
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { countWords, calculateTotalWords, calculateUsagePercentage } = require('../../src/core/memory/counter');
const Cycle = require('../../src/core/memory/cycle');
const Memory = require('../../src/core/memory/structure');

// ============================================================
// Testes: countWords
// ============================================================
describe('countWords', () => {
  it('deve retornar 0 para string vazia', () => {
    assert.equal(countWords(''), 0);
    assert.equal(countWords('   '), 0);
  });

  it('deve retornar 0 para null/undefined', () => {
    assert.equal(countWords(null), 0);
    assert.equal(countWords(undefined), 0);
  });

  it('deve contar palavras simples', () => {
    assert.equal(countWords('hello world'), 2);
    assert.equal(countWords('uma duas três quatro'), 4);
  });

  it('deve ignorar espaços extras', () => {
    assert.equal(countWords('  hello   world  '), 2);
  });

  it('deve contar valores monetários como palavras', () => {
    assert.equal(countWords('Gastei R$ 150,00 no almoço'), 5);
  });
});

// ============================================================
// Testes: calculateTotalWords
// ============================================================
describe('calculateTotalWords', () => {
  it('deve retornar 0 para memória vazia', () => {
    assert.equal(calculateTotalWords({ recent: [], old: [] }), 0);
  });

  it('deve calcular palavras de ciclos recentes', () => {
    const memory = {
      recent: [
        { userInput: 'Olá', aiResponse: 'Olá, como posso ajudar?' },
      ],
      old: [],
    };
    assert.equal(calculateTotalWords(memory), 5); // 1 + 4
  });

  it('deve somar recentes e antigos', () => {
    const memory = {
      recent: [{ userInput: 'uma duas', aiResponse: 'três quatro' }],
      old: [{ content: 'cinco seis sete' }],
    };
    assert.equal(calculateTotalWords(memory), 7); // 2 + 2 + 3
  });

  it('deve suportar old como array de strings', () => {
    const memory = {
      recent: [],
      old: ['resumo com quatro palavras'],
    };
    assert.equal(calculateTotalWords(memory), 4);
  });
});

// ============================================================
// Testes: calculateUsagePercentage
// ============================================================
describe('calculateUsagePercentage', () => {
  it('deve calcular percentual corretamente', () => {
    assert.equal(calculateUsagePercentage(1250, 2500), 0.5);
    assert.equal(calculateUsagePercentage(2250, 2500), 0.9);
    assert.equal(calculateUsagePercentage(2500, 2500), 1.0);
  });

  it('deve retornar 0 se maxWords é 0', () => {
    assert.equal(calculateUsagePercentage(100, 0), 0);
  });
});

// ============================================================
// Testes: Cycle
// ============================================================
describe('Cycle', () => {
  it('deve criar ciclo com id único', () => {
    const c1 = new Cycle('msg1', 'resp1');
    const c2 = new Cycle('msg2', 'resp2');
    assert.notEqual(c1.id, c2.id);
  });

  it('deve serializar e deserializar', () => {
    const original = new Cycle('pergunta', 'resposta');
    const json = original.toJSON();
    const restored = Cycle.fromJSON(json);

    assert.equal(restored.id, original.id);
    assert.equal(restored.userInput, 'pergunta');
    assert.equal(restored.aiResponse, 'resposta');
    assert.equal(restored.timestamp, original.timestamp);
  });

  it('deve auto-gerar timestamp se não fornecido', () => {
    const cycle = new Cycle('a', 'b');
    assert.ok(cycle.timestamp);
    assert.ok(!isNaN(Date.parse(cycle.timestamp)));
  });
});

// ============================================================
// Testes: Memory
// ============================================================
describe('Memory', () => {
  it('deve inicializar vazia', () => {
    const mem = new Memory();
    assert.equal(mem.recent.length, 0);
    assert.equal(mem.old.length, 0);
    assert.equal(mem.wordCount, 0);
  });

  it('deve adicionar ciclo aos recentes', () => {
    const mem = new Memory();
    const cycle = new Cycle('olá', 'olá, tudo bem?');
    const { movedCycle } = mem.addCycle(cycle);

    assert.equal(mem.recent.length, 1);
    assert.equal(movedCycle, null);
  });

  it('deve mover ciclo mais antigo quando excede limite', () => {
    const mem = new Memory();
    const c1 = new Cycle('primeiro', 'resposta um');
    const c2 = new Cycle('segundo', 'resposta dois');
    const c3 = new Cycle('terceiro', 'resposta três');

    mem.addCycle(c1);
    mem.addCycle(c2);
    const { movedCycle } = mem.addCycle(c3);

    assert.equal(mem.recent.length, 2);
    assert.equal(movedCycle.id, c1.id);
    assert.equal(mem.recent[0].id, c2.id);
    assert.equal(mem.recent[1].id, c3.id);
  });

  it('deve detectar necessidade de compressão quando > 90%', () => {
    const mem = new Memory();

    // Adicionar resumos antigos até passar de 2250 palavras (90% de 2500)
    const longText = 'palavra '.repeat(2300);
    mem.addOldSummary(longText, new Date().toISOString());

    assert.equal(mem.shouldCompress(), true);
  });

  it('não deve pedir compressão quando abaixo de 90%', () => {
    const mem = new Memory();
    mem.addOldSummary('Resumo curto', new Date().toISOString());
    assert.equal(mem.shouldCompress(), false);
  });

  it('deve substituir old por versão comprimida', () => {
    const mem = new Memory();
    mem.addOldSummary('Resumo 1', '2026-01-01');
    mem.addOldSummary('Resumo 2', '2026-01-02');
    mem.addOldSummary('Resumo 3', '2026-01-03');

    assert.equal(mem.old.length, 3);

    mem.replaceOldWithCompressed('Resumo comprimido final');
    assert.equal(mem.old.length, 1);
    assert.equal(mem.old[0].content, 'Resumo comprimido final');
    assert.equal(mem.old[0].compressed, true);
  });

  it('deve serializar e deserializar corretamente', () => {
    const mem = new Memory();
    mem.addCycle(new Cycle('pergunta', 'resposta'));
    mem.addOldSummary('Resumo antigo', '2026-01-01');

    const json = mem.toJSON();
    const restored = Memory.fromJSON(json);

    assert.equal(restored.recent.length, 1);
    assert.equal(restored.recent[0].userInput, 'pergunta');
    assert.equal(restored.old.length, 1);
    assert.equal(restored.old[0].content, 'Resumo antigo');
    assert.ok(restored.wordCount > 0);
  });
});
