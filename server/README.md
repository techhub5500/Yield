# Finance Bridge - Servidor Backend

Sistema de middleware inteligente para gerenciamento de finanças pessoais com suporte a IA.

## Estrutura do Projeto

```
server/
├── src/
│   ├── config/          # Configurações (banco de dados)
│   ├── models/          # Modelos e repositórios
│   ├── services/        # Serviços principais
│   │   └── finance-bridge/
│   │       ├── operations/    # 6 operações do Finance Bridge
│   │       ├── filters/       # Filtros booleanos e períodos
│   │       ├── validation/    # Camada de validação
│   │       └── ai/            # Integração com GPT-5 Nano
│   ├── utils/           # Utilitários (logs, erros)
│   ├── index.js         # Ponto de entrada da aplicação
│   └── api.js           # API pública
├── tests/               # Testes automatizados
├── .env.example         # Exemplo de variáveis de ambiente
├── package.json         # Dependências
└── README.md            # Este arquivo
```

## Instalação

1. Instalar dependências:
```bash
npm install
```

2. Configurar variáveis de ambiente:
```bash
cp .env.example .env
```

Edite o arquivo `.env` e configure:
- `MONGODB_URI`: String de conexão do MongoDB
- `OPENAI_API_KEY`: Chave da API da OpenAI (opcional, usada para todos os modelos)

3. Iniciar servidor:
```bash
npm start
```

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

## Uso Básico

### Opção 1: JSON Estruturado

```javascript
const { processRequest } = require('./src/api');

const result = await processRequest({
  operation: 'query',
  params: {
    filters: {
      type: 'expense',
      named_period: 'current_month'
    }
  },
  context: {
    user_id: 'user_123',
    user_timezone: 'America/Sao_Paulo'
  }
});
```

### Opção 2: Linguagem Natural (com GPT-5 Nano)

```javascript
const { processNaturalLanguage } = require('./src/api');

const result = await processNaturalLanguage(
  'Quanto gastei este mês?',
  {
    user_id: 'user_123',
    user_timezone: 'America/Sao_Paulo'
  }
);
```

## Operações Disponíveis

1. **query** - Buscar transações
2. **insert** - Criar nova transação
3. **update** - Atualizar transação existente
4. **delete** - Remover transação
5. **aggregate** - Calcular soma, média, contagem, etc.
6. **compare** - Comparar períodos ou categorias

## Recursos Implementados

✓ Conexão com MongoDB com reconexão automática  
✓ Modelo de transações com validação  
✓ Índices otimizados para buscas rápidas  
✓ Operações CRUD completas  
✓ 6 operações do Finance Bridge  
✓ Filtros booleanos (AND, OR, NOT)  
✓ Períodos inteligentes (current_month, last_7_days, etc.)  
✓ Validação de tipos, sanitização e range checking  
✓ Integração com GPT-5 Nano  
✓ Sistema de logs estruturado  
✓ Tratamento de erros padronizado  

## Testes

```bash
npm test
```

## Contribuindo

Este é um projeto em desenvolvimento ativo. Consulte a documentação em `docs/` para mais detalhes sobre a arquitetura e planos futuros.

## Licença

MIT
