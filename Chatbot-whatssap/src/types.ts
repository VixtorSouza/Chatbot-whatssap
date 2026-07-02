/**
 * Tipos e validadores centralizados do Chatbot O Rei das Orquídeas.
 * Usa Zod para validação em runtime e TypeScript para tipagem estática.
 */
import { z } from 'zod';

// ─── Status da Sessão ─────────────────────────────────────────────────────────

export const SessionStatusSchema = z.enum(['ROUTER', 'COMPRANDO', 'HUMAN']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const CheckoutStepSchema = z.enum([
  'NONE',
  'AGUARDANDO_PRODUTO',
  'AGUARDANDO_ENTREGA',
  'AGUARDANDO_ENDERECO',
]);
export type CheckoutStep = z.infer<typeof CheckoutStepSchema>;

// ─── Intenções ────────────────────────────────────────────────────────────────

export const IntentSchema = z.enum([
  'SAUDACAO',
  'VER_ESTOQUE',
  'STATUS_PEDIDO',
  'HUMANO',
  'COMPRAR',
]);
export type Intent = z.infer<typeof IntentSchema>;

// ─── Modelos de Domínio (espelham o schema do Prisma) ─────────────────────────

export const ChatSessionSchema = z.object({
  id: z.string().uuid(),
  customerPhone: z.string().min(10).max(30),
  status: SessionStatusSchema,
  checkoutStep: CheckoutStepSchema,
  currentOrderId: z.string().uuid().nullable(),
  createdAt: z.date(),
});
export type ChatSession = z.infer<typeof ChatSessionSchema>;

export const MessageSchema = z.object({
  id: z.string().uuid(),
  chatSessionId: z.string().uuid(),
  sender: z.enum(['USER', 'BOT']),
  text: z.string().min(1),
  createdAt: z.date(),
});
export type Message = z.infer<typeof MessageSchema>;

export const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  sku: z.string().min(1),
  price: z.number().positive(),
  stock: z.number().int().min(0),
});
export type Product = z.infer<typeof ProductSchema>;

export const OrderStatusSchema = z.enum(['PENDING', 'COMPLETED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const DeliveryTypeSchema = z.enum(['RETIRADA', 'ENTREGA']);
export type DeliveryType = z.infer<typeof DeliveryTypeSchema>;

export const OrderItemSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
  price: z.number().positive(), // snapshot do preço no momento da compra
  product: ProductSchema.optional(),
});
export type OrderItem = z.infer<typeof OrderItemSchema>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  chatSessionId: z.string().uuid(),
  status: OrderStatusSchema,
  total: z.number().min(0),
  deliveryType: DeliveryTypeSchema.nullable(),
  deliveryAddress: z.string().nullable(),
  createdAt: z.date(),
  items: z.array(OrderItemSchema).optional(),
});
export type Order = z.infer<typeof OrderSchema>;

// ─── DTOs de Entrada ──────────────────────────────────────────────────────────

/** Input do webhook do WhatsApp */
export const IncomingMessageSchema = z.object({
  from: z.string().min(5),   // JID do WhatsApp (ex: 5511999999@s.whatsapp.net)
  text: z.string().min(1).max(4096),
});
export type IncomingMessage = z.infer<typeof IncomingMessageSchema>;

/** Atualização de estado da sessão */
export const SessionUpdateSchema = z.object({
  status: SessionStatusSchema.optional(),
  checkoutStep: CheckoutStepSchema.optional(),
  currentOrderId: z.string().uuid().nullable().optional(),
});
export type SessionUpdate = z.infer<typeof SessionUpdateSchema>;

/** Input para finalização do pedido */
export const FinalizeOrderSchema = z.object({
  status: OrderStatusSchema,
  deliveryType: DeliveryTypeSchema,
  deliveryAddress: z.string().min(10).optional(),
}).refine(
  (data) => data.deliveryType === 'RETIRADA' || (data.deliveryType === 'ENTREGA' && !!data.deliveryAddress),
  { message: 'Endereço obrigatório para entrega', path: ['deliveryAddress'] }
);
export type FinalizeOrder = z.infer<typeof FinalizeOrderSchema>;

// ─── Resultados de UseCase ─────────────────────────────────────────────────────

export type CreateOrderResult =
  | { success: true; order: Order; product: Product }
  | { success: false; error: 'PRODUTO_NAO_ENCONTRADO'; allProducts?: Product[] }
  | { success: false; error: 'ESTOQUE_ESGOTADO'; productName: string; allProducts?: Product[] };
