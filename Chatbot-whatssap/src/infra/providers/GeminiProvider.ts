import { GoogleGenAI } from '@google/genai';

// Todas as intenções possíveis do sistema
type Intent = 'SAUDACAO' | 'VER_ESTOQUE' | 'STATUS_PEDIDO' | 'HUMANO' | 'COMPRAR' | 'REATIVAR_BOT';

export class GeminiProvider {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_AI;
    if (apiKey && apiKey !== 'sua-chave-do-gemini-aqui') {
      this.ai = new GoogleGenAI({ apiKey });
    } else {
      console.warn('[GeminiProvider] ⚠️ Chave GEMINI_API_AI ausente ou inválida. Usando fallback de regras locais.');
    }
  }

  /**
   * Classifica a intenção do cliente no fluxo principal (status ROUTER).
   */
  async classifyIntent(
    messageText: string,
    history: Array<{ sender: string; text: string }>
  ): Promise<'SAUDACAO' | 'VER_ESTOQUE' | 'STATUS_PEDIDO' | 'HUMANO' | 'COMPRAR'> {
    // Atalhos numéricos do menu: tratados localmente (Gemini não tem contexto do nosso menu)
    const trimmed = messageText.trim();
    if (trimmed === '1') return 'VER_ESTOQUE';
    if (trimmed === '2') return 'COMPRAR';
    if (trimmed === '3') return 'STATUS_PEDIDO';
    if (trimmed === '4') return 'HUMANO';

    if (!this.ai) {
      return this.localFallback(messageText);
    }

    try {
      const formattedHistory = history
        .map((h) => `[${h.sender}]: ${h.text}`)
        .reverse()
        .join('\n');

      const systemPrompt = `Você é o classificador de intenções do chatbot da floricultura "O Rei das Orquídeas".
Com base no histórico recente da conversa e na última mensagem do cliente, responda APENAS com uma das seguintes categorias (em letras maiúsculas, sem pontuação, sem formatação markdown):

- SAUDACAO: Se for uma saudação como olá, oi, bom dia, boa tarde, ou se a mensagem for genérica de contato inicial.
- VER_ESTOQUE: Se o cliente perguntar por produtos, catálogo, orquídeas disponíveis, adubos, preços gerais, ou se há plantas em estoque.
- STATUS_PEDIDO: Se o cliente estiver perguntando sobre o status de um pedido ("onde está meu pedido?", "meu pedido foi enviado?", "status da compra", "código de rastreio").
- HUMANO: Se o cliente pedir explicitamente para falar com um atendente humano ("falar com atendente", "falar com pessoa", "suporte", "ligar").
- COMPRAR: Se o cliente expressar o desejo direto de comprar ou pedir um produto específico ("quero comprar a orquídea branca", "quero a cesta cascata", "quero encomendar 1 adubo").

Histórico recente:
${formattedHistory}

Última mensagem do cliente: "${messageText}"

Resposta esperada (APENAS a palavra da categoria):`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
      });

      const intent = response.text?.trim().toUpperCase();
      console.log(`[GeminiProvider] 🧠 Classificação de intenção: "${intent}" para: "${messageText}"`);

      const validIntents = ['SAUDACAO', 'VER_ESTOQUE', 'STATUS_PEDIDO', 'HUMANO', 'COMPRAR'];
      if (validIntents.includes(intent as any)) {
        return intent as any;
      }

      return this.localFallback(messageText);
    } catch (error) {
      console.error('[GeminiProvider] ❌ Erro ao chamar API do Gemini. Usando fallback local.', (error as any)?.message ?? error);
      return this.localFallback(messageText);
    }
  }

  /**
   * Detecta via NLP se o cliente em atendimento humano quer voltar a falar com o bot.
   * Usa o Gemini para entender variações naturais da intenção.
   */
  async detectReactivation(messageText: string): Promise<boolean> {
    if (!this.ai) {
      return this.localReactivationFallback(messageText);
    }

    try {
      const systemPrompt = `Você é um detector de intenção de reativação de chatbot.

O cliente está sendo atendido por um humano. Analise a mensagem abaixo e responda APENAS com SIM ou NAO:

- Responda SIM se o cliente quiser voltar a ser atendido pelo bot/robô/assistente virtual/chatbot automatizado. Exemplos:
  "quero falar com o bot", "me transfere para o robô", "quero o atendente virtual", "pode me passar pro chatbot", "voltar para o assistente", "quero falar com o assistente", "fala comigo robô", "preciso do bot", "eu quero o bot de volta".

- Responda NAO para qualquer outra mensagem que não seja uma solicitação de voltar ao atendimento automático.

Mensagem do cliente: "${messageText}"

Resposta (APENAS SIM ou NAO):`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: systemPrompt,
      });

      const result = response.text?.trim().toUpperCase();
      console.log(`[GeminiProvider] 🔄 Detecção de reativação: "${result}" para: "${messageText}"`);

      return result === 'SIM';
    } catch (error) {
      console.error('[GeminiProvider] ❌ Erro ao detectar reativação. Usando fallback local.', (error as any)?.message ?? error);
      return this.localReactivationFallback(messageText);
    }
  }

  // ─── Fallbacks locais (usados quando a API do Gemini não está disponível) ───

  private localFallback(messageText: string): 'SAUDACAO' | 'VER_ESTOQUE' | 'STATUS_PEDIDO' | 'HUMANO' | 'COMPRAR' {
    const text = messageText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    // Navegação por número (menu principal)
    if (text === '1' || text === 'catalogo' || text === 'catalago') return 'VER_ESTOQUE';
    if (text === '2' || text === 'comprar' || text === 'compra' || text === 'compro') return 'COMPRAR';
    if (text === '3' || text === 'pedido' || text === 'meu pedido') return 'STATUS_PEDIDO';
    if (text === '4') return 'HUMANO';

    const palavrasEstoque = ['tem', 'estoque', 'disponivel', 'orquidea', 'planta', 'flor', 'adubo', 'produto', 'catalogo', 'denphal', 'phalaenopsis', 'cesta', 'bokashi', 'preco', 'valor', 'quanto custa'];
    const palavrasHumano = ['humano', 'atendente', 'pessoa', 'falar com alguem', 'suporte', 'ajuda humana'];
    const palavrasPedido = ['pedido', 'rastreio', 'rastrear', 'status', 'entrega', 'chegar', 'chega', 'onde esta', 'foi enviado'];
    const palavrasComprar = ['comprar', 'quero a', 'quero o', 'quero comprar', 'pedir', 'encomendar', 'gostaria de comprar'];

    if (palavrasHumano.some((p) => text.includes(p))) return 'HUMANO';
    if (palavrasComprar.some((p) => text.includes(p))) return 'COMPRAR';
    if (palavrasPedido.some((p) => text.includes(p))) return 'STATUS_PEDIDO';
    if (palavrasEstoque.some((p) => text.includes(p))) return 'VER_ESTOQUE';

    return 'SAUDACAO';
  }

  private localReactivationFallback(messageText: string): boolean {
    const text = messageText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const termosReativar = [
      'bot', 'robo', 'chatbot', 'assistente', 'atendente virtual',
      'falar com o bot', 'falar com o robo', 'voltar para o bot',
      'me transfere para o bot', 'preciso do bot', 'quero o bot',
      ' ia', 'falar com a ia', 'inteligencia artificial', 'atendimento automatico',
    ];
    return termosReativar.some((t) => text.includes(t));
  }
}
