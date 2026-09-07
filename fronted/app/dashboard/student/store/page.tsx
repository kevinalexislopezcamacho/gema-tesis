"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Spinner } from "@/components/ui/spinner"
import {
  LogOut, Trophy, Flame, BookOpen, ShoppingBag,
  Palette, Shirt, Smile, Pencil, Check,
  Glasses, Ribbon, PartyPopper, Sparkles, Lightbulb, Minus,
  Headphones, Crown, Frown, BookOpenCheck, Hand, Eye, Moon,
  Coins,
  type LucideIcon,
} from "lucide-react"
import { ByteMascot, type ByteColor, type ByteOutfit, type ByteExpression } from "@/components/byte/ByteMascot"

const NAV_ITEMS = [
  { href: "/dashboard/student",              icon: BookOpen,      label: "Mi Aprendizaje",              tourId: "nav-learning" },
  { href: "/dashboard/student/achievements", icon: Trophy,        label: "Logros",                      tourId: "nav-achievements" },
  { href: "/dashboard/student/store",        icon: ShoppingBag,   label: "Tienda", active: true,        tourId: "nav-store" },
]

interface StoreItem { id: string; label: string; price: number }

const COLOR_ITEMS: StoreItem[] = [
  { id: "azul",      label: "Azul clásico", price: 0 },
  { id: "violeta",   label: "Violeta",      price: 150 },
  { id: "esmeralda", label: "Esmeralda",    price: 150 },
  { id: "coral",     label: "Coral",        price: 200 },
  { id: "dorado",    label: "Dorado",       price: 250 },
  { id: "rosa",      label: "Rosa",         price: 250 },
  { id: "cian",      label: "Cian",         price: 300 },
]
const COLOR_SWATCH: Record<string, string> = {
  azul: "#1E88E5", violeta: "#7C4FE0", esmeralda: "#17A673", coral: "#E0714F",
  dorado: "#D4A017", rosa: "#E0568C", cian: "#17A6A6",
}

const OUTFIT_ITEMS: StoreItem[] = [
  { id: "ninguno",   label: "Ninguno",       price: 0 },
  { id: "corbata",   label: "Corbatín",      price: 200 },
  { id: "gorro",     label: "Gorro fiesta",  price: 250 },
  { id: "lentes",    label: "Lentes de sol", price: 300 },
  { id: "audifonos", label: "Audífonos",     price: 350 },
  { id: "corona",    label: "Corona",        price: 400 },
]
const OUTFIT_ICON: Record<string, LucideIcon> = {
  ninguno: Minus, corbata: Ribbon, gorro: PartyPopper, lentes: Glasses,
  audifonos: Headphones, corona: Crown,
}

const STYLE_ITEMS: StoreItem[] = [
  { id: "feliz",       label: "Feliz",       price: 0 },
  { id: "emocionado",  label: "Emocionado",  price: 100 },
  { id: "pensativo",   label: "Pensativo",   price: 100 },
  { id: "celebrando",  label: "Celebrando",  price: 150 },
  { id: "triste",      label: "Triste",      price: 100 },
  { id: "estudioso",   label: "Estudioso",   price: 120 },
  { id: "saludando",   label: "Saludando",   price: 130 },
  { id: "sorprendido", label: "Sorprendido", price: 140 },
  { id: "durmiendo",   label: "Durmiendo",   price: 160 },
]
const STYLE_ICON: Record<string, LucideIcon> = {
  feliz: Smile, emocionado: Sparkles, pensativo: Lightbulb, celebrando: PartyPopper,
  triste: Frown, estudioso: BookOpenCheck, saludando: Hand, sorprendido: Eye, durmiendo: Moon,
}
const STYLE_TO_EXPRESSION: Record<string, ByteExpression> = {
  feliz: "happy", emocionado: "excited", pensativo: "thinking", celebrando: "celebrating",
  triste: "sad", estudioso: "studying", saludando: "waving", sorprendido: "surprised", durmiendo: "sleeping",
}

type Tab = "color" | "ropa" | "estilo" | "nombre"
type PurchaseCategory = "color" | "outfit" | "style"

const CATALOG: Record<PurchaseCategory, StoreItem[]> = {
  color: COLOR_ITEMS, outfit: OUTFIT_ITEMS, style: STYLE_ITEMS,
}

interface PreviewSelection { category: PurchaseCategory; itemId: string }

export default function StorePage() {
  const router = useRouter()
  const { user, isLoading, logout, purchaseByteItem, updateByteName } = useAuth()
  const [tab, setTab] = useState<Tab>("color")
  const [nameInput, setNameInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  // Ítem que el estudiante está "probándose" antes de comprar — no descuenta
  // monedas hasta que confirme con el botón de compra.
  const [previewSelection, setPreviewSelection] = useState<PreviewSelection | null>(null)

  useEffect(() => {
    if (!isLoading && (!user || user.role !== "student")) router.push("/login")
  }, [user, isLoading, router])

  useEffect(() => {
    if (user?.progress) setNameInput(user.progress.byteName ?? "Byte")
  }, [user?.progress?.byteName])

  if (isLoading || !user || user.role !== "student" || !user.progress) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Spinner className="w-8 h-8" /></div>
  }

  const progress = user.progress!
  const byteColor  = (progress.byteColor as ByteColor) ?? "azul"
  const byteOutfit = (progress.byteOutfit as ByteOutfit) ?? "ninguno"
  const expression = STYLE_TO_EXPRESSION[progress.byteStyle] ?? "happy"

  // Props reales del mascot en el panel de preview: si hay un ítem no
  // comprado en "probado", su categoría se reemplaza por ese ítem; las
  // demás categorías se quedan con lo que el estudiante ya tiene equipado.
  const previewColor  = previewSelection?.category === "color"  ? (previewSelection.itemId as ByteColor)   : byteColor
  const previewOutfit = previewSelection?.category === "outfit" ? (previewSelection.itemId as ByteOutfit)  : byteOutfit
  const previewExpr   = previewSelection?.category === "style"  ? (STYLE_TO_EXPRESSION[previewSelection.itemId] ?? expression) : expression

  const previewItem = previewSelection ? CATALOG[previewSelection.category].find(i => i.id === previewSelection.itemId) : null

  const handlePick = (category: PurchaseCategory, item: StoreItem, owned: boolean) => {
    setError(null)
    if (owned) {
      // Ya es tuyo — equipar de inmediato, sin costo ni paso de preview.
      void confirmPurchase(category, item.id)
      return
    }
    // Todavía no es tuyo — solo mostrarlo puesto en el preview, sin gastar monedas aún.
    setPreviewSelection({ category, itemId: item.id })
  }

  const confirmPurchase = async (category: PurchaseCategory, itemId: string) => {
    setError(null)
    setPendingId(itemId)
    const result = await purchaseByteItem(category, itemId)
    setPendingId(null)
    if (!result.success) setError(result.error ?? "No se pudo completar la compra")
    else setPreviewSelection(null)
  }

  const saveName = () => {
    const trimmed = nameInput.trim().slice(0, 18)
    if (trimmed && trimmed !== progress.byteName) updateByteName(trimmed)
  }

  const renderGrid = (
    items: StoreItem[],
    category: PurchaseCategory,
    ownedList: string[],
    equipped: string,
    renderIcon: (item: StoreItem) => React.ReactNode,
  ) => (
    <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
      {items.map(item => {
        const owned = ownedList.includes(item.id)
        const isEquipped = item.id === equipped
        const busy = pendingId === item.id
        const isPreviewing = previewSelection?.category === category && previewSelection.itemId === item.id
        return (
          <button
            key={item.id}
            onClick={() => handlePick(category, item, owned)}
            disabled={busy}
            className={`relative rounded-2xl border-2 bg-card p-4 text-center transition-colors disabled:opacity-60 ${
              isEquipped ? "border-primary" : isPreviewing ? "border-accent border-dashed" : owned ? "border-accent/40" : "border-border hover:border-primary/40"
            }`}
          >
            {isEquipped && (
              <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            <div className="mx-auto mb-2.5 flex items-center justify-center">{renderIcon(item)}</div>
            <p className="text-xs font-bold">{item.label}</p>
            <p className="text-[11px] font-mono text-muted-foreground mt-1">
              {isEquipped ? "Equipado" : owned ? "Poseído" : (
                <span className="inline-flex items-center gap-0.5"><Coins className="h-3 w-3" /> {item.price}</span>
              )}
            </p>
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
              <img src="/logo-icon.png" alt="GEMA" className="w-8 h-8 object-contain" />
              <span className="font-bold text-sm tracking-tight hidden sm:inline">GEMA</span>
            </Link>
            <nav className="flex items-center gap-1 overflow-x-auto">
              {NAV_ITEMS.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-tour-id={item.tourId}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                    item.active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-sm font-bold text-orange-600 font-mono">{progress.streak}</span>
            </div>
            <Link href="/dashboard/student/profile">
              <Avatar className="w-9 h-9 border border-primary/20 hover:border-primary transition-colors cursor-pointer">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">
                  {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground" onClick={() => { logout(); router.push("/") }}>
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-bold text-xl">Tienda de {progress.byteName}</h2>
            <p className="text-xs text-muted-foreground mt-1">Personaliza el color, la ropa y el estilo de tu compañero</p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10">
            <Coins className="h-4 w-4 text-amber-600" />
            <span className="text-base font-bold font-mono text-amber-600">{progress.coins}</span>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-start gap-7 flex-wrap">
          {/* Preview */}
          <div className="flex-shrink-0 w-full sm:w-[260px] flex flex-col items-center gap-3.5 bg-card border border-border rounded-2xl p-7 md:sticky md:top-24">
            <div className={`w-full aspect-square rounded-2xl flex items-center justify-center transition-colors ${previewItem ? "bg-accent/10 ring-2 ring-accent" : "bg-secondary/60"}`}>
              <ByteMascot expression={previewExpr} color={previewColor} outfit={previewOutfit} size={170} animate />
            </div>
            <p className="text-base font-bold">{progress.byteName}</p>
            <p className="text-[11px] text-muted-foreground">
              {previewItem ? "Así se vería" : "Tu compañero de aprendizaje"}
            </p>

            {previewItem && (() => {
              const canAfford = progress.coins >= previewItem.price
              const busy = pendingId === previewItem.id
              return (
                <div className="w-full space-y-2 pt-1 border-t border-border">
                  <p className="text-xs text-center text-muted-foreground pt-2">
                    {previewItem.label} — <span className="inline-flex items-center gap-0.5 font-mono"><Coins className="h-3 w-3" /> {previewItem.price}</span>
                  </p>
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    disabled={!canAfford || busy}
                    onClick={() => confirmPurchase(previewSelection!.category, previewSelection!.itemId)}
                  >
                    {busy ? "Comprando..." : canAfford ? "Comprar y equipar" : "Monedas insuficientes"}
                  </Button>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setPreviewSelection(null)}>
                    Cancelar
                  </Button>
                </div>
              )
            })()}
          </div>

          {/* Categories */}
          <div data-tour-id="store-items-grid" className="flex-1 min-w-[280px]">
            <div data-tour-id="store-tabs" className="scroll-mt-24 flex gap-1 p-1 bg-secondary/70 rounded-xl w-fit max-w-full overflow-x-auto mb-5">
              {([
                { id: "color" as Tab,  icon: Palette, label: "Color" },
                { id: "ropa" as Tab,   icon: Shirt,   label: "Ropa" },
                { id: "estilo" as Tab, icon: Smile,   label: "Estilo" },
                { id: "nombre" as Tab, icon: Pencil,  label: "Nombre" },
              ]).map(t => {
                const isActive = tab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
                      isActive ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <t.icon className={`w-4 h-4 ${isActive ? "text-primary" : ""}`} />
                    {t.label}
                  </button>
                )
              })}
            </div>

            {tab === "color" && renderGrid(COLOR_ITEMS, "color", progress.ownedColors ?? [], progress.byteColor, item => (
              <div className="w-10 h-10 rounded-full" style={{ background: COLOR_SWATCH[item.id], boxShadow: "0 3px 0 oklch(0.2 0.02 265 / 0.15)" }} />
            ))}
            {tab === "ropa" && renderGrid(OUTFIT_ITEMS, "outfit", progress.ownedOutfits ?? [], progress.byteOutfit, item => {
              const Icon = OUTFIT_ICON[item.id]
              return <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center"><Icon className="w-5 h-5 text-foreground" /></div>
            })}
            {tab === "estilo" && renderGrid(STYLE_ITEMS, "style", progress.ownedStyles ?? [], progress.byteStyle, item => {
              const Icon = STYLE_ICON[item.id]
              return <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center"><Icon className="w-5 h-5 text-primary" /></div>
            })}
            {tab === "nombre" && (
              <div className="max-w-[360px] bg-card border border-border rounded-2xl p-5">
                <p className="text-xs font-semibold mb-2">Ponle un nombre a tu compañero</p>
                <input
                  type="text"
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={e => { if (e.key === "Enter") { saveName(); (e.target as HTMLInputElement).blur() } }}
                  maxLength={18}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border text-sm font-semibold outline-none focus:border-primary"
                />
                <p className="text-[11px] text-muted-foreground mt-2">Se guarda al salir del campo, sin costo.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
