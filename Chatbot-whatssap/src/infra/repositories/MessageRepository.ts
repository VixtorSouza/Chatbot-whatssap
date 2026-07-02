import { prisma } from '../database/prisma';

export class MessageRepository {
  // Salva uma mensagem no histórico da sessão
  async save(chatSessionId: string, sender: 'USER' | 'BOT', text: string) {
    return await prisma.message.create({
      data: {
        chatSessionId,
        sender,
        text,
      },
    });
  }

  // Busca as últimas N mensagens de uma sessão para contexto do bot
  async findRecent(chatSessionId: string, limit = 5) {
    return await prisma.message.findMany({
      where: { chatSessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
