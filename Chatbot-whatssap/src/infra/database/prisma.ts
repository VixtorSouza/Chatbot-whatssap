// src/infra/database/prisma.ts
import 'dotenv/config'; // Carrega o .env antes de qualquer coisa
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL não está definida no .env!');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Instancia única do Prisma (singleton) compartilhada por toda a aplicação
export const prisma = new PrismaClient({ adapter });
