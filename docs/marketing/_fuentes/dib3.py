"""Casos de uso, clases, mapas mentales, cronograma, riesgos y portada."""
import os, base64, datetime, math, json
from kit import *

SALIDA = os.path.join(os.path.dirname(__file__), 'svg')
LOGO = r'C:\Users\Hostos\Desktop\noova-erp - copia\src\assets\logo-blanco.png'


# ---------- casos de uso ----------
def actor(lz, cx, cy, etiqueta, kind='persona'):
    col = '#46525d' if kind != 'sistema' else '#8a96a0'
    dash = ' stroke-dasharray="3 3"' if kind == 'sistema' else ''
    lz.add('<g stroke="%s" stroke-width="1.8" fill="#ffffff" stroke-linecap="round"%s>'
           '<circle cx="%.1f" cy="%.1f" r="9"/><path d="M%.1f %.1f V%.1f M%.1f %.1f H%.1f M%.1f %.1f L%.1f %.1f M%.1f %.1f L%.1f %.1f" fill="none"/></g>'
           % (col, dash, cx, cy - 22, cx, cy - 13, cy + 10, cx - 15, cy - 5, cx + 15, cx, cy + 10, cx - 12, cy + 28, cx, cy + 10, cx + 12, cy + 28), 4)
    partes = etiqueta.split('|')
    for i, p in enumerate(partes):
        texto(lz, cx, cy + 46 + i * 15, p, 13 if i == 0 else 11.5, TINTA if i == 0 else '#5a6672', i == 0)
    return Nodo(cx - 28, cy - 32, 56, 62)


def caso(lz, cx, cy, t, kind='hoy', w=230, h=54):
    fill, stroke, dash, tc = KINDS[kind]
    lz.add('<ellipse cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f" fill="%s" stroke="%s" stroke-width="1.6"%s filter="url(#sh)"/>'
           % (cx, cy, w / 2, h / 2, fill, stroke, ' stroke-dasharray="%s"' % dash if dash else ''), 3)
    partes = t.split('|')
    yy = cy - (len(partes) - 1) * 8 + 4.5
    for i, p in enumerate(partes):
        texto(lz, cx, yy + i * 16, p, 13.5, tc, i == 0 and len(partes) > 1 or len(partes) == 1)
    return Nodo(cx - w / 2, cy - h / 2, w, h)


def enlace(lz, a, b, dash=None, color='#8a96a0'):
    lz.add('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.3"%s/>' % (a[0], a[1], b[0], b[1], color, ' stroke-dasharray="%s"' % dash if dash else ''), 2)


def punto_elipse(n, hacia):
    """Punto del borde de la elipse en dirección al punto 'hacia'."""
    cx, cy = n.x + n.w / 2, n.y + n.h / 2
    dx, dy = hacia[0] - cx, hacia[1] - cy
    a, b = n.w / 2, n.h / 2
    t = 1 / math.sqrt((dx / a) ** 2 + (dy / b) ** 2) if (dx or dy) else 0
    return (cx + dx * t, cy + dy * t)


def vincular(lz, act, c, color='#8a96a0', dash=None):
    ac = (act.x + act.w / 2, act.y + act.h / 2)
    enlace(lz, ac, punto_elipse(c, ac), dash, color)


def incluye(lz, a, b, texto_=None):
    p1 = punto_elipse(a, (b.x + b.w / 2, b.y + b.h / 2))
    p2 = punto_elipse(b, (a.x + a.w / 2, a.y + a.h / 2))
    flecha(lz, [p1, p2], MEDIO, dash='5 4', etiqueta=texto_, ancho=1.3)


def casos_hoy():
    lz = Lienzo(860, 640)
    panel(lz, 215, 20, 440, 560, 'Módulo Publicaciones del ERP (hoy)')
    ys = [90 + i * 70 for i in range(7)]
    t = ['Generar una pieza', 'Ver publicaciones por red', 'Ver vista previa como en la red', 'Editar texto y hashtags',
         'Escribir observaciones', 'Eliminar un borrador', 'Aprobar la pieza']
    k = ['hoy'] * 6 + ['brecha']
    cs = [caso(lz, 435, y, tt, kk) for y, tt, kk in zip(ys, t, k)]
    a1 = actor(lz, 105, 230, 'Gerencia · Administrador|Responsable de marketing')
    a2 = actor(lz, 105, 430, 'Soporte TI|solo lectura y notas')
    a3 = actor(lz, 105, 560, 'Aprobador|hoy en el chat')
    gh = actor(lz, 770, 90, 'GitHub Actions|arma la pieza', 'sistema')
    for c in cs[:6]:
        vincular(lz, a1, c)
    for i in (1, 2, 4):
        vincular(lz, a2, cs[i])
    vincular(lz, a3, cs[6], CORAL, '5 4')
    vincular(lz, gh, cs[0])
    texto(lz, 435, 612, 'La aprobación ocurre fuera del ERP, en el chat, y se anota a mano.', 12, CORAL)
    lz.guardar(os.path.join(SALIDA, 'casos_hoy.svg'))


def casos_futuro_a():
    lz = Lienzo(860, 1010)
    panel(lz, 140, 14, 600, 980, 'Crear, mejorar los diseños, trabajar a mano y aprobar')
    c1x, c2x = 290, 600
    nomb1 = [('Planificar la quincena', 'nuevo'), ('Pedir una pieza', 'hoy'), ('Subir un diseño nuevo', 'nuevo'), ('Aprobar la plantilla nueva', 'nuevo'),
             ('Descargar el paquete', 'nuevo'), ('Subir versión editada|o video', 'nuevo'), ('Editar texto y comentar', 'hoy'),
             ('Ver vista previa', 'hoy'), ('Aprobar con historial', 'nuevo'), ('Devolver con motivo', 'nuevo')]
    ys = [88 + i * 92 for i in range(10)]
    col1 = [caso(lz, c1x, y, t, kd, 220, 56) for y, (t, kd) in zip(ys, nomb1)]
    nomb2 = [('Redactar con|hechos aprobados', 'hoy', 150), ('Elegir fotos|autorizadas', 'hoy', 225), ('Convertir el diseño|en plantilla', 'nuevo', 300), ('Guion y lista de|tomas de video', 'nuevo', 470)]
    col2 = [caso(lz, c2x, y, t, kd, 210, 58) for t, kd, y in nomb2]
    resp = actor(lz, 62, 230, 'Responsable|de marketing')
    edit = actor(lz, 62, 470, 'Editor creativo|imagen y video')
    apro = actor(lz, 62, 700, 'Aprobador|gerencia')
    ia = actor(lz, 800, 260, 'Claude|redacta y propone', 'sistema')
    for i in (0, 1, 2, 6, 7):
        vincular(lz, resp, col1[i])
    for i in (2, 4, 5, 6):
        vincular(lz, edit, col1[i])
    for i in (3, 7, 8, 9):
        vincular(lz, apro, col1[i])
    for c in [col1[0]] + col2:
        vincular(lz, ia, c)
    incluye(lz, col1[1], col2[0], 'incluye')
    incluye(lz, col1[1], col2[1], 'incluye')
    incluye(lz, col1[2], col2[2], 'incluye')
    incluye(lz, col1[8], col1[9], '')
    lz.guardar(os.path.join(SALIDA, 'casos_futuro_a.svg'))


def casos_futuro_b():
    lz = Lienzo(860, 1100)
    panel(lz, 140, 14, 600, 1070, 'Publicar, vigilar las redes, medir y aprender')
    c1x, c2x = 290, 600
    n1 = [('Programar una pieza|aprobada', 'nuevo'), ('Registrar el enlace|publicado', 'nuevo'), ('Proponer ajustes|al plan', 'nuevo'), ('Ver el panel', 'nuevo'),
          ('Ver el monitoreo|de redes', 'nuevo'), ('Atender comentarios|y menciones', 'nuevo'), ('Recibir el informe mensual', 'nuevo'),
          ('Leer el estudio semanal|del sector', 'nuevo'), ('Registrar el origen|de una consulta', 'nuevo'), ('Gestionar roles|y accesos', 'hoy'), ('Renovar tokens|de las redes', 'nuevo')]
    ys = [88 + i * 92 for i in range(11)]
    col1 = [caso(lz, c1x, y, t, kd, 220, 58) for y, (t, kd) in zip(ys, n1)]
    n2 = [('Publicar en la red', 'nuevo', 150), ('Capturar métricas', 'nuevo', 280)]
    col2 = [caso(lz, c2x, y, t, kd, 210, 56) for t, kd, y in n2]
    apro = actor(lz, 62, 150, 'Aprobador')
    resp = actor(lz, 62, 330, 'Responsable|de marketing')
    ger = actor(lz, 62, 560, 'Gerencia')
    com = actor(lz, 62, 800, 'Comercial')
    ti = actor(lz, 62, 960, 'TI')
    red = actor(lz, 800, 190, 'Redes sociales|LinkedIn · Facebook|Instagram · TikTok', 'sistema')
    rel = actor(lz, 800, 400, 'Reloj programado|lunes 07:00', 'sistema')
    ia = actor(lz, 800, 740, 'Claude|investiga el sector', 'sistema')
    for i in (0, 2):
        vincular(lz, apro, col1[i])
    for i in (0, 3, 4, 5, 7):
        vincular(lz, resp, col1[i])
    for i in (3, 4, 6):
        vincular(lz, ger, col1[i])
    vincular(lz, com, col1[8])
    for i in (9, 10):
        vincular(lz, ti, col1[i])
    for c in col2:
        vincular(lz, red, c)
        vincular(lz, rel, c)
    vincular(lz, red, col1[5])
    for i in (6, 7):
        vincular(lz, ia, col1[i])
    incluye(lz, col1[0], col1[1], 'incluye')
    incluye(lz, col2[0], col1[1], 'incluye')
    lz.guardar(os.path.join(SALIDA, 'casos_futuro_b.svg'))


# ---------- clases ----------
def clase(lz, x, y, w, nombre, attrs, metodos=(), kind='hoy'):
    fill, stroke, dash, _ = KINDS[kind]
    h = 28 + len(attrs) * 17 + 8 + (len(metodos) * 17 + 6 if metodos else 0)
    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="8" fill="#ffffff" stroke="%s" stroke-width="1.6"%s filter="url(#sh)"/>'
           % (x, y, w, h, stroke, ' stroke-dasharray="%s"' % dash if dash else ''), 3)
    lz.add('<path d="M%.1f %.1f h%.1f v%.1f h-%.1f z" fill="%s" opacity="0.0"/>' % (x, y, w, 0, w, fill), 3)
    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="26" rx="7" fill="%s"/>' % (x + 1, y + 1, w - 2, fill), 3)
    texto(lz, x + w / 2, y + 18.5, nombre, 13.5, TINTA, True)
    yy = y + 28
    for a in attrs:
        texto(lz, x + 10, yy + 14, a, 11.8, '#33414c', False, 'start')
        yy += 17
    if metodos:
        lz.add('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1"/>' % (x, yy + 4, x + w, yy + 4, '#c9d4db'), 4)
        yy += 8
        for m in metodos:
            texto(lz, x + 10, yy + 14, m, 11.8, AZUL, False, 'start')
            yy += 17
    return Nodo(x, y, w, h)


def rombo(lz, p, hacia, lleno=True):
    dx, dy = hacia[0] - p[0], hacia[1] - p[1]
    n = math.hypot(dx, dy) or 1
    ux, uy = dx / n, dy / n
    px, py = -uy, ux
    s, a = 14, 5.5
    pts = [p, (p[0] + ux * s / 2 + px * a, p[1] + uy * s / 2 + py * a), (p[0] + ux * s, p[1] + uy * s), (p[0] + ux * s / 2 - px * a, p[1] + uy * s / 2 - py * a)]
    lz.add('<polygon points="%s" fill="%s" stroke="%s" stroke-width="1.4"/>' % (' '.join('%.1f,%.1f' % q for q in pts), AZUL if lleno else '#ffffff', AZUL), 4)


def relacion(lz, pts, tipo='asoc', m1='', m2='', et=None):
    if tipo == 'dep':
        flecha(lz, pts, GRIS, dash='5 4', ancho=1.4, r=6)
    elif tipo == 'asoc':
        flecha(lz, pts, AZUL, ancho=1.4, r=6)
    else:
        flecha(lz, pts, AZUL, ancho=1.4, sin_punta=True, r=6)
        rombo(lz, pts[0], pts[1], lleno=(tipo == 'comp'))
    if m1:
        texto(lz, pts[0][0] + (12 if abs(pts[1][0] - pts[0][0]) > abs(pts[1][1] - pts[0][1]) and pts[1][0] > pts[0][0] else (-12 if abs(pts[1][0] - pts[0][0]) > abs(pts[1][1] - pts[0][1]) else 9)),
              pts[0][1] + (-6 if abs(pts[1][0] - pts[0][0]) > abs(pts[1][1] - pts[0][1]) else (20 if pts[1][1] > pts[0][1] else -10)), m1, 11, '#5a6672', False,
              'middle' if abs(pts[1][0] - pts[0][0]) > abs(pts[1][1] - pts[0][1]) else 'start')
    if m2:
        texto(lz, pts[-1][0] + (-12 if pts[-1][0] > pts[-2][0] and abs(pts[-1][0] - pts[-2][0]) > abs(pts[-1][1] - pts[-2][1]) else (12 if abs(pts[-1][0] - pts[-2][0]) > abs(pts[-1][1] - pts[-2][1]) else 9)),
              pts[-1][1] + (-6 if abs(pts[-1][0] - pts[-2][0]) > abs(pts[-1][1] - pts[-2][1]) else (-8 if pts[-1][1] > pts[-2][1] else 20)), m2, 11, '#5a6672', False,
              'middle' if abs(pts[-1][0] - pts[-2][0]) > abs(pts[-1][1] - pts[-2][1]) else 'start')


def clases():
    lz = Lienzo(1000, 705)
    pub = clase(lz, 385, 205, 230, 'Publicacion',
                ['id', 'titulo', 'texto · hashtags', 'estado', 'revision', 'origen (generado | manual)', 'fechaProgramada', 'urlPublicada', 'jsonEtag'],
                ['editarTexto()', 'aprobar()', 'devolver(motivo)', 'programar(fechaHora)', 'marcarPublicada(url)'], 'hoy')
    medio = clase(lz, 20, 30, 195, 'Medio', ['archivo', 'tipo (imagen|pdf|video)', 'sha256', 'ancho · alto', 'duracionSeg'], (), 'hoy')
    guion = clase(lz, 20, 175, 195, 'Guion', ['gancho', 'mensaje', 'cierre', 'tomas[]', 'duracionSeg'], (), 'nuevo')
    obs = clase(lz, 20, 320, 195, 'Observacion', ['texto', 'autorUid', 'fecha', 'tipo'], (), 'hoy')
    apr = clase(lz, 790, 30, 195, 'Aprobacion', ['textoFinal', 'fechaHora', 'aprobadoPor', 'revision', 'resultado'], (), 'nuevo')
    prog = clase(lz, 790, 175, 195, 'Programacion', ['herramienta (buffer|nativa)', 'idExterno', 'fechaHora', 'estado'], (), 'nuevo')
    met = clase(lz, 790, 300, 195, 'Metrica', ['ventana (1d|7d|28d)', 'alcance', 'interacciones', 'clics', 'capturadaEn'], (), 'nuevo')
    inf = clase(lz, 790, 450, 195, 'Informe', ['mes', 'resumen', 'aprendizajes[]'], (), 'nuevo')
    var = clase(lz, 255, 20, 150, 'Variante', ['familia · formato', 'origen (propio|referencia)', 'estado (activa|descansa)', 'rendimiento'], (), 'hoy')
    tema = clase(lz, 425, 20, 160, 'Tema', ['clave', 'pilar', 'fuente', 'extracto'], (), 'hoy')
    foto = clase(lz, 605, 20, 150, 'Foto', ['ruta', 'autorizacion', 'etiquetas[]'], (), 'hoy')
    red = clase(lz, 215, 566, 140, 'Red', ['clave', 'formatos[]'], (), 'hoy')
    con = clase(lz, 440, 545, 190, 'Consulta', ['origen', 'fecha', 'cotizacionId', 'resultado'], (), 'nuevo')
    cv = clase(lz, 20, 445, 195, 'CuentaVigilada', ['red · nombre', 'tipo (propia | sector)', 'motivo'], (), 'nuevo')
    nov = clase(lz, 20, 560, 195, 'Novedad', ['fecha', 'resumen', 'enlace', 'requiereRespuesta'], (), 'nuevo')
    relacion(lz, [nov.p('t', 0.5), cv.p('b', 0.5)], 'asoc', '*', '1')
    py = lambda f: pub.y + f * pub.h
    relacion(lz, [(385, py(0.1)), (250, py(0.1)), (250, medio.y + 80), (215, medio.y + 80)], 'comp', '1', '1..*')
    relacion(lz, [(385, py(0.22)), (238, py(0.22)), (238, guion.y + 60), (215, guion.y + 60)], 'agg', '1', '0..1')
    relacion(lz, [(385, py(0.45)), (300, py(0.45)), (300, obs.y + 45), (215, obs.y + 45)], 'comp', '1', '0..*')
    relacion(lz, [(615, py(0.1)), (772, py(0.1)), (772, apr.y + 80), (790, apr.y + 80)], 'comp', '1', '0..*')
    relacion(lz, [(615, py(0.25)), (735, py(0.25)), (735, prog.y + 50), (790, prog.y + 50)], 'agg', '1', '0..1')
    relacion(lz, [(615, py(0.45)), (700, py(0.45)), (700, met.y + 60), (790, met.y + 60)], 'comp', '1', '0..*')
    relacion(lz, [inf.p('t', 0.5), met.p('b', 0.5)], 'dep')
    texto(lz, 895, 436, 'resume', 11, '#5a6672', False, 'start')
    relacion(lz, [pub.p('t', 0.12), (pub.p('t', 0.12)[0], 150), (340, 150), var.p('b', 0.5)], 'asoc', '*', '1')
    relacion(lz, [pub.p('t', 0.5), tema.p('b', 0.5)], 'asoc', '*', '1')
    relacion(lz, [pub.p('t', 0.88), (pub.p('t', 0.88)[0], 150), (680, 150), foto.p('b', 0.5)], 'asoc', '*', '*')
    relacion(lz, [pub.p('b', 0.08), (pub.p('b', 0.08)[0], 595), red.p('r', 0.5)], 'asoc', '*', '1')
    relacion(lz, [con.p('t', 0.5), pub.p('b', 0.6)], 'asoc', '*', '0..1')
    texto(lz, 545, 523, 'se atribuye a', 11, '#5a6672', False, 'start')
    leyenda(lz, 20, 682, ['hoy', 'nuevo'], nombres={'hoy': 'Existe hoy (en JSON o Firestore)', 'nuevo': 'Por construir'})
    lz.guardar(os.path.join(SALIDA, 'clases.svg'))


# ---------- mapas mentales ----------
RAMAS = [
    ('Planificar', AZUL, [('7 temas con fuente', 'e', 'e'), ('Calendario mensual', 'p', 'm'), ('Estudio semanal del sector', 'p', 'm'), ('Plan quincenal con resultados', 'f', 'n')]),
    ('Crear', MEDIO, [('Banco de fotos autorizado', 'e', 'e'), ('Texto con hechos aprobados', 'p', 'm'), ('Detector de piezas genéricas', 'e', 'e'), ('Banco de frases de Noova', 'f', 'n')]),
    ('Biblioteca de diseños', '#7a4fa0', [('19 diseños con rotación', 'e', 'e'), ('Subir un diseño nuevo', 'f', 'n'), ('Convertirlo en plantilla', 'f', 'n'), ('Elegir por rendimiento', 'f', 'n'), ('Referencias de otras empresas', 'p', 'm')]),
    ('Taller manual', CIAN, [('Descargar el paquete', 'f', 'n'), ('Subir versión editada', 'f', 'n'), ('Guía de contenido orgánico', 'p', 'm'), ('Guion y tomas de video', 'p', 'm'), ('Subir el MP4 al ERP', 'f', 'n')]),
    ('Revisar y aprobar', INDIGO, [('Vista previa por red', 'e', 'e'), ('Editar texto y hashtags', 'e', 'e'), ('Observaciones del equipo', 'e', 'e'), ('Botón Aprobar con historial', 'f', 'n'), ('Estados y devolver', 'f', 'n')]),
    ('Programar y publicar', '#0b6e8a', [('Cola de piezas aprobadas', 'f', 'n'), ('Programación asistida', 'f', 'n'), ('Enlace publicado registrado', 'f', 'n'), ('Cuentas de las redes listas', 'f', 'n'), ('TikTok', 'f', 'n')]),
    ('Medir', '#5b6f82', [('Línea base 30 oct 2026', 'f', 'n'), ('Captura semanal', 'f', 'n'), ('Enlaces con UTM', 'p', 'm'), ('Origen de cada consulta', 'f', 'n'), ('Panel en el ERP', 'f', 'n')]),
    ('Monitoreo de redes', '#c2603a', [('Panel de cuentas propias', 'f', 'n'), ('Comentarios y menciones', 'f', 'n'), ('Cuentas del sector a vigilar', 'f', 'n'), ('Alertas de cambios', 'f', 'n')]),
    ('Aprender', '#8a8f12', [('Rotación de temas y fotos', 'e', 'e'), ('Registro de aprobaciones', 'p', 'm'), ('Informe mensual', 'f', 'n'), ('Pruebas A/B simples', 'f', 'n')]),
    ('Gobierno', '#3a6f5f', [('Reglas permanentes', 'e', 'e'), ('Aprobación humana siempre', 'e', 'e'), ('Repo y token propios', 'p', 'm'), ('Roles y permisos por rol', 'e', 'm')]),
]
LADOS = {'Planificar': ('d', 0), 'Crear': ('d', 1), 'Biblioteca de diseños': ('d', 2), 'Taller manual': ('d', 3), 'Revisar y aprobar': ('d', 4),
         'Gobierno': ('i', 0), 'Aprender': ('i', 1), 'Monitoreo de redes': ('i', 2), 'Medir': ('i', 3), 'Programar y publicar': ('i', 4)}


def contar():
    r = {'e': 0, 'p': 0, 'f': 0}
    for _, _, hojas in RAMAS:
        for _, h, _ in hojas:
            r[h] += 1
    return r


def mapa(futuro):
    lz = Lienzo(1000, 672)
    cx, cy = 500, 330
    centro = caja(lz, cx - 78, cy - 38, 156, 76, 'Marketing|de Noova|' + ('mañana' if futuro else 'hoy'), 'oscuro', 17)
    banda = 124
    for nombre, color, hojas in RAMAS:
        lado, fila = LADOS[nombre]
        yb = 18 + banda * fila + banda / 2
        bx = 650 if lado == 'd' else 220
        lz.add('<rect x="%.1f" y="%.1f" width="130" height="40" rx="12" fill="%s" filter="url(#sh)"/>' % (bx, yb - 20, color), 3)
        tam = 13 if tw(nombre, 13, True) < 118 else 11.5
        texto(lz, bx + 65, yb + 5, nombre, tam, '#ffffff', True, 'middle', 5)
        if lado == 'd':
            flecha(lz, [(cx + 78, cy + (yb - cy) * 0.12), (bx, yb)], color, curva=True, sin_punta=True, ancho=2.2)
        else:
            flecha(lz, [(cx - 78, cy + (yb - cy) * 0.12), (bx + 130, yb)], color, curva=True, sin_punta=True, ancho=2.2)
        n = len(hojas)
        paso = min(29, (banda - 10) / n)
        alto = min(25, paso - 1.5)
        y0 = yb - (n - 1) * paso / 2
        for j, (txt, h_hoy, h_fut) in enumerate(hojas):
            st = h_fut if futuro else h_hoy
            yl = y0 + j * paso
            ancho_txt = tw(txt, 11.8, True) + 38
            w = max(min(ancho_txt, 198), 150)
            lx = 802 if lado == 'd' else (200 - w)
            if st == 'e':
                fill, stroke, dash = '#e6f1f6', AZUL, None
            elif st in ('p', 'm'):
                fill, stroke, dash = '#fff3d3', '#d29b12', None
            elif st == 'f':
                fill, stroke, dash = '#fbe6df', CORAL, '5 3'
            else:
                fill, stroke, dash = '#e0f5f5', CIAN, '5 3'
            lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="8" fill="%s" stroke="%s" stroke-width="1.4"%s/>'
                   % (lx, yl - alto / 2, w, alto, fill, stroke, ' stroke-dasharray="%s"' % dash if dash else ''), 3)
            gx, gy = lx + 12, yl
            lz.add('<circle cx="%.1f" cy="%.1f" r="5" fill="%s" stroke="%s" stroke-width="1.3"/>' % (gx, gy, stroke if st == 'e' else '#ffffff', stroke), 4)
            if st in ('p', 'm'):
                lz.add('<path d="M%.1f %.1f a5 5 0 0 1 0 10 z" fill="%s"/>' % (gx, gy - 5, stroke), 5)
            texto(lz, lx + 23, yl + 4.2, txt, 11.8, TINTA, True, 'start', 5)
            if lado == 'd':
                flecha(lz, [(bx + 130, yb), (lx, yl)], color, curva=True, sin_punta=True, ancho=1.3)
            else:
                flecha(lz, [(bx, yb), (lx + w, yl)], color, curva=True, sin_punta=True, ancho=1.3)
    xs = 330
    items = [('e', 'Ya existe', '#e6f1f6', AZUL, None), ('m', 'Mejora' if futuro else 'Parcial', '#fff3d3', '#d29b12', None),
             ('n', 'Nuevo' if futuro else 'Falta', '#e0f5f5' if futuro else '#fbe6df', CIAN if futuro else CORAL, '5 3')]
    for st, t, fill, stroke, dash in items:
        lz.add('<rect x="%.1f" y="652" width="22" height="13" rx="4" fill="%s" stroke="%s" stroke-width="1.4"%s/>' % (xs, fill, stroke, ' stroke-dasharray="%s"' % dash if dash else ''), 4)
        texto(lz, xs + 29, 662.5, t, 11.8, '#46525d', False, 'start')
        xs += 29 + tw(t, 11.8) + 26
    lz.guardar(os.path.join(SALIDA, 'mapa_futuro.svg' if futuro else 'mapa_hoy.svg'))


# ---------- cronograma ----------
def d(s):
    return datetime.date.fromisoformat(s)


def gantt():
    lz = Lienzo(1000, 575)
    ini, fin = d('2026-10-26'), d('2027-04-30')
    x0, x1 = 262, 985
    px = (x1 - x0) / (fin - ini).days
    X = lambda f: x0 + (d(f) - ini).days * px
    meses = [('Nov', '2026-11-01'), ('Dic', '2026-12-01'), ('Ene', '2027-01-01'), ('Feb', '2027-02-01'), ('Mar', '2027-03-01'), ('Abr', '2027-04-01')]
    meses_ab = ['Oct'] + [m for m, _ in meses]
    for m, f in meses:
        xx = X(f)
        lz.add('<line x1="%.1f" y1="38" x2="%.1f" y2="395" stroke="#e3eaee" stroke-width="1"/>' % (xx, xx), 1)
        lz.add('<text x="%.1f" y="30" font-size="11" fill="#7a8a97" font-weight="600" letter-spacing="1.2">%s</text>' % (xx + 4, m.upper()), 5)
    fases = [('Fase 0 · Línea base y reglas', '2026-10-30', '2026-11-13', CORAL),
             ('Fase 1 · Cimientos del ERP', '2026-11-09', '2026-12-04', AZUL),
             ('Fase 2 · Taller manual', '2026-11-23', '2026-12-18', CIAN),
             ('Fase 3 · Programación asistida', '2026-12-01', '2027-01-15', MEDIO),
             ('Fase 4 · Medición y panel', '2026-11-16', '2027-01-29', INDIGO),
             ('Fase 5 · Aprendizaje y rutinas', '2027-01-18', '2027-03-31', '#0b6e8a'),
             ('Fase 6 · Piloto de TikTok', '2027-01-18', '2027-03-12', '#8a8f12')]
    meses_es = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    fmt = lambda f: '%d %s' % (d(f).day, meses_es[d(f).month])
    for i, (n, a, b, col) in enumerate(fases):
        y = 52 + i * 48
        texto(lz, 14, y + 19, n, 13, TINTA, True, 'start')
        lz.add('<rect x="%.1f" y="%d" width="%.1f" height="26" rx="9" fill="%s" filter="url(#sh)"/>' % (X(a), y + 2, X(b) - X(a), col), 3)
        et = '%s – %s' % (fmt(a), fmt(b))
        if X(b) - X(a) < tw(et, 11.5, True) + 22:
            texto(lz, X(b) + 8, y + 20, et, 11.5, TINTA, True, 'start', 5)
        else:
            texto(lz, X(a) + 10, y + 20, et, 11.5, '#ffffff', True, 'start', 5)
    hoy = X('2026-10-30')
    lz.add('<line x1="%.1f" y1="38" x2="%.1f" y2="395" stroke="%s" stroke-width="1.8" stroke-dasharray="4 3"/>' % (hoy, hoy, CORAL), 4)
    texto(lz, hoy + 5, 402, 'Hoy · 30 oct', 11.5, CORAL, True, 'start')
    hitos = [('2026-11-30', 'Primer informe mensual'), ('2027-01-28', 'Comparación a 90 días'), ('2027-03-15', 'Decidir si se publica sin intervención'), ('2027-04-30', 'Informe semestral')]
    texto(lz, 14, 432, 'HITOS', 10.5, '#7a8a97', True, 'start', 5, 'letter-spacing="1.2"')
    for i, (f, t) in enumerate(hitos):
        xx = X(f)
        yy = 428 + i * 27
        lz.add('<polygon points="%.1f,%d %.1f,%d %.1f,%d %.1f,%d" fill="%s" stroke="#a9a71a" stroke-width="1.4"/>' % (xx, yy - 8, xx + 8, yy, xx, yy + 8, xx - 8, yy, LIMA), 4)
        ancla = 'start' if xx < 760 else 'end'
        texto(lz, xx + (14 if ancla == 'start' else -14), yy + 4, '%s · %s' % (fmt(f), t), 12, TINTA, False, ancla)
    texto(lz, 14, 560, 'Propuesta de planificación: las fechas dependen de las horas que TI pueda dedicar cada semana.', 11.5, '#5a6672', False, 'start')
    lz.guardar(os.path.join(SALIDA, 'gantt.svg'))


# ---------- riesgos ----------
def riesgos():
    lz = Lienzo(1000, 560)
    R = [(1, 'Aprobar datos falsos o confidenciales', 2, 5), (2, 'El contenido suena a IA o genérico', 4, 3),
         (3, 'Repositorio y token en una cuenta personal', 3, 4), (4, 'Personas o minas en foto o video sin permiso', 2, 5),
         (5, 'Cambian o vencen los tokens de las redes', 3, 3), (6, 'La carga humana resulta mayor de la prevista', 4, 4),
         (7, 'Sin acceso a Instagram ni a LinkedIn de empresa', 4, 3), (8, 'Bloqueo de cuenta por automatizar', 2, 4),
         (9, 'Pocos datos: las métricas fluctúan', 4, 2), (10, 'Presupuesto cero limita herramientas', 3, 2),
         (11, 'Todo depende de una sola persona', 3, 4), (12, 'Se pierde el historial de rotación', 2, 2)]
    mx, my, cw, chh = 80, 24, 88, 76
    colores = {}
    for p in range(1, 6):
        for i in range(1, 6):
            s = p * i
            col = '#e0f5f5' if s <= 4 else ('#fbf8cf' if s <= 9 else ('#fde9c8' if s <= 14 else '#fbd5c8'))
            x = mx + (i - 1) * cw
            y = my + (5 - p) * chh
            lz.add('<rect x="%d" y="%d" width="%d" height="%d" fill="%s" stroke="#ffffff" stroke-width="3" rx="6"/>' % (x, y, cw, chh, col), 1)
    for i in range(1, 6):
        texto(lz, mx + (i - 1) * cw + cw / 2, my + 5 * chh + 22, str(i), 13, '#5a6672', True)
        texto(lz, mx - 18, my + (5 - i) * chh + chh / 2 + 5, str(i), 13, '#5a6672', True)
    texto(lz, mx + 2.5 * cw, my + 5 * chh + 46, 'IMPACTO  →', 11, '#7a8a97', True, 'middle', 5, 'letter-spacing="1.4"')
    lz.add('<text transform="translate(24 %.1f) rotate(-90)" font-size="11" fill="#7a8a97" font-weight="600" text-anchor="middle" letter-spacing="1.4">PROBABILIDAD  →</text>' % (my + 2.5 * chh), 5)
    celdas = {}
    for n, t, p, i in R:
        celdas.setdefault((p, i), []).append(n)
    for (p, i), ns in celdas.items():
        x0_ = mx + (i - 1) * cw + cw / 2
        y0_ = my + (5 - p) * chh + chh / 2
        k = len(ns)
        for j, n in enumerate(ns):
            ox = (j - (k - 1) / 2) * 30
            lz.add('<circle cx="%.1f" cy="%.1f" r="13" fill="%s" filter="url(#sh)"/>' % (x0_ + ox, y0_, AZUL), 4)
            texto(lz, x0_ + ox, y0_ + 4.6, str(n), 12.5, '#ffffff', True, 'middle', 5)
    # lista
    lx = 560
    texto(lz, lx, 38, 'RIESGOS', 10.5, '#7a8a97', True, 'start', 5, 'letter-spacing="1.4"')
    for k, (n, t, p, i) in enumerate(sorted(R, key=lambda r: -(r[2] * r[3]))):
        yy = 64 + k * 40
        lz.add('<circle cx="%d" cy="%d" r="12" fill="%s"/>' % (lx + 12, yy, AZUL), 4)
        texto(lz, lx + 12, yy + 4.4, str(n), 12, '#ffffff', True, 'middle', 5)
        texto(lz, lx + 34, yy + 4.6, t, 13, TINTA, False, 'start')
    lz.guardar(os.path.join(SALIDA, 'riesgos.svg'))


# ---------- portada ----------
def portada():
    b64 = base64.b64encode(open(LOGO, 'rb').read()).decode()
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" width="794" height="1123" viewBox="0 0 794 1123">'
           '<defs><linearGradient id="g" x1="0" y1="0" x2="0.55" y2="1"><stop offset="0" stop-color="#004669"/><stop offset="1" stop-color="#1486ba"/></linearGradient>'
           '<radialGradient id="r" cx="0.85" cy="0.12" r="0.7"><stop offset="0" stop-color="#32b6b5" stop-opacity="0.55"/><stop offset="1" stop-color="#32b6b5" stop-opacity="0"/></radialGradient>'
           '<linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#004669" stop-opacity="0"/><stop offset="1" stop-color="#002c43" stop-opacity="0.85"/></linearGradient></defs>'
           '<rect width="794" height="1123" fill="url(#g)"/>'
           '<rect width="794" height="1123" fill="url(#r)"/>'
           '<polygon points="794,0 794,640 0,1010 0,820" fill="#ffffff" fill-opacity="0.045"/>'
           '<polygon points="794,260 794,1123 0,1123 0,1010" fill="#00a2b1" fill-opacity="0.10"/>'
           '<rect y="700" width="794" height="423" fill="url(#f)"/>'
           '<image href="data:image/png;base64,%s" x="58" y="58" width="190" height="97"/>'
           '</svg>') % b64
    open(os.path.join(SALIDA, 'portada.svg'), 'w', encoding='utf-8').write(svg)


if __name__ == '__main__':
    for f in (casos_hoy, casos_futuro_a, casos_futuro_b, clases, gantt, riesgos, portada):
        f()
    mapa(False)
    mapa(True)
    print(json.dumps(contar()))
