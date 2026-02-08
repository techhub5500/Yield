# Integração de Chats com o Backend — Guia Completo

**Data:** 07/02/2026  
**Status:** Implementado

---

## 1. Visão Geral

Todos os chats do frontend se conectam ao backend Yield por meio de uma **única classe compartilhada**: `YieldChat`, definida em `client/js/integration.js`.

```
┌─────────────────────────────────────────────────────┐
│  integration.js                                     │
│                                                     │
│  ┌─────────────┐    ┌────────────────┐              │
│  │  Sidebar     │    │  YieldChat     │◄── Classe   │
│  │  (navegação) │    │  (chat↔backend)│    pública   │
│  └─────────────┘    └───────┬────────┘              │
│                             │                       │
└─────────────────────────────┼───────────────────────┘
                              │
          ┌───────────────────┼─────────────────────┐
          │                   │                     │
     home.js            finance.js          [nova-página].js
     (instância)        (instância)         (instância)
```

Cada página cria **sua própria instância** de `YieldChat`, passando os elementos de DOM do chat daquela página. Não há duplicação de lógica — toda a comunicação com o backend, estados, histórico e tratamento de erros estão centralizados em `integration.js`.

---

## 2. Arquitetura

### Arquivo central: `client/js/integration.js`

Este arquivo contém **todo o código compartilhado** do frontend:

| Componente | Responsabilidade |
|-----------|-----------------|
| `initSidebar()` | Navegação lateral (sidebar) |
| `YieldChat` | Classe que conecta qualquer chat ao backend |

### Endpoint do backend utilizado

| Método | Rota | Payload | Retorno |
|--------|------|---------|---------|
| **POST** | `/api/message` | `{ chatId, message }` | `{ response, chatId, timestamp, metadata }` |
| **GET** | `/api/chat/:chatId/history` | — | `{ chatId, recent, summary, wordCount }` |
| **GET** | `/api/chats` | `?limit=50` | `{ chats: [{ chatId, preview, lastMessage, timestamp, messageCount }], count }` |
| **GET** | `/health` | — | `{ status, version, timestamp, uptime }` |

O backend espera `chatId` como UUID string. Cada instância de `YieldChat` gera e persiste um chatId por página no `localStorage`.

---

## 3. Como funciona o `YieldChat`

### 3.1 Ciclo de vida de uma mensagem

```
[Usuário digita] → [Enter / clique no botão]
       ↓
  YieldChat._handleSend()
       ↓
  Limpa input, chama send(text)
       ↓
  1. Exibe mensagem do usuário no DOM
  2. Mostra indicador de digitação (...)
  3. POST /api/message { chatId, message }
       ↓
  Backend processa (Junior → Dispatcher → Resposta)
       ↓
  4. Remove indicador de digitação
  5. Exibe resposta do bot no DOM (com markdown básico)
```

### 3.2 Gerenciamento de chatId

- Cada instância usa um `pageId` (ex: `'home'`, `'finance'`) como prefixo
- O chatId é armazenado em `localStorage` com a chave `yield_chatId_{pageId}`
- Se não existir, um UUID v4 é gerado automaticamente
- O botão "novo chat" (`newChat()`) gera um novo UUID e limpa as mensagens

### 3.3 Funcionalidades incluídas

| Funcionalidade | Descrição |
|---------------|-----------|
| **Envio de mensagens** | POST ao backend, exibe resposta |
| **Indicador de digitação** | Três pontos animados enquanto aguarda resposta |
| **Markdown básico** | Bold, itálico, código inline e quebras de linha |
| **Novo chat** | Gera novo chatId, limpa o histórico visual |
| **Carregar histórico** | GET do histórico do chatId atual e renderiza |
| **Modal de histórico completo** | Lista todos os chats salvos, permite trocar entre eles |
| **Troca de chat** | Selecionar chat do histórico e carregar suas mensagens |
| **Health check** | Verificação de disponibilidade do backend |
| **Detecção de URL** | Funciona tanto acessando via servidor (`http://localhost:3000`) quanto via `file://` |
| **Tratamento de erros** | Mensagem amigável se o backend falhar |
| **Callback de estado** | `onStateChange` notifica a página sobre `idle`, `sending`, `error` |

---

## 4. Como adicionar um chat a uma nova página

### 4.1 Pré-requisitos

O HTML da página precisa:
1. Carregar `integration.js` **antes** do script específico da página
2. Ter os elementos de chat no DOM

### 4.2 HTML mínimo necessário

```html
<!-- No <head> ou no final do <body>, ANTES do script da página -->
<script src="../js/integration.js"></script>
<script src="../js/[sua-pagina].js"></script>
```

Estrutura de chat no HTML:

```html
<div class="chat-messages" id="meu-chat-messages">
    <!-- Mensagens serão inseridas aqui -->
</div>
<div class="chat-input-area">
    <div class="action-icons">
        <button class="chat-btn" id="new-chat-btn"><i class="fas fa-plus"></i></button>
        <button class="chat-btn" id="history-btn"><i class="fas fa-history"></i></button>
    </div>
    <textarea class="chat-input" placeholder="Pergunte sobre suas finanças" rows="1"></textarea>
    <button class="send-btn"><i class="fas fa-arrow-up"></i></button>
</div>
```

### 4.3 JavaScript da página

No arquivo JS específico da página, crie uma instância de `YieldChat`:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    const chat = new YieldChat({
        // Obrigatórios — elementos de DOM do chat
        messagesEl : document.getElementById('meu-chat-messages'),
        inputEl    : document.querySelector('.chat-input'),
        sendBtnEl  : document.querySelector('.send-btn'),

        // Opcionais — botões de ação
        newChatBtnEl : document.getElementById('new-chat-btn'),
        historyBtnEl : document.getElementById('history-btn'),

        // Identificador da página (único por chat)
        pageId: 'minha-pagina',

        // Callback opcional para reagir a mudanças de estado
        onStateChange: (state) => {
            // state: 'idle' | 'sending' | 'error'
            console.log('Chat state:', state);
        },
    });
});
```

**É isso.** Nenhum código adicional de envio, recebimento, fetch ou tratamento de erros é necessário.

### 4.4 Parâmetros do construtor

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|:-----------:|-----------|
| `messagesEl` | `HTMLElement` | ✅ | Container onde as mensagens serão exibidas |
| `inputEl` | `HTMLElement` | ✅ | Textarea de input do usuário |
| `sendBtnEl` | `HTMLElement` | ✅ | Botão de envio |
| `newChatBtnEl` | `HTMLElement` | — | Botão de "novo chat" (gera novo chatId) |
| `historyBtnEl` | `HTMLElement` | — | Botão de "histórico" (carrega do backend) |
| `pageId` | `string` | — | Identificador único da página (default: `'default'`) |
| `baseUrl` | `string` | — | URL base da API (default: auto-detectado) |
| `onStateChange` | `function` | — | Callback `(state) => {}` chamado em mudanças de estado |

### 4.5 Métodos públicos disponíveis

| Método | Descrição |
|--------|-----------|
| `send(text)` | Envia mensagem ao backend e exibe resposta |
| `loadHistory()` | Carrega histórico do backend e renderiza |
| `newChat()` | Cria novo chatId e limpa m
| `listAllChats()` | Lista todos os chats salvos no backend |
| `openHistoryModal()` | Abre modal com histórico completo de chats |
| `switchToChat(chatId)` | Troca para outro chat e carrega seu histórico |ensagens |
| `healthCheck()` | Retorna `true/false` se o backend está disponível |
| `getChatId()` | Retorna o chatId atual |

---

## 5. Exemplos de integrações existentes

### 5.1 home.js

A home tem um comportamento especial: o chat se expande ao digitar e se contrai ao fechar. O `onStateChange` é usado para detectar quando o usuário envia uma mensagem e abrir o painel de chat.

```javascript
const chat = new YieldChat({
    messagesEl   : chatMessages,
    inputEl      : chatInput,
    sendBtnEl    : sendBtn,
    newChatBtnEl : newChatBtn,
    historyBtnEl : historyBtn,
    pageId       : 'home',
    onStateChange: (state) => {
        if (state === 'sending') {
            hasSentMessage = true;
            openChat();   // Função local que expande o painel
        }
    },
});
```

### 5.2 finance.js

A finance não tem comportamento de abrir/fechar — o chat é sempre visível. A integração é mínima:

```javascript
const chat = new YieldChat({
    messagesEl   : chatMessages,
    inputEl      : chatInput,
    sendBtnEl    : sendBtn,
    newChatBtnEl : newChatBtn,
    historyBtnEl : historyBtn,
    pageId       : 'finance',
});
```

---

## 6. CSS necessário para o indicador de digitação

O `YieldChat` injeta um elemento com a classe `.typing-indicator` contendo três `<span class="dot">`. Se quiser a animação dos três pontos, adicione ao CSS da página ou ao `integration.css`:

```css
.typing-indicator .dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    margin: 0 2px;
    background: #888;
    border-radius: 50%;
    animation: typing-bounce 1.4s infinite ease-in-out both;
}
.typing-indicator .dot:nth-child(1) { animation-delay: -0.32s; }
.typing-indicator .dot:nth-child(2) { animation-delay: -0.16s; }
.typing-indicator .dot:nth-child(3) { animation-delay: 0s; }

@keyframes typing-bounce {
    0%, 80%, 100% { transform: scale(0); }
    40% { transform: scale(1); }
}
```

---

## 7. Fluxo completo (Frontend → Backend → Frontend)

```
[Página]                     [integration.js]              [Backend /api/message]
   │                              │                               │
   │  new YieldChat(config)       │                               │
   │──────────────────────────────>│                               │
   │                              │  _bindEvents()                │
   │                              │  _loadOrCreateChatId()        │
   │                              │                               │
   │  [Usuário digita Enter]      │                               │
   │──────────────────────────────>│                               │
   │                              │  _handleSend()                │
   │                              │  _appendMessage(user)         │
   │                              │  _showTypingIndicator()       │
   │                              │  POST /api/message            │
   │                              │───────────────────────────────>│
   │                              │                               │ Junior classifica
   │                              │                               │ Dispatcher roteia
   │                              │                               │ ResponseAgent formata
   │                              │      { response, metadata }   │
   │                              │<───────────────────────────────│
   │                              │  _removeTypingIndicator()     │
   │                              │  _appendMessage(bot)          │
   │                              │                               │
   │  [DOM atualizado com resposta]                               │
   │<──────────────────────────────│                               │
```

---

## 8. Regras de manutenção

1. **Toda lógica de comunicação com o backend** deve ficar em `integration.js`. As páginas individuais NÃO devem fazer `fetch` para a API.

2. **Cada página** deve apenas criar uma instância de `YieldChat` com seus seletores de DOM e, opcionalmente, reagir a mudanças de estado via `onStateChange`.

3. **Para adicionar uma nova funcionalidade ao chat** (ex: upload de arquivo, streaming), altere apenas `YieldChat` em `integration.js`. Todas as páginas herdam automaticamente.

4. **O `pageId`** deve ser único por chat. Dois chats na mesma página devem ter `pageId` diferentes para manter chatIds separados.

5. **Não duplicar** `addMessage`, `handleSend`, `fetch('/api/message')` ou qualquer lógica de comunicação dentro dos arquivos de página.

---

## 9. Funcionalidades dos Botões de Chat

### 9.1 Botão "+" (Novo Chat)
- **Ícone:** `fas fa-plus`
- **Ação:** Cria um novo chat do zero
- **Comportamento:**
  - Gera um novo UUID v4 como chatId
  - Salva no localStorage com a chave `yield_chatId_{pageId}`
  - Limpa todas as mensagens da interface
  - Reseta o histórico visual
- **Uso:** Quando o usuário quer começar uma nova conversa sem contexto anterior

### 9.2 Botão "Histórico" (Lista de Chats)
- **Ícone:** `fas fa-history`
- **Ação:** Abre modal com lista de todos os chats salvos
- **Comportamento:**
  1. Faz GET `/api/chats` para buscar lista completa
  2. Renderiza modal com glassmorphism seguindo identidade visual
  3. Lista ordenada por data (mais recentes primeiro)
  4. Cada item mostra:
     - Preview da primeira mensagem (até 80 caracteres)
     - Data formatada (Hoje, Ontem, X dias atrás, DD/MMM)
     - Número de mensagens no chat
  5. Chat atual destacado visualmente
  6. Ao clicar em um chat:
     - Troca para aquele chatId
     - Carrega histórico completo
     - Fecha o modal
- **Modal:**
  - Background com backdrop-filter blur
  - Glassmorphism (fundo escuro com transparência)
  - Animação de fade-in e slide-up
  - Fecha ao clicar no X ou fora do modal
  - Scroll interno se lista for grande

### 9.3 Estrutura do Modal (integration.html)
```html
<div id="chat-history-modal" class="chat-modal">
    <div class="chat-modal-content">
        <div class="chat-modal-header">
            <h3>Histórico de Conversas</h3>
            <button class="chat-modal-close" id="close-history-modal">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="chat-modal-body" id="chat-list-container">
            <!-- Lista de chats renderizada aqui -->
        </div>
    </div>
</div>
```

### 9.4 Fluxo do Modal de Histórico
```
[Usuário clica em botão histórico]
          ↓
    openHistoryModal()
          ↓
    Modal exibe loading
          ↓
    GET /api/chats
          ↓
    Backend consulta MongoDB
          ↓
    Retorna lista de chats
          ↓
    Renderiza itens no modal
          ↓
    [Usuário clica em chat]
          ↓
    switchToChat(chatId)
          ↓
    Atualiza chatId no localStorage
          ↓
    Limpa mensagens atuais
          ↓
    loadHistory() do chat selecionado
          ↓
    Fecha modal
```

---