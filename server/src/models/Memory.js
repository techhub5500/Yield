const mongoose = require('mongoose');
const memoryConfig = require('../config/memory-config');

/**
 * Schema de Ciclo Recente
 * Mantido na íntegra, sem modificação
 */
const RecentCycleSchema = new mongoose.Schema({
  cycle_id: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  user_message: {
    type: String,
    required: true
  },
  ai_response: {
    type: String,
    required: true
  },
  word_count: {
    type: Number,
    default: 0
  }
}, { _id: false });

/**
 * Schema de Dados Preservados
 * Extraídos durante o resumo
 */
const PreservedDataSchema = new mongoose.Schema({
  numerical_values: [{
    type: mongoose.Schema.Types.Mixed  // Pode ser número ou string formatada
  }],
  dates: [{
    type: String
  }],
  decisions: [{
    type: String
  }],
  essential_context: {
    type: String,
    default: ''
  }
}, { _id: false });

/**
 * Schema de Ciclo Antigo (Resumido)
 */
const OldCycleSchema = new mongoose.Schema({
  cycle_id: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    required: true
  },
  summary: {
    type: String,
    required: true
  },
  preserved_data: {
    type: PreservedDataSchema,
    default: () => ({
      numerical_values: [],
      dates: [],
      decisions: [],
      essential_context: ''
    })
  },
  original_word_count: {
    type: Number,
    default: 0
  },
  summary_word_count: {
    type: Number,
    default: 0
  },
  pending_summarization: {
    type: Boolean,
    default: false
  }
}, { _id: false });

/**
 * Schema de Metadados
 */
const MetadataSchema = new mongoose.Schema({
  total_cycles: {
    type: Number,
    default: 0
  },
  total_word_count: {
    type: Number,
    default: 0
  },
  last_compression: {
    type: Date,
    default: null
  },
  compression_count: {
    type: Number,
    default: 0
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * Schema de Item de Dados Críticos
 */
const CriticalItemSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  extracted_at: {
    type: Date,
    default: Date.now
  },
  source_cycle_id: {
    type: Number
  },
  numerical_value: {
    type: mongoose.Schema.Types.Mixed
  },
  date_value: {
    type: String
  }
}, { _id: false });

/**
 * Schema de Dados Críticos
 * Nunca são apagados, mesmo durante compressão
 */
const CriticalDataSchema = new mongoose.Schema({
  financial_goals: [CriticalItemSchema],
  configured_limits: [CriticalItemSchema],
  declared_preferences: [CriticalItemSchema],
  important_decisions: [CriticalItemSchema]
}, { _id: false });

/**
 * Schema Principal de Memória
 */
const MemorySchema = new mongoose.Schema({
  // Identificação
  chat_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user_id: {
    type: String,
    required: true,
    index: true
  },
  
  // Memória Recente (últimos 2 ciclos completos)
  recent_memory: {
    type: [RecentCycleSchema],
    default: [],
    validate: {
      validator: function(v) {
        return v.length <= memoryConfig.memory.recentCyclesCount;
      },
      message: `Memória recente não pode exceder ${memoryConfig.memory.recentCyclesCount} ciclos`
    }
  },
  
  // Memória Antiga (ciclos resumidos)
  old_memory: {
    type: [OldCycleSchema],
    default: []
  },
  
  // Metadados
  metadata: {
    type: MetadataSchema,
    default: () => ({
      total_cycles: 0,
      total_word_count: 0,
      last_compression: null,
      compression_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    })
  },
  
  // Dados Críticos (nunca são apagados)
  critical_data: {
    type: CriticalDataSchema,
    default: () => ({
      financial_goals: [],
      configured_limits: [],
      declared_preferences: [],
      important_decisions: []
    })
  }
}, {
  timestamps: false,  // Gerenciamos manualmente via metadata
  collection: 'memories'
});

// Índice composto para ordenar chats por atividade recente
MemorySchema.index({ user_id: 1, 'metadata.updated_at': -1 });

// Middleware pre-save para atualizar updated_at
MemorySchema.pre('save', function(next) {
  this.metadata.updated_at = new Date();
  next();
});

// Métodos de instância
MemorySchema.methods.getRecentCyclesCount = function() {
  return this.recent_memory.length;
};

MemorySchema.methods.getOldCyclesCount = function() {
  return this.old_memory.length;
};

MemorySchema.methods.getTotalCyclesCount = function() {
  return this.recent_memory.length + this.old_memory.length;
};

MemorySchema.methods.hasReachedCompressionThreshold = function() {
  return this.metadata.total_word_count >= memoryConfig.compressionThresholdWords;
};

MemorySchema.methods.getUsagePercentage = function() {
  return (this.metadata.total_word_count / memoryConfig.memory.maxWords) * 100;
};

// Métodos estáticos
MemorySchema.statics.findByChat = function(chatId) {
  return this.findOne({ chat_id: chatId });
};

MemorySchema.statics.findByUser = function(userId) {
  return this.find({ user_id: userId }).sort({ 'metadata.updated_at': -1 });
};

MemorySchema.statics.chatExists = async function(chatId) {
  const count = await this.countDocuments({ chat_id: chatId });
  return count > 0;
};

const Memory = mongoose.model('Memory', MemorySchema);

module.exports = Memory;
