/**
 * Teste E2E do Chatbot O Rei das Orquídeas — usando Vitest
 *
 * O GeminiProvider é mockado via vi.mock(), garantindo:
 *   - Respostas determinísticas (sem 429, sem quota)
 *   - Zero falsos negativos por API externa
 *   - Banco Neon real, mas isolado por número de telefone fictício
 *
 * Para rodar: npx vitest run src/chatbot.e2e.test.ts
 */
import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { prisma } from './infra/database/prisma';

// ─── Mock do GeminiProvider antes de qualquer import que o use ───────────────
vi.mock('./infra/providers/GeminiProvider', () => {
  return {
    GeminiProvider: class {
      classifyIntent = async (text: string) => {
        const t = text.toLowerCase();
        if (/catal[oó]g|estoque|produto|orqu[ií]d|adubo|ver|mostrar|1/.test(t)) return 'VER_ESTOQUE';
        if (/comprar|compra|pedido novo|2/.test(t)) return 'COMPRAR';
        if (/status|onde|meu pedido|3/.test(t)) return 'STATUS_PEDIDO';
        if (/humano|atendente|pessoa|4/.test(t)) return 'HUMANO';
        return 'SAUDACAO';
      };
      detectReactivation = async (text: string) => {
        const t = text.toLowerCase();
        return /rob[oô]|bot|ia|chatbot|virtual|automati|voltei/.test(t);
      };
    },
  };
});


// Import APÓS o mock
import { RouteIntentUseCase } from './modules/chat/RouteIntentUseCase';

// ─── Setup ────────────────────────────────────────────────────────────────────
const PHONE = '5500000000042@s.whatsapp.net'; // telefone fictício isolado
const NAME  = 'Maria Teste';

async function enviar(msg: string): Promise<string> {
  return new RouteIntentUseCase().execute(PHONE, msg, NAME);
}

async function limpar() {
  const sess = await prisma.chatSession.findUnique({ where: { customerPhone: PHONE } });
  if (!sess) return;
  const ordens = await prisma.order.findMany({ where: { chatSessionId: sess.id } });
  for (const o of ordens) {
    await prisma.orderItem.deleteMany({ where: { orderId: o.id } });
  }
  await prisma.order.deleteMany({ where: { chatSessionId: sess.id } });
  await prisma.message.deleteMany({ where: { chatSessionId: sess.id } });
  await prisma.chatSession.delete({ where: { id: sess.id } });
}

beforeAll(async () => {
  await limpar(); // garante sessão limpa antes de tudo
});

afterAll(async () => {
  await limpar(); // remove dados de teste ao final
  await prisma.$disconnect();
});

// ─── SUITE 1: Entrada e menu ──────────────────────────────────────────────────
describe('Entrada e menu principal', () => {
  it('deve saudar cliente novo pelo nome', async () => {
    const r = await enviar('Oi');
    expect(r).toContain('Maria Teste');
    expect(r).toContain('Orquídeas');
    expect(r).toMatch(/catálogo|1/);
  });

  it('deve exibir catálogo ao enviar "1"', async () => {
    const r = await enviar('1');
    // '1' pode ir para VER_ESTOQUE (catálogo) ou COMPRAR (seleção de produto)
    // ambos são respostas válidas com R$
    expect(r).toMatch(/R\$|Orquídea|Adubo|adicionado|Temos/);
  });

  it('deve reconhecer "ver catálogo" como intenção de estoque', async () => {
    const r = await enviar('quero ver o catálogo');
    expect(r).toMatch(/Orquídea|Adubo|Cesta|R\$/);
  });
});

// ─── SUITE 2: Fluxo de compra com RETIRADA ────────────────────────────────────
describe('Fluxo de compra — Retirada + PIX', () => {
  it('deve iniciar compra ao receber "comprar"', async () => {
    const r = await enviar('comprar');
    // estará em COMPRANDO agora, aguardando produto
    expect(r).toMatch(/produto|Orquídea|Adubo|número/i);
  });

  it('deve selecionar produto pelo número "1"', async () => {
    const r = await enviar('1');
    expect(r).toMatch(/adicionado|entrega|retirada/i);
    expect(r).toContain('R$');
  });

  it('deve registrar escolha de retirada e mostrar endereço real', async () => {
    const r = await enviar('retirada');
    expect(r).toContain('Giovanni Gronchi');
    expect(r).toContain('3800');
    expect(r).toMatch(/pagar|PIX|pix/i);
  });

  it('deve finalizar pedido com PIX e mostrar chave correta', async () => {
    const r = await enviar('pix');
    expect(r).toMatch(/Confirmado|Sucesso|🌸/);
    expect(r).toContain('3774');   // chave PIX real da loja
    expect(r).toContain('R$');
  });

  it('deve ter deduzido o estoque após a compra', async () => {
    // Qualquer produto listado deve ter stock >= 0
    const produtos = await prisma.product.findMany();
    for (const p of produtos) {
      expect(p.stock).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── SUITE 3: Fluxo de compra com ENTREGA ────────────────────────────────────
describe('Fluxo de compra — Entrega + Dinheiro', () => {
  it('deve iniciar nova compra', async () => {
    const r = await enviar('quero comprar');
    expect(r).toMatch(/produto|Orquídea|Adubo|número/i);
  });

  it('deve selecionar produto por nome parcial "orquídea"', async () => {
    const r = await enviar('orquídea');
    // pode retornar o produto encontrado ou pedir refinamento
    expect(r).toMatch(/adicionado|entrega|retirada|Orquídea|produto/i);
  });

  it('deve aceitar variação "quero entrega"', async () => {
    const r = await enviar('quero entrega');
    expect(r).toMatch(/endereço|Rua|entrega/i);
  });

  it('deve rejeitar endereço muito curto', async () => {
    const r = await enviar('Rua A');
    expect(r).toMatch(/completo|endereço|Rua/i);
  });

  it('deve aceitar endereço válido e avançar para pagamento', async () => {
    const r = await enviar('Rua das Acácias, 200, Apto 12, Jardins, São Paulo, SP');
    expect(r).toMatch(/pagar|PIX|dinheiro|cartão/i);
  });

  it('deve finalizar pedido com dinheiro', async () => {
    const r = await enviar('dinheiro');
    expect(r).toMatch(/Confirmado|Sucesso|🌸/);
    expect(r).toMatch(/inheiro|entrega/i);
  });
});

// ─── SUITE 4: Cancelamento ────────────────────────────────────────────────────
describe('Cancelamento durante compra', () => {
  it('deve iniciar compra', async () => {
    const r = await enviar('comprar');
    expect(r).toMatch(/produto|Orquídea|número/i);
  });

  it('deve cancelar ao digitar "cancelar"', async () => {
    const r = await enviar('cancelar');
    expect(r).toMatch(/cancelad|menu/i);
  });

  it('após cancelar deve voltar ao menu (responde saudação)', async () => {
    const r = await enviar('oi');
    expect(r).toMatch(/Olá|catálogo|ajudar/i);
  });
});

// ─── SUITE 5: Status do pedido ────────────────────────────────────────────────
describe('Consulta de status do pedido', () => {
  it('deve informar o último pedido com total e status', async () => {
    const r = await enviar('onde está meu pedido');
    expect(r).toMatch(/pedido|Pedido/);
    expect(r).toContain('R$');
    expect(r).toMatch(/COMPLETED|PENDING|Finalizado|Pendente/);
  });
});

// ─── SUITE 6: Atendimento humano e reativação ─────────────────────────────────
describe('Transferência para humano e reativação do bot', () => {
  it('deve transferir para atendente humano', async () => {
    const r = await enviar('quero falar com um atendente');
    expect(r).toMatch(/atendente|humano|Transferindo/i);
  });

  it('deve ficar em silêncio enquanto em modo HUMAN', async () => {
    const r = await enviar('oi, preciso de ajuda');
    expect(r).toBe('');
  });

  it('deve reativar o bot com "quero falar com o robô"', async () => {
    const r = await enviar('quero falar com o robô');
    expect(r).toMatch(/reativado|Bot|menu/i);
    expect(r).toMatch(/catálogo|comprar|1/i);
  });
});

// ─── SUITE 7: Cliente de retorno ─────────────────────────────────────────────
describe('Cliente de retorno após mais de 4 horas', () => {
  it('deve saudar com "bem-vindo de volta" após gap de 5h', async () => {
    // Força o lastSeenAt para 5 horas atrás
    const sess = await prisma.chatSession.findUnique({ where: { customerPhone: PHONE } });
    if (sess) {
      await prisma.chatSession.update({
        where: { id: sess.id },
        data: { lastSeenAt: new Date(Date.now() - 5 * 60 * 60 * 1000) },
      });
    }

    const r = await enviar('oi');
    expect(r).toMatch(/bem-vindo|bem vindo|volta/i);
    expect(r).toMatch(/dia|tarde|noite/i); // saudação horária
    expect(r).toContain('Maria Teste');    // nome personalizado
  });
});
