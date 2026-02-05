/**
 * Lançador de Transações
 * Fase 3 - Sistema de Lançamentos
 * 
 * Responsável por processar lançamentos de despesas e receitas,
 * usando o GPT-5 Nano para categorização e o Finance Bridge para inserção.
 */

const { CategoryLoader } = require('./category-loader');
const logger = require('../../../../utils/logger');

/**
 * Formata valor como moeda
 */
function formatCurrency(value) {
  if (typeof value !== 'number') return value;
  return value.toLocaleString('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  });
}

/**
 * Formata data para exibição
 */
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
}

class TransactionLauncher {
  
  constructor() {
    this.categoryLoader = new CategoryLoader();
    this.nanoBridge = null; // Lazy loading
    this.financeBridge = null; // Lazy loading
  }

  /**
   * Obtém o NanoBridge (lazy loading)
   */
  getNanoBridge() {
    if (!this.nanoBridge) {
      this.nanoBridge = require('../../../finance-bridge/ai/nano-bridge');
    }
    return this.nanoBridge;
  }

  /**
   * Obtém o FinanceBridge (lazy loading)
   */
  getFinanceBridge() {
    if (!this.financeBridge) {
      this.financeBridge = require('../../../finance-bridge');
    }
    return this.financeBridge;
  }

  /**
   * Lança uma transação a partir da mensagem do usuário
   * Fluxo completo: identificar tipo → categorizar → inserir
   * 
   * @param {string} userMessage - Mensagem do usuário
   * @param {Object} context - Contexto (user_id, etc)
   * @returns {Promise<Object>} Resultado do lançamento
   */
  async launch(userMessage, context = {}) {
    const startTime = Date.now();

    try {
      logger.info('Iniciando lançamento de transação', {
        user_id: context.user_id,
        message_length: userMessage.length
      });

      // Passo 1: Identificar tipo (expense ou income)
      const type = await this.identifyType(userMessage);
      
      logger.debug('Tipo identificado', { type });

      // Passo 2: Carregar categorias do tipo identificado
      const categories = await this.categoryLoader.loadCategories(type);

      // Passo 3: Escolher categoria via GPT-5 Nano
      const categoryChoice = await this.chooseCategory(userMessage, categories, type);

      // Passo 4: Carregar subcategorias da categoria escolhida
      const subcategories = await this.categoryLoader.loadSubcategories(type, categoryChoice.id);

      // Passo 5: Montar payload de transação via GPT-5 Nano
      const transactionPayload = await this.buildTransactionPayload(
        userMessage,
        categoryChoice,
        subcategories,
        type,
        context
      );

      // Passo 6: Executar inserção via Finance Bridge
      const result = await this.insertTransaction(transactionPayload, context);

      const duration = Date.now() - startTime;

      logger.info('Transação lançada com sucesso', {
        duration_ms: duration,
        type,
        category: categoryChoice.nome,
        amount: transactionPayload.amount
      });

      return {
        success: true,
        transaction: transactionPayload,
        response: this.formatSuccessResponse(transactionPayload),
        data: result
      };

    } catch (error) {
      logger.error('Erro ao lançar transação', { 
        error: error.message,
        user_id: context.user_id 
      });

      return {
        success: false,
        error: error.message,
        response: 'Desculpe, não consegui registrar a transação. Por favor, tente novamente.'
      };
    }
  }

  /**
   * Lança transação a partir de dados já extraídos
   * Usado quando o classificador já extraiu as informações
   * 
   * @param {Object} extracted - Dados extraídos
   * @param {string} type - 'expense' ou 'income'
   * @param {Object} context - Contexto
   * @returns {Promise<Object>} Resultado
   */
  async launchFromExtracted(extracted, type, context = {}) {
    const startTime = Date.now();

    try {
      logger.info('Lançando transação de dados extraídos', {
        type,
        has_amount: !!extracted.amount,
        has_category: !!extracted.category
      });

      // Tentar encontrar categoria e subcategoria
      let category = null;
      let subcategory = null;

      if (extracted.category) {
        // Buscar categoria pelo termo extraído
        const foundCategory = await this.categoryLoader.findCategoryByName(type, extracted.category);
        
        if (foundCategory) {
          category = { id: foundCategory.id, nome: foundCategory.nome };
          
          // Se encontrou via subcategoria, usar ela
          if (foundCategory.matchedSubcategory) {
            subcategory = foundCategory.matchedSubcategory;
          } else {
            // Buscar subcategoria pelo termo
            subcategory = await this.categoryLoader.findSubcategoryByName(
              type, 
              foundCategory.id, 
              extracted.category
            );
          }
        }
      }

      // Se não encontrou categoria, usar GPT-5 Nano
      if (!category) {
        const categories = await this.categoryLoader.loadCategories(type);
        const categoryChoice = await this.chooseCategory(
          `${extracted.category || ''} ${extracted.description || ''}`,
          categories,
          type
        );
        category = categoryChoice;

        // Carregar subcategorias
        const subcategories = await this.categoryLoader.loadSubcategories(type, category.id);
        
        // Escolher subcategoria
        if (subcategories.length > 0) {
          subcategory = await this.chooseSubcategory(
            extracted.category || extracted.description || '',
            subcategories
          );
        }
      }

      // Montar payload
      const transactionPayload = {
        amount: extracted.amount,
        date: extracted.date || new Date().toISOString().split('T')[0],
        type: type,
        category: category.nome,
        subcategory: subcategory || undefined,
        description: extracted.description || undefined
      };

      // Inserir via Finance Bridge
      const result = await this.insertTransaction(transactionPayload, context);

      const duration = Date.now() - startTime;

      logger.info('Transação de dados extraídos lançada', {
        duration_ms: duration,
        type,
        category: category.nome,
        amount: transactionPayload.amount
      });

      return {
        success: true,
        transaction: transactionPayload,
        response: this.formatSuccessResponse(transactionPayload),
        data: result
      };

    } catch (error) {
      logger.error('Erro ao lançar de dados extraídos', { error: error.message });
      
      return {
        success: false,
        error: error.message,
        response: 'Desculpe, não consegui registrar a transação.'
      };
    }
  }

  /**
   * Identifica se é despesa ou receita
   */
  async identifyType(userMessage) {
    const message = userMessage.toLowerCase();

    // Palavras-chave de despesa
    const expenseKeywords = [
      'gastei', 'paguei', 'comprei', 'custo', 'custou',
      'despesa', 'gasto', 'pagamento', 'pago', 'gastar',
      'compra', 'conta', 'boleto'
    ];

    // Palavras-chave de receita
    const incomeKeywords = [
      'recebi', 'ganhei', 'entrou', 'salário', 'salario',
      'receita', 'renda', 'ganho', 'entrada', 'pagaram',
      'depositaram', 'transferiram'
    ];

    if (expenseKeywords.some(kw => message.includes(kw))) {
      return 'expense';
    }

    if (incomeKeywords.some(kw => message.includes(kw))) {
      return 'income';
    }

    // Se não conseguir identificar, usar GPT-5 Nano
    try {
      const nanoBridge = this.getNanoBridge();
      const result = await nanoBridge.transformToJSON(
        `Classifique se isso é uma DESPESA ou RECEITA: "${userMessage}". Responda com JSON: {"type": "expense" ou "income"}`
      );
      return result.type || 'expense';
    } catch (error) {
      logger.warn('Não conseguiu identificar tipo via IA, assumindo despesa');
      return 'expense';
    }
  }

  /**
   * Escolhe a categoria via GPT-5 Nano
   */
  async chooseCategory(userMessage, categories, type) {
    try {
      const nanoBridge = this.getNanoBridge();
      
      const categoriesList = categories.map(c => `${c.id}: ${c.nome}`).join('\n');
      
      const prompt = `
Texto do usuário: "${userMessage}"
Tipo: ${type === 'expense' ? 'DESPESA' : 'RECEITA'}

Categorias disponíveis:
${categoriesList}

Escolha a categoria mais adequada. Retorne APENAS um JSON válido:
{"category_id": "id_da_categoria", "category_name": "nome_da_categoria", "confidence": 0.0 a 1.0}`;

      const result = await nanoBridge.transformToJSON(prompt);

      return {
        id: result.category_id,
        nome: result.category_name,
        confidence: result.confidence
      };

    } catch (error) {
      logger.error('Erro ao escolher categoria via IA', { error: error.message });
      
      // Fallback: usar primeira categoria
      if (categories.length > 0) {
        return categories[0];
      }
      
      throw error;
    }
  }

  /**
   * Escolhe a subcategoria
   */
  async chooseSubcategory(searchTerm, subcategories) {
    // Busca local primeiro
    const searchLower = searchTerm.toLowerCase();
    
    let found = subcategories.find(sub => 
      sub.toLowerCase() === searchLower
    );
    if (found) return found;

    found = subcategories.find(sub => 
      sub.toLowerCase().includes(searchLower) ||
      searchLower.includes(sub.toLowerCase())
    );
    if (found) return found;

    // Usar GPT-5 Nano se não encontrar
    try {
      const nanoBridge = this.getNanoBridge();
      
      const prompt = `
Termo de busca: "${searchTerm}"

Subcategorias disponíveis:
${subcategories.join(', ')}

Qual subcategoria melhor corresponde? Retorne APENAS um JSON:
{"subcategory": "nome_da_subcategoria"}`;

      const result = await nanoBridge.transformToJSON(prompt);
      return result.subcategory;

    } catch (error) {
      logger.warn('Não conseguiu escolher subcategoria via IA');
      return subcategories[0]; // Fallback: primeira subcategoria
    }
  }

  /**
   * Monta o payload completo da transação
   */
  async buildTransactionPayload(userMessage, category, subcategories, type, context) {
    try {
      const nanoBridge = this.getNanoBridge();
      
      const prompt = `
Texto do usuário: "${userMessage}"
Tipo: ${type === 'expense' ? 'DESPESA' : 'RECEITA'}
Categoria: ${category.nome}
Subcategorias disponíveis: ${subcategories.join(', ')}
Data de hoje: ${new Date().toISOString().split('T')[0]}

Extraia as informações e monte o JSON de lançamento:
{
  "amount": número (extraia o valor monetário),
  "date": "YYYY-MM-DD" (use hoje se não especificado),
  "type": "${type}",
  "category": "${category.nome}",
  "subcategory": "escolha a mais adequada",
  "description": "descrição breve (opcional)"
}`;

      const result = await nanoBridge.transformToJSON(prompt);

      // Garantir que os campos obrigatórios existem
      return {
        amount: result.amount,
        date: result.date || new Date().toISOString().split('T')[0],
        type: type,
        category: category.nome,
        subcategory: result.subcategory,
        description: result.description
      };

    } catch (error) {
      logger.error('Erro ao montar payload da transação', { error: error.message });
      throw error;
    }
  }

  /**
   * Insere a transação via Finance Bridge
   */
  async insertTransaction(payload, context) {
    const financeBridge = this.getFinanceBridge();
    
    const bridgePayload = {
      operation: 'insert',
      params: {
        ...payload,
        user_id: context.user_id
      },
      context: {
        user_id: context.user_id,
        user_timezone: context.user_timezone || 'America/Sao_Paulo',
        currency: 'BRL'
      }
    };

    const result = await financeBridge.process(bridgePayload);

    if (!result.success) {
      throw new Error(result.error?.message || 'Erro ao inserir transação');
    }

    return result.data;
  }

  /**
   * Formata resposta de sucesso
   */
  formatSuccessResponse(transaction) {
    const typeText = transaction.type === 'expense' ? 'Despesa' : 'Receita';
    const emoji = transaction.type === 'expense' ? '✅💸' : '✅💰';

    let response = `${emoji} ${typeText} registrada com sucesso!\n\n`;
    response += `**Valor:** ${formatCurrency(transaction.amount)}\n`;
    response += `**Categoria:** ${transaction.category}`;
    
    if (transaction.subcategory) {
      response += ` > ${transaction.subcategory}`;
    }
    
    response += `\n**Data:** ${formatDate(transaction.date)}`;
    
    if (transaction.description) {
      response += `\n**Descrição:** ${transaction.description}`;
    }

    return response;
  }

  /**
   * Health check do lançador
   */
  async healthCheck() {
    try {
      const categoryHealth = await this.categoryLoader.healthCheck();
      
      return {
        status: categoryHealth.status,
        category_loader: categoryHealth,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = { TransactionLauncher };
