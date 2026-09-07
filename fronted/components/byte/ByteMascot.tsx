import React from "react"

export type ByteExpression =
  | "happy"        // default smile
  | "excited"      // big smile, raised brows
  | "thinking"     // one brow up, looking sideways
  | "celebrating"  // huge smile, both brows way up
  | "sad"          // frown, drooped brows
  | "studying"     // focused, slight smile
  | "waving"       // happy + wave (same as happy, arm already waves)
  | "surprised"    // O mouth, wide eyes
  | "sleeping"     // closed eyes

type ExpressionConfig = {
  leftBrow:     string
  rightBrow:    string
  mouth:        string
  teethPath?:   string
  irisX:        number  // offset from center (290 left, 390 right)
  irisY:        number  // offset from center (236)
  cheekOpacity: number
  eyesClosed?:  boolean
  irisScale?:   number  // scale iris (default 1)
}

const EXPR: Record<ByteExpression, ExpressionConfig> = {
  happy: {
    leftBrow:     "M252 196 Q270 186 292 192",
    rightBrow:    "M388 192 Q410 186 428 196",
    mouth:        "M302 292 Q340 322 378 292",
    teethPath:    "M310 298 Q340 322 370 298",
    irisX: 0, irisY: 0,
    cheekOpacity: 0.45,
  },
  excited: {
    leftBrow:     "M252 188 Q270 176 292 184",
    rightBrow:    "M388 184 Q410 176 428 188",
    mouth:        "M294 286 Q340 330 386 286",
    teethPath:    "M302 294 Q340 330 378 294",
    irisX: 0, irisY: 0,
    cheekOpacity: 0.65,
    irisScale: 1.08,
  },
  thinking: {
    leftBrow:     "M252 196 Q270 186 292 192",
    rightBrow:    "M388 186 Q410 178 428 192",
    mouth:        "M308 298 Q340 306 372 298",
    irisX: 7, irisY: -5,
    cheekOpacity: 0.2,
  },
  celebrating: {
    leftBrow:     "M248 184 Q270 170 292 178",
    rightBrow:    "M388 178 Q410 170 432 184",
    mouth:        "M290 284 Q340 336 390 284",
    teethPath:    "M298 292 Q340 336 382 292",
    irisX: 0, irisY: 0,
    cheekOpacity: 0.7,
    irisScale: 1.12,
  },
  sad: {
    leftBrow:     "M252 196 Q270 206 292 200",
    rightBrow:    "M388 200 Q410 206 428 196",
    mouth:        "M306 312 Q340 284 374 312",
    irisX: 0, irisY: 6,
    cheekOpacity: 0.15,
    irisScale: 0.88,
  },
  studying: {
    leftBrow:     "M252 194 Q270 186 292 190",
    rightBrow:    "M388 190 Q410 186 428 194",
    mouth:        "M310 298 Q340 308 370 298",
    irisX: 0, irisY: -3,
    cheekOpacity: 0.3,
  },
  waving: {
    leftBrow:     "M252 188 Q270 178 292 184",
    rightBrow:    "M388 184 Q410 178 428 188",
    mouth:        "M302 292 Q340 322 378 292",
    teethPath:    "M310 298 Q340 322 370 298",
    irisX: 0, irisY: 0,
    cheekOpacity: 0.55,
  },
  surprised: {
    leftBrow:     "M248 186 Q270 172 292 180",
    rightBrow:    "M388 180 Q410 172 432 186",
    mouth:        "M318 294 Q340 318 362 294 Q362 318 340 322 Q318 318 318 294",
    irisX: 0, irisY: 0,
    cheekOpacity: 0.35,
    irisScale: 1.15,
  },
  sleeping: {
    leftBrow:     "M256 198 Q270 196 288 198",
    rightBrow:    "M392 198 Q410 196 424 198",
    mouth:        "M316 300 Q340 308 364 300",
    irisX: 0, irisY: 0,
    cheekOpacity: 0.25,
    eyesClosed: true,
  },
}

export type ByteColor  = "azul" | "violeta" | "esmeralda" | "coral" | "dorado" | "rosa" | "cian"
export type ByteOutfit = "ninguno" | "corbata" | "gorro" | "lentes" | "audifonos" | "corona"

const HUE_ROTATE: Record<ByteColor, number> = {
  azul: 0, violeta: 62, esmeralda: -60, coral: 155, dorado: 198, rosa: 123, cian: 338,
}

interface Props {
  expression?: ByteExpression
  size?: number    // width in px, height is auto (aspect ratio 680:540)
  className?: string
  animate?: boolean  // gentle float animation
  color?: ByteColor      // Tienda "Color" customization (hue-rotate filter)
  outfit?: ByteOutfit    // Tienda "Ropa" customization (accessory overlay)
}

export function ByteMascot({
  expression = "happy",
  size = 200,
  className = "",
  animate = false,
  color = "azul",
  outfit = "ninguno",
}: Props) {
  const e   = EXPR[expression]
  const h   = Math.round(size * (540 / 680))
  const sc  = e.irisScale ?? 1
  const hue = HUE_ROTATE[color]

  // Iris positions (centers: left=290,236 right=390,236)
  const liX = 290 + e.irisX
  const liY = 236 + e.irisY
  const riX = 390 + e.irisX
  const riY = 236 + e.irisY

  return (
    <div
      style={{ width: size, height: h, flexShrink: 0, filter: hue !== 0 ? `hue-rotate(${hue}deg)` : undefined }}
      className={`${className} ${animate ? "animate-bounce" : ""}`}
    >
      <svg width={size} height={h} viewBox="0 0 680 540" xmlns="http://www.w3.org/2000/svg">
        {/* Shadow */}
        <ellipse cx="340" cy="490" rx="100" ry="12" fill="#000" opacity="0.1" />

        {/* Antenna */}
        <rect x="336" y="108" width="8" height="40" rx="4" fill="#4F9EFF" />
        <circle cx="340" cy="94" r="16" fill="#A371F7" />
        <circle cx="340" cy="94" r="10" fill="#C5A0FF" />
        <circle cx="340" cy="94" r="5" fill="#fff" />
        {[0,90,180,270,45,135,225,315].map((deg, i) => {
          const r1 = i < 4 ? 20 : 17
          const r2 = i < 4 ? 24 : 21
          const rad = (deg * Math.PI) / 180
          return (
            <line key={deg}
              x1={340 + Math.cos(rad)*r1} y1={94 + Math.sin(rad)*r1}
              x2={340 + Math.cos(rad)*r2} y2={94 + Math.sin(rad)*r2}
              stroke="#A371F7" strokeWidth={i < 4 ? 2.5 : 2} strokeLinecap="round"
            />
          )
        })}

        {/* Head shadow */}
        <rect x="194" y="150" width="292" height="200" rx="48" fill="#000" opacity="0.08" />
        {/* Head */}
        <rect x="190" y="144" width="300" height="196" rx="60" fill="#1E88E5" />
        <rect x="204" y="158" width="272" height="168" rx="50" fill="#42A5F5" />
        <ellipse cx="340" cy="175" rx="90" ry="22" fill="#fff" opacity="0.12" />

        {/* Ears */}
        <rect x="166" y="186" width="30" height="60" rx="15" fill="#1565C0" />
        <rect x="172" y="194" width="18" height="44" rx="9" fill="#1E88E5" />
        <circle cx="181" cy="210" r="6" fill="#4F9EFF" opacity="0.4" />
        <circle cx="181" cy="224" r="4" fill="#A371F7" />
        <rect x="484" y="186" width="30" height="60" rx="15" fill="#1565C0" />
        <rect x="490" y="194" width="18" height="44" rx="9" fill="#1E88E5" />
        <circle cx="499" cy="210" r="6" fill="#4F9EFF" opacity="0.4" />
        <circle cx="499" cy="224" r="4" fill="#A371F7" />

        {/* Outfit: headphones (band over the head, cups on the ears) */}
        {outfit === "audifonos" && (
          <>
            <path d="M181 196 Q340 116 499 196" stroke="#1A1A2E" strokeWidth="10" fill="none" strokeLinecap="round" />
            <circle cx="181" cy="216" r="24" fill="#1A1A2E" />
            <circle cx="181" cy="216" r="14" fill="#4F9EFF" />
            <circle cx="499" cy="216" r="24" fill="#1A1A2E" />
            <circle cx="499" cy="216" r="14" fill="#4F9EFF" />
          </>
        )}

        {/* Eye sockets */}
        <ellipse cx="290" cy="234" rx="46" ry="44" fill="#fff" />
        <ellipse cx="290" cy="234" rx="42" ry="40" fill="#E3F2FD" />
        <ellipse cx="390" cy="234" rx="46" ry="44" fill="#fff" />
        <ellipse cx="390" cy="234" rx="42" ry="40" fill="#E3F2FD" />

        {/* Eyes: open or closed */}
        {e.eyesClosed ? (
          <>
            {/* Closed eyes - arcs */}
            <path d={`M${262} ${234} Q290 ${214} ${318} ${234}`} stroke="#1E88E5" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d={`M${362} ${234} Q390 ${214} ${418} ${234}`} stroke="#1E88E5" strokeWidth="5" fill="none" strokeLinecap="round" />
            {/* ZZZ */}
            <text x="350" y="200" fill="#A371F7" fontSize="22" fontWeight="bold" opacity="0.7">z</text>
            <text x="362" y="186" fill="#A371F7" fontSize="16" fontWeight="bold" opacity="0.5">z</text>
            <text x="372" y="175" fill="#A371F7" fontSize="12" fontWeight="bold" opacity="0.35">z</text>
          </>
        ) : (
          <>
            {/* Left iris */}
            <ellipse cx={liX} cy={liY} rx={28*sc} ry={28*sc} fill="#4F9EFF" />
            <ellipse cx={liX} cy={liY} rx={18*sc} ry={18*sc} fill="#1565C0" />
            <ellipse cx={liX} cy={liY} rx={10*sc} ry={10*sc} fill="#0D47A1" />
            <circle cx={liX+12} cy={liY-14} r={7} fill="#fff" opacity="0.9" />
            <circle cx={liX+17} cy={liY-17} r={3.5} fill="#fff" />
            <circle cx={liX-12} cy={liY+8} r={3} fill="#fff" opacity="0.5" />
            {/* Right iris */}
            <ellipse cx={riX} cy={riY} rx={28*sc} ry={28*sc} fill="#4F9EFF" />
            <ellipse cx={riX} cy={riY} rx={18*sc} ry={18*sc} fill="#1565C0" />
            <ellipse cx={riX} cy={riY} rx={10*sc} ry={10*sc} fill="#0D47A1" />
            <circle cx={riX+12} cy={riY-14} r={7} fill="#fff" opacity="0.9" />
            <circle cx={riX+17} cy={riY-17} r={3.5} fill="#fff" />
            <circle cx={riX-12} cy={riY+8} r={3} fill="#fff" opacity="0.5" />
          </>
        )}

        {/* Outfit: sunglasses (over eye sockets) */}
        {outfit === "lentes" && (
          <>
            <rect x="256" y="216" width="72" height="36" rx="16" fill="#1A1A2E" />
            <rect x="352" y="216" width="72" height="36" rx="16" fill="#1A1A2E" />
            <rect x="328" y="228" width="24" height="8" rx="4" fill="#1A1A2E" />
          </>
        )}

        {/* Eyebrows */}
        <path d={e.leftBrow}  stroke="#1565C0" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d={e.rightBrow} stroke="#1565C0" strokeWidth="5" fill="none" strokeLinecap="round" />

        {/* Cheeks */}
        <ellipse cx="238" cy="268" rx="26" ry="16" fill="#FF8A80" opacity={e.cheekOpacity} />
        <ellipse cx="442" cy="268" rx="26" ry="16" fill="#FF8A80" opacity={e.cheekOpacity} />

        {/* Nose */}
        <ellipse cx="340" cy="268" rx="8" ry="5" fill="#1565C0" opacity="0.4" />

        {/* Mouth */}
        <path d={e.mouth} stroke="#1565C0" strokeWidth="5" fill="none" strokeLinecap="round" />
        {e.teethPath && (
          <>
            <path d={e.teethPath} fill="#fff" stroke="none" />
            <line x1="340" y1="298" x2="340" y2="314" stroke="#E3F2FD" strokeWidth="2" />
            <line x1="323" y1="302" x2="323" y2="316" stroke="#E3F2FD" strokeWidth="2" />
            <line x1="357" y1="302" x2="357" y2="316" stroke="#E3F2FD" strokeWidth="2" />
          </>
        )}

        {/* Neck */}
        <rect x="308" y="338" width="64" height="26" rx="12" fill="#1565C0" />
        <rect x="316" y="342" width="48" height="18" rx="9" fill="#1E88E5" />

        {/* Outfit: bow tie (at the neck) */}
        {outfit === "corbata" && (
          <>
            <path d="M280 349 L328 322 L328 378 Z" fill="oklch(0.6 0.19 300)" stroke="#1565C0" strokeWidth="2" />
            <path d="M400 349 L352 322 L352 378 Z" fill="oklch(0.6 0.19 300)" stroke="#1565C0" strokeWidth="2" />
            <rect x="325" y="335" width="30" height="28" rx="6" fill="oklch(0.46 0.19 265)" stroke="#1565C0" strokeWidth="2" />
          </>
        )}

        {/* Body shadow */}
        <rect x="212" y="368" width="256" height="106" rx="32" fill="#000" opacity="0.07" />
        {/* Body */}
        <rect x="208" y="362" width="264" height="102" rx="32" fill="#1E88E5" />
        <rect x="216" y="370" width="248" height="86" rx="26" fill="#42A5F5" />
        <ellipse cx="340" cy="384" rx="80" ry="14" fill="#fff" opacity="0.1" />

        {/* Chest panel */}
        <rect x="264" y="378" width="152" height="58" rx="16" fill="#1565C0" />
        <rect x="270" y="384" width="140" height="46" rx="12" fill="#0D47A1" />

        {/* Heart */}
        <path d="M340 418 C340 418 318 404 318 392 C318 384 325 378 333 382 C336 383 338 386 340 389 C342 386 344 383 347 382 C355 378 362 384 362 392 C362 404 340 418 340 418Z" fill="#FF5252" />
        <ellipse cx="333" cy="390" rx="5" ry="3" fill="#fff" opacity="0.4" transform="rotate(-30 333 390)" />

        {/* LEDs */}
        <circle cx="282" cy="393" r="6" fill="#38BD71" opacity="0.4" />
        <circle cx="298" cy="393" r="5" fill="#FFD43B" />
        <circle cx="282" cy="408" r="5" fill="#4F9EFF" />
        <circle cx="298" cy="408" r="6" fill="#F78166" opacity="0.4" />

        {/* Corner bolts */}
        {[228,452].flatMap(x => [380,450].map(y => (
          <circle key={`${x}${y}`} cx={x} cy={y} r="6" fill="#1565C0" />
        )))}

        {/* Left arm (raised - waving) */}
        <path d="M212 382 Q168 354 154 318" stroke="#1E88E5" strokeWidth="36" fill="none" strokeLinecap="round" />
        <path d="M212 382 Q168 354 154 318" stroke="#42A5F5" strokeWidth="28" fill="none" strokeLinecap="round" />
        <circle cx="150" cy="310" r="26" fill="#1E88E5" />
        <circle cx="150" cy="310" r="20" fill="#42A5F5" />
        <rect x="126" y="278" width="14" height="28" rx="7" fill="#1E88E5" />
        <rect x="143" y="272" width="14" height="30" rx="7" fill="#1E88E5" />
        <rect x="160" y="274" width="14" height="28" rx="7" fill="#1E88E5" />
        <rect x="176" y="280" width="14" height="24" rx="7" fill="#1E88E5" />

        {/* Right arm */}
        <path d="M468 390 Q510 400 524 434" stroke="#1E88E5" strokeWidth="36" fill="none" strokeLinecap="round" />
        <path d="M468 390 Q510 400 524 434" stroke="#42A5F5" strokeWidth="28" fill="none" strokeLinecap="round" />
        <circle cx="528" cy="442" r="26" fill="#1E88E5" />
        <circle cx="528" cy="442" r="20" fill="#42A5F5" />
        <rect x="516" y="454" width="14" height="22" rx="7" fill="#1E88E5" />
        <rect x="533" y="456" width="14" height="22" rx="7" fill="#1E88E5" />
        <rect x="504" y="452" width="14" height="20" rx="7" fill="#1E88E5" />

        {/* Legs */}
        <rect x="264" y="460" width="56" height="28" rx="14" fill="#1565C0" />
        <ellipse cx="284" cy="495" rx="36" ry="16" fill="#1565C0" />
        <ellipse cx="280" cy="492" rx="30" ry="12" fill="#1E88E5" />
        <rect x="360" y="460" width="56" height="28" rx="14" fill="#1565C0" />
        <ellipse cx="396" cy="495" rx="36" ry="16" fill="#1565C0" />
        <ellipse cx="400" cy="492" rx="30" ry="12" fill="#1E88E5" />
        <ellipse cx="270" cy="494" rx="10" ry="5" fill="#fff" opacity="0.25" />
        <ellipse cx="410" cy="494" rx="10" ry="5" fill="#fff" opacity="0.25" />

        {/* Outfit: party hat (above the antenna, on top of everything) */}
        {outfit === "gorro" && (
          <>
            <path d="M300 148 L380 148 L340 66 Z" fill="oklch(0.6 0.19 300)" />
            <path d="M300 148 L380 148 L340 66 Z" fill="none" stroke="#1565C0" strokeWidth="3" />
            <circle cx="340" cy="66" r="9" fill="oklch(0.74 0.15 70)" />
          </>
        )}

        {/* Outfit: crown (above the head, on top of everything) */}
        {outfit === "corona" && (
          <>
            <path d="M296 148 L296 100 L322 124 L340 84 L358 124 L384 100 L384 148 Z" fill="oklch(0.82 0.16 85)" stroke="#1565C0" strokeWidth="3" strokeLinejoin="round" />
            <circle cx="340" cy="84" r="6" fill="oklch(0.6 0.19 25)" />
            <circle cx="296" cy="100" r="5" fill="oklch(0.6 0.19 260)" />
            <circle cx="384" cy="100" r="5" fill="oklch(0.6 0.19 260)" />
          </>
        )}
      </svg>
    </div>
  )
}
