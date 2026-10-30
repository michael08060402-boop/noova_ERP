"""Motor mínimo de diagramas SVG con la paleta de Noova.
Todo se dibuja en píxeles naturales (96 dpi); el documento escala la imagen al ancho de página."""
import html
from PIL import ImageFont

AZUL, MEDIO, CIAN, TURQ, LIMA, INDIGO = '#004669', '#1486ba', '#00a2b1', '#32b6b5', '#e0de28', '#3852a0'
TINTA, PAPEL, GRIS = '#14181c', '#f2efe9', '#6b7580'
CORAL = '#d9573b'
FUENTE = "'Segoe UI', 'Segoe UI Variable', Arial, sans-serif"

_REG = ImageFont.truetype(r'C:\Windows\Fonts\segoeui.ttf', 200)
_SEMI = ImageFont.truetype(r'C:\Windows\Fonts\seguisb.ttf', 200)


def tw(texto, size, semi=False):
    return (_SEMI if semi else _REG).getlength(texto) * size / 200


# fill, stroke, dash, color de texto
KINDS = {
    'hoy':      ('#e6f1f6', AZUL, None, TINTA),
    'nuevo':    ('#e0f5f5', CIAN, '7 4', TINTA),
    'persona':  (PAPEL, GRIS, None, TINTA),
    'externo':  ('#ffffff', '#8a96a0', '2 3', '#4a5560'),
    'brecha':   ('#fbe6df', CORAL, '7 4', TINTA),
    'decision': ('#fbf8cf', '#a9a71a', None, TINTA),
    'parcial':  ('#fff3d3', '#d29b12', None, TINTA),
    'oscuro':   (AZUL, AZUL, None, '#ffffff'),
    'medio':    (MEDIO, MEDIO, None, '#ffffff'),
}
ETIQUETAS = {'hoy': 'Existe hoy', 'nuevo': 'Por construir', 'persona': 'Persona', 'externo': 'Servicio externo', 'brecha': 'Falta hoy', 'parcial': 'A medias'}


class Nodo:
    def __init__(self, x, y, w, h):
        self.x, self.y, self.w, self.h = x, y, w, h

    def p(self, lado, f=0.5):
        if lado == 'l': return (self.x, self.y + self.h * f)
        if lado == 'r': return (self.x + self.w, self.y + self.h * f)
        if lado == 't': return (self.x + self.w * f, self.y)
        if lado == 'b': return (self.x + self.w * f, self.y + self.h)
        return (self.x + self.w / 2, self.y + self.h / 2)


class Lienzo:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.capas = []   # (orden, svg)
        self.marcas = set()

    def add(self, s, z=1):
        self.capas.append((z, s))

    def marca(self, color):
        self.marcas.add(color)
        return 'url(#m%s)' % color.strip('#')

    def svg(self):
        defs = ['<defs>',
                '<filter id="sh" x="-8%" y="-8%" width="116%" height="130%"><feDropShadow dx="0" dy="1.6" stdDeviation="1.8" flood-color="#0b2a3a" flood-opacity="0.13"/></filter>']
        for c in sorted(self.marcas | {GRIS, MEDIO, CIAN, AZUL, CORAL}):
            defs.append('<marker id="m%s" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto"><path d="M0 1 L10 5 L0 9 z" fill="%s"/></marker>' % (c.strip('#'), c))
        defs.append('</defs>')
        cuerpo = ''.join(s for _, s in sorted(self.capas, key=lambda t: t[0]))
        return ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" font-family="%s">'
                '<rect width="100%%" height="100%%" fill="#ffffff"/>%s%s</svg>') % (self.w, self.h, self.w, self.h, FUENTE, ''.join(defs), cuerpo)

    def guardar(self, ruta):
        with open(ruta, 'w', encoding='utf-8') as f:
            f.write(self.svg())


def esc(t):
    return html.escape(t, quote=False)


def texto(lz, x, y, t, size=13, color=TINTA, semi=False, anchor='middle', z=5, extra=''):
    lz.add('<text x="%.1f" y="%.1f" font-size="%s" fill="%s" text-anchor="%s" font-weight="%s" %s>%s</text>'
           % (x, y, size, color, anchor, 600 if semi else 400, extra, esc(t)), z)


def caja(lz, x, y, w, h, t, kind='hoy', size=14, sombra=True, rx=11, z=3):
    """t = 'Título|línea 2|línea 3'. Devuelve el nodo."""
    fill, stroke, dash, tc = KINDS[kind]
    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%s" fill="%s" stroke="%s" stroke-width="1.6"%s%s/>'
           % (x, y, w, h, rx, fill, stroke, ' stroke-dasharray="%s"' % dash if dash else '', ' filter="url(#sh)"' if sombra else ''), z)
    partes = t.split('|')
    ls = [size * 1.28] + [size * 0.86 * 1.3] * (len(partes) - 1)
    alto = sum(ls)
    yy = y + (h - alto) / 2
    for i, p in enumerate(partes):
        yy += ls[i]
        base = yy - ls[i] * 0.24
        if i == 0:
            texto(lz, x + w / 2, base, p, size, tc, True)
        else:
            sub = '#dbe9f0' if kind in ('oscuro', 'medio') else '#46525d'
            texto(lz, x + w / 2, base, p, size * 0.86, sub)
    return Nodo(x, y, w, h)


def caja_auto(lz, x, y, t, kind='hoy', size=14, minw=90, px=16, py=11, h=None):
    partes = t.split('|')
    ancho = max([tw(partes[0], size, True)] + [tw(p, size * 0.86) for p in partes[1:]])
    w = max(minw, ancho + 2 * px)
    alto = (size * 1.28 + (len(partes) - 1) * size * 0.86 * 1.3) + 2 * py
    return caja(lz, x, y, w, h or alto, t, kind, size)


def panel(lz, x, y, w, h, titulo='', fill='#f7fafb', stroke='#d3dde4'):
    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="14" fill="%s" stroke="%s" stroke-width="1.2"/>' % (x, y, w, h, fill, stroke), 1)
    if titulo:
        texto(lz, x + 14, y + 20, titulo.upper(), 10.5, '#7a8a97', True, 'start', 2, 'letter-spacing="1.2"')


def _redondeada(pts, r=9):
    d = 'M%.1f %.1f' % pts[0]
    for i in range(1, len(pts) - 1):
        (x0, y0), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
        l1 = max(abs(x1 - x0) + abs(y1 - y0), 1e-6)
        l2 = max(abs(x2 - x1) + abs(y2 - y1), 1e-6)
        rr = min(r, l1 / 2, l2 / 2)
        ax, ay = x1 - (x1 - x0) / l1 * rr, y1 - (y1 - y0) / l1 * rr
        bx, by = x1 + (x2 - x1) / l2 * rr, y1 + (y2 - y1) / l2 * rr
        d += ' L%.1f %.1f Q%.1f %.1f %.1f %.1f' % (ax, ay, x1, y1, bx, by)
    d += ' L%.1f %.1f' % pts[-1]
    return d


def flecha(lz, pts, color=MEDIO, dash=None, etiqueta=None, ep=0.5, ambos=False, sin_punta=False, ancho=1.7, curva=False, r=9, z=2):
    """pts: lista de puntos; ortogonal con esquinas redondeadas, o curva suave de 2 puntos si curva=True."""
    if curva and len(pts) == 2:
        (x0, y0), (x1, y1) = pts
        dx = (x1 - x0) * 0.5
        d = 'M%.1f %.1f C%.1f %.1f %.1f %.1f %.1f %.1f' % (x0, y0, x0 + dx, y0, x1 - dx, y1, x1, y1)
        mid = ((x0 + x1) / 2, (y0 + y1) / 2)
    else:
        d = _redondeada(pts, r)
        # punto medio por longitud
        seg = [(abs(pts[i + 1][0] - pts[i][0]) + abs(pts[i + 1][1] - pts[i][1])) for i in range(len(pts) - 1)]
        total, objetivo, acc = sum(seg), sum(seg) * ep, 0
        mid = pts[0]
        for i, s in enumerate(seg):
            if acc + s >= objetivo:
                f = (objetivo - acc) / s if s else 0
                mid = (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * f, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * f)
                break
            acc += s
    m = lz.marca(color)
    extra = ''
    if not sin_punta:
        extra += ' marker-end="%s"' % m
    if ambos:
        extra += ' marker-start="%s"' % m
    lz.add('<path d="%s" fill="none" stroke="%s" stroke-width="%s"%s stroke-linecap="round"%s/>'
           % (d, color, ancho, ' stroke-dasharray="%s"' % dash if dash else '', extra), z)
    if etiqueta:
        w = tw(etiqueta, 11.5) + 10
        lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="17" rx="8" fill="#ffffff" fill-opacity="0.94"/>' % (mid[0] - w / 2, mid[1] - 9, w), 6)
        texto(lz, mid[0], mid[1] + 3.6, etiqueta, 11.5, '#46525d', False, 'middle', 7)


def leyenda(lz, x, y, kinds, size=11.5, nombres=None):
    xx = x
    etq = dict(ETIQUETAS, **(nombres or {}))
    for k in kinds:
        fill, stroke, dash, _ = KINDS[k]
        lz.add('<rect x="%.1f" y="%.1f" width="20" height="13" rx="4" fill="%s" stroke="%s" stroke-width="1.4"%s/>'
               % (xx, y, fill, stroke, ' stroke-dasharray="%s"' % dash if dash else ''), 4)
        texto(lz, xx + 27, y + 10.5, etq[k], size, '#46525d', False, 'start', 4)
        xx += 27 + tw(etq[k], size) + 22
    return xx
