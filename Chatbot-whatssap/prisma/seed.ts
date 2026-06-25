// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const DATABASE_URL = 'postgresql://admin:mypassword@localhost:5432/chatbot_db?schema=public';

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Iniciando o seed do estoque...');

  // Deleta produtos antigos para não duplicar se rodar o script de novo
  await prisma.product.deleteMany();

  // Cria os produtos de teste no PostgreSQL
  await prisma.product.createMany({
    data: [
      {
        name: 'Camiseta Preta Oversized',
        sku: 'CAM-PRE-G',
        price: 89.90,
        stock: 15,
      },
      {
        name: 'Boné Minimalista Chumbo',
        sku: 'BON-CHU-U',
        price: 59.90,
        stock: 5,
      },
      {
        name: 'Moletom Canguru Off-White',
        sku: 'MOL-OFF-M',
        price: 199.90,
        stock: 3,
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