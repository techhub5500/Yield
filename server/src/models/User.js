/**
 * User Model
 * Schema e modelo para usuários do sistema
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Schema do Usuário
 */
const UserSchema = new mongoose.Schema({
  // Nome completo
  name: {
    type: String,
    required: [true, 'Nome é obrigatório'],
    trim: true,
    minlength: [2, 'Nome deve ter pelo menos 2 caracteres'],
    maxlength: [100, 'Nome deve ter no máximo 100 caracteres']
  },

  // E-mail (único)
  email: {
    type: String,
    required: [true, 'E-mail é obrigatório'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'E-mail inválido']
  },

  // Senha (hash)
  password: {
    type: String,
    required: [true, 'Senha é obrigatória'],
    minlength: [6, 'Senha deve ter pelo menos 6 caracteres'],
    select: false // Não retorna por padrão
  },

  // Avatar (URL)
  avatar: {
    type: String,
    default: null
  },

  // Configurações do usuário
  settings: {
    // Fuso horário
    timezone: {
      type: String,
      default: 'America/Sao_Paulo'
    },
    // Moeda padrão
    currency: {
      type: String,
      default: 'BRL'
    },
    // Notificações
    notifications: {
      email: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    // Tema
    theme: {
      type: String,
      enum: ['dark', 'light', 'auto'],
      default: 'dark'
    }
  },

  // Autenticação OAuth
  oauth: {
    google: {
      id: String,
      email: String
    }
  },

  // Token de recuperação de senha
  resetPasswordToken: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },

  // Status da conta
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },

  // Último login
  lastLoginAt: {
    type: Date,
    default: null
  },

  // Datas de criação e atualização
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ===================================================
// ÍNDICES
// ===================================================

UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ 'oauth.google.id': 1 }, { sparse: true });
UserSchema.index({ status: 1 });
UserSchema.index({ createdAt: -1 });

// ===================================================
// MIDDLEWARE PRE-SAVE
// ===================================================

/**
 * Hash da senha antes de salvar
 */
UserSchema.pre('save', async function(next) {
  // Só faz hash se a senha foi modificada
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Atualiza updatedAt antes de salvar
 */
UserSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// ===================================================
// MÉTODOS DE INSTÂNCIA
// ===================================================

/**
 * Compara senha fornecida com a senha armazenada
 */
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Retorna dados públicos do usuário (sem senha)
 */
UserSchema.methods.toPublicJSON = function() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    avatar: this.avatar,
    settings: this.settings,
    status: this.status,
    lastLoginAt: this.lastLoginAt,
    createdAt: this.createdAt
  };
};

/**
 * Atualiza data do último login
 */
UserSchema.methods.updateLastLogin = async function() {
  this.lastLoginAt = new Date();
  await this.save();
};

// ===================================================
// MÉTODOS ESTÁTICOS
// ===================================================

/**
 * Busca usuário por e-mail (inclui senha para autenticação)
 */
UserSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

/**
 * Busca usuário por ID do Google
 */
UserSchema.statics.findByGoogleId = function(googleId) {
  return this.findOne({ 'oauth.google.id': googleId });
};

/**
 * Verifica se e-mail já está em uso
 */
UserSchema.statics.emailExists = async function(email) {
  const user = await this.findOne({ email: email.toLowerCase() });
  return !!user;
};

// ===================================================
// VIRTUAL
// ===================================================

/**
 * Nome de exibição (primeiro nome)
 */
UserSchema.virtual('displayName').get(function() {
  return this.name.split(' ')[0];
});

// ===================================================
// MODELO
// ===================================================

const User = mongoose.model('User', UserSchema);

module.exports = User;
