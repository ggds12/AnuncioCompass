"""Compasso Casco: fonte em pixel do site do Compasso.

Cada letra é desenhada numa grade (# = pixel). O gerador transforma a grade em contornos:
  - pixel de 100 unidades (UPM 1000: a altura das maiúsculas tem 7 pixels, a das minúsculas, 5);
  - cantos expostos arredondados, como o casco da tartaruga do logo;
  - pixels que se tocam só na diagonal ganham uma emenda a 45°, para os traços inclinados não se partirem.

Para mudar uma letra, edite a grade e rode:  python build-casco.py
Saída: CompassoCasco-Regular e CompassoCasco-Bold, em .ttf e .woff2, nesta pasta.
"""
from pathlib import Path
import unicodedata

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables._g_l_y_f import flagOverlapSimple

U = 100   # tamanho do pixel
R = 34    # raio dos cantos expostos
E = 2     # sobreposição entre pixels vizinhos (evita frestas no rasterizador)
F = 46    # meia-diagonal da emenda a 45°

# (grade de cima para baixo, y da linha de baixo). Linha de base = 0.
G = {
    # ---------- maiúsculas (7 de altura) ----------
    'A': ([".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"], 0),
    'B': (["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."], 0),
    'C': ([".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."], 0),
    'D': (["####.", "#...#", "#...#", "#...#", "#...#", "#...#", "####."], 0),
    'E': (["#####", "#....", "#....", "####.", "#....", "#....", "#####"], 0),
    'F': (["#####", "#....", "#....", "####.", "#....", "#....", "#...."], 0),
    'G': ([".###.", "#...#", "#....", "#.###", "#...#", "#...#", ".####"], 0),
    'H': (["#...#", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"], 0),
    'I': (["###", ".#.", ".#.", ".#.", ".#.", ".#.", "###"], 0),
    'J': (["..###", "...#.", "...#.", "...#.", "#..#.", "#..#.", ".##.."], 0),
    'K': (["#...#", "#..#.", "#.#..", "##...", "#.#..", "#..#.", "#...#"], 0),
    'L': (["#....", "#....", "#....", "#....", "#....", "#....", "#####"], 0),
    'M': (["#...#", "##.##", "#.#.#", "#.#.#", "#...#", "#...#", "#...#"], 0),
    'N': (["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"], 0),
    'O': ([".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."], 0),
    'P': (["####.", "#...#", "#...#", "####.", "#....", "#....", "#...."], 0),
    'Q': ([".###.", "#...#", "#...#", "#...#", "#.#.#", "#..#.", ".##.#"], 0),
    'R': (["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"], 0),
    'S': ([".####", "#....", "#....", ".###.", "....#", "....#", "####."], 0),
    'T': (["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."], 0),
    'U': (["#...#", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."], 0),
    'V': (["#...#", "#...#", "#...#", "#...#", ".#.#.", ".#.#.", "..#.."], 0),
    'W': (["#...#", "#...#", "#...#", "#.#.#", "#.#.#", "##.##", "#...#"], 0),
    'X': (["#...#", "#...#", ".#.#.", "..#..", ".#.#.", "#...#", "#...#"], 0),
    'Y': (["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."], 0),
    'Z': (["#####", "....#", "...#.", "..#..", ".#...", "#....", "#####"], 0),
    # ---------- minúsculas (x = 5, hastes = 7, descendentes = 2) ----------
    'a': ([".###.", "....#", ".####", "#...#", ".####"], 0),
    'b': (["#....", "#....", "####.", "#...#", "#...#", "#...#", "####."], 0),
    'c': ([".###.", "#...#", "#....", "#...#", ".###."], 0),
    'd': (["....#", "....#", ".####", "#...#", "#...#", "#...#", ".####"], 0),
    'e': ([".###.", "#...#", "#####", "#....", ".###."], 0),
    'f': (["..##", ".#..", ".#..", "###.", ".#..", ".#..", ".#.."], 0),
    'g': ([".####", "#...#", "#...#", "#...#", ".####", "....#", ".###."], -2),
    'h': (["#....", "#....", "####.", "#...#", "#...#", "#...#", "#...#"], 0),
    'i': (["#", ".", "#", "#", "#", "#", "#"], 0),
    'j': (["..#", "...", "..#", "..#", "..#", "..#", "..#", "#.#", ".#."], -2),
    'k': (["#...", "#...", "#..#", "#.#.", "##..", "#.#.", "#..#"], 0),
    'l': (["#.", "#.", "#.", "#.", "#.", "#.", ".#"], 0),
    'm': (["####.", "#.#.#", "#.#.#", "#.#.#", "#.#.#"], 0),
    'n': (["####.", "#...#", "#...#", "#...#", "#...#"], 0),
    'o': ([".###.", "#...#", "#...#", "#...#", ".###."], 0),
    'p': (["####.", "#...#", "#...#", "#...#", "####.", "#....", "#...."], -2),
    'q': ([".####", "#...#", "#...#", "#...#", ".####", "....#", "....#"], -2),
    'r': (["#.##", "##..", "#...", "#...", "#..."], 0),
    's': ([".####", "#....", ".###.", "....#", "####."], 0),
    't': ([".#..", ".#..", "###.", ".#..", ".#..", ".#..", "..##"], 0),
    'u': (["#...#", "#...#", "#...#", "#...#", ".####"], 0),
    'v': (["#...#", "#...#", "#...#", ".#.#.", "..#.."], 0),
    'w': (["#...#", "#...#", "#.#.#", "#.#.#", ".#.#."], 0),
    'x': (["#...#", ".#.#.", "..#..", ".#.#.", "#...#"], 0),
    'y': (["#...#", "#...#", "#...#", "#...#", ".####", "....#", ".###."], -2),
    'z': (["#####", "...#.", "..#..", ".#...", "#####"], 0),
    'ı': (["#", "#", "#", "#", "#"], 0),
    # ---------- algarismos (todos com 5 de largura: tabulares) ----------
    '0': ([".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."], 0),
    '1': (["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."], 0),
    '2': ([".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"], 0),
    '3': (["#####", "...#.", "..#..", "...#.", "....#", "#...#", ".###."], 0),
    '4': (["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."], 0),
    '5': (["#####", "#....", "####.", "....#", "....#", "#...#", ".###."], 0),
    '6': (["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."], 0),
    '7': (["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."], 0),
    '8': ([".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."], 0),
    '9': ([".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."], 0),
    # ---------- pontuação e símbolos ----------
    '.': (["#"], 0),
    ',': ([".#", "#."], -1),
    ':': (["#", ".", ".", "#"], 0),
    ';': ([".#", "..", "..", ".#", "#."], -1),
    '!': (["#", "#", "#", "#", "#", ".", "#"], 0),
    '?': ([".###.", "#...#", "....#", "...#.", "..#..", ".....", "..#.."], 0),
    '¡': (["#", ".", "#", "#", "#", "#", "#"], -2),
    '¿': (["..#..", ".....", "..#..", ".#...", "#....", "#...#", ".###."], -2),
    '-': (["####"], 3),
    '–': (["#####"], 3),
    '—': (["#######"], 3),
    '_': (["#####"], -1),
    '+': (["..#..", "..#..", "#####", "..#..", "..#.."], 1),
    '=': (["####", "....", "####"], 2),
    '×': (["#...#", ".#.#.", "..#..", ".#.#.", "#...#"], 1),
    '/': (["....#", "...#.", "...#.", "..#..", ".#...", ".#...", "#...."], 0),
    '\\': (["#....", ".#...", ".#...", "..#..", "...#.", "...#.", "....#"], 0),
    '|': (["#"] * 9, -2),
    '(': ([".#", "#.", "#.", "#.", "#.", "#.", ".#"], 0),
    ')': (["#.", ".#", ".#", ".#", ".#", ".#", "#."], 0),
    '[': (["##", "#.", "#.", "#.", "#.", "#.", "##"], 0),
    ']': (["##", ".#", ".#", ".#", ".#", ".#", "##"], 0),
    '<': (["..#", ".#.", "#..", ".#.", "..#"], 1),
    '>': (["#..", ".#.", "..#", ".#.", "#.."], 1),
    "'": (["#", "#"], 5),
    '"': (["#.#", "#.#"], 5),
    '‘': ([".#", "#."], 5),
    '’': ([".#", "#."], 5),
    '“': ([".#.#", "#.#."], 5),
    '”': ([".#.#", "#.#."], 5),
    '«': (["..#.#", ".#.#.", "#.#..", ".#.#.", "..#.#"], 1),
    '»': (["#.#..", ".#.#.", "..#.#", ".#.#.", "#.#.."], 1),
    '*': (["#.#", ".#.", "#.#"], 4),
    '·': (["#"], 3),
    '•': (["##", "##"], 2),
    '…': (["#.#.#"], 0),
    '°': ([".#.", "#.#", ".#."], 4),
    'º': ([".#.", "#.#", ".#.", "...", "###"], 2),
    'ª': (["##.", ".##", "#.#", "...", "###"], 2),
    '%': (["##..#", "##.#.", "...#.", "..#..", ".#...", ".#.##", "#..##"], 0),
    '$': (["..#..", ".####", "#.#..", ".###.", "..#.#", "####.", "..#.."], 0),
    '€': ([".###.", "#...#", "####.", "#....", "####.", "#...#", ".###."], 0),
    '#': ([".#.#.", "#####", ".#.#.", "#####", ".#.#."], 1),
    '@': ([".###.", "#...#", "#.###", "#.#.#", "#.###", "#....", ".###."], 0),
    '&': ([".##..", "#..#.", "#.#..", ".#...", "#.#.#", "#..#.", ".##.#"], 0),
    '→': (["..#..", "...#.", "#####", "...#.", "..#.."], 1),
    '←': (["..#..", ".#...", "#####", ".#...", "..#.."], 1),
    '↑': (["..#..", ".###.", "#.#.#", "..#..", "..#..", "..#..", "..#.."], 0),
    '↓': (["..#..", "..#..", "..#..", "..#..", "#.#.#", ".###.", "..#.."], 0),
    '✓': (["....#", "...#.", "#.#..", ".#..."], 1),
    '~': ([".#.#", "#.#."], 3),
    '^': ([".#.", "#.#"], 5),
    '`': (["#.", ".#"], 5),
    '©': ([".#####.", "#.....#", "#.###.#", "#.#...#", "#.###.#", "#.....#", ".#####."], 0),
    '{': (["..##", ".#..", ".#..", "#...", ".#..", ".#..", "..##"], 0),
    '}': (["##..", "..#.", "..#.", "...#", "..#.", "..#.", "##.."], 0),
}

# Acentos: (grade, largura). Nas minúsculas ficam em y = 6–7; nas maiúsculas, em y = 8–9.
ACC = {
    'acute': ["..#", ".#."],
    'grave': ["#..", ".#."],
    'circ': [".#.", "#.#"],
    'tilde': [".#.#", "#.#."],
    'diaer': ["#.#"],
    'ring': ["#"],
}
COMBOS = {
    '́': 'acute', '̀': 'grave', '̂': 'circ', '̃': 'tilde', '̈': 'diaer',
}
ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüñýÿÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÑÝ"


def pixels_of(rows, base):
    h = len(rows)
    return {(x, base + (h - 1 - r)) for r, row in enumerate(rows) for x, c in enumerate(row) if c == '#'}


def compose_accent(ch):
    d = unicodedata.normalize('NFD', ch)
    letter, mark = d[0], d[1]
    upper = letter.isupper()
    base_ch = 'ı' if letter == 'i' else letter
    rows, b = G[base_ch]
    px = pixels_of(rows, b)
    width = max(len(r) for r in rows)
    acc = ACC[COMBOS[mark]]
    aw = max(len(r) for r in acc)
    ax = (width - aw) // 2 if width >= aw else -((aw - width + 1) // 2)
    ay = 8 if upper else 6
    if len(acc) == 1:
        ay += 1
    px |= {(x + ax, y) for (x, y) in pixels_of(acc, ay)}
    return px


def cedilla(letter):
    rows, b = G[letter]
    px = pixels_of(rows, b)
    px |= {(2, -1), (1, -2), (2, -2)}
    return px


def build_pixels():
    glyphs = {}
    for ch, (rows, base) in G.items():
        glyphs[ch] = pixels_of(rows, base)
    for ch in ACCENTED:
        glyphs[ch] = compose_accent(ch)
    glyphs['ç'] = cedilla('c')
    glyphs['Ç'] = cedilla('C')
    return glyphs


def draw(px):
    pen = TTGlyphPen(None)
    S = px
    for (x, y) in sorted(S):
        L, Rt, T, B = (x - 1, y) in S, (x + 1, y) in S, (x, y + 1) in S, (x, y - 1) in S
        x0 = x * U - (E if L else 0)
        x1 = (x + 1) * U + (E if Rt else 0)
        y0 = y * U - (E if B else 0)
        y1 = (y + 1) * U + (E if T else 0)
        pts = []

        def corner(cx, cy, inv, outv, rounded):
            if rounded:
                pts.append((True, (cx + inv[0] * R, cy + inv[1] * R)))
                pts.append((False, (cx, cy)))
                pts.append((True, (cx + outv[0] * R, cy + outv[1] * R)))
            else:
                pts.append((True, (cx, cy)))

        # sentido horário (y para cima): baixo-esq → cima-esq → cima-dir → baixo-dir
        corner(x0, y0, (1, 0), (0, 1), not L and not B)
        corner(x0, y1, (0, -1), (1, 0), not L and not T)
        corner(x1, y1, (-1, 0), (0, -1), not Rt and not T)
        corner(x1, y0, (0, 1), (-1, 0), not Rt and not B)
        pen.moveTo(pts[0][1])
        i = 1
        while i < len(pts):
            on, p = pts[i]
            if on:
                pen.lineTo(p)
                i += 1
            else:
                pen.qCurveTo(p, pts[(i + 1) % len(pts)][1])
                i += 2
        pen.closePath()

    # emendas a 45° entre pixels que só se tocam pela diagonal
    for (x, y) in S:
        for dx in (1, -1):
            if (x + dx, y + 1) in S and (x + dx, y) not in S and (x, y + 1) not in S:
                cx = (x + 1) * U if dx == 1 else x * U
                cy = (y + 1) * U
                pen.moveTo((cx - F, cy))
                pen.lineTo((cx, cy + F))
                pen.lineTo((cx + F, cy))
                pen.lineTo((cx, cy - F))
                pen.closePath()
    g = pen.glyph()
    if g.numberOfContours > 0:
        g.flags[0] |= flagOverlapSimple
    return g


def glyph_name(ch):
    if ch == ' ':
        return 'space'
    return 'uni%04X' % ord(ch)


# No Bold as hastes ganham 2 pixels; letras com vãos de 1 pixel precisam de um desenho mais largo
BOLD_GRIDS = {
    'm': (["######.", "#..#..#", "#..#..#", "#..#..#", "#..#..#"], 0),
    'w': (["#.....#", "#.....#", "#..#..#", "#..#..#", ".##.##."], 0),
    'M': (["#......#", "##....##", "#.#..#.#", "#..##..#", "#......#", "#......#", "#......#"], 0),
    'W': (["#......#", "#......#", "#......#", "#..##..#", "#.#..#.#", "##....##", "#......#"], 0),
    'N': (["#.....#", "##....#", "#.#...#", "#..#..#", "#...#.#", "#....##", "#.....#"], 0),
    'Q': ([".####.", "#....#", "#....#", "#....#", "#..#.#", "#...#.", ".###.#"], 0),
    '0': ([".####.", "#....#", "#...##", "#..#.#", "#.#..#", "##...#", ".####."], 0),
    '#': ([".#..#.", "######", ".#..#.", "######", ".#..#."], 1),
    '"': (["#..#", "#..#"], 5),
    '…': (["#..#..#"], 0),
}


def embolden(px):
    """Bold: cada pixel ganha um vizinho à direita (hastes verticais com 2 pixels)."""
    return px | {(x + 1, y) for (x, y) in px}


def main():
    build('Regular', 400, lambda p: p)
    G.update(BOLD_GRIDS)
    build('Bold', 700, embolden)


def build(style, weight, transform):
    here = Path(__file__).parent
    pix = {ch: transform(p) for ch, p in build_pixels().items()}
    order = ['.notdef', 'space'] + [glyph_name(c) for c in pix]
    cmap = {32: 'space', 0xA0: 'space'}
    glyf, hmtx = {}, {}

    nd = TTGlyphPen(None)
    for (a, b, c, d) in [(50, 0, 450, 700), (150, 100, 350, 600)]:
        if a == 50:
            nd.moveTo((a, b)); nd.lineTo((a, d)); nd.lineTo((c, d)); nd.lineTo((c, b)); nd.closePath()
        else:
            nd.moveTo((a, b)); nd.lineTo((c, b)); nd.lineTo((c, d)); nd.lineTo((a, d)); nd.closePath()
    glyf['.notdef'] = nd.glyph(); hmtx['.notdef'] = (500, 50)
    glyf['space'] = TTGlyphPen(None).glyph(); hmtx['space'] = (400 if weight == 400 else 500, 0)

    for ch, px in pix.items():
        minx = min(x for x, _ in px)
        px = {(x - minx, y) for x, y in px}
        w = max(x for x, _ in px) + 1
        name = glyph_name(ch)
        glyf[name] = draw(px)
        hmtx[name] = ((w + 1) * U, 0)
        cmap[ord(ch)] = name
    # aspas e apóstrofos tipográficos já estão no mapa; o hífen também serve ao sinal de menos
    cmap[0x2212] = glyph_name('-')

    fb = FontBuilder(1000, isTTF=True)
    fb.setupGlyphOrder(order)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyf)
    fb.setupHorizontalMetrics(hmtx)
    fb.setupHorizontalHeader(ascent=1000, descent=-250)
    fb.setupNameTable({
        'familyName': 'Compasso Casco',
        'styleName': style,
        'uniqueFontIdentifier': f'Compasso Casco {style} 1.000',
        'fullName': f'Compasso Casco {style}',
        'psName': f'CompassoCasco-{style}',
        'version': 'Version 1.000',
        'copyright': '© 2026 Compasso',
        'designer': 'Compasso',
        'description': 'Fonte em pixel do Compasso: cantos macios como o casco da tartaruga e emendas a 45°.',
    })
    fb.setupOS2(
        version=4,
        sTypoAscender=800, sTypoDescender=-200, sTypoLineGap=200,
        usWinAscent=1050, usWinDescent=250,
        sxHeight=500, sCapHeight=700, achVendID='CMPS', usWeightClass=weight,
        fsSelection=(0x40 if weight == 400 else 0x20) | 0x80,  # REGULAR/BOLD + USE_TYPO_METRICS
    )
    fb.setupPost()
    fb.font['head'].fontRevision = 1.0

    if weight == 700:
        fb.font['head'].macStyle = 1
    ttf = here / f'CompassoCasco-{style}.ttf'
    fb.save(str(ttf))
    fb.font.flavor = 'woff2'
    woff2 = here / f'CompassoCasco-{style}.woff2'
    fb.save(str(woff2))
    print(f'{style}: {len(pix)} glifos, {ttf.stat().st_size // 1024} KB (ttf), {woff2.stat().st_size // 1024} KB (woff2)')


if __name__ == '__main__':
    main()
