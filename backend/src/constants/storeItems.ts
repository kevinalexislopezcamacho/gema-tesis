// Server-side source of truth for Byte Store prices — the client must never
// be trusted to send its own price, only the itemId it wants to buy/equip.

export interface StoreItem {
  id: string
  price: number
}

export const COLOR_ITEMS: StoreItem[] = [
  { id: 'azul',      price: 0 },
  { id: 'violeta',   price: 150 },
  { id: 'esmeralda', price: 150 },
  { id: 'coral',     price: 200 },
  { id: 'dorado',    price: 250 },
  { id: 'rosa',      price: 250 },
  { id: 'cian',      price: 300 },
]

export const OUTFIT_ITEMS: StoreItem[] = [
  { id: 'ninguno',   price: 0 },
  { id: 'corbata',   price: 200 },
  { id: 'gorro',     price: 250 },
  { id: 'lentes',    price: 300 },
  { id: 'audifonos', price: 350 },
  { id: 'corona',    price: 400 },
]

export const STYLE_ITEMS: StoreItem[] = [
  { id: 'feliz',      price: 0 },
  { id: 'emocionado', price: 100 },
  { id: 'pensativo',  price: 100 },
  { id: 'celebrando', price: 150 },
  { id: 'triste',     price: 100 },
  { id: 'estudioso',  price: 120 },
  { id: 'saludando',  price: 130 },
  { id: 'sorprendido',price: 140 },
  { id: 'durmiendo',  price: 160 },
]

export type StoreCategory = 'color' | 'outfit' | 'style'

export function catalogFor(category: StoreCategory): StoreItem[] {
  if (category === 'color') return COLOR_ITEMS
  if (category === 'outfit') return OUTFIT_ITEMS
  return STYLE_ITEMS
}
