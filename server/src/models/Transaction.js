const mongoose = require('mongoose');

/**
 * Schema de Transação Financeira
 */
const TransactionSchema = new mongoose.Schema({
  // Campos obrigatórios
  amount: {
    type: Number,
    required: [true, 'Valor é obrigatório'],
    min: [0, 'Valor não pode ser negativo'],
    validate: {
      validator: function(v) {
        return v <= 1000000000; // Máximo 1 bilhão
      },
      message: 'Valor não pode exceder 1 bilhão'
    }
  },
  
  date: {
    type: Date,
    required: [true, 'Data é obrigatória'],
    validate: {
      validator: function(v) {
        const now = new Date();
        const maxPast = new Date();
        maxPast.setFullYear(maxPast.getFullYear() - 10);
        const maxFuture = new Date();
        maxFuture.setDate(maxFuture.getDate() + 1);
        
        return v >= maxPast && v <= maxFuture;
      },
      message: 'Data não pode ser mais de 10 anos no passado ou mais de 1 dia no futuro'
    }
  },
  
  category: {
    type: String,
    required: [true, 'Categoria é obrigatória'],
    trim: true,
    maxlength: [100, 'Categoria não pode ter mais de 100 caracteres']
  },
  
  type: {
    type: String,
    required: [true, 'Tipo é obrigatório'],
    enum: {
      values: ['expense', 'income'],
      message: 'Tipo deve ser "expense" ou "income"'
    }
  },
  
  // Campos opcionais
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Descrição não pode ter mais de 500 caracteres']
  },
  
  subcategory: {
    type: String,
    trim: true,
    maxlength: [100, 'Subcategoria não pode ter mais de 100 caracteres']
  },
  
  tags: {
    type: [String],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= 20;
      },
      message: 'Não pode ter mais de 20 tags'
    }
  },
  
  payment_method: {
    type: String,
    trim: true,
    enum: {
      values: ['PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Dinheiro', 'Boleto', 'Transferência', 'Outro', ''],
      message: 'Método de pagamento inválido'
    }
  },
  
  merchant: {
    type: String,
    trim: true,
    maxlength: [200, 'Nome do estabelecimento não pode ter mais de 200 caracteres']
  },
  
  status: {
    type: String,
    default: 'confirmada',
    enum: {
      values: ['pendente', 'confirmada', 'cancelada'],
      message: 'Status deve ser "pendente", "confirmada" ou "cancelada"'
    }
  },
  
  user_id: {
    type: String,
    required: [true, 'ID do usuário é obrigatório'],
    index: true
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

/**
 * Índices para otimização de buscas
 */
// Índice composto para buscas por usuário e data
TransactionSchema.index({ user_id: 1, date: -1 });

// Índice composto para buscas por usuário e categoria
TransactionSchema.index({ user_id: 1, category: 1 });

// Índice composto para buscas por usuário e tipo
TransactionSchema.index({ user_id: 1, type: 1 });

// Índice para buscas por valor
TransactionSchema.index({ amount: 1 });

// Índice multikey para tags
TransactionSchema.index({ tags: 1 });

/**
 * Método para validar categoria contra arquivos de categorias
 */
TransactionSchema.methods.validateCategory = async function() {
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const categoryFile = this.type === 'expense' 
      ? 'despesas.json' 
      : 'receitas.json';
    
    const filePath = path.join(__dirname, '../../../docs/jsons/lançamentos/despesas e receitas', categoryFile);
    const data = await fs.readFile(filePath, 'utf-8');
    const categories = JSON.parse(data);
    
    // Procura a categoria (case-insensitive)
    const categoryLower = this.category.toLowerCase();
    const found = categories.categories.some(cat => 
      cat.name.toLowerCase() === categoryLower
    );
    
    if (!found) {
      throw new Error(`Categoria "${this.category}" não encontrada no tipo "${this.type}"`);
    }
    
    return true;
  } catch (error) {
    // Se o arquivo não existir, aceita qualquer categoria
    if (error.code === 'ENOENT') {
      return true;
    }
    throw error;
  }
};

/**
 * Hook antes de salvar
 */
TransactionSchema.pre('save', async function(next) {
  // Validar categoria se especificada
  if (this.category) {
    try {
      await this.validateCategory();
    } catch (error) {
      // Se falhar a validação de categoria, apenas loga mas permite salvar
      console.warn('Aviso na validação de categoria:', error.message);
    }
  }
  
  next();
});

/**
 * Método estático para buscar com filtros
 */
TransactionSchema.statics.findWithFilters = function(filters, options = {}) {
  const query = this.find(filters);
  
  if (options.sort) {
    query.sort(options.sort);
  }
  
  if (options.limit) {
    query.limit(options.limit);
  }
  
  if (options.skip) {
    query.skip(options.skip);
  }
  
  return query;
};

/**
 * Método estático para agregações
 */
TransactionSchema.statics.aggregate = function(pipeline) {
  return mongoose.Model.aggregate.call(this, pipeline);
};

const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;
