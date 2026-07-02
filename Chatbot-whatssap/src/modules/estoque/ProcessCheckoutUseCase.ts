import { ChatSessionRepository } from '../../infra/repositories/ChatSessionRepository';
import { OrderRepository } from '../../infra/repositories/OrderRepository';
import { CreateOrderUseCase } from './CreateOrderUseCase';
import { prisma } from '../../infra/database/prisma';

// Endereço real da loja O Rei das Orquídeas
const ENDERECO_LOJA = 'Av. Giovanni Gronchi, 3800 - Morumbi, São Paulo/SP - CEP 05724-020';

// Formas de pagamento aceitas
const FORMAS_PAGAMENTO = '• *PIX* — chave: (11) 3774-6006\n• *Dinheiro* (na retirada/entrega)\n• *Cartão* (na retirada/entrega)';

export class ProcessCheckoutUseCase {
  private sessionRepository = new ChatSessionRepository();
  private orderRepository = new OrderRepository();
  private createOrderUseCase = new CreateOrderUseCase();

  async execute(session: any, messageText: string): Promise<string> {
    const text = messageText.toLowerCase().trim();
    const textNorm = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Permite cancelar a qualquer momento
    const termosCancelar = ['cancelar', 'sair', 'voltar', 'parar', 'desistir'];
    if (termosCancelar.some((t) => textNorm.includes(t))) {
      if (session.currentOrderId) {
        await this.orderRepository.cancelOrder(session.currentOrderId);
      }
      await this.sessionRepository.updateState(session.id, {
        status: 'ROUTER',
        checkoutStep: 'NONE',
        currentOrderId: null,
      });
      return '❌ Compra cancelada. Voltei você para o menu principal. Como posso ajudar agora?';
    }

    switch (session.checkoutStep) {
      case 'AGUARDANDO_PRODUTO':
        return await this.handleAguardandoProduto(session, messageText);

      case 'AGUARDANDO_ENTREGA':
        return await this.handleAguardandoEntrega(session, textNorm);

      case 'AGUARDANDO_ENDERECO':
        return await this.handleAguardandoEndereco(session, messageText);

      case 'AGUARDANDO_PAGAMENTO':
        return await this.handleAguardandoPagamento(session, textNorm);

      default:
        await this.sessionRepository.updateState(session.id, {
          status: 'ROUTER',
          checkoutStep: 'NONE',
          currentOrderId: null,
        });
        return 'Algo deu errado no fluxo de compra. Voltei você para o menu principal.';
    }
  }

  // ─── ETAPA 1: Produto ──────────────────────────────────────────────────────

  private async handleAguardandoProduto(session: any, messageText: string): Promise<string> {
    const result = await this.createOrderUseCase.execute(session.id, messageText);

    if (result.success && result.order && result.product) {
      await this.sessionRepository.updateState(session.id, {
        checkoutStep: 'AGUARDANDO_ENTREGA',
      });

      return (
        `✅ *${result.product.name}* adicionado ao seu pedido!\n` +
        `💰 Valor: *R$ ${result.product.price.toFixed(2)}*\n\n` +
        `Como você deseja receber?\n\n` +
        `• Digite *entrega* — enviamos para o seu endereço\n` +
        `• Digite *retirada* — você busca na nossa loja`
      );
    }

    const produtos = (result as any).allProducts ?? [];
    const listaProdutos = produtos.length > 0
      ? produtos.map((p: any, i: number) => `• ${i + 1}. *${p.name}* — R$ ${p.price.toFixed(2)}`).join('\n')
      : '• Nenhum produto disponível no momento.';

    if (result.error === 'ESTOQUE_ESGOTADO') {
      return `😔 *${(result as any).productName}* está esgotado.\n\nProdutos disponíveis:\n${listaProdutos}\n\nQual você quer? (ou *cancelar*)`;
    }

    return `Não encontrei esse produto.\n\nNossos produtos:\n${listaProdutos}\n\nDigite o número ou o nome. (ou *cancelar*)`;
  }

  // ─── ETAPA 2: Tipo de entrega ──────────────────────────────────────────────

  private async handleAguardandoEntrega(session: any, textNorm: string): Promise<string> {
    // Detecta "entrega" e variações
    const quer_entrega = ['entrega', 'entregar', 'enviar', 'envio', 'meu endereco', 'endereco'].some((t) =>
      textNorm.includes(t)
    );

    // Detecta "retirada" e variações
    const quer_retirada = ['retirada', 'retirar', 'buscar', 'busco', 'pegar', 'loja', 'presencial'].some((t) =>
      textNorm.includes(t)
    );

    if (quer_entrega) {
      await this.sessionRepository.updateState(session.id, {
        checkoutStep: 'AGUARDANDO_ENDERECO',
      });
      return (
        `🚚 Ótimo, faremos a entrega!\n\n` +
        `Por favor, digite o seu *endereço completo*:\n` +
        `_(Rua, Número, Complemento, Bairro, Cidade, Estado)_`
      );
    }

    if (quer_retirada) {
      // Pula para pagamento direto (sem coleta de endereço)
      await this.sessionRepository.updateState(session.id, {
        checkoutStep: 'AGUARDANDO_PAGAMENTO',
        // Salva o tipo de entrega no pedido
      });

      // Guarda a escolha "RETIRADA" no pedido
      if (session.currentOrderId) {
        await prisma.order.update({
          where: { id: session.currentOrderId },
          data: { deliveryType: 'RETIRADA', deliveryAddress: ENDERECO_LOJA },
        });
      }

      return (
        `🏪 Perfeito! Você buscará na nossa loja.\n\n` +
        `📍 *Endereço da loja:*\n${ENDERECO_LOJA}\n\n` +
        `Como você deseja pagar?\n\n${FORMAS_PAGAMENTO}\n\n` +
        `Digite: *pix*, *dinheiro* ou *cartão*`
      );
    }

    return (
      `Por favor, escolha como quer receber seu pedido:\n\n` +
      `• Digite *entrega* — enviamos para você\n` +
      `• Digite *retirada* — você busca na loja\n\n` +
      `_(ou *cancelar* para voltar ao menu)_`
    );
  }

  // ─── ETAPA 3: Endereço (apenas para ENTREGA) ──────────────────────────────

  private async handleAguardandoEndereco(session: any, address: string): Promise<string> {
    if (address.trim().length < 10) {
      return (
        `Por favor, digite o endereço *completo*:\n` +
        `_(Rua, Número, Complemento, Bairro, Cidade, Estado)_\n\n` +
        `_Ou *cancelar* para voltar._`
      );
    }

    // Salva o endereço e avança para pagamento
    if (session.currentOrderId) {
      await prisma.order.update({
        where: { id: session.currentOrderId },
        data: { deliveryType: 'ENTREGA', deliveryAddress: address },
      });
    }

    await this.sessionRepository.updateState(session.id, {
      checkoutStep: 'AGUARDANDO_PAGAMENTO',
    });

    return (
      `📍 Endereço registrado:\n*${address}*\n\n` +
      `Como você deseja pagar?\n\n${FORMAS_PAGAMENTO}\n\n` +
      `Digite: *pix*, *dinheiro* ou *cartão*`
    );
  }

  // ─── ETAPA 4: Pagamento + Confirmação final ────────────────────────────────

  private async handleAguardandoPagamento(session: any, textNorm: string): Promise<string> {
    const quer_pix = ['pix'].some((t) => textNorm.includes(t));
    const quer_dinheiro = ['dinheiro', 'especie', 'espécie', 'cash'].some((t) => textNorm.includes(t));
    const quer_cartao = ['cartao', 'cartão', 'credito', 'crédito', 'debito', 'débito', 'maquina', 'máquina'].some((t) =>
      textNorm.includes(t)
    );

    let formaPagamento: string | null = null;
    let instrucaoPagamento = '';

    if (quer_pix) {
      formaPagamento = 'PIX';
      instrucaoPagamento = `\n\n💠 *Chave PIX:* (11) 3774-6006\nApós o pagamento, envie o comprovante aqui para confirmarmos seu pedido!`;
    } else if (quer_dinheiro) {
      formaPagamento = 'Dinheiro';
      instrucaoPagamento = `\n\n💵 O pagamento será feito na *entrega/retirada*.`;
    } else if (quer_cartao) {
      formaPagamento = 'Cartão';
      instrucaoPagamento = `\n\n💳 A maquininha estará disponível na *entrega/retirada*.`;
    } else {
      return (
        `Por favor, escolha a forma de pagamento:\n\n` +
        `${FORMAS_PAGAMENTO}\n\n` +
        `Digite: *pix*, *dinheiro* ou *cartão*\n_(ou *cancelar* para voltar)_`
      );
    }

    // Finaliza o pedido
    if (!session.currentOrderId) {
      return 'Erro: Pedido não encontrado. Digite *cancelar* para voltar ao menu.';
    }

    const order = await this.orderRepository.finalizeOrder(session.currentOrderId, {
      status: 'COMPLETED',
      deliveryType: 'RETIRADA', // já foi salvo antes, mas o método precisa do campo
    });

    // Deduz o estoque
    for (const item of order.items) {
      await prisma.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

    // Reinicia a sessão
    await this.sessionRepository.updateState(session.id, {
      status: 'ROUTER',
      checkoutStep: 'NONE',
      currentOrderId: null,
    });

    const itemInfo = order.items.map((i) => `• ${i.product.name} (x${i.quantity}) — R$ ${(i.price * i.quantity).toFixed(2)}`).join('\n');
    const tipoEntrega = order.deliveryType === 'ENTREGA' ? `🚚 Entrega em: ${order.deliveryAddress}` : `🏪 Retirada: ${order.deliveryAddress}`;

    return (
      `🌸 *Pedido Confirmado com Sucesso!* 🌸\n\n` +
      `📦 *Itens:*\n${itemInfo}\n\n` +
      `💰 *Total:* R$ ${order.total.toFixed(2)}\n` +
      `💳 *Pagamento:* ${formaPagamento}` +
      `${instrucaoPagamento}\n\n` +
      `${tipoEntrega}\n\n` +
      `_Obrigado pela compra! Qualquer dúvida, é só chamar. 🌺_`
    );
  }
}
