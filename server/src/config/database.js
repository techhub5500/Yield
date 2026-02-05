const mongoose = require('mongoose');
const logger = require('../utils/logger');

class Database {
  constructor() {
    this.connection = null;
    this.isConnected = false;
  }

  /**
   * Estabelece conexão com MongoDB
   */
  async connect() {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yield_finance';
      
      const options = {
        maxPoolSize: 10,
        minPoolSize: 2,
        socketTimeoutMS: 45000,
        serverSelectionTimeoutMS: 5000,
        family: 4, // Use IPv4
      };

      // Eventos de conexão
      mongoose.connection.on('connected', () => {
        this.isConnected = true;
        logger.info('MongoDB conectado com sucesso');
      });

      mongoose.connection.on('error', (err) => {
        this.isConnected = false;
        logger.error('Erro na conexão MongoDB:', err);
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('MongoDB desconectado');
      });

      // Reconexão automática
      mongoose.connection.on('reconnected', () => {
        this.isConnected = true;
        logger.info('MongoDB reconectado');
      });

      this.connection = await mongoose.connect(mongoUri, options);
      
      logger.info(`MongoDB conectado: ${this.connection.connection.host}`);
      
      return this.connection;
    } catch (error) {
      logger.error('Falha ao conectar ao MongoDB:', error);
      
      // Não tentar reconectar automaticamente em desenvolvimento
      // (evita logs repetitivos quando o banco não está disponível)
      
      throw error;
    }
  }

  /**
   * Desconecta do MongoDB
   */
  async disconnect() {
    try {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('MongoDB desconectado com sucesso');
    } catch (error) {
      logger.error('Erro ao desconectar do MongoDB:', error);
      throw error;
    }
  }

  /**
   * Verifica se está conectado
   */
  checkConnection() {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  /**
   * Obtém estatísticas da conexão
   */
  getStats() {
    if (!this.checkConnection()) {
      return { connected: false };
    }

    return {
      connected: true,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
      models: Object.keys(mongoose.connection.models)
    };
  }
}

// Singleton
const database = new Database();

module.exports = database;
