import { CheckStockUseCase } from '../estoque/CheckStockUseCase';

export class RouteIntentUseCase {
  async execute(telefone: string, textoDoCliente: string): Promise<string> {
    const texto = textoDoCliente.toLowerCase();

    // Detecta a intenção do cliente pelo texto
    let intencao = 'SAUDACAO';

    const palavrasEstoque = ['tem', 'estoque', 'disponível', 'disponivel', 'camiseta', 'boné', 'bone', 'moletom', 'produto', 'catalogo', 'catálogo'];
    const palavrasHumano = ['humano', 'atendente', 'pessoa', 'falar com alguem', 'falar com alguém'];

    if (palavrasEstoque.some((p) => texto.includes(p))) {
      intencao = 'VER_ESTOQUE';
    } else if (palavrasHumano.some((p) => texto.includes(p))) {
      intencao = 'FALAR_HUMANO';
    }

    console.log(`[Bot] Telefone: ${telefone} | Intenção: ${intencao} | Texto: "${textoDoCliente}"`);

    switch (intencao) {
      case 'VER_ESTOQUE':
        const checkStock = new CheckStockUseCase();
        return await checkStock.execute(textoDoCliente);

      case 'FALAR_HUMANO':
        return '👤 Estou transferindo você para um atendente. Por favor, aguarde um momento.';

      default:
        return '👋 Olá! Sou o assistente virtual da loja.\n\nPosso te ajudar com:\n• Ver o *estoque* de produtos\n• Falar com um *atendente humano*\n\nO que você precisa?';
    }
  }
}