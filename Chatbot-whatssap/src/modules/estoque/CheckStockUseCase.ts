import { ProductRepository } from '../../infra/repositories/ProductRepository';

export class CheckStockUseCase {
  async execute(textoDoCliente: string): Promise<string> {
    const repository = new ProductRepository();

    // Palavras-chave dos produtos para identificar o que o cliente quer
    const palavrasChave: Record<string, string> = {
      camiseta: 'Camiseta',
      camisa: 'Camiseta',
      bone: 'Boné',
      boné: 'Boné',
      moletom: 'Moletom',
    };

    const textoNormalizado = textoDoCliente.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Tenta encontrar qual produto o cliente está perguntando
    let nomeProcurado: string | null = null;
    for (const [palavra, nome] of Object.entries(palavrasChave)) {
      if (textoNormalizado.includes(palavra)) {
        nomeProcurado = nome;
        break;
      }
    }

    // Se mencionou um produto específico, busca só ele
    if (nomeProcurado) {
      const produto = await repository.findByName(nomeProcurado);

      if (!produto || produto.stock === 0) {
        return `😔 Desculpe, *${nomeProcurado}* está esgotado no momento.`;
      }

      return `✅ Temos *${produto.name}* disponível!\n📦 Estoque: ${produto.stock} unidades\n💰 Valor: R$ ${produto.price.toFixed(2)}`;
    }

    // Se não mencionou produto específico, mostra o catálogo completo
    const produtos = await repository.findAllAvailable();

    if (produtos.length === 0) {
      return '😔 No momento não temos produtos disponíveis em estoque.';
    }

    const lista = produtos
      .map((p) => `• *${p.name}* — R$ ${p.price.toFixed(2)} (${p.stock} un.)`)
      .join('\n');

    return `🛍️ Nosso estoque disponível:\n\n${lista}\n\nQual produto você quer saber mais?`;
  }
}