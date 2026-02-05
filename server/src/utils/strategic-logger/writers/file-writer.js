/**
 * Escritor de Arquivos de Log
 * 
 * Responsável por gerenciar a escrita de logs em arquivos .md,
 * incluindo rotação, buffer e criação de diretórios.
 */

const fs = require('fs');
const path = require('path');
const { FILE_CONFIG, BEHAVIOR_CONFIG } = require('../config');
const markdownFormatter = require('../formatters/markdown');

class FileWriter {
  constructor() {
    this.buffer = [];
    this.currentFile = null;
    this.currentDate = null;
    this.flushTimer = null;
    this.initialized = false;
    this.writeQueue = Promise.resolve();
  }

  /**
   * Inicializa o escritor de arquivos
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Garante que o diretório de logs existe
      await this.ensureLogsDirectory();
      
      // Define arquivo atual
      this.updateCurrentFile();
      
      // Inicia timer de flush
      this.startFlushTimer();
      
      this.initialized = true;
    } catch (error) {
      console.error('[FileWriter] Erro ao inicializar:', error.message);
      throw error;
    }
  }

  /**
   * Garante que o diretório de logs existe
   */
  async ensureLogsDirectory() {
    const logsDir = FILE_CONFIG.logsDir;
    
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  /**
   * Atualiza o arquivo de log atual baseado na data
   */
  updateCurrentFile() {
    const today = this.getDateString();
    
    // Se mudou o dia, atualiza arquivo
    if (this.currentDate !== today) {
      this.currentDate = today;
      const fileName = FILE_CONFIG.dailyLogPattern.replace('{date}', today);
      this.currentFile = path.join(FILE_CONFIG.logsDir, fileName);
      
      // Reseta formatador para novo arquivo
      markdownFormatter.reset();
      
      // Cria novo arquivo com cabeçalho se não existir
      if (!fs.existsSync(this.currentFile)) {
        this.writeHeader();
      }
    }
  }

  /**
   * Escreve cabeçalho no arquivo
   */
  writeHeader() {
    const header = markdownFormatter.formatFileHeader();
    fs.writeFileSync(this.currentFile, header, 'utf8');
  }

  /**
   * Adiciona entrada ao buffer
   * 
   * @param {string} content - Conteúdo formatado em Markdown
   */
  async write(content) {
    if (!this.initialized) {
      await this.initialize();
    }

    // Verifica se precisa rotacionar arquivo
    this.updateCurrentFile();
    
    // Adiciona ao buffer
    this.buffer.push(content);
    
    // Faz flush se buffer atingiu tamanho máximo
    if (this.buffer.length >= BEHAVIOR_CONFIG.bufferSize) {
      await this.flush();
    }
  }

  /**
   * Escreve buffer no arquivo
   */
  async flush() {
    if (this.buffer.length === 0) return;

    // Pega conteúdo atual do buffer e limpa
    const content = this.buffer.join('');
    this.buffer = [];
    
    // Adiciona à fila de escrita para evitar condições de corrida
    this.writeQueue = this.writeQueue.then(async () => {
      try {
        await this.appendToFile(content);
      } catch (error) {
        console.error('[FileWriter] Erro ao escrever:', error.message);
        // Re-adiciona ao buffer em caso de erro
        this.buffer.unshift(content);
      }
    });

    await this.writeQueue;
  }

  /**
   * Adiciona conteúdo ao arquivo
   */
  async appendToFile(content) {
    return new Promise((resolve, reject) => {
      // Verifica tamanho do arquivo
      const shouldRotate = this.checkFileSize();
      
      if (shouldRotate) {
        this.rotateFile();
      }

      fs.appendFile(this.currentFile, content, 'utf8', (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Verifica se arquivo atingiu tamanho máximo
   */
  checkFileSize() {
    if (!fs.existsSync(this.currentFile)) return false;
    
    const stats = fs.statSync(this.currentFile);
    return stats.size >= FILE_CONFIG.maxFileSize;
  }

  /**
   * Rotaciona arquivo quando atinge tamanho máximo
   */
  rotateFile() {
    const timestamp = Date.now();
    const ext = path.extname(this.currentFile);
    const baseName = path.basename(this.currentFile, ext);
    const dirName = path.dirname(this.currentFile);
    
    const rotatedName = `${baseName}-${timestamp}${ext}`;
    const rotatedPath = path.join(dirName, rotatedName);
    
    // Renomeia arquivo atual
    fs.renameSync(this.currentFile, rotatedPath);
    
    // Cria novo arquivo com cabeçalho
    this.writeHeader();
    
    // Limpa arquivos antigos
    this.cleanOldFiles();
  }

  /**
   * Remove arquivos de log antigos (mantém apenas os N mais recentes)
   */
  cleanOldFiles() {
    const logsDir = FILE_CONFIG.logsDir;
    
    // Lista todos os arquivos .md
    const files = fs.readdirSync(logsDir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f,
        path: path.join(logsDir, f),
        time: fs.statSync(path.join(logsDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time); // Mais recentes primeiro
    
    // Remove arquivos além do limite
    if (files.length > FILE_CONFIG.maxFiles) {
      const toRemove = files.slice(FILE_CONFIG.maxFiles);
      toRemove.forEach(f => {
        try {
          fs.unlinkSync(f.path);
        } catch (err) {
          console.error(`[FileWriter] Erro ao remover ${f.name}:`, err.message);
        }
      });
    }
  }

  /**
   * Inicia timer de flush automático
   */
  startFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        console.error('[FileWriter] Erro no flush automático:', err.message);
      });
    }, BEHAVIOR_CONFIG.bufferFlushInterval);

    // Permite que o processo termine mesmo com timer ativo
    this.flushTimer.unref();
  }

  /**
   * Retorna string da data atual (YYYY-MM-DD)
   */
  getDateString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Retorna caminho do arquivo atual
   */
  getCurrentFilePath() {
    return this.currentFile;
  }

  /**
   * Força escrita de todo o buffer e finaliza
   */
  async shutdown() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    
    await this.flush();
    this.initialized = false;
  }

  /**
   * Retorna estatísticas do escritor
   */
  getStats() {
    let fileSize = 0;
    if (this.currentFile && fs.existsSync(this.currentFile)) {
      fileSize = fs.statSync(this.currentFile).size;
    }

    return {
      initialized: this.initialized,
      currentFile: this.currentFile,
      bufferSize: this.buffer.length,
      fileSize: fileSize,
      fileSizeFormatted: this.formatBytes(fileSize)
    };
  }

  /**
   * Formata bytes para exibição legível
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new FileWriter();
