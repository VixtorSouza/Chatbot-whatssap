import { ChatSessionRepository } from '../../infra/repositories/ChatSessionRepository';
import { MessageRepository } from '../../infra/repositories/MessageRepository';
import { OrderRepository } from '../../infra/repositories/OrderRepository';
import { GeminiProvider } from '../../infra/providers/GeminiProvider';
import { CheckStockUseCase } from '../estoque/CheckStockUseCase';
import { ProcessCheckoutUseCase } from '../estoque/ProcessCheckoutUseCase';

export class RouteIntentUseCase {
  private sessionRepository = new ChatSessionRepository();
  private messageRepository = new MessageRepository();
  private orderRepository = new OrderRepository();
  private geminiProvider = new GeminiProvider();
  private checkStockUseCase = new CheckStockUseCase();
  private processCheckoutUseCase = new ProcessCheckoutUseCase();

  async execute(telefone: string, textoDoCliente: string, pushName?: string): Promise<string> {
    // 1. Carrega ou cria a sessão do cliente (passando o nome do WhatsApp)
    const { session, isNewSession, previousLastSeenAt } = await this.sessionRepository.findOrCreate(telefone, pushName);

    // 2. Salva a mensagem recebida do usuário
    await this.messageRepository.save(session.id, 'USER', textoDoCliente);

    // 3. Se estiver em atendimento humano — usa NLP para detectar se quer voltar ao bot
    if (session.status === 'HUMAN') {
      const querReativar = await this.geminiProvider.detectReactivation(textoDoCliente);

      if (querReativar) {
        await this.sessionRepository.updateState(session.id, {
          status: 'ROUTER',
          checkoutStep: 'NONE',
          currentOrderId: null,
        });
        const nome = session.customerName ? ` ${session.customerName}` : '';
        const msg = `🤖 *Bot reativado!* Olá de novo${nome}! Como posso te ajudar?\n\n• Ver nosso *catálogo* (digite *catálogo* ou *1*)\n• Iniciar uma *compra* (digite *comprar* ou *2*)\n• Ver *status do pedido* (digite *pedido* ou *3*)\n• Falar com *atendente humano* (digite *humano* ou *4*)`;
        await this.messageRepository.save(session.id, 'BOT', msg);
        return msg;
      }
      return '';
    }

    let resposta = '';

    // 4. Fluxo de Compra ativo
    if (session.status === 'COMPRANDO') {
      resposta = await this.processCheckoutUseCase.execute(session, textoDoCliente);
    } else {
      // 5. Fluxo de Roteador (Classificação de Intenção)

      // 5.1 Se é a PRIMEIRA mensagem do cliente → saudação personalizada de boas-vindas
      if (isNewSession) {
        const nome = session.customerName ? `, *${session.customerName}*` : '';
        resposta = `👋 Olá${nome}! Sou o assistente virtual da floricultura *O Rei das Orquídeas*. Que bom ter você por aqui! 🌸\n\nPosso te ajudar com:\n• Ver nosso *catálogo* de orquídeas e adubos (digite *catálogo* ou *1*)\n• Iniciar uma *compra* (digite *comprar* ou *2*)\n• Ver o *status do pedido* (digite *pedido* ou *3*)\n• Falar com um *atendente humano* (digite *humano* ou *4*)\n\nO que você precisa hoje?`;
      } else {
        // 5.2 Cliente de retorno — verifica se é a "primeira mensagem do dia"
        const ultimaVez = previousLastSeenAt ?? new Date();
        const agora = new Date();
        const diferencaHoras = (agora.getTime() - ultimaVez.getTime()) / (1000 * 60 * 60);

        // Se ficou mais de 4 horas sem mensagem, trata como "retorno"
        const eRetorno = diferencaHoras > 4;

        if (eRetorno) {
          const nome = session.customerName ? `, *${session.customerName}*` : '';
          const saudacao = this.getSaudacaoHoraria();

          // Verifica se tem pedido recente para mencionar
          const ultimoPedido = await this.orderRepository.findLatest(session.id);
          let msgPedido = '';
          if (ultimoPedido && ultimoPedido.status === 'PENDING') {
            msgPedido = `\n\n📦 Você tem um pedido em aberto (R$ ${ultimoPedido.total.toFixed(2)}). Digite *pedido* para ver o status.`;
          } else if (ultimoPedido && ultimoPedido.status === 'COMPLETED') {
            msgPedido = `\n\n🌸 Seu último pedido foi concluído com sucesso!`;
          }

          resposta = `${saudacao}${nome}, bem-vindo(a) de volta ao *Rei das Orquídeas*! 🌸${msgPedido}\n\nComo posso te ajudar hoje?\n• *catálogo* ou *1* — Ver nossos produtos\n• *comprar* ou *2* — Fazer um pedido\n• *pedido* ou *3* — Status do pedido\n• *humano* ou *4* — Falar com atendente`;
        } else {
          // Dentro do mesmo período — classifica a intenção normalmente
          const historico = await this.messageRepository.findRecent(session.id, 5);
          const historicoSemUltima = historico.slice(1);
          const intencao = await this.geminiProvider.classifyIntent(textoDoCliente, historicoSemUltima);

          switch (intencao) {
            case 'STATUS_PEDIDO': {
              const order = await this.orderRepository.findLatest(session.id);
              if (order) {
                const dataPedido = order.createdAt.toLocaleDateString('pt-BR');
                const statusMap: Record<string, string> = {
                  PENDING: '⏳ Pendente',
                  COMPLETED: '✅ Finalizado/Pago',
                  CANCELLED: '❌ Cancelado',
                };
                resposta = `🌸 *Status do seu último pedido:* 🌸\n\n🆔 *Código:* ${order.id}\n📅 *Data:* ${dataPedido}\n💰 *Total:* R$ ${order.total.toFixed(2)}\n📊 *Status:* *${statusMap[order.status] ?? order.status}*\n🚚 *Modo:* ${order.deliveryType ?? 'Não definido'}`;
                if (order.deliveryAddress) {
                  resposta += `\n📍 *Endereço:* ${order.deliveryAddress}`;
                }
              } else {
                resposta = 'Você ainda não possui pedidos registrados no nosso sistema. 🌸';
              }
              break;
            }

            case 'VER_ESTOQUE':
              resposta = await this.checkStockUseCase.execute(textoDoCliente);
              break;

            case 'HUMANO':
              await this.sessionRepository.updateState(session.id, { status: 'HUMAN' });
              resposta = '👤 Estou transferindo você para um atendente do *Rei das Orquídeas*. Por favor, aguarde um momento.';
              break;

            case 'COMPRAR': {
              const updatedSession = await this.sessionRepository.updateState(session.id, {
                status: 'COMPRANDO',
                checkoutStep: 'AGUARDANDO_PRODUTO',
              });
              resposta = await this.processCheckoutUseCase.execute(updatedSession, textoDoCliente);
              break;
            }

            case 'SAUDACAO':
            default: {
              const nome = session.customerName ? `, *${session.customerName}*` : '';
              resposta = `👋 Olá${nome}! Sou o assistente virtual da floricultura *O Rei das Orquídeas*.\n\nPosso te ajudar com:\n• Ver nosso *catálogo* de orquídeas e adubos (digite *catálogo* ou *1*)\n• Iniciar uma *compra* (digite *comprar* ou *2*)\n• Ver o *status do pedido* (digite *pedido* ou *3*)\n• Falar com um *atendente humano* (digite *humano* ou *4*)\n\nO que você precisa hoje?`;
              break;
            }
          }
        }
      }
    }

    // 6. Salva a resposta gerada do bot no histórico se não for vazia
    if (resposta) {
      await this.messageRepository.save(session.id, 'BOT', resposta);
    }

    return resposta;
  }

  /** Retorna saudação adequada ao horário atual */
  private getSaudacaoHoraria(): string {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) return '☀️ Bom dia';
    if (hora >= 12 && hora < 18) return '🌤️ Boa tarde';
    return '🌙 Boa noite';
  }
}