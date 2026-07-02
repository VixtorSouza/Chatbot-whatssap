import { ProductRepository } from '../../infra/repositories/ProductRepository';

export class CheckStockUseCase {
  async execute(textoDoCliente: string): Promise<string> {
    const repository = new ProductRepository();

    const textoNormalizado = textoDoCliente
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

    // Carrega todos os produtos do banco dinamicamente
    const produtos = await repository.findAllAvailable();

    if (produtos.length === 0) {
      return '😔 No momento não temos produtos disponíveis em estoque.';
    }

    // Tenta identificar se o cliente está perguntando sobre um produto específico
    // Suporta seleção por número (ex: "1", "2") ou por texto parcial
    let produtoEncontrado = null;

    const numberChoice = parseInt(textoNormalizado, 10);
    if (!isNaN(numberChoice) && numberChoice >= 1 && numberChoice <= produtos.length) {
      produtoEncontrado = produtos[numberChoice - 1];
    }

    if (!produtoEncontrado) {
      const words = textoNormalizado.split(' ').filter((w) => w.length > 3);
      produtoEncontrado = produtos.find((p) => {
        const normalizedName = p.name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return (
          normalizedName.includes(textoNormalizado) ||
          words.some((word) => normalizedName.includes(word))
        );
      }) ?? null;
    }

    // Se encontrou um produto específico, exibe os detalhes
    if (produtoEncontrado) {
      return `✅ Temos *${produtoEncontrado.name}* disponível!\n📦 Estoque: ${produtoEncontrado.stock} unidades\n💰 Valor: R$ ${produtoEncontrado.price.toFixed(2)}`;
    }

    // Exibe o catálogo completo como lista numerada
    const lista = produtos
      .map((p, i) => `• ${i + 1}. *${p.name}* — R$ ${p.price.toFixed(2)} (${p.stock} un.)`)
      .join('\n');

    return `🛍️ *Catálogo O Rei das Orquídeas:*\n\n${lista}\n\nQuer saber mais sobre algum produto? Digite o número ou o nome. Para comprar, diga *comprar* ou *quero comprar*.`;
  }
}