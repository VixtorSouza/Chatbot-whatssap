import { prisma } from '../database/prisma';

export class OrderRepository {
  // Cria um novo pedido pendente associado à sessão
  async createPending(chatSessionId: string) {
    return await prisma.order.create({
      data: {
        chatSessionId,
        status: 'PENDING',
        total: 0.0,
      },
    });
  }

  // Adiciona ou atualiza um item no pedido, atualizando o total do pedido
  async addItem(orderId: string, productId: string, quantity: number, price: number) {
    // Cria o item do pedido
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId,
        productId,
        quantity,
        price,
      },
    });

    // Atualiza o total do pedido
    const items = await prisma.orderItem.findMany({
      where: { orderId },
    });

    const total = items.reduce((acc, item) => acc + item.price * item.quantity, 0);

    await prisma.order.update({
      where: { id: orderId },
      data: { total },
    });

    return orderItem;
  }

  // Atualiza informações de finalização do pedido (status, entrega, etc.)
  async finalizeOrder(orderId: string, data: { status: string; deliveryType: string; deliveryAddress?: string }) {
    return await prisma.order.update({
      where: { id: orderId },
      data: {
        status: data.status,
        deliveryType: data.deliveryType,
        deliveryAddress: data.deliveryAddress ?? null,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }

  // Cancela o pedido
  async cancelOrder(orderId: string) {
    return await prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  // Retorna o último pedido de uma sessão
  async findLatest(chatSessionId: string) {
    return await prisma.order.findFirst({
      where: { chatSessionId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  }
}
