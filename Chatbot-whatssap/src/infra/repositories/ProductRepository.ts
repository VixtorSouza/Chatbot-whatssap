import { prisma } from '../database/prisma';

export class ProductRepository {
  // Busca produto pelo nome (busca parcial, case-insensitive)
  async findByName(name: string) {
    return await prisma.product.findFirst({
      where: {
        name: {
          contains: name,
          mode: 'insensitive',
        },
      },
    });
  }

  // Retorna todos os produtos com estoque disponível
  async findAllAvailable() {
    return await prisma.product.findMany({
      where: {
        stock: { gt: 0 },
      },
      orderBy: { name: 'asc' },
    });
  }
}