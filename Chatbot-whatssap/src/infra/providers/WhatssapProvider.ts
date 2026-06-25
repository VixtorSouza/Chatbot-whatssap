import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from 'baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { RouteIntentUseCase } from '../../modules/chat/RouteIntentUseCase';

// Logger silencioso para não poluir o terminal com JSON bruto
const logger = pino({ level: 'silent' }) as any;

export class WhatsAppProvider {
  private sock: any;

  async start() {
    console.log('[WhatsApp] Iniciando conexão...');

    // Busca a versão mais recente do protocolo do WhatsApp
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`[WhatsApp] Versão do protocolo: ${version.join('.')} | Mais recente: ${isLatest}`);

    // Gerencia a sessão para não pedir QR code toda vez
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    this.sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal: false, // Geramos o QR manualmente abaixo
      logger,
      generateHighQualityLinkPreview: true,
      // Evita que o bot reconecte em modo passivo (causa Connection Failure em loop)
      shouldIgnoreJid: (jid) => jid?.endsWith('@broadcast') ?? false,
    });

    // Salva as credenciais sempre que atualizarem
    this.sock.ev.on('creds.update', saveCreds);

    // Monitora o estado da conexão
    this.sock.ev.on('connection.update', (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n[WhatsApp] 📱 QR Code gerado! Escaneie com o seu WhatsApp:\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`[WhatsApp] Conexão encerrada (código: ${statusCode}). Reconectando: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(() => this.start(), 3000); // Aguarda 3s antes de reconectar
        } else {
          console.log('[WhatsApp] ⚠️ Deslogado. Delete a pasta auth_info_baileys e reinicie.');
        }
      } else if (connection === 'open') {
        console.log('[WhatsApp] ✅ Conectado com sucesso! Bot pronto para receber mensagens.');
      }
    });

    // Escuta mensagens recebidas
    this.sock.ev.on('messages.upsert', async (m: any) => {
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const from = msg.key.remoteJid!;
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        '';

      if (!text.trim()) return;

      console.log(`[WhatsApp] 📩 Mensagem de ${from}: "${text}"`);

      try {
        const routeIntentUseCase = new RouteIntentUseCase();
        const resposta = await routeIntentUseCase.execute(from, text);

        await this.sock.sendMessage(from, { text: resposta });
        console.log(`[WhatsApp] ✉️ Resposta enviada para ${from}`);
      } catch (err) {
        console.error('[WhatsApp] ❌ Erro ao processar mensagem:', err);
        await this.sock.sendMessage(from, {
          text: 'Desculpe, ocorreu um erro interno. Tente novamente em instantes.',
        });
      }
    });
  }
}