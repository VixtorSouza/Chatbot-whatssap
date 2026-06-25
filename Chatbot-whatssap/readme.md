# 🤖 WhatsApp Chatbot — TypeScript + Baileys + Prisma 7

Bot de atendimento automatizado via WhatsApp, construído com **TypeScript**, arquitetura em camadas (Clean Architecture), banco de dados **PostgreSQL** via **Prisma 7** e integração com a API não-oficial do WhatsApp via **Baileys**.

---

## 📐 Arquitetura

O projeto segue os princípios de **Clean Architecture**, separando responsabilidades em camadas bem definidas:

```
src/
├── index.ts                        # Entrypoint da aplicação
├── infra/
│   ├── database/
│   │   └── prisma.ts               # Singleton do PrismaClient com adapter PG
│   ├── providers/
│   │   └── WhatssapProvider.ts     # Integração com o WhatsApp (Baileys)
│   └── repositories/
│       └── ProductRepository.ts    # Acesso ao banco de dados (Prisma)
└── modules/
    ├── chat/
    │   └── RouteIntentUseCase.ts   # Roteador de intenções do usuário
    ├── estoque/
    │   └── CheckStockUseCase.ts    # Caso de uso: consulta de estoque
    └── pedidos/                    # (em desenvolvimento)
```

### Camadas

| Camada | Responsabilidade |
|---|---|
| **Provider** | Conecta ao WhatsApp, recebe e envia mensagens |
| **UseCase** | Contém a lógica de negócio de cada funcionalidade |
| **Repository** | Abstrai o acesso ao banco de dados |
| **Database** | Instância do Prisma configurada com adapter explícito |

---

## 🔄 Fluxo de uma mensagem

```mermaid
sequenceDiagram
    participant C as 📱 Cliente (WhatsApp)
    participant P as WhatsAppProvider
    participant R as RouteIntentUseCase
    participant E as CheckStockUseCase
    participant DB as PostgreSQL (Prisma)

    C->>P: Envia mensagem de texto
    P->>P: Filtra mensagens próprias e sem texto
    P->>R: execute(telefone, texto)
    R->>R: Detecta intenção por palavras-chave
    alt Intenção: VER_ESTOQUE
        R->>E: execute(texto)
        E->>DB: findByName() ou findAllAvailable()
        DB-->>E: Produto(s) encontrado(s)
        E-->>R: Resposta formatada
    else Intenção: FALAR_HUMANO
        R-->>P: Mensagem de transferência
    else Intenção: SAUDAÇÃO
        R-->>P: Mensagem de boas-vindas
    end
    P->>C: sendMessage(resposta)
```

---

## 🔄 Fluxo de dados (Infraestrutura)

```mermaid
graph TD
    A[npm run dev] --> B[index.ts]
    B --> C[WhatsAppProvider.start]
    C --> D[Baileys: makeWASocket]
    D --> E{QR Code?}
    E -->|Não logado| F[Imprime QR no terminal]
    F --> G[Usuário escaneia]
    G --> H[✅ Conectado ao WhatsApp]
    E -->|Já autenticado| H
    H --> I[Escuta: messages.upsert]
    I --> J[RouteIntentUseCase]
    J --> K[Repositório → Prisma → PostgreSQL]
    K --> L[Resposta formatada]
    L --> M[sock.sendMessage]
```

---

## 🗄️ Modelo de Dados

```mermaid
erDiagram
    ChatSession {
        string id PK
        string customerPhone UK
        string status
        datetime createdAt
    }
    Product {
        string id PK
        string name
        string sku UK
        float price
        int stock
    }
    Order {
        string id PK
        string chatSessionId FK
        string status
        float total
        datetime createdAt
    }
    OrderItem {
        string id PK
        string orderId FK
        string productId FK
        int quantity
        float price
    }

    ChatSession ||--o{ Order : "tem"
    Order ||--o{ OrderItem : "contém"
    Product ||--o{ OrderItem : "referenciado em"
```

---

## 🛠️ Stack Tecnológica

| Tecnologia | Versão | Função |
|---|---|---|
| **TypeScript** | ^6.0 | Linguagem principal |
| **tsx** | ^4.22 | Executa TypeScript diretamente sem build |
| **Baileys** | 6.17.16 | SDK WhatsApp Multi-Device (protocolo não-oficial) |
| **Prisma** | ^7.8 | ORM + migrations + geração de tipos |
| **@prisma/adapter-pg** | ^7.8 | Adapter explícito PostgreSQL para Prisma 7 |
| **pg** | ^8.22 | Driver nativo do PostgreSQL |
| **dotenv** | ^17 | Carregamento de variáveis de ambiente |
| **pino** | interno | Logger estruturado (do Baileys) |
| **qrcode-terminal** | latest | Renderiza o QR Code no terminal |
| **@hapi/boom** | ^10 | Tipagem de erros HTTP estruturados |
| **Docker + PostgreSQL 15** | — | Banco de dados em container |

---

## 📦 Pré-requisitos

- **Node.js** >= 20
- **Docker** (para o PostgreSQL)
- Conta no **WhatsApp** para escanear o QR Code

---

## 🚀 Como rodar

### 1. Clone o repositório

```bash
git clone https://github.com/VixtorSouza/Chatbot-whatssap.git
cd Chatbot-whatssap
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o ambiente

Crie um arquivo `.env` na raiz:

```env
DATABASE_URL="postgresql://admin:mypassword@localhost:5432/chatbot_db?schema=public"
```

### 4. Suba o banco de dados

```bash
docker compose up -d
```

### 5. Gere o Prisma Client e rode as migrations

```bash
# Gera os tipos do Prisma
npx prisma generate --config Chatbot-whatssap/prisma.config.ts

# Aplica as migrations no banco
npx prisma migrate dev --config Chatbot-whatssap/prisma.config.ts

# Popula o banco com dados iniciais (seed)
npm run seed
```

### 6. Inicie o bot

```bash
npm run dev
```

Um **QR Code** aparecerá no terminal. Escaneie com o seu WhatsApp (**Configurações → Dispositivos conectados → Conectar dispositivo**).

---

## 📜 Scripts disponíveis

```bash
npm run dev      # Inicia o bot em modo desenvolvimento
npm run seed     # Executa o seed no banco de dados
npm run migrate  # Roda as migrations do Prisma
```

---

## ⚙️ Configuração do Prisma 7

O Prisma 7 introduziu uma mudança importante: a URL de conexão não fica mais no `schema.prisma` e sim em um arquivo `prisma.config.ts`:

```ts
// prisma.config.ts
import { defineConfig } from 'prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
```

E o `PrismaClient` agora exige um **adapter explícito** para conectar ao banco:

```ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
```

---

## 🔌 Como o Baileys funciona

O **Baileys** é uma biblioteca que implementa o protocolo **WhatsApp Multi-Device** via WebSocket, sem necessidade de um celular conectado continuamente. Na primeira execução:

1. Gera um **QR Code** no terminal
2. Após o scan, salva as credenciais em `auth_info_baileys/` (pasta local, no `.gitignore`)
3. Nas próximas execuções, reconecta automaticamente sem QR

> ⚠️ O código `440` nos logs indica que o WhatsApp detectou múltiplas conexões abertas (ex: celular + bot ao mesmo tempo) e força uma reconexão. O bot trata isso automaticamente.

---

## 📁 Estrutura completa do projeto

```
chatbot-whatssap/
├── .env                          # Variáveis de ambiente (não commitado)
├── .gitignore
├── docker-compose.yml            # PostgreSQL em container
├── package.json                  # Dependências e scripts
├── prisma.config.ts              # Configuração global do Prisma 7 (raiz)
├── auth_info_baileys/            # Credenciais WhatsApp (não commitado)
└── Chatbot-whatssap/
    ├── prisma/
    │   ├── schema.prisma         # Modelos do banco de dados
    │   ├── seed.ts               # Script de seed
    │   └── prisma.config.ts      # Config do Prisma para este subprojeto
    └── src/
        ├── index.ts
        ├── infra/
        │   ├── database/prisma.ts
        │   ├── providers/WhatssapProvider.ts
        │   └── repositories/ProductRepository.ts
        └── modules/
            ├── chat/RouteIntentUseCase.ts
            ├── estoque/CheckStockUseCase.ts
            └── pedidos/              # (em desenvolvimento)
```

---

## 🔮 Próximas evoluções

- [ ] Integração com IA (Gemini / GPT) para detecção de intenção via NLP
- [ ] Módulo de pedidos com fluxo de carrinho via WhatsApp
- [ ] Gerenciamento de sessão de conversa com máquina de estados
- [ ] Painel administrativo web para visualização de pedidos e estoque
- [ ] Testes unitários e de integração

---

## 📄 Licença

MIT
