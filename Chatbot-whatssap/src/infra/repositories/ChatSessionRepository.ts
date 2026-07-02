import { prisma } from '../database/prisma';

export class ChatSessionRepository {
  // Busca uma sessão existente pelo telefone do cliente
  async findByPhone(phone: string) {
    return await prisma.chatSession.findUnique({
      where: { customerPhone: phone },
    });
  }

  // Cria uma nova sessão com status inicial ROUTER e nome do cliente
  async create(phone: string, name?: string) {
    return await prisma.chatSession.create({
      data: {
        customerPhone: phone,
        customerName: name ?? null,
        status: 'ROUTER',
        checkoutStep: 'NONE',
        lastSeenAt: new Date(),
      },
    });
  }

  /**
   * Busca ou cria a sessão.
   * Retorna `isNewSession` e `previousLastSeenAt` (antes de atualizar para now)
   * para que o caller possa detectar se o cliente é de retorno.
   */
  async findOrCreate(
    phone: string,
    name?: string
  ): Promise<{ session: Awaited<ReturnType<typeof prisma.chatSession.findUnique>> & {}; isNewSession: boolean; previousLastSeenAt: Date | null }> {
    const existing = await this.findByPhone(phone);

    if (existing) {
      // Guarda o lastSeenAt ANTERIOR antes de atualizar para agora
      const previousLastSeenAt = existing.lastSeenAt;

      const updated = await prisma.chatSession.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: new Date(),
          ...(name && !existing.customerName ? { customerName: name } : {}),
        },
      });
      return { session: updated, isNewSession: false, previousLastSeenAt };
    }

    const session = await this.create(phone, name);
    return { session, isNewSession: true, previousLastSeenAt: null };
  }


  // Atualiza o estado da sessão (status, checkoutStep, currentOrderId)
  async updateState(
    id: string,
    data: { status?: string; checkoutStep?: string; currentOrderId?: string | null }
  ) {
    return await prisma.chatSession.update({
      where: { id },
      data,
    });
  }
}
