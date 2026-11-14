"""Gera os ícones do Finia a partir de um único desenho.

Marca: linha ascendente dourada sobre o verde-petróleo do app — a mesma cor de
destaque usada nas telas. Desenhado em 4x e reduzido, para ficar sem serrilhado.
Rodar: python3 scripts/make-icons.py
"""
from PIL import Image, ImageDraw

TEAL = (14, 74, 92)
GOLD = (214, 183, 127)
S = 1024
F = 4  # fator de superamostragem

def draw_icon(size: int, bleed: bool = True) -> Image.Image:
    w = S * F
    img = Image.new("RGB", (w, w), TEAL)
    d = ImageDraw.Draw(img)
    pts = [(230, 720), (440, 520), (620, 610), (815, 300)]
    pts = [(x * F, y * F) for x, y in pts]
    d.line(pts, fill=GOLD, width=70 * F, joint="curve")
    for p in pts[:1] + pts[-1:]:
        r = 35 * F
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=GOLD)
    # Base discreta, sugerindo o eixo do gráfico (um tom acima do fundo, não branco)
    d.rounded_rectangle([250 * F, 802 * F, 774 * F, 818 * F], radius=8 * F, fill=(45, 100, 118))
    return img.resize((size, size), Image.LANCZOS)

for name, size in [
    ("assets/icon.png", 1024),
    ("assets/favicon.png", 64),
    ("assets/splash-icon.png", 512),
    ("assets/android-icon-foreground.png", 1024),
    ("public/icon-192.png", 192),
    ("public/icon-512.png", 512),
    ("public/apple-touch-icon.png", 180),
]:
    draw_icon(size).save(name)
    print("gerado", name)
