import 'dotenv/config'; // Garante que o .env é carregado antes de tudo
import { WhatsAppProvider } from './infra/providers/WhatssapProvider';

console.log('[App] 🚀 Iniciando chatbot...');

const whatsapp = new WhatsAppProvider();
whatsapp.start();
