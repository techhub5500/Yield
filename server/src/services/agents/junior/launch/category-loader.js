/**
 * Carregador de Categorias
 * Fase 3 - Sistema de Lançamentos
 * 
 * Carrega categorias e subcategorias de forma otimizada,
 * carregando apenas o tipo necessário (despesa OU receita) para economizar tokens.
 */

const fs = require('fs').promises;
const path = require('path');
const logger = require('../../../../utils/logger');

class CategoryLoader {
  
  constructor() {
    // Caminho para os arquivos de categorias
    this.basePath = path.join(__dirname, '../../../../../docs/jsons/lançamentos/despesas e receitas');
    
    // Cache para evitar leituras repetidas
    this.cache = {
      expense: null,
      income: null
    };
  }

  /**
   * Carrega categorias de um tipo específico
   * Retorna apenas os nomes/IDs das categorias (sem subcategorias)
   * 
   * @param {string} type - 'expense' ou 'income'
   * @returns {Promise<Array>} Lista de categorias
   * 
   * @example
   * const categories = await categoryLoader.loadCategories('expense');
   * // [{ id: 'desp_001', nome: 'Alimentação' }, ...]
   */
  async loadCategories(type) {
    try {
      // Verificar cache
      if (this.cache[type]) {
        logger.debug('Categorias carregadas do cache', { type });
        return this.extractCategoryNames(this.cache[type]);
      }

      // Determinar arquivo
      const fileName = type === 'expense' ? 'despesas.json' : 'receitas.json';
      const filePath = path.join(this.basePath, fileName);

      logger.info('Carregando categorias do arquivo', { type, filePath });

      // Ler arquivo
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Armazenar em cache
      this.cache[type] = data;

      // Retornar apenas nomes (sem subcategorias para economizar tokens)
      return this.extractCategoryNames(data);

    } catch (error) {
      logger.error('Erro ao carregar categorias', { 
        type, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Extrai apenas nomes e IDs das categorias (sem subcategorias)
   */
  extractCategoryNames(data) {
    if (!data || !data.categorias) {
      return [];
    }

    return data.categorias.map(cat => ({
      id: cat.id,
      nome: cat.nome
    }));
  }

  /**
   * Carrega subcategorias de uma categoria específica
   * 
   * @param {string} type - 'expense' ou 'income'
   * @param {string} categoryId - ID da categoria (ex: 'desp_001')
   * @returns {Promise<Array>} Lista de subcategorias
   * 
   * @example
   * const subcategories = await categoryLoader.loadSubcategories('expense', 'desp_001');
   * // ['Supermercado', 'Restaurante', 'Delivery', ...]
   */
  async loadSubcategories(type, categoryId) {
    try {
      // Garantir que as categorias estão carregadas
      if (!this.cache[type]) {
        await this.loadCategories(type);
      }

      const data = this.cache[type];
      
      if (!data || !data.categorias) {
        logger.warn('Dados de categorias não encontrados', { type });
        return [];
      }

      // Buscar categoria pelo ID ou nome
      const category = data.categorias.find(c => 
        c.id === categoryId || 
        c.nome.toLowerCase() === categoryId.toLowerCase()
      );

      if (!category) {
        logger.warn('Categoria não encontrada', { type, categoryId });
        return [];
      }

      logger.debug('Subcategorias carregadas', { 
        type, 
        categoryId, 
        count: category.subcategorias?.length || 0 
      });

      return category.subcategorias || [];

    } catch (error) {
      logger.error('Erro ao carregar subcategorias', { 
        type, 
        categoryId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Busca categoria por nome (fuzzy match)
   * 
   * @param {string} type - 'expense' ou 'income'
   * @param {string} searchTerm - Termo de busca
   * @returns {Promise<Object|null>} Categoria encontrada ou null
   */
  async findCategoryByName(type, searchTerm) {
    try {
      if (!this.cache[type]) {
        await this.loadCategories(type);
      }

      const data = this.cache[type];
      if (!data || !data.categorias) return null;

      const searchLower = searchTerm.toLowerCase();

      // Busca exata primeiro
      let found = data.categorias.find(c => 
        c.nome.toLowerCase() === searchLower
      );

      if (found) {
        return { id: found.id, nome: found.nome };
      }

      // Busca parcial
      found = data.categorias.find(c => 
        c.nome.toLowerCase().includes(searchLower) ||
        searchLower.includes(c.nome.toLowerCase())
      );

      if (found) {
        return { id: found.id, nome: found.nome };
      }

      // Busca em subcategorias
      for (const cat of data.categorias) {
        if (cat.subcategorias) {
          const subMatch = cat.subcategorias.find(sub => 
            sub.toLowerCase().includes(searchLower) ||
            searchLower.includes(sub.toLowerCase())
          );
          if (subMatch) {
            return { 
              id: cat.id, 
              nome: cat.nome, 
              matchedSubcategory: subMatch 
            };
          }
        }
      }

      return null;

    } catch (error) {
      logger.error('Erro ao buscar categoria', { 
        type, 
        searchTerm, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Busca subcategoria por nome dentro de uma categoria
   * 
   * @param {string} type - 'expense' ou 'income'
   * @param {string} categoryId - ID da categoria
   * @param {string} searchTerm - Termo de busca
   * @returns {Promise<string|null>} Nome da subcategoria ou null
   */
  async findSubcategoryByName(type, categoryId, searchTerm) {
    try {
      const subcategories = await this.loadSubcategories(type, categoryId);
      
      if (!subcategories || subcategories.length === 0) {
        return null;
      }

      const searchLower = searchTerm.toLowerCase();

      // Busca exata
      let found = subcategories.find(sub => 
        sub.toLowerCase() === searchLower
      );

      if (found) return found;

      // Busca parcial
      found = subcategories.find(sub => 
        sub.toLowerCase().includes(searchLower) ||
        searchLower.includes(sub.toLowerCase())
      );

      return found || null;

    } catch (error) {
      logger.error('Erro ao buscar subcategoria', { 
        type, 
        categoryId, 
        searchTerm, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Limpa o cache de categorias
   */
  clearCache() {
    this.cache = {
      expense: null,
      income: null
    };
    logger.debug('Cache de categorias limpo');
  }

  /**
   * Verifica se os arquivos de categorias existem
   */
  async healthCheck() {
    try {
      const expensePath = path.join(this.basePath, 'despesas.json');
      const incomePath = path.join(this.basePath, 'receitas.json');

      await fs.access(expensePath);
      await fs.access(incomePath);

      return {
        status: 'healthy',
        files: {
          expenses: 'ok',
          income: 'ok'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = { CategoryLoader };
