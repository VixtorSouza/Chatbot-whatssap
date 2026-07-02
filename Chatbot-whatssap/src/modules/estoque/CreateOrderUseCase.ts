import { ProductRepository } from '../../infra/repositories/ProductRepository';
import { OrderRepository } from '../../infra/repositories/OrderRepository';
import { ChatSessionRepository } from '../../infra/repositories/ChatSessionRepository';

export class CreateOrderUseCase {
  private productRepository = new ProductRepository();
  private orderRepository = new OrderRepository();
  private sessionRepository = new ChatSessionRepository();

  async execute(chatSessionId: string, textOrProductName: string) {
    // Carrega todos os produtos disponíveis em estoque do banco
    const allProducts = await this.productRepository.findAllAvailable();

    if (allProducts.length === 0) {
      return { success: false, error: 'PRODUTO_NAO_ENCONTRADO' };
    }

    const textNormalized = textOrProductName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    let matchedProduct: (typeof allProducts)[0] | null = null;

    // Tenta selecionar por número (ex: "1", "2", "3", "4")
    const numberChoice = parseInt(textNormalized, 10);
    if (!isNaN(numberChoice) && numberChoice >= 1 && numberChoice <= allProducts.length) {
      matchedProduct = allProducts[numberChoice - 1];
    }

    // Se não foi número, tenta correspondência por texto (parcial, case-insensitive)
    if (!matchedProduct) {
      matchedProduct = allProducts.find((p) => {
        const normalizedName = p.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        // Verifica se o texto do cliente contém alguma palavra significativa do nome do produto
        return normalizedName.includes(textNormalized) || textNormalized.includes(normalizedName.split(' ')[0]);
      }) ?? null;
    }

    // Busca mais flexível: verifica se o texto do cliente contém alguma parte do nome
    if (!matchedProduct) {
      const words = textNormalized.split(' ').filter((w) => w.length > 3);
      matchedProduct = allProducts.find((p) => {
        const normalizedName = p.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return words.some((word) => normalizedName.includes(word));
      }) ?? null;
    }

    if (!matchedProduct) {
      return { success: false, error: 'PRODUTO_NAO_ENCONTRADO', allProducts };
    }

    if (matchedProduct.stock <= 0) {
      return { success: false, error: 'ESTOQUE_ESGOTADO', productName: matchedProduct.name, allProducts };
    }

    // Criar pedido pendente
    const order = await this.orderRepository.createPending(chatSessionId);

    // Adiciona o item ao pedido (quantidade 1 por padrão para o MVP)
    await this.orderRepository.addItem(order.id, matchedProduct.id, 1, matchedProduct.price);

    // Salva o ID do pedido ativo na sessão do chat
    await this.sessionRepository.updateState(chatSessionId, {
      currentOrderId: order.id,
    });

    return { success: true, order, product: matchedProduct };
  }
}
