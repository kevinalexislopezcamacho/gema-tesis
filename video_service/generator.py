#!/usr/bin/env python3
"""
Generador de Videos Educativos con IA
GEMA — Universidad de San Buenaventura Cali 2026

Flujo:
  1. OpenAI genera el guión estructurado en JSON
  2. Pillow dibuja cada slide como imagen PNG
  3. Edge TTS convierte la narración a audio MP3 (gratis)
  4. MoviePy ensambla imágenes + audios en un MP4 final
"""

import os, sys, json, asyncio, textwrap, shutil, argparse, math, uuid, re
from pathlib import Path

# En Windows, platform.system() puede colgar al leer info del sistema vía WinAPI.
# edge_tts usa aiohttp que llama platform.system() en el import level → bloquea todo.
# Solución: pre-inyectar el cache de uname ANTES de importar edge_tts.
# Deshabilitar C extensions de aiohttp que cuelgan en Windows
os.environ.setdefault('AIOHTTP_NO_EXTENSIONS', '1')

if sys.platform == 'win32':
    import platform as _platform
    if _platform._uname_cache is None:
        _platform._uname_cache = _platform.uname_result('Windows', '', '', '', 'AMD64')
    del _platform
    # También forzar SelectorEventLoop (el ProactorEventLoop puede colgar con aiohttp)
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Forzar UTF-8 en stdout/stderr para que los emojis en los print no fallen
# (Windows usa cp1252 por defecto y no soporta emojis en la consola)
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, OSError):
        pass
from PIL import Image, ImageDraw, ImageFont
import edge_tts
from moviepy.editor import ImageClip, AudioFileClip, concatenate_videoclips
from openai import OpenAI

# ── Resolución y paleta ────────────────────────────────────────────────────────
W, H   = 1280, 720
FPS    = 24
VOICE  = "es-MX-DaliaNeural"   # voz femenina en español

BG       = (13,  17,  23)
BG_CARD  = (22,  27,  34)
BG_CODE  = (31,  41,  55)
C_BLUE   = (79, 158, 255)
C_GREEN  = (56, 189, 113)
C_ORANGE = (247, 129, 102)
C_PURPLE = (163, 113, 247)
C_YELLOW = (255, 212,  59)
C_TEXT   = (230, 237, 243)
C_MUTED  = (139, 148, 158)
C_LINE   = ( 48,  54,  61)


def load_fonts() -> dict:
    candidates = {
        "regular": [
            "C:/Windows/Fonts/segoeui.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ],
        "bold": [
            "C:/Windows/Fonts/segoeuib.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ],
        "mono": [
            "C:/Windows/Fonts/consola.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
            "/System/Library/Fonts/Menlo.ttc",
        ],
        "emoji": [
            "C:/Windows/Fonts/seguiemj.ttf",
            # Symbola is a plain monochrome outline font (not a color bitmap
            # font like Noto Color Emoji), so it renders through PIL's normal
            # draw.text() without needing embedded_color handling.
            "/usr/share/fonts/truetype/ancient-scripts/Symbola_hint.ttf",
            "/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf",
            "/usr/share/fonts/truetype/noto/NotoEmoji-Regular.ttf",
            "/System/Library/Fonts/Apple Color Emoji.ttc",
        ],
    }
    fonts = {}
    for style, paths in candidates.items():
        loaded = None
        for p in paths:
            if Path(p).exists():
                loaded = p
                break
        fonts[style] = loaded
    return fonts

FONT_PATHS = load_fonts()


def get_font(style: str = "regular", size: int = 28) -> ImageFont.FreeTypeFont:
    path = FONT_PATHS.get(style)
    if path:
        return ImageFont.truetype(path, size)
    return ImageFont.load_default()


# ── Utilidades de dibujo ───────────────────────────────────────────────────────

def draw_rounded_rect(draw, xy, radius, fill, outline=None, width=1):
    x1, y1, x2, y2 = xy
    draw.rounded_rectangle([x1, y1, x2, y2], radius=radius, fill=fill,
                           outline=outline, width=width)


def draw_text_wrapped(draw, text, x, y, max_width, font, fill, line_spacing=8, align="left"):
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    lh = draw.textbbox((0, 0), "Ag", font=font)[3] + line_spacing
    for i, line in enumerate(lines):
        lx = x
        if align == "center":
            w = draw.textbbox((0, 0), line, font=font)[2]
            lx = x - w // 2
        draw.text((lx, y + i * lh), line, font=font, fill=fill)
    return y + len(lines) * lh


def draw_gradient_bar(img, color_left, color_right, y, height=4):
    bar = Image.new("RGB", (W, height))
    draw = ImageDraw.Draw(bar)
    for px in range(W):
        t = px / W
        r = int(color_left[0] * (1 - t) + color_right[0] * t)
        g = int(color_left[1] * (1 - t) + color_right[1] * t)
        b = int(color_left[2] * (1 - t) + color_right[2] * t)
        draw.line([(px, 0), (px, height - 1)], fill=(r, g, b))
    img.paste(bar, (0, y))


def draw_progress(img, current, total):
    draw = ImageDraw.Draw(img)
    bar_h = 4
    y = H - bar_h
    draw.rectangle([0, y, W, H], fill=BG_CARD)
    filled = int(W * current / total)
    if filled > 0:
        for px in range(filled):
            t = px / max(W, 1)
            r = int(C_BLUE[0] * (1 - t) + C_PURPLE[0] * t)
            g = int(C_BLUE[1] * (1 - t) + C_PURPLE[1] * t)
            b = int(C_BLUE[2] * (1 - t) + C_PURPLE[2] * t)
            draw.line([(px, y), (px, H - 1)], fill=(r, g, b))


def draw_logo(draw):
    f = get_font("bold", 18)
    draw.text((36, 28), "GE", font=f, fill=C_BLUE)
    draw.text((36 + draw.textbbox((0,0), "GE", font=f)[2], 28), "MA", font=f, fill=C_PURPLE)


# ── Mascota: Byte ──────────────────────────────────────────────────────────────
# Para cambiar de mascota en el futuro, sólo reemplaza la llamada dentro de
# draw_mascot() con la función de la nueva mascota.
# Expressions: "happy", "excited", "thinking", "celebrating", "sad", "studying"

def draw_mascot(draw, img, cx, cy, size=90, expression="happy"):
    """Punto único de cambio de mascota. Actualmente usa Byte."""
    draw_byte(draw, img, cx, cy, size, expression)


def draw_byte(draw, img, cx, cy, size=90, expression="happy"):
    """
    Dibuja a Byte con Pillow.
    cx, cy = centro horizontal, borde inferior del cuerpo.
    size   = altura de referencia en px (escala todo proporcionalmente).
    """
    s = size / 90  # factor de escala

    def sc(v):
        return max(1, int(round(v * s)))

    # Paleta (idéntica al SVG)
    BLUE_M  = (30,  136, 229)
    BLUE_D  = (21,  101, 192)
    BLUE_L  = (66,  165, 245)
    PURPLE  = (163, 113, 247)
    PURP_L  = (197, 160, 255)
    IRIS_C  = (79,  158, 255)
    WHITE   = (255, 255, 255)
    SOCK_C  = (227, 242, 253)   # eye socket tint
    HEART_C = (255,  82,  82)

    # ── Layout vertical (de abajo hacia arriba) ───────────────────────────
    bh = sc(30)          # altura del cuerpo
    hh = sc(58)          # altura de la cabeza
    hw = sc(82)          # ancho de la cabeza

    by1 = cy - bh        # tope del cuerpo
    hy2 = by1 - sc(2)    # base de la cabeza
    hy1 = hy2 - hh       # tope de la cabeza

    ant_cy = hy1 - sc(14)   # centro del círculo de la antena

    # ── Antena ────────────────────────────────────────────────────────────
    draw.rounded_rectangle([cx - sc(2), ant_cy, cx + sc(2), hy1],
                           radius=sc(2), fill=IRIS_C)
    ar = sc(9)
    draw.ellipse([cx-ar, ant_cy-ar, cx+ar, ant_cy+ar], fill=PURPLE)
    draw.ellipse([cx-sc(6), ant_cy-sc(6), cx+sc(6), ant_cy+sc(6)], fill=PURP_L)
    draw.ellipse([cx-sc(3), ant_cy-sc(3), cx+sc(3), ant_cy+sc(3)], fill=WHITE)
    for deg in [0, 90, 180, 270]:
        rad = math.radians(deg)
        r1, r2 = ar + sc(2), ar + sc(4)
        draw.line([
            (int(cx + r1 * math.cos(rad)), int(ant_cy + r1 * math.sin(rad))),
            (int(cx + r2 * math.cos(rad)), int(ant_cy + r2 * math.sin(rad))),
        ], fill=PURPLE, width=sc(2))

    # ── Cabeza ────────────────────────────────────────────────────────────
    draw.rounded_rectangle([cx - hw//2, hy1, cx + hw//2, hy2],
                           radius=sc(20), fill=BLUE_M)
    inset = sc(5)
    draw.rounded_rectangle([cx - hw//2 + inset, hy1 + inset,
                            cx + hw//2 - inset, hy2 - inset],
                           radius=sc(15), fill=BLUE_L)

    # Orejas
    ew = sc(8)
    draw.rounded_rectangle([cx - hw//2 - ew, hy1 + sc(14),
                            cx - hw//2,      hy1 + sc(36)], radius=sc(5), fill=BLUE_D)
    draw.rounded_rectangle([cx + hw//2,      hy1 + sc(14),
                            cx + hw//2 + ew, hy1 + sc(36)], radius=sc(5), fill=BLUE_D)

    # ── Ojos ──────────────────────────────────────────────────────────────
    ex_off = sc(22)
    ey_center = hy1 + sc(30)

    # Desplazamiento del iris según expresión
    idx = sc(4) if expression == "thinking" else 0
    idy = (sc(3)  if expression == "sad"
           else -sc(2) if expression in ("excited", "celebrating")
           else 0)

    for ex in (cx - ex_off, cx + ex_off):
        er = sc(14)
        draw.ellipse([ex-er, ey_center-er, ex+er, ey_center+er], fill=WHITE)
        draw.ellipse([ex-sc(11), ey_center-sc(11), ex+sc(11), ey_center+sc(11)], fill=SOCK_C)

        ix, iy = ex + idx, ey_center + idy
        draw.ellipse([ix-sc(8),  iy-sc(8),  ix+sc(8),  iy+sc(8)],  fill=IRIS_C)
        draw.ellipse([ix-sc(5),  iy-sc(5),  ix+sc(5),  iy+sc(5)],  fill=BLUE_D)
        draw.ellipse([ix-sc(3),  iy-sc(3),  ix+sc(3),  iy+sc(3)],  fill=(13, 71, 161))
        gx, gy = ix + sc(3), iy - sc(5)
        draw.ellipse([gx-sc(2), gy-sc(2), gx+sc(2), gy+sc(2)], fill=WHITE)

    # ── Cejas ─────────────────────────────────────────────────────────────
    brow_y = hy1 + sc(16)
    bw     = sc(16)
    bt     = max(2, sc(3))

    brow_dy = (-sc(3) if expression in ("excited", "celebrating", "waving")
               else  sc(2) if expression == "sad"
               else  0)

    for ex in (cx - ex_off, cx + ex_off):
        by_local = brow_y + brow_dy
        if expression == "sad":
            draw.arc([ex-bw, by_local, ex+bw, by_local+sc(8)],
                     start=200, end=340, fill=BLUE_D, width=bt)
        else:
            draw.arc([ex-bw, by_local-sc(3), ex+bw, by_local+sc(3)],
                     start=210, end=330, fill=BLUE_D, width=bt)

    # ── Mejillas (color pre-mezclado con el fondo azul) ───────────────────
    # Mix: 60% BLUE_L + 40% (255,138,128) → aspecto rosado suave sobre azul
    ck_col = (
        int(BLUE_L[0] * 0.55 + 255 * 0.45),
        int(BLUE_L[1] * 0.55 + 138 * 0.45),
        int(BLUE_L[2] * 0.55 + 128 * 0.45),
    )
    ch_y   = hy1 + sc(44)
    ch_w, ch_h = sc(14), sc(7)
    for side in (-1, 1):
        ccx = cx + side * sc(34)
        draw.ellipse([ccx-ch_w, ch_y-ch_h, ccx+ch_w, ch_y+ch_h], fill=ck_col)

    # ── Boca ──────────────────────────────────────────────────────────────
    my  = hy1 + sc(50)
    mw  = sc(18)
    mth = max(2, sc(3))

    if expression in ("happy", "studying", "waving"):
        draw.arc([cx-mw, my-sc(7), cx+mw, my+sc(3)],
                 start=0, end=180, fill=BLUE_D, width=mth)

    elif expression in ("excited", "celebrating"):
        mw2 = sc(22)
        draw.arc([cx-mw2, my-sc(10), cx+mw2, my+sc(5)],
                 start=0, end=180, fill=BLUE_D, width=mth)
        # Dientes
        draw.chord([cx-sc(15), my-sc(7), cx+sc(15), my+sc(2)],
                   start=0, end=180, fill=WHITE)

    elif expression == "sad":
        draw.arc([cx-mw, my-sc(3), cx+mw, my+sc(7)],
                 start=180, end=360, fill=BLUE_D, width=mth)

    elif expression == "thinking":
        # Línea diagonal (smirk)
        draw.line([cx-sc(10), my, cx+sc(13), my-sc(3)],
                  fill=BLUE_D, width=mth)

    # ── Cuerpo ────────────────────────────────────────────────────────────
    bw_body = sc(68)
    draw.rounded_rectangle([cx-bw_body//2, by1, cx+bw_body//2, cy],
                           radius=sc(11), fill=BLUE_M)
    draw.rounded_rectangle([cx-bw_body//2+sc(4), by1+sc(4),
                            cx+bw_body//2-sc(4), cy-sc(4)],
                           radius=sc(8), fill=BLUE_L)

    # Panel del pecho
    px1 = cx - sc(20); py1 = by1 + sc(6)
    px2 = cx + sc(20); py2 = cy  - sc(6)
    draw.rounded_rectangle([px1, py1, px2, py2], radius=sc(5), fill=BLUE_D)

    # Corazón
    hcx = cx
    hcy = (py1 + py2) // 2
    hr  = sc(5)
    draw.ellipse([hcx-hr-sc(1), hcy-hr, hcx+sc(1), hcy], fill=HEART_C)
    draw.ellipse([hcx-sc(1), hcy-hr, hcx+hr+sc(1), hcy],  fill=HEART_C)
    draw.polygon([(hcx-hr-sc(1), hcy), (hcx+hr+sc(1), hcy),
                  (hcx, hcy+hr+sc(1))], fill=HEART_C)


# Posición fija de la mascota en los slides (esquina inferior derecha)
_MASCOT_CX   = W - 78
_MASCOT_CY   = H - 10    # encima de la barra de progreso (que está en H-4)
_MASCOT_SIZE = 90


# ── Tipos de slide ─────────────────────────────────────────────────────────────

def slide_portada(slide, idx, total):
    img  = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    for r, alpha in [(320, 15), (220, 25), (140, 40)]:
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.ellipse([W//2 - r, H//2 - r, W//2 + r, H//2 + r], fill=(*C_BLUE, alpha))
        img.paste(Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB"))
        draw = ImageDraw.Draw(img)
    draw_gradient_bar(img, C_BLUE, C_PURPLE, 0, 6)
    emoji = slide.get("emoji", "📘")
    fe = get_font("emoji", 72)
    draw.text((W//2, H//2 - 130), emoji, font=fe, fill=C_TEXT, anchor="mm")
    titulo = slide.get("titulo", "")
    ft = get_font("bold", 58)
    # subtitulo's y depends on how many lines titulo actually wrapped to —
    # a fixed offset collides with the second line on long titles.
    titulo_end_y = draw_text_wrapped(draw, titulo, W//2, H//2 - 40, W - 160, ft, C_TEXT, align="center")
    subtitulo = slide.get("subtitulo", "")
    fs = get_font("regular", 26)
    draw_text_wrapped(draw, subtitulo, W//2, titulo_end_y + 20, W - 200, fs, C_MUTED, align="center")
    nivel = slide.get("nivel", "")
    if nivel:
        color_nivel = {"fácil": C_GREEN, "medio": C_YELLOW, "avanzado": C_ORANGE}.get(nivel.lower(), C_BLUE)
        fn = get_font("bold", 18)
        pill_w, pill_h = 120, 36
        px = W//2 - pill_w//2
        py = H - 110
        draw_rounded_rect(draw, [px, py, px + pill_w, py + pill_h], 18, fill=(*color_nivel[:3], 40))
        draw.rounded_rectangle([px, py, px + pill_w, py + pill_h], radius=18, outline=color_nivel, width=1)
        draw.text((W//2, py + pill_h//2), nivel.upper(), font=fn, fill=color_nivel, anchor="mm")
    draw_logo(draw)
    draw_progress(img, idx, total)
    draw_mascot(draw, img, _MASCOT_CX, _MASCOT_CY, _MASCOT_SIZE, "excited")
    return img


def slide_concepto(slide, idx, total):
    img  = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw_gradient_bar(img, C_BLUE, C_PURPLE, 0, 4)
    emoji = slide.get("emoji", "💡")
    titulo = slide.get("titulo", "")
    puntos = slide.get("puntos", [])
    fe = get_font("emoji", 40)
    draw.text((60, 56), emoji, font=fe, fill=C_TEXT)
    ft = get_font("bold", 36)
    draw.text((116, 58), titulo, font=ft, fill=C_TEXT)
    draw.line([(60, 114), (W - 60, 114)], fill=C_LINE, width=1)
    fp = get_font("regular", 24)
    y = 140
    for i, punto in enumerate(puntos):
        bx, by = 72, y + 14
        draw.ellipse([bx, by, bx + 12, by + 12], fill=C_BLUE)
        y = draw_text_wrapped(draw, punto, 100, y, W - 180, fp, C_TEXT, line_spacing=6)
        y += 24
    draw_logo(draw)
    draw_progress(img, idx, total)
    draw_mascot(draw, img, _MASCOT_CX, _MASCOT_CY, _MASCOT_SIZE, "thinking")
    return img


def slide_codigo(slide, idx, total):
    img  = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw_gradient_bar(img, C_GREEN, C_BLUE, 0, 4)
    titulo      = slide.get("titulo", "")
    codigo      = slide.get("codigo", "")
    explicacion = slide.get("explicacion", "")
    lenguaje    = slide.get("lenguaje", "python")
    ft = get_font("bold", 30)
    draw.text((60, 50), titulo, font=ft, fill=C_TEXT)
    draw.line([(60, 96), (W - 60, 96)], fill=C_LINE, width=1)
    code_x, code_y = 60, 112
    code_w = W - 120
    header_h = 36
    pad = 34  # header + top/bottom breathing room inside the box

    # A fixed 340px/9-line box silently DROPPED any line past the 9th for
    # longer snippets (recursive algorithms like merge sort easily run
    # 20-27 lines) — no ellipsis, no scroll, just a hard cutoff mid-function.
    # Grow the box and shrink text together instead, so long code still fits.
    num_lines = max(len(codigo.split("\n")), 1)
    base_code_h, max_code_h = 340, 480
    if num_lines * 30 <= base_code_h - header_h - pad:
        code_h, line_h, font_size = base_code_h, 30, 22
    else:
        code_h = max_code_h
        avail = code_h - header_h - pad
        line_h = max(14, min(30, avail // num_lines))
        font_size = max(11, min(22, round(22 * line_h / 30)))

    draw_rounded_rect(draw, [code_x, code_y, code_x + code_w, code_y + code_h],
                      12, fill=BG_CODE, outline=C_LINE, width=1)
    draw_rounded_rect(draw, [code_x, code_y, code_x + code_w, code_y + header_h], 12, fill=(40, 52, 70))
    draw.rectangle([code_x, code_y + 20, code_x + code_w, code_y + header_h], fill=(40, 52, 70))
    for cx, col in [(code_x + 20, (255, 95, 86)), (code_x + 40, (255, 189, 46)), (code_x + 60, (39, 201, 63))]:
        draw.ellipse([cx - 6, code_y + 12, cx + 6, code_y + 24], fill=col)
    fl = get_font("regular", 15)
    draw.text((code_x + 84, code_y + 10), lenguaje, font=fl, fill=C_MUTED)
    fm = get_font("mono", font_size)
    keywords = {"def", "if", "else", "elif", "for", "while", "in", "return", "import",
                "from", "class", "True", "False", "None", "and", "or", "not", "print", "range", "len"}
    indent_w = max(6, round(13 * line_h / 30))

    # The height-based sizing above only accounts for line COUNT — a single
    # long line (dict/list comprehensions, chained calls) still ran straight
    # off the right edge of the box with nothing to shrink or wrap it. Shrink
    # the font further (in lockstep with line height) until the widest
    # rendered line actually fits inside the box, down to a readable floor.
    max_avail_w = code_w - 40
    for _ in range(14):
        widest = 0
        for line in codigo.split("\n"):
            indent = len(line) - len(line.lstrip())
            w = indent * indent_w
            for word in line.lstrip().split(" "):
                w += draw.textbbox((0, 0), word + " ", font=fm)[2]
            widest = max(widest, w)
        if widest <= max_avail_w or font_size <= 9:
            break
        font_size -= 1
        line_h = max(12, line_h - 1)
        fm = get_font("mono", font_size)

    cy = code_y + header_h + 14
    for line in codigo.split("\n"):
        cx_cur = code_x + 20
        indent = len(line) - len(line.lstrip())
        cx_cur += indent * indent_w
        for word in line.lstrip().split(" "):
            color = C_TEXT
            if word in keywords:        color = C_PURPLE
            elif word.startswith("#"):  color = C_MUTED
            elif word.startswith(("'", '"')) or word.endswith(("'", '"')): color = C_ORANGE
            elif word.isdigit():        color = C_YELLOW
            draw.text((cx_cur, cy), word + " ", font=fm, fill=color)
            if word.startswith("#"):
                break
            cx_cur += draw.textbbox((0,0), word + " ", font=fm)[2]
        cy += line_h
        if cy > code_y + code_h - 20:
            break
    if explicacion:
        fe = get_font("regular", 22)
        femoji = get_font("emoji", 22)
        exp_y = code_y + code_h + 18
        draw.text((60, exp_y), "💬", font=femoji, fill=C_MUTED)
        draw_text_wrapped(draw, explicacion, 94, exp_y, W - 154, fe, C_MUTED, line_spacing=6)
    draw_logo(draw)
    draw_progress(img, idx, total)
    draw_mascot(draw, img, _MASCOT_CX, _MASCOT_CY, _MASCOT_SIZE, "studying")
    return img


def slide_ejemplo(slide, idx, total):
    img  = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw_gradient_bar(img, C_ORANGE, C_YELLOW, 0, 4)
    emoji    = slide.get("emoji", "🌎")
    titulo   = slide.get("titulo", "")
    cuerpo   = slide.get("cuerpo", "")
    analogia = slide.get("analogia", "")
    fe = get_font("emoji", 44)
    draw.text((60, 50), emoji, font=fe, fill=C_TEXT)
    ft = get_font("bold", 34)
    draw.text((120, 58), titulo, font=ft, fill=C_TEXT)
    draw.line([(60, 110), (W - 60, 110)], fill=C_LINE, width=1)
    fc = get_font("regular", 26)
    y = draw_text_wrapped(draw, cuerpo, 60, 132, W - 120, fc, C_TEXT, line_spacing=8)
    if analogia:
        y += 32
        draw_rounded_rect(draw, [60, y, W - 60, y + 130], 12, fill=(30, 40, 55), outline=C_ORANGE, width=1)
        fa = get_font("regular", 22)
        draw.text((88, y + 16), "Analogía del mundo real:", font=fa, fill=C_ORANGE)
        draw_text_wrapped(draw, analogia, 88, y + 46, W - 180, fa, C_TEXT, line_spacing=6)
    draw_logo(draw)
    draw_progress(img, idx, total)
    draw_mascot(draw, img, _MASCOT_CX, _MASCOT_CY, _MASCOT_SIZE, "happy")
    return img


def slide_resumen(slide, idx, total):
    img  = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw_gradient_bar(img, C_GREEN, C_BLUE, 0, 4)
    titulo = slide.get("titulo", "Resumen")
    puntos = slide.get("puntos", [])
    ft = get_font("bold", 38)
    fe_check = get_font("emoji", 38)
    draw.text((60, 50), "✅ ", font=fe_check, fill=C_GREEN)
    check_w = draw.textbbox((0, 0), "✅ ", font=fe_check)[2]
    draw.text((60 + check_w, 50), titulo, font=ft, fill=C_TEXT)
    draw.line([(60, 108), (W - 60, 108)], fill=C_LINE, width=1)
    icons = ["①", "②", "③", "④", "⑤"]
    fp = get_font("regular", 26)
    fi = get_font("emoji", 30)
    y = 130
    for i, punto in enumerate(puntos[:5]):
        draw_rounded_rect(draw, [60, y, W - 60, y + 70], 10, fill=BG_CARD, outline=C_LINE, width=1)
        draw.text((88, y + 20), icons[i] if i < len(icons) else "•", font=fi, fill=C_GREEN)
        draw_text_wrapped(draw, punto, 136, y + 18, W - 230, fp, C_TEXT)
        y += 88
    draw_logo(draw)
    draw_progress(img, idx, total)
    draw_mascot(draw, img, _MASCOT_CX, _MASCOT_CY, _MASCOT_SIZE, "celebrating")
    return img


SLIDE_RENDERERS = {
    "portada":  slide_portada,
    "concepto": slide_concepto,
    "codigo":   slide_codigo,
    "ejemplo":  slide_ejemplo,
    "resumen":  slide_resumen,
}


# ── Generación de guión con OpenAI ─────────────────────────────────────────────

def generar_guion(client: OpenAI, tema: str, subtema: str, nivel: str) -> dict:
    print("🧠 Generando guión con OpenAI...")

    nivel_instrucciones = {
        "fácil": """
- Es la PARTE 1 del tema. Introduce los conceptos desde cero.
- Usa analogías del mundo real simples (ej: una variable es como una caja con etiqueta).
- Máximo 1 ejemplo de código, muy corto (2-4 líneas), sin lógica compleja.
- No uses términos técnicos sin explicarlos primero.
- El estudiante no sabe absolutamente nada del tema todavía.
- Tono: amigable, motivador y paciente, como explicarle a alguien que nunca ha programado.
- El código de ejemplo debe ser el más básico posible del concepto.
""",
        "medio": """
- Es la PARTE 2 del tema. Asume que el estudiante ya completó el nivel fácil.
- NO repitas definiciones básicas, construye directamente sobre ellas.
- Introduce 2 o 3 variaciones o casos de uso distintos del concepto.
- El ejemplo de código debe ser más completo (5-8 líneas) y mostrar combinaciones.
- Muestra qué errores comunes cometen los principiantes y cómo evitarlos.
- Tono: más técnico pero todavía accesible, asume que ya hay una base.
- El código debe incluir al menos una condición o estructura adicional al básico.
""",
        "avanzado": """
- Es la PARTE 3 del tema. Asume que el estudiante dominó los niveles fácil y medio.
- Sin explicaciones básicas. Ve directo a casos complejos y combinaciones.
- Muestra cómo este concepto se combina con otros conceptos de programación.
- El código debe ser de 8-12 líneas con lógica real y no trivial.
- Incluye buenas prácticas, optimizaciones y errores típicos de developers con experiencia.
- Tono: técnico y directo, como hablarle a alguien que ya programa con soltura.
- El código debe resolver un problema real, no solo ilustrar la sintaxis.
"""
    }

    prompt = f"""Crea un guión para un video educativo de micro-learning sobre:
- Tema: {tema}
- Subtema: {subtema}
- Nivel: {nivel.upper()}
- Duración objetivo: 2 a 4 minutos
- Audiencia: estudiantes universitarios de Fundamentos de Programación

INSTRUCCIONES ESPECÍFICAS PARA NIVEL {nivel.upper()}:
{nivel_instrucciones.get(nivel.lower(), nivel_instrucciones["fácil"])}

Devuelve ÚNICAMENTE un JSON válido con esta estructura (sin markdown, sin backticks):
{{
  "titulo": "string",
  "duracion_estimada": "X minutos",
  "slides": [
    {{
      "tipo": "portada",
      "titulo": "string",
      "subtitulo": "string que indique que es Parte 1/2/3 según el nivel",
      "emoji": "emoji",
      "nivel": "{nivel}",
      "narracion": "texto que leerá el narrador, mínimo 3 oraciones"
    }},
    {{
      "tipo": "concepto",
      "titulo": "string",
      "emoji": "emoji",
      "puntos": ["punto 1", "punto 2", "punto 3"],
      "narracion": "texto narrador",
      "preguntas": [
        {{
          "dificultad": "facil",
          "tipo": "seleccion_multiple",
          "enunciado": "versión más directa/obvia de la pregunta sobre lo explicado en este slide",
          "opciones": ["opción 0", "opción 1", "opción 2", "opción 3"],
          "respuesta_correcta": "0",
          "explicacion": "por qué esa es la respuesta correcta"
        }},
        {{
          "dificultad": "medio",
          "tipo": "seleccion_multiple",
          "enunciado": "versión con un poco más de razonamiento sobre el mismo concepto",
          "opciones": ["opción 0", "opción 1", "opción 2", "opción 3"],
          "respuesta_correcta": "0",
          "explicacion": "por qué esa es la respuesta correcta"
        }},
        {{
          "dificultad": "dificil",
          "tipo": "seleccion_multiple",
          "enunciado": "versión que exige aplicar el concepto a un caso menos obvio, con distractores más parecidos entre sí",
          "opciones": ["opción 0", "opción 1", "opción 2", "opción 3"],
          "respuesta_correcta": "0",
          "explicacion": "por qué esa es la respuesta correcta"
        }}
      ]
    }},
    {{
      "tipo": "codigo",
      "titulo": "string",
      "codigo": "código Python apropiado para el nivel",
      "lenguaje": "python",
      "explicacion": "breve explicación del código",
      "narracion": "texto narrador explicando el código",
      "preguntas": [
        {{
          "dificultad": "facil",
          "tipo": "codigo",
          "enunciado": "instrucción breve en texto plano (máx. 2 oraciones, SIN código Python ni backticks) que dice qué debe hacer el programa",
          "codigo_inicial": "código del slide con exactamente UN valor/variable/expresión reemplazada por ???. El ??? es el único marcador. El resto del código es idéntico al slide.",
          "salida_esperada": "texto EXACTO que debe imprimir el código correcto (stdout)",
          "explicacion": "explicación de la solución correcta"
        }},
        {{
          "dificultad": "medio",
          "tipo": "codigo",
          "enunciado": "instrucción breve en texto plano (máx. 2 oraciones, SIN código Python) que describe qué debe completar el estudiante",
          "codigo_inicial": "código con UNA estructura (if/for/while/función) cuyo cuerpo está vacío y tiene solo # completar aquí adentro. La línea del if/for/def presente; solo falta el interior.",
          "salida_esperada": "texto EXACTO que debe imprimir el código correcto (stdout)",
          "explicacion": "explicación de la solución correcta"
        }},
        {{
          "dificultad": "dificil",
          "tipo": "codigo",
          "enunciado": "instrucción breve en texto plano (máx. 2 oraciones, SIN código Python) que plantea el problema completo",
          "codigo_inicial": "# Comienza a programar aquí (máximo una línea adicional de contexto si es estrictamente necesaria)",
          "salida_esperada": "texto EXACTO que debe imprimir el código correcto (stdout)",
          "explicacion": "explicación de la solución correcta"
        }}
      ]
    }},
    {{
      "tipo": "ejemplo",
      "titulo": "string",
      "emoji": "emoji",
      "cuerpo": "explicación del ejemplo",
      "analogia": "analogía del mundo real",
      "narracion": "texto narrador",
      "preguntas": [
        {{ "dificultad": "facil",   "tipo": "seleccion_multiple", "enunciado": "versión directa sobre el ejemplo", "opciones": ["opción 0","opción 1","opción 2","opción 3"], "respuesta_correcta": "0", "explicacion": "feedback" }},
        {{ "dificultad": "medio",   "tipo": "seleccion_multiple", "enunciado": "versión con más razonamiento sobre el ejemplo", "opciones": ["opción 0","opción 1","opción 2","opción 3"], "respuesta_correcta": "0", "explicacion": "feedback" }},
        {{ "dificultad": "dificil", "tipo": "seleccion_multiple", "enunciado": "versión que exige extrapolar el ejemplo a un caso nuevo", "opciones": ["opción 0","opción 1","opción 2","opción 3"], "respuesta_correcta": "0", "explicacion": "feedback" }}
      ]
    }},
    {{
      "tipo": "resumen",
      "titulo": "Lo que aprendiste hoy",
      "puntos": ["punto clave 1", "punto clave 2", "punto clave 3"],
      "narracion": "texto narrador cerrando el video e invitando al siguiente nivel"
    }}
  ]
}}

Reglas generales:
- Usa entre 5 y 7 slides
- La narración de cada slide debe durar entre 25 y 45 segundos al leerla
- Usa emojis relevantes al contenido
- El lenguaje debe estar en español
- Incluye al menos 2 slides de tipo codigo

⚠️ REGLA CRÍTICA para el campo "subtitulo" de la portada:
DEBE empezar exactamente con "Parte 1: " (nivel fácil), "Parte 2: " (nivel medio) o
"Parte 3: " (nivel avanzado) — literalmente esas palabras y ese número, seguido si
quieres de texto descriptivo adicional (ej. "Parte 1: Introducción a las listas").
NUNCA uses formatos como "Parte 1/2", "Parte 1" a secas sin dos puntos, ni omitas
el número de parte poniendo solo una descripción del tema.

⚠️ REGLA CRÍTICA para las preguntas ("preguntas") — sistema adaptativo:
TODOS y cada uno de los slides de tipo concepto, codigo y ejemplo, SIN EXCEPCIÓN,
deben incluir su propio campo "preguntas" con un arreglo de EXACTAMENTE 3 variantes
("facil", "medio", "dificil"). No es opcional y no puede faltar en ninguno de ellos
— un slide de tipo concepto/codigo/ejemplo sin su campo "preguntas" completo hace que
la respuesta entera sea inválida. Antes de responder, revisa slide por slide: si es
concepto, codigo o ejemplo, confirma que tiene exactamente 3 preguntas; si no las
tiene, agrégalas antes de terminar. Los slides portada y resumen NUNCA llevan preguntas.
- Las 3 variantes de un mismo slide evalúan EXACTAMENTE el mismo concepto/código de ESE slide, solo que calibradas a distinta dificultad — no son preguntas distintas, son la misma pregunta en 3 niveles de exigencia. El sistema elegirá en tiempo real cuál de las 3 mostrarle a cada estudiante según su nivel de habilidad medido (no se muestran las 3, solo una).
- Dentro de cada slide, las 3 variantes deben compartir el mismo "tipo" (seleccion_multiple o codigo según el tipo de slide), EXCEPTO que puedes usar "abierta" en las 3 variantes de como máximo UN slide de todo el guión (el más conceptual). Las preguntas "abierta" llevan "respuesta_modelo" (referencia breve) en vez de "opciones"/"respuesta_correcta".
- En selección múltiple: siempre exactamente 4 opciones y "respuesta_correcta" como índice ("0"-"3").
- En los slides de tipo codigo la escalada de dificultad ya está especificada arriba (casi completo → falta una parte estructural → desde cero) — respétala.

⚠️ REGLA CRÍTICA para slides de tipo codigo — campo "codigo_inicial":
El "codigo_inicial" NUNCA puede ser código completo ni funcional. Si se ejecuta tal cual NO debe producir la "salida_esperada". El estudiante DEBE escribir algo para que funcione.
  • variante "facil": copia el código del slide con EXACTAMENTE un valor, variable o expresión reemplazada por "???" (sin comillas). Solo eso falta, nada más.
  • variante "medio": copia el código con el cuerpo de UNA sola estructura faltante (cuerpo de if, de for, de while, o de función). Usa "# completar aquí" como marcador dentro de la estructura vacía; la línea del if/for/def debe estar presente.
  • variante "dificil": deja SOLO el comentario "# Comienza a programar aquí" (más máximo una línea de contexto inicial si es estrictamente necesaria).
ANTES de incluirlo en el JSON, verifica mentalmente que tu codigo_inicial NO imprime la salida_esperada si se ejecuta sin modificaciones.

⚠️ REGLA CRÍTICA — coherencia con lo que el estudiante ya vio, y llamado/impresión:
El código del slide (campo "codigo") a veces SOLO define una función/estructura sin
llamarla ni imprimir nada (ej. "def saludar(nombre): return f'Hola, {{nombre}}!'"). Si
"codigo_inicial" se basa en ese slide, DEBE incluir TAMBIÉN las líneas que llaman a esa
función/estructura y la imprimen (ej. "nombre = 'Juan'" y "print(saludar(nombre))") —
si no, no hay forma de que exista ninguna salida que comparar, sin importar qué escriba
el estudiante. Esas líneas de llamado/impresión SIEMPRE deben estar completas y visibles
en el codigo_inicial (nunca detrás del marcador ??? / completar aquí / dificil) porque el
estudiante nunca vio cómo se llama una función en este video — no puede intuir esa
sintaxis por su cuenta. El enunciado debe dejar claro que esa parte ya está dada y el
estudiante solo debe completar el cuerpo/expresión pedida.

⚠️ REGLA CRÍTICA para el campo "salida_esperada":
"salida_esperada" es SIEMPRE el stdout real que imprime la versión CORRECTAMENTE
COMPLETADA del código (la que el estudiante debe lograr escribir) — NUNCA una
descripción de lo que pasa si NO se completa. Aunque codigo_inicial esté diseñado para
fallar/no ejecutarse tal cual, "salida_esperada" jamás puede ser un texto como "Error",
"Error de sintaxis", "NameError", "no está definido", etc. — eso describe el estado ROTO,
no la solución. Antes de escribir salida_esperada, imagina que TÚ resuelves el ejercicio
correctamente y anota EXACTAMENTE lo que ese programa (ya arreglado) imprimiría.

⚠️ REGLA CRÍTICA — cuando el valor a completar es de libre elección:
Algunos "???" no tienen un único valor correcto (ej. "asigna cualquier número decimal a
'altura'", "pon el nombre que quieras"). Para esos casos, NO inventes un valor específico
como si fuera el único correcto: dile explícitamente en el "enunciado" que cualquier valor
del tipo pedido es válido (ej. "Asigna cualquier número decimal a 'altura' y luego
imprímela.") y deja "salida_esperada" como cadena vacía "" — el sistema de corrección ya
acepta automáticamente cualquier salida válida (sin errores) cuando "salida_esperada" está
vacío, precisamente para estos casos de libre elección. Usa un valor concreto en
"salida_esperada" SOLO cuando el resultado esté matemáticamente/lógicamente determinado
por el resto del código (ej. una suma, una comparación, una función con lógica fija) — en
esos casos SÍ existe una única salida correcta y debe especificarse exactamente.

⚠️ REGLA CRÍTICA para el campo "enunciado" en preguntas de tipo codigo:
La corrección compara la salida impresa EXACTA contra "salida_esperada" — el enunciado
DEBE nombrar explícitamente la(s) variable(s) y la acción exacta que se espera (ej.
"agrega cada par (i, j) a la lista 'resultados' con resultados.append((i, j))", NO
"completa el bucle para que funcione correctamente"). Un enunciado vago permite que el
estudiante escriba algo funcionalmente razonable (como un print de depuración) que nunca
podrá coincidir con salida_esperada porque no modifica la variable que sí se evalúa.

⚠️ REGLA CRÍTICA — nunca asumas funciones de otro slide:
"codigo_inicial" debe ser 100% autocontenido. Si llama a una función (p.ej. "quicksort(arr)"),
esa función DEBE estar definida (con su propio "def") dentro del MISMO codigo_inicial — nunca
asumas que ya fue definida en un slide anterior de este mismo guión; cada pregunta se ejecuta
de forma aislada, sin ese contexto, y el ejercicio quedaría roto sin ninguna solución posible,
ni siquiera completándolo del todo.

Calibración de dificultad — los estudiantes son de PRIMER SEMESTRE sin experiencia previa:
  • "facil": la respuesta es directa y visible en el slide; un estudiante que escuchó la explicación puede responderla en 5 segundos.
  • "medio": requiere entender el concepto y aplicarlo de forma obvia; solo un paso de razonamiento; nada más allá de lo explicado.
  • "dificil": aplica el concepto a un caso nuevo, pero usando SOLO lo del slide; sin jerga avanzada, sin trucos, sin conceptos adicionales.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
        max_tokens=5500
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    guion = json.loads(raw)
    print(f"✓ Guión generado: {len(guion['slides'])} slides | {guion.get('duracion_estimada', '?')}")
    return guion


# ── Generación de audio con Edge TTS ───────────────────────────────────────────

async def generar_audio_slide(texto: str, output_path: str, voice: str = VOICE):
    communicate = edge_tts.Communicate(texto, voice)
    await communicate.save(output_path)


def _duracion_esperada_seg(texto: str) -> float:
    # Misma heurística que estimarTiming() en el backend: ~150 palabras/minuto.
    palabras = len(texto.split())
    return (palabras / 150) * 60


async def _generar_audio_slide_validado(texto: str, output_path: str, voice: str = VOICE, intentos: int = 3):
    # Edge TTS ocasionalmente devuelve un audio truncado/silencioso para un
    # texto dado (falla transitoria del servicio gratuito) — eso deja un
    # slide visible menos de un segundo en el video final, con narración
    # cortada, sin que nada falle explícitamente. Se detecta comparando la
    # duración real del audio contra lo que ese texto debería tardar leído
    # en voz alta, y se reintenta si sale sospechosamente corto.
    esperada = _duracion_esperada_seg(texto)
    for intento in range(intentos):
        await generar_audio_slide(texto, output_path, voice)
        if esperada < 1.5:
            return  # textos muy cortos (p.ej. un título) no aplican este chequeo
        try:
            clip = AudioFileClip(output_path)
            real = clip.duration
            clip.close()
        except Exception:
            real = 0
        if real >= esperada * 0.5:
            return
        print(f"  ⚠️  Audio sospechosamente corto ({real:.1f}s vs ~{esperada:.1f}s esperados) — reintentando ({intento + 1}/{intentos})...")
    print(f"  ⚠️  No se logró un audio de duración razonable tras {intentos} intentos — se usa el último resultado.")


async def generar_todos_los_audios(slides: list, tmp_dir: str) -> list:
    print("🎙️  Generando audios con Edge TTS...")
    tareas = []
    paths  = []
    for i, slide in enumerate(slides):
        narr = slide.get("narracion", slide.get("titulo", ""))
        path = os.path.join(tmp_dir, f"audio_{i:02d}.mp3")
        paths.append(path)
        tareas.append(_generar_audio_slide_validado(narr, path))
    await asyncio.gather(*tareas)
    print(f"✓ {len(paths)} archivos de audio generados")
    return paths


# ── Renderizado de slides ──────────────────────────────────────────────────────

def renderizar_slides(slides: list, tmp_dir: str) -> list:
    print("🎨 Renderizando slides...")
    total = len(slides)
    paths = []
    for i, slide in enumerate(slides):
        tipo     = slide.get("tipo", "concepto")
        renderer = SLIDE_RENDERERS.get(tipo, slide_concepto)
        img      = renderer(slide, i + 1, total)
        path     = os.path.join(tmp_dir, f"slide_{i:02d}.png")
        img.save(path, "PNG")
        paths.append(path)
        print(f"  ✓ Slide {i+1}/{total} — {tipo}")
    return paths


# ── Ensamblaje del video ───────────────────────────────────────────────────────

def ensamblar_video(slide_paths: list, audio_paths: list, output_path: str, tmp_dir: str):
    print("🎬 Ensamblando video...")
    clips = []
    slide_timings = []   # [{"inicio_sec": float, "fin_sec": float}, ...] por slide
    cursor = 0.0
    for i, (sp, ap) in enumerate(zip(slide_paths, audio_paths)):
        audio    = AudioFileClip(ap)
        duracion = audio.duration + 0.5
        clip     = ImageClip(sp, duration=duracion).set_audio(audio)
        clip     = clip.fadein(0.3).fadeout(0.3)
        clips.append(clip)
        slide_timings.append({"inicio_sec": round(cursor, 2), "fin_sec": round(cursor + duracion, 2)})
        cursor += duracion
        print(f"  ✓ Clip {i+1}: {duracion:.1f}s")
    video = concatenate_videoclips(clips, method="compose")
    # +faststart moves the moov atom to the front of the file so browsers can
    # start streaming/seeking immediately via byte-range requests — without it,
    # <video> has to probe near the end of the file for metadata first, which
    # can leave playback stuck in a permanent error state over a real network.
    #
    # Two safety measures against concurrent/duplicate requests for the same
    # tema+subtema+nivel (which share the same output filename): (1) force
    # MoviePy's temp audio file into our already-unique tmp_dir instead of
    # letting it derive a shared name next to output_path — two overlapping
    # runs used to race on that shared temp file and crash with "No such
    # file or directory"; (2) render to a per-call unique path and only
    # os.replace() it onto the final name once fully written, so a slower
    # duplicate run can never read/serve a half-written final file.
    unique = uuid.uuid4().hex[:8]
    partial_path = f"{output_path}.partial-{unique}.mp4"
    video.write_videofile(
        partial_path, fps=FPS, codec="libx264", audio_codec="aac", logger=None,
        ffmpeg_params=["-movflags", "+faststart"],
        temp_audiofile=os.path.join(tmp_dir, f"temp-audio-{unique}.m4a"),
    )
    os.replace(partial_path, output_path)
    duracion_total = sum(c.duration for c in clips)
    print(f"✓ Video ensamblado: {duracion_total:.0f}s ({duracion_total/60:.1f} min)")
    return duracion_total, slide_timings


# ── Función principal ──────────────────────────────────────────────────────────

# Building the output filename by concatenating tema+subtema+nivel verbatim used
# to blow past the filesystem's ~255-byte filename limit whenever an admin (or
# the AI-assisted batch script) wrote a longer subtema — MoviePy/ffmpeg then
# failed with an opaque "Error opening output" instead of a clear message. Slug
# it down to ASCII word characters and cap the subtema portion's length.
def _slug(text: str, max_len: int = 40) -> str:
    ascii_text = (text.lower()
        .replace("á", "a").replace("é", "e").replace("í", "i")
        .replace("ó", "o").replace("ú", "u").replace("ñ", "n").replace("ü", "u"))
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_text).strip("_")
    return slug[:max_len].rstrip("_")


def generar_video(
    tema: str,
    subtema: str,
    nivel: str = "medio",
    output_dir: str = "output",
    api_key: str = None
) -> str:
    import tempfile

    key = api_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        raise ValueError("Necesitas una OPENAI_API_KEY")

    client = OpenAI(api_key=key)
    Path(output_dir).mkdir(parents=True, exist_ok=True)

    nombre_archivo = f"{_slug(tema)}_{_slug(subtema, max_len=60)}_{nivel}.mp4"
    output_path    = os.path.join(output_dir, nombre_archivo)

    with tempfile.TemporaryDirectory() as tmp:
        guion      = generar_guion(client, tema, subtema, nivel)
        json_path  = os.path.join(output_dir, nombre_archivo.replace(".mp4", ".json"))
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(guion, f, ensure_ascii=False, indent=2)
        slide_paths = renderizar_slides(guion["slides"], tmp)
        audio_paths = asyncio.run(generar_todos_los_audios(guion["slides"], tmp))
        duracion, slide_timings = ensamblar_video(slide_paths, audio_paths, output_path, tmp)

        # Añadir los timestamps reales de cada slide al guión y reescribir el JSON
        for slide, timing in zip(guion["slides"], slide_timings):
            slide["inicio_sec"] = timing["inicio_sec"]
            slide["fin_sec"]    = timing["fin_sec"]
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(guion, f, ensure_ascii=False, indent=2)

    print(f"\n🎉 Video listo: {output_path}")
    print(f"   Duración: {duracion:.0f}s | Slides: {len(guion['slides'])}")
    return output_path


# ── CLI ────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generador de videos educativos GEMA")
    parser.add_argument("--tema",    required=True,  help="Tema principal (ej: Condicionales)")
    parser.add_argument("--subtema", required=True,  help="Subtema (ej: if/else en Python)")
    parser.add_argument("--nivel",   default="medio", choices=["fácil", "medio", "avanzado"])
    parser.add_argument("--output",  default="output", help="Carpeta de salida")
    parser.add_argument("--api-key", default=None,   help="OpenAI API key")
    args = parser.parse_args()

    generar_video(
        tema=args.tema,
        subtema=args.subtema,
        nivel=args.nivel,
        output_dir=args.output,
        api_key=args.api_key
    )