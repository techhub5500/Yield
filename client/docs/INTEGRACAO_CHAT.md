# Documentação de Integração dos Chats

## Sistema Unificado de Chat - Yield Finance

**Data:** 05 de fevereiro de 2026  
**Versão:** 1.0.0

---

## 📋 Visão Geral

Este documento descreve como funciona a integração entre os chats do frontend e o backend do sistema multi-agente Yield Finance. A arquitetura foi projetada para ser **reutilizável**, permitindo que novos chats sejam adicionados facilmente em futuras páginas.

### Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND                                │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   home.js    │  │  finance.js  │  │  futuro.js   │       │
│  │   (chat)     │  │   (chat)     │  │   (chat)     │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         ▼                 ▼                 ▼                │
│  ┌─────────────────────────────────────────────────────┐    │
│  │               ChatManager (integration.js)          │    │
│  │                                                     │    │
│  │  - ChatService('home')                              │    │
│  │  - ChatService('finance')                           │    │
│  │  - ChatService('futuro')                            │    │
│  └─────────────────────────┬───────────────────────────┘    │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTP POST /api/chat
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      BACKEND                                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Rota /api/chat (index.js)                │    │
│  └─────────────────────────┬───────────────────────────┘    │
│                            │                                 │
│                            ▼                                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Sistema Multi-Agente (agents/)            │    │
│  │                                                     │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐       │    │
│  │  │  Júnior   │→│Orquestrador│→│Coordenadores│       │    │
│  │  └───────────┘  └───────────┘  └───────────┘       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Componentes do Frontend

### 1. ChatService (integration.js)

Classe responsável pela comunicação com o backend. Mantém o estado da sessão e histórico de mensagens.

#### Uso Básico

```javascript
// Criar instância para uma página específica
const chatService = ChatManager.getChat('home');

// Enviar mensagem
const result = await chatService.sendMessage('Quanto gastei este mês?');
console.log(result.response); // Resposta da IA

// Verificar se está processando
if (chatService.isProcessing()) {
    // Mostrar indicador de loading
}

// Obter histórico
const history = chatService.getHistory();

// Limpar histórico
chatService.clearHistory();
```

#### Callbacks

```javascript
const chatService = ChatManager.getChat('finance');

// Callback quando receber mensagem
chatService.on('message', (message) => {
    console.log('IA respondeu:', message.content);
});

// Callback para erros
chatService.on('error', (error) => {
    console.error('Erro:', error.message);
});

// Callback para estado de loading
chatService.on('loading', (isLoading) => {
    button.disabled = isLoading;
});
```

### 2. ChatManager (integration.js)

Factory que gerencia instâncias de ChatService. Mantém uma instância única por página.

```javascript
// Obter chat da página atual
const chat = ChatManager.getChat('home');

// Remover instância específica
ChatManager.removeChat('home');

// Limpar todas as instâncias
ChatManager.clearAll();
```

---

## 🔌 Endpoint da API

### POST /api/chat

Endpoint principal para comunicação com o sistema de IA.

#### Request

```json
{
  "message": "Quanto gastei este mês?",
  "chatId": "chat_user123_home_1707145200000",
  "pageContext": "home"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `message` | string | ✅ | Mensagem do usuário |
| `chatId` | string | ❌ | ID do chat (gerado automaticamente se não fornecido) |
| `pageContext` | string | ❌ | Identificador da página (home, finance, etc.) |

#### Response (Sucesso)

```json
{
  "success": true,
  "chatId": "chat_user123_home_1707145200000",
  "response": "Você gastou R$ 2.500,00 este mês, focado principalmente em alimentação (R$ 800) e transporte (R$ 450).",
  "metadata": {
    "page": "home",
    "timestamp": "2026-02-05T12:00:00.000Z",
    "agentType": "junior",
    "complexity": "intermediate"
  }
}
```

#### Response (Erro)

```json
{
  "success": false,
  "error": "Erro ao processar mensagem"
}
```

---

## 📝 Como Adicionar um Novo Chat

### Passo 1: Criar o HTML

Adicione a estrutura do chat no seu arquivo HTML:

```html
<div class="chat-section">
    <div class="chat-messages" id="minha-pagina-chat-messages">
        <!-- Mensagens aparecerão aqui -->
    </div>
    <div class="chat-input-area">
        <textarea class="chat-input" placeholder="Pergunte algo..."></textarea>
        <button class="send-btn">
            <i class="fas fa-arrow-up"></i>
        </button>
    </div>
</div>
```

### Passo 2: Criar o JavaScript

No arquivo JS da sua página (ex: `minha-pagina.js`):

```javascript
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.querySelector('.chat-input');
    const sendBtn = document.querySelector('.send-btn');
    const chatMessages = document.querySelector('.chat-messages');

    // 1. Inicializar o serviço de chat com o contexto da página
    const chatService = ChatManager.getChat('minha-pagina');

    // 2. Configurar callback de loading (opcional)
    chatService.on('loading', (isLoading) => {
        sendBtn.disabled = isLoading;
        if (isLoading) {
            sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        } else {
            sendBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
        }
    });

    // 3. Função para adicionar mensagem na tela
    function addMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${sender}`;
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 4. Função para indicador de digitação
    function addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message bot typing-indicator';
        indicator.id = 'minha-pagina-typing';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatMessages.appendChild(indicator);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('minha-pagina-typing');
        if (indicator) indicator.remove();
    }

    // 5. Função de envio
    async function handleSend() {
        const text = chatInput.value.trim();
        if (text && !chatService.isProcessing()) {
            addMessage(text, 'user');
            chatInput.value = '';

            addTypingIndicator();
            const result = await chatService.sendMessage(text);
            removeTypingIndicator();
            
            addMessage(result.response, 'bot');
        }
    }

    // 6. Event listeners
    sendBtn.addEventListener('click', handleSend);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });
});
```

### Passo 3: Incluir os Scripts

No HTML, certifique-se de incluir:

```html
<!-- CSS comum -->
<link rel="stylesheet" href="../css/integration.css">
<!-- CSS específico da página -->
<link rel="stylesheet" href="../css/minha-pagina.css">

<!-- Scripts -->
<script src="../js/integration.js"></script>
<script src="../js/minha-pagina.js"></script>
```

---

## 🎨 Estilos CSS

Os estilos comuns do chat estão em `integration.css`:

### Indicador de Digitação

```css
.typing-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 12px 16px;
}

.typing-indicator span {
    width: 8px;
    height: 8px;
    background-color: rgba(255, 255, 255, 0.6);
    border-radius: 50%;
    animation: typing-bounce 1.4s infinite ease-in-out both;
}

.typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
.typing-indicator span:nth-child(3) { animation-delay: 0s; }

@keyframes typing-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
}
```

### Botão Desabilitado

```css
.send-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
}

.fa-spinner {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
```

---

## 🧠 Como o Backend Processa

### Fluxo de Processamento

1. **Recepção**: O endpoint `/api/chat` recebe a mensagem
2. **Autenticação**: Verifica token JWT (se fornecido)
3. **Memória**: Carrega memória do chat (se existir)
4. **Processamento**: Envia para o sistema de agentes
5. **Agente Júnior**: Classifica a complexidade
   - **Trivial/Simples**: Resolve diretamente
   - **Intermediário**: Usa Finance Bridge + cálculos
   - **Complexo**: Escala para Orquestrador
6. **Resposta**: Formata e retorna ao frontend
7. **Persistência**: Salva ciclo na memória

### Tipos de Complexidade

| Nível | Descrição | Exemplo |
|-------|-----------|---------|
| `trivial` | Consulta direta | "Qual foi minha última compra?" |
| `simple` | Lançamento com dados | "Gastei R$50 no mercado" |
| `intermediate` | Análise básica | "Quanto gastei este mês?" |
| `complex` | Múltiplas tarefas | "Analise meus gastos e crie um orçamento" |

---

## 🔧 Configuração

### Variáveis de Ambiente (.env)

```env
# API de IA (necessário para processamento inteligente)
OPENAI_API_KEY=sua_chave_aqui

# MongoDB (necessário para persistência de memória)
MONGODB_URI=mongodb://localhost:27017/yield_finance

# Servidor
PORT=3000
```

### URL da API (Frontend)

Em `integration.js`:

```javascript
const CHAT_API_URL = 'http://localhost:3000/api/chat';
```

Para produção, altere para:

```javascript
const CHAT_API_URL = 'https://api.yield.finance/api/chat';
```

---

## 📊 Estrutura de Arquivos

```
client/
├── js/
│   ├── integration.js    # ChatService, ChatManager, AuthManager
│   ├── home.js           # Chat da página home
│   └── finance.js        # Chat da página finance
├── css/
│   └── integration.css   # Estilos comuns (typing indicator, etc.)
└── html/
    ├── home.html
    └── finance.html

server/
├── src/
│   ├── index.js          # Rota /api/chat
│   └── services/
│       ├── agents/       # Sistema multi-agente
│       │   ├── index.js  # API pública (processMessage)
│       │   ├── junior/   # Agente Júnior
│       │   ├── orchestrator/  # Orquestrador
│       │   ├── coordinators/  # Coordenadores especializados
│       │   └── response/      # Agente de Resposta
│       └── memory/       # Sistema de memória
│           ├── index.js
│           └── memory-manager.js
```

---

## ✅ Checklist para Novos Chats

- [ ] Criar estrutura HTML do chat
- [ ] Inicializar `ChatManager.getChat('nome-da-pagina')`
- [ ] Implementar função `addMessage()`
- [ ] Implementar indicador de digitação
- [ ] Configurar event listeners (click e Enter)
- [ ] Incluir `integration.js` antes do script da página
- [ ] Incluir `integration.css` para estilos do indicador

---

## 🚀 Próximos Passos

1. **Persistência de Histórico**: Implementar salvamento de histórico de chat no localStorage
2. **Markdown na Resposta**: Suporte a formatação Markdown nas respostas
3. **Streaming**: Implementar streaming de resposta para respostas longas
4. **Histórico de Conversas**: UI para visualizar conversas anteriores
5. **Contexto por Página**: Personalizar prompts baseado no contexto da página

---

## 📝 Notas Importantes

1. **Autenticação**: O chat funciona com ou sem autenticação. Com autenticação, mantém histórico persistente.

2. **Memória**: Sem MongoDB, a memória é volátil (apenas na sessão atual).

3. **OpenAI**: Sem API key configurada, o sistema usa respostas simplificadas.

4. **CORS**: O servidor está configurado para aceitar requisições de qualquer origem em desenvolvimento.

---

## 🛠️ Troubleshooting

### Chat não responde

1. Verifique se o servidor está rodando (`node src/index.js`)
2. Verifique o console do navegador para erros
3. Verifique se a URL da API está correta

### Resposta genérica

1. Verifique se a `OPENAI_API_KEY` está configurada no `.env`
2. Verifique os logs do servidor para erros de API

### Memória não persiste

1. Verifique se o MongoDB está rodando
2. Verifique a `MONGODB_URI` no `.env`

---

**Última atualização:** 05/02/2026
