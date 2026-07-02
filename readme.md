# 🤖 WhatsApp Chatbot — TypeScript + Gemini NLP + Prisma 7 + Neon

Bot de atendimento inteligente e automatizado para a floricultura **O Rei das Orquídeas**, construído com **TypeScript**, arquitetura baseada em casos de uso (Clean Architecture), banco de dados **PostgreSQL (Neon)** via **Prisma 7**, inteligência artificial com a API do **Gemini** e integração não-oficial com WhatsApp via **Baileys**.

---

## 📐 Arquitetura

O projeto segue princípios de Clean Architecture, organizando o código em casos de uso focados:

```
src/
├── index.ts                        # Entrypoint da aplicação
├── types.ts                        # Schemas Zod e tipos TypeScript centralizados
├── infra/
│   ├── database/
│   │   └── prisma.ts               # Singleton do PrismaClient com adapter PG
│   ├── providers/
│   │   ├── WhatssapProvider.ts     # Integração WhatsApp (Baileys)
│   │   └── GeminiProvider.ts       # Brain NLP (Classificação e Reativação)
│   └── repositories/
│       ├── ChatSessionRepository.ts # Controle de sessões dos clientes
│       ├── MessageRepository.ts     # Histórico de conversas
│       ├── ProductRepository.ts     # Catálogo e estoque
│       └── OrderRepository.ts       # Gestão de pedidos
└── modules/
    ├── chat/
    │   └── RouteIntentUseCase.ts   # Orquestrador de fluxo por máquina de estados
    └── estoque/
        ├── CheckStockUseCase.ts    # Consulta e listagem dinâmica de estoque
        ├── CreateOrderUseCase.ts   # Validação de estoque e criação de pedidos
        └── ProcessCheckoutUseCase.ts # Máquina de estados do fluxo de compra
```

---

## ⚙️ Máquina de Estados de Atendimento

O chatbot controla a experiência do usuário com base no status de sua sessão no banco de dados:

1. **`ROUTER` (Roteador NLP)**:
   - Se o usuário envia `1`, `2`, `3` ou `4`, o bot intercepta localmente sem fazer requisições na API do Gemini.
   - Caso contrário, envia o texto ao Gemini NLP para classificar a intenção (`VER_ESTOQUE`, `COMPRAR`, `STATUS_PEDIDO`, `HUMANO` ou `SAUDACAO`).
   - Possui fallback resiliente local para lidar com o limite da cota gratuita da API do Gemini (429).
2. **`COMPRANDO` (Checkout em 4 etapas)**:
   - **`AGUARDANDO_PRODUTO`**: Usuário digita ou seleciona o número do item no catálogo.
   - **`AGUARDANDO_ENTREGA`**: Escolha entre `entrega` ou `retirada` (com NLP para variações linguísticas).
   - **`AGUARDANDO_ENDERECO`**: Coleta de endereço (se selecionado entrega).
   - **`AGUARDANDO_PAGAMENTO`**: Escolha do meio de pagamento (`PIX`, `Dinheiro` ou `Cartão`) e envio de resumo final com dedução imediata no estoque.
3. **`HUMAN` (Transbordo Humano)**:
   - O chatbot para de responder e entra em modo silencioso.
   - O Gemini NLP monitora as mensagens buscando intenções de reativação (ex: "quero o robô", "voltar para IA"), trazendo o status da sessão de volta para `ROUTER` de forma natural.

---

## 🗄️ Modelo de Dados (PostgreSQL / Neon)

O banco de dados PostgreSQL está normalizado na terceira forma normal (**3FN**), utilizando as seguintes entidades:

*   **`ChatSession`**: Mantém o estado da conversa, o telefone, a última mensagem recebida (`lastSeenAt`) e o nome do contato do WhatsApp (`customerName`) capturado de forma passiva.
*   **`Message`**: Histórico completo de mensagens recebidas (`USER`) e enviadas (`BOT`).
*   **`Product`**: Tabela de inventário com SKU única, preço e quantidade em estoque.
*   **`Order`**: Registro de compras com tipo de entrega, endereço e valor total.
*   **`OrderItem`**: Tabela de pivô (N:M) que armazena a quantidade e o preço unitário pago (snapshot do preço no momento da compra).

---

## 🛠️ Stack Tecnológica

*   **TypeScript + tsx**: Execução direta sem etapa de build.
*   **Baileys**: SDK WhatsApp Multi-Device (WebSocket).
*   **Gemini API (@google/genai)**: Processamento de Linguagem Natural (NLP) para intenções e reativação.
*   **Prisma 7 + @prisma/adapter-pg**: ORM de última geração com drivers PostgreSQL nativos.
*   **Zod**: Validação de runtime e tipagem forte ponta a ponta.
*   **Vitest**: Suite de testes rápidos e mockagem de serviços.

---

## 🚀 Como Rodar o Projeto

### 1. Instalar dependências
```bash
npm install
```

### 2. Configurar o arquivo `.env`
Crie um arquivo `.env` na raiz do projeto com as chaves:
```env
DATABASE_URL="sua_connection_string_postgresql_do_neon"
GEMINI_API_KEY="sua_chave_gemini_api"
```

### 3. Sincronizar banco de dados e rodar o Seed
```bash
# Sincroniza o schema e aplica migrations
npx prisma migrate dev --schema Chatbot-whatssap/prisma/schema.prisma

# Popula o banco com orquídeas e adubos
npx tsx Chatbot-whatssap/src/seed.ts
```

### 4. Iniciar o chatbot
```bash
npm run dev
```
Escaneie o QR Code exibido no terminal utilizando a opção "Aparelhos conectados" do seu aplicativo do WhatsApp.

---

## 🧪 Testes E2E (Vitest)

O projeto conta com uma suite completa de testes integrados utilizando **Vitest** e mock de API. Os testes validam:
- Saudação a novos clientes
- Catálogo e busca dinâmica de produtos
- Fluxo de compra completo (tanto Retirada + PIX quanto Entrega + Dinheiro)
- Cancelamento de fluxo
- Detecção e saudação de cliente de retorno (>4h de ausência)
- Transbordo e reativação NLP do bot

Para executar os testes:
```bash
npm run test:e2e
```
