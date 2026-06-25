import { defineConfig } from '@prisma/config';

export default defineConfig({
  migrations: {
    seed: 'npx tsx Chatbot-whatssap/prisma/seed.ts',
  },
  datasource: {
    url: 'postgresql://admin:mypassword@localhost:5432/chatbot_db?schema=public',
  },
});