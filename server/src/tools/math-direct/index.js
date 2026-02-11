/**
 * @module tools/math-direct
 * @description Executor de calculos matematicos diretos via MathModule.
 *
 * Recebe uma query de calculo com parametros explicitos,
 * converte para uma chamada valida do MathModule e executa.
 *
 * PONTO DE IA: interpretacao da query e extracao de parametros.
 */

const ModelFactory = require('../../utils/ai/model-factory');
const mathModule = require('../math');
const logger = require('../../utils/logger');

const MATH_DIRECT_PROMPT = `Voce interpreta pedidos de calculo matematico financeiro.

Seu trabalho:
1) Verificar se a pergunta e um calculo direto com TODOS os parametros explicitos.
2) Mapear a pergunta para uma acao do MathModule e extrair parametros.

Regras:
- Se faltar qualquer parametro, retorne is_math_direct = false.
- Se a query foi classificada como math_direct, assuma que e elegivel e extraia os parametros.
- Se houver contexto pessoal ou necessidade de dados do usuario, retorne false.
- Converta percentuais para decimais (1% => 0.01; 95% => 0.95).
- Retornos em porcentagem devem virar decimais.
- Use apenas numeros em params.

Acoes disponiveis:
- compound_interest: { principal, rate, periods }
- projection_with_contributions: { monthlyPayment, monthlyRate, months, initialAmount (opcional, default 0) }
- net_present_value: { rate, cashFlows }
- internal_rate_of_return: { cashFlows }
- sharpe_ratio: { returns, riskFreeRate }
- value_at_risk: { returns, confidence }

Retorne JSON valido com:
{
  "is_math_direct": true|false,
  "actions": [
    { "action": "compound_interest|projection_with_contributions|net_present_value|internal_rate_of_return|sharpe_ratio|value_at_risk", "params": { ... } }
  ],
  "reasoning": "curta explicacao"
}`;

const REQUIRED_FIELDS = {
  compound_interest: ['principal', 'rate', 'periods'],
  projection_with_contributions: ['monthlyPayment', 'monthlyRate', 'months'],
  net_present_value: ['rate', 'cashFlows'],
  internal_rate_of_return: ['cashFlows'],
  sharpe_ratio: ['returns', 'riskFreeRate'],
  value_at_risk: ['returns'],
};

const ACTION_MAP = {
  compound_interest: 'compoundInterest',
  projection_with_contributions: 'projectionWithContributions',
  net_present_value: 'netPresentValue',
  internal_rate_of_return: 'internalRateOfReturn',
  sharpe_ratio: 'sharpeRatio',
  value_at_risk: 'valueAtRisk',
};

function normalizeNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return value;

  const raw = String(value).trim();
  if (raw.length === 0) return null;

  let cleaned = raw.replace(/\s/g, '').replace(/%/g, '');
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    cleaned = cleaned.replace(',', '.');
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return null;
  const normalized = values.map(normalizeNumber).filter(v => v !== null);
  return normalized.length > 0 ? normalized : null;
}

function validateParams(action, params) {
  const required = REQUIRED_FIELDS[action] || [];
  const missing = [];

  for (const field of required) {
    if (params[field] === undefined || params[field] === null) {
      missing.push(field);
    }
  }

  return { valid: missing.length === 0, missing };
}

async function executeMathDirect(query) {
  const mini = ModelFactory.getMini('medium', 'low');

  const userPrompt = `QUERY: "${query}"`;

  const parsed = await mini.completeJSON(MATH_DIRECT_PROMPT, userPrompt, {
    maxTokens: 400,
    temperature: 0.2,
  });

  if (!parsed || !parsed.is_math_direct) {
    const reason = parsed && parsed.reasoning ? `: ${parsed.reasoning}` : '';
    throw new Error(`Query nao elegivel para math_direct${reason}`);
  }

  const actions = Array.isArray(parsed.actions) ? parsed.actions : [];
  const fallbackAction = parsed.action ? [{ action: parsed.action, params: parsed.params || {} }] : [];
  const actionList = actions.length > 0 ? actions : fallbackAction;

  if (actionList.length === 0) {
    throw new Error('Nenhuma acao matematica identificada');
  }

  const results = [];

  for (const item of actionList) {
    const action = item.action;
    const mappedAction = ACTION_MAP[action];
    if (!mappedAction || !mathModule[mappedAction]) {
      throw new Error('Acao matematica invalida');
    }

    const params = item.params || {};
    const normalized = { ...params };

    if (normalized.cashFlows) {
      normalized.cashFlows = normalizeArray(normalized.cashFlows);
    }
    if (normalized.returns) {
      normalized.returns = normalizeArray(normalized.returns);
    }

    for (const key of Object.keys(normalized)) {
      if (key === 'cashFlows' || key === 'returns') continue;
      normalized[key] = normalizeNumber(normalized[key]);
    }

    if (action === 'projection_with_contributions' && (normalized.initialAmount === null || normalized.initialAmount === undefined)) {
      normalized.initialAmount = 0;
    }

    const validation = validateParams(action, normalized);
    if (!validation.valid) {
      throw new Error(`Parametros incompletos: ${validation.missing.join(', ')}`);
    }

    let result;
    switch (mappedAction) {
      case 'compoundInterest':
        result = mathModule.compoundInterest(
          normalized.principal,
          normalized.rate,
          normalized.periods
        );
        break;
      case 'projectionWithContributions':
        result = mathModule.projectionWithContributions(
          normalized.monthlyPayment,
          normalized.monthlyRate,
          normalized.months,
          normalized.initialAmount || 0
        );
        break;
      case 'netPresentValue':
        result = mathModule.netPresentValue(
          normalized.rate,
          normalized.cashFlows
        );
        break;
      case 'internalRateOfReturn':
        result = mathModule.internalRateOfReturn(
          normalized.cashFlows
        );
        break;
      case 'sharpeRatio':
        result = mathModule.sharpeRatio(
          normalized.returns,
          normalized.riskFreeRate
        );
        break;
      case 'valueAtRisk':
        result = mathModule.valueAtRisk(
          normalized.returns,
          normalized.confidence || 0.95
        );
        break;
      default:
        throw new Error('Acao matematica invalida');
    }

    results.push({
      action,
      input: normalized,
      output: result,
    });
  }

  logger.logic('INFO', 'MathDirect', 'Calculo matematico direto executado', {
    actions: results.map((item) => item.action).join(', '),
    toolsExecuted: results.length,
  });

  return {
    actions: results,
    tools_executed: results.length,
  };
}

module.exports = { executeMathDirect };
