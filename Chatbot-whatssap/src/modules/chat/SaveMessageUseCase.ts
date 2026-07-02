import { MessageRepository } from '../../infra/repositories/MessageRepository';

export class SaveMessageUseCase {
  private repository = new MessageRepository();

  async execute(chatSessionId: string, sender: 'USER' | 'BOT', text: string) {
    return await this.repository.save(chatSessionId, sender, text);
  }
}
