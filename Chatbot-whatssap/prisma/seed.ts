import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL não está definida nas variáveis de ambiente!');
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando o seed do estoque...');

  // Limpa dados relacionados primeiro para respeitar as FKs
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  console.log('🗑️  Dados antigos removidos.');

  // Cria os produtos da floricultura O Rei das Orquídeas
  await prisma.product.createMany({
    data: [
      {
        name: 'Orquídea Phalaenopsis Branca',
        sku: 'ORQ-PHA-BR',
        price: 89.90,
        stock: 10,
      },
      {
        name: 'Cesta Cascata Pink (3 hastes)',
        sku: 'ORQ-CES-PK',
        price: 199.90,
        stock: 5,
      },
      {
        name: 'Muda de Orquídea Denphal',
        sku: 'ORQ-DEN-MU',
        price: 39.90,
        stock: 20,
      },
      {
        name: 'Adubo Orgânico Especial Bokashi',
        sku: 'ADU-BOK-SP',
        price: 29.90,
        stock: 15,
      },
    ],
  });

  console.log('✅ Estoque populado com sucesso!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });