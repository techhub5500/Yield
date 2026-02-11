/**
 * @module tools/finance-bridge/schema
 * @description Schema completo do Finance Bridge.
 * Define todos os campos aceitos, tipos, validações e períodos inteligentes.
 * Exportado como constante para ser enviado à IA na conversão NL→JSON.
 * 
 * LÓGICA PURA — definição de estrutura.
 */

/**
 * Schema do Finance Bridge.
 * Enviado à IA para guiar a conversão de linguagem natural para JSON.
 */
const FINANCE_BRIDGE_SCHEMA = {
  description: 'Schema para operações financeiras via Finance Bridge',

  operations: ['query', 'insert'],

  query_schema: {
    operation: 'query',
    params: {
      filters: {
        period: {
          description: 'Período da consulta',
          options: {
            start: 'Data início (YYYY-MM-DD)',
            end: 'Data fim (YYYY-MM-DD)',
            named_period: 'Período pré-definido: current_month | last_month | last_quarter | last_6_days | fiscal_year | since_last_payday',
          },
        },
        amount: {
          description: 'Filtro por valor',
          options: {
            min: 'Valor mínimo (number)',
            max: 'Valor máximo (number)',
          },
        },
        categories: {
          description: 'Lista de categorias para filtrar (array de strings)',
          type: 'string[]',
        },
        type: {
          description: 'Tipo da transação (expense | income | all). Omitir para ambas.',
          options: ['expense', 'income', 'all'],
        },
        subcategories: {
          description: 'Lista de subcategorias para filtrar (array de strings)',
          type: 'string[]',
        },
        status: {
          description: 'Status da transação',
          type: 'string',
        },
        payment_method: {
          description: 'Método de pagamento',
          type: 'string',
        },
        tags: {
          description: 'Tags para filtrar (array de strings)',
          type: 'string[]',
        },
      },
      logic: {
        description: 'Lógica booleana para filtros',
        options: ['AND', 'OR', 'NOT'],
        default: 'AND',
      },
      exclude: {
        description: 'Critérios de exclusão',
        options: {
          tags: 'Tags a excluir (array de strings)',
          categories: 'Categorias a excluir (array de strings)',
        },
      },
      sort: {
        description: 'Ordenação dos resultados',
        options: {
          field: 'date | amount | category',
          order: 'asc | desc',
        },
      },
      limit: {
        description: 'Número máximo de resultados (number)',
        type: 'number',
      },
    },
    context: {
      user_timezone: {
        description: 'Timezone do usuário',
        default: 'America/Sao_Paulo',
      },
      currency: {
        description: 'Moeda',
        default: 'BRL',
      },
    },
  },

  insert_schema: {
    operation: 'insert',
    params: {
      amount: { description: 'Valor da transação (number, obrigatório)', required: true },
      date: { description: 'Data da transação (YYYY-MM-DD, obrigatório)', required: true },
      type: { description: '"expense" ou "income" (obrigatório)', required: true },
      category: { description: 'Categoria principal (obrigatório)', required: true },
      subcategory: { description: 'Subcategoria (obrigatório)', required: true },
      description: { description: 'Descrição textual', required: false },
      payment_method: { description: 'Método de pagamento (credit_card, debit_card, pix, cash, transfer)', required: false },
      status: { description: 'Status (completed, pending)', default: 'completed' },
    },
  },

  named_periods: {
    current_month: 'Do dia 01 do mês atual até hoje',
    last_month: 'Mês anterior completo',
    last_quarter: 'Últimos 3 meses fechados',
    last_6_days: 'Últimos 6 dias a partir de hoje',
    fiscal_year: 'Ano fiscal vigente (01/01 até hoje)',
    since_last_payday: 'Desde último recebimento de salário',
  },
};

/**
 * Retorna o schema formatado como string para inclusão em prompts de IA.
 * @returns {string}
 */
function getSchemaForPrompt() {
  return JSON.stringify(FINANCE_BRIDGE_SCHEMA, null, 2);
}

module.exports = { FINANCE_BRIDGE_SCHEMA, getSchemaForPrompt };
