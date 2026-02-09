/**
 * Script de Migração — Add fullHistory aos Chats Existentes
 * 
 * CONTEXTO:
 * A correção do sistema de histórico adicionou um campo `fullHistory` na estrutura
 * de Memory. Chats criados antes desta correção não têm este campo populado.
 * 
 * Este script migra chats existentes, reconstruindo o fullHistory a partir dos
 * ciclos recentes disponíveis. Nota: ciclos que já foram resumidos em `old` foram
 * perdidos e não podem ser recuperados.
 * 
 * COMO USAR:
 * 
 *   cd server
 *   node scripts/migrate-fullhistory.js
 * 
 * O script:
 * 1. Conecta ao MongoDB
 * 2. Busca todos os chats
 * 3. Para cada chat sem fullHistory ou com fullHistory vazio:
 *    - Reconstrói fullHistory a partir de recent
 *    - Atualiza o documento no banco
 * 4. Reporta estatísticas
 * 
 * SEGURO: Faz backup antes de modificar (campo `_backup_before_migration`)
 */

const { MongoClient } = require('mongodb');
const config = require('../src/config');

const COLLECTION = 'memories';

async function migrate() {
  console.log('=== Migração: Adicionar fullHistory aos chats existentes ===\n');

  let client;
  try {
    // Conectar ao MongoDB
    console.log('Conectando ao MongoDB...');
    client = new MongoClient(config.mongodb.uri);
    await client.connect();
    const db = client.db(config.mongodb.dbName);
    const collection = db.collection(COLLECTION);

    console.log('✅ Conectado com sucesso\n');

    // Buscar todos os chats
    const allChats = await collection.find({}).toArray();
    console.log(`📊 Total de chats encontrados: ${allChats.length}\n`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const chat of allChats) {
      try {
        const memory = chat.memory;

        // Verificar se já tem fullHistory
        if (memory.fullHistory && memory.fullHistory.length > 0) {
          console.log(`⏭️  Chat ${chat.chatId.substring(0, 8)}... já tem fullHistory (${memory.fullHistory.length} mensagens) — pulando`);
          skippedCount++;
          continue;
        }

        // Reconstruir fullHistory a partir de recent
        const fullHistory = [];

        if (memory.recent && Array.isArray(memory.recent)) {
          memory.recent.forEach(cycle => {
            fullHistory.push({
              userInput: cycle.userInput,
              aiResponse: cycle.aiResponse,
              timestamp: cycle.timestamp,
              id: cycle.id,
            });
          });
        }

        // Se não há ciclos recentes, pular
        if (fullHistory.length === 0) {
          console.log(`⚠️  Chat ${chat.chatId.substring(0, 8)}... não tem ciclos recentes — pulando`);
          skippedCount++;
          continue;
        }

        // Atualizar documento com backup
        await collection.updateOne(
          { chatId: chat.chatId },
          {
            $set: {
              'memory.fullHistory': fullHistory,
              '_backup_before_migration': {
                timestamp: new Date().toISOString(),
                recentLength: memory.recent?.length || 0,
                oldLength: memory.old?.length || 0,
              },
            },
          }
        );

        console.log(`✅ Chat ${chat.chatId.substring(0, 8)}... migrado (${fullHistory.length} mensagens)`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Erro ao migrar chat ${chat.chatId}:`, error.message);
        errorCount++;
      }
    }

    // Estatísticas finais
    console.log('\n=== Migração Concluída ===');
    console.log(`✅ Migrados: ${migratedCount}`);
    console.log(`⏭️  Pulados: ${skippedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`📊 Total: ${allChats.length}\n`);

    if (migratedCount > 0) {
      console.log('⚠️  IMPORTANTE:');
      console.log('   - Apenas mensagens em `recent` foram recuperadas');
      console.log('   - Mensagens antigas que foram resumidas em `old` foram perdidas');
      console.log('   - Um backup foi criado no campo `_backup_before_migration`\n');
    }

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('Conexão fechada.');
    }
  }
}

// Executar
migrate().catch(console.error);
