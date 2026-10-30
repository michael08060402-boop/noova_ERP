"""Diagramas visuales con ilustraciones: seis pasos, diseños que mejoran y pantalla de Marketing."""
import os
from kit import *
from dib6 import partir

SALIDA = os.path.join(os.path.dirname(__file__), 'svg')


# ---------- iconos simples (24x24, trazo) ----------
ICONOS = {
    'pedir': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    'maquina': '<circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    'mano': '<path d="M4 20l1-4 11-11 3 3L8 19z"/><path d="M14 7l3 3"/>',
    'check': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
    'enviar': '<path d="M4 12l16-8-6 16-3-7z"/><path d="M11 13l9-9"/>',
    'grafico': '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    'subir': '<path d="M12 16V5M7.5 9.5L12 5l4.5 4.5"/><path d="M5 19h14"/>',
    'ojo': '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
}


def icono(lz, x, y, nombre, size=34, color='#ffffff', ancho=1.9):
    k = size / 24
    lz.add('<g transform="translate(%.1f %.1f) scale(%.3f)" fill="none" stroke="%s" stroke-width="%s" stroke-linecap="round" stroke-linejoin="round">%s</g>'
           % (x, y, k, color, ancho, ICONOS[nombre]), 6)


def estacion(lz, cx, cy, num, nombre_icono, titulo, linea, quien, kind, colores):
    fondo, borde = colores
    # círculo grande con icono
    lz.add('<circle cx="%.1f" cy="%.1f" r="52" fill="%s" filter="url(#sh)"/>' % (cx, cy, fondo), 3)
    lz.add('<circle cx="%.1f" cy="%.1f" r="60" fill="none" stroke="%s" stroke-width="2.2"%s/>' % (cx, cy, borde, ' stroke-dasharray="7 5"' if kind == 'nuevo' else ''), 3)
    icono(lz, cx - 20, cy - 20, nombre_icono, 40)
    lz.add('<circle cx="%.1f" cy="%.1f" r="15" fill="#ffffff" stroke="%s" stroke-width="2"/>' % (cx - 44, cy - 44, borde), 7)
    texto(lz, cx - 44, cy - 38.5, str(num), 15, borde, True, 'middle', 8)
    texto(lz, cx, cy + 92, titulo, 17, TINTA, True, 'middle', 6)
    for i, l in enumerate(partir(linea, 140, 12.8)):
        texto(lz, cx, cy + 114 + i * 16.5, l, 12.8, '#46525d', False, 'middle', 6)
    etiqueta = {'persona': 'Persona', 'sistema': 'Sistema', 'ambos': 'Persona + sistema'}[quien]
    col = {'persona': ('#fff3d3', '#8a5a00'), 'sistema': ('#e6f1f6', AZUL), 'ambos': ('#e0f5f5', '#0b6b7a')}[quien]
    w = tw(etiqueta, 12, True) + 24
    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="22" rx="11" fill="%s"/>' % (cx - w / 2, cy + 178, w, col[0]), 6)
    texto(lz, cx, cy + 193.5, etiqueta, 12, col[1], True, 'middle', 7)


def seis_pasos():
    lz = Lienzo(1000, 470)
    pasos = [
        ('pedir', 'Pedir', 'Red, tema y formato. Desde el ERP o con Claude.', 'persona', 'hoy'),
        ('maquina', 'Preparar', 'Elige foto y diseño, y redacta con datos aprobados.', 'sistema', 'hoy'),
        ('mano', 'Mejorar a mano', 'Retoca la imagen o edita el video.', 'persona', 'nuevo'),
        ('check', 'Aprobar', 'Se ve como saldrá en cada red y se aprueba en el ERP.', 'persona', 'parcial'),
        ('enviar', 'Publicar', 'Sale en la red a la hora acordada.', 'ambos', 'nuevo'),
        ('grafico', 'Medir', 'Cada semana, cómo le fue. Cada mes, un balance.', 'ambos', 'nuevo'),
    ]
    col = {'hoy': (AZUL, AZUL), 'parcial': ('#d29b12', '#d29b12'), 'nuevo': (CIAN, CIAN)}
    xs = [95 + i * 162 for i in range(6)]
    cy = 120
    # camino de fondo
    lz.add('<path d="M%d %d H%d" stroke="#d3dde4" stroke-width="10" stroke-linecap="round"/>' % (xs[0], cy, xs[-1]), 1)
    for i in range(5):
        lz.add('<path d="M%d %d H%d" stroke="%s" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 11"/>' % (xs[i] + 66, cy, xs[i + 1] - 66, '#1486ba'), 2)
        lz.add('<path d="M%d %d l-9 -6 v12 z" fill="#1486ba" transform="translate(%d 0)"/>' % (xs[i + 1] - 66, cy, 0), 2)
    for i, (ic, t, l, q, k) in enumerate(pasos):
        estacion(lz, xs[i], cy, i + 1, ic, t, l, q, k, col[k])
    # retorno
    lz.add('<path d="M%d 358 Q%d 388 %d 358" fill="none" stroke="#00a2b1" stroke-width="2.4" stroke-dasharray="6 5"/>' % (xs[0], (xs[0] + xs[-1]) / 2, xs[-1]), 2)
    lz.add('<path d="M%d 358 l9 -3 -3 10 z" fill="#00a2b1"/>' % xs[0], 2)
    lz.add('<rect x="%d" y="388" width="300" height="26" rx="13" fill="#e0f5f5" stroke="#00a2b1" stroke-width="1.4"/>' % ((xs[0] + xs[-1]) / 2 - 150), 3)
    texto(lz, (xs[0] + xs[-1]) / 2, 406, 'Lo que aprendemos mejora la siguiente pieza', 13, '#0b6b7a', True, 'middle', 6)
    leyenda(lz, 14, 446, ['hoy', 'parcial', 'nuevo'], nombres={'hoy': 'Ya existe', 'parcial': 'Existe a medias', 'nuevo': 'Por construir'})
    lz.guardar(os.path.join(SALIDA, 'flujo_simple.svg'))


# ---------- diseños ----------
def mini(lz, x, y, w, h, zonas, fondo='#ffffff', borde='#b8c6d0'):
    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="6" fill="%s" stroke="%s" stroke-width="1.4"/>' % (x, y, w, h, fondo, borde), 4)
    for tipo, zx, zy, zw, zh in zonas:
        fx, fy, fw, fh = x + zx * w, y + zy * h, zw * w, zh * h
        if tipo == 'foto':
            lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="3" fill="#8fb3c7"/>' % (fx, fy, fw, fh), 5)
            lz.add('<path d="M%.1f %.1f l%.1f %.1f l%.1f %.1f l%.1f %.1f z" fill="#6c95ad"/>' % (fx, fy + fh, fw * 0.3, -fh * 0.45, fw * 0.25, fh * 0.25, fw * 0.45, fh * 0.2), 5)
        elif tipo == 'titular':
            lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="2" fill="#004669"/>' % (fx, fy, fw, fh), 5)
        elif tipo == 'dato':
            lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="2" fill="#32b6b5"/>' % (fx, fy, fw, fh), 5)
        elif tipo == 'logo':
            lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="2" fill="#d29b12"/>' % (fx, fy, fw, fh), 5)
        elif tipo == 'texto':
            lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="1.5" fill="#c3ced6"/>' % (fx, fy, fw, fh), 5)


DISENO_A = [('foto', 0.06, 0.06, 0.88, 0.5), ('titular', 0.06, 0.62, 0.7, 0.08), ('dato', 0.06, 0.74, 0.35, 0.1), ('logo', 0.72, 0.88, 0.22, 0.06)]
DISENO_B = [('foto', 0, 0, 1, 1), ('titular', 0.08, 0.68, 0.6, 0.07), ('dato', 0.08, 0.8, 0.3, 0.09), ('logo', 0.72, 0.9, 0.2, 0.05)]
DISENO_C = [('titular', 0.1, 0.1, 0.8, 0.09), ('dato', 0.1, 0.3, 0.5, 0.22), ('texto', 0.1, 0.62, 0.8, 0.04), ('texto', 0.1, 0.7, 0.65, 0.04), ('logo', 0.72, 0.9, 0.2, 0.05)]


def paso_diseno(lz, cx, cy, num, titulo, linea, kind):
    stroke = {'hoy': AZUL, 'parcial': '#d29b12', 'nuevo': CIAN}[kind]
    lz.add('<circle cx="%.1f" cy="%.1f" r="14" fill="%s"/>' % (cx - 62, cy - 4, stroke), 7)
    texto(lz, cx - 62, cy + 1.5, str(num), 14, '#ffffff', True, 'middle', 8)
    texto(lz, cx, cy + 215, titulo, 16, TINTA, True, 'middle', 6)
    for i, l in enumerate(partir(linea, 170, 12.8)):
        texto(lz, cx, cy + 236 + i * 16, l, 12.8, '#46525d', False, 'middle', 6)


def disenos():
    lz = Lienzo(1000, 520)
    xs = [100, 300, 500, 700, 900]
    cy = 12
    ancho_mini, alto_mini = 110, 150
    # fondo de cada paso
    for x in xs:
        lz.add('<rect x="%d" y="%d" width="170" height="258" rx="14" fill="#f7fafb" stroke="#d3dde4" stroke-width="1.2"/>' % (x - 85, 4), 1)
    # 1. archivo subido
    x = xs[0]
    lz.add('<rect x="%d" y="26" width="80" height="108" rx="6" fill="#ffffff" stroke="#b8c6d0" stroke-width="1.4" transform="rotate(-8 %d 80)"/>' % (x - 66, x - 26), 4)
    mini(lz, x - 34, 22, 78, 108, DISENO_C)
    for i, (t, col) in enumerate([('JPG', '#d9573b'), ('PDF', '#1486ba'), ('Canva', '#7a4fa0')]):
        lz.add('<rect x="%d" y="%d" width="%d" height="20" rx="10" fill="%s"/>' % (x - 70 + i * 48, 148, 44 if t != 'Canva' else 52, col), 6)
        texto(lz, x - 70 + i * 48 + (22 if t != 'Canva' else 26), 162, t, 11.5, '#ffffff', True, 'middle', 7)
    icono(lz, x - 12, 180, 'subir', 24, AZUL, 2)
    # 2. estudia: lupa sobre diseño
    x = xs[1]
    mini(lz, x - 42, 26, ancho_mini - 20, alto_mini - 14, DISENO_A)
    for i, (t, c) in enumerate([('foto', '#6c95ad'), ('titular', '#004669'), ('dato', '#2a9b9a'), ('logo', '#c28a0e')]):
        cx_ = x - 66 + (i % 2) * 70
        cy_ = 176 + (i // 2) * 28
        lz.add('<rect x="%d" y="%d" width="64" height="22" rx="11" fill="%s"/>' % (cx_, cy_, c), 6)
        texto(lz, cx_ + 32, cy_ + 15, t, 11.5, '#ffffff', True, 'middle', 7)
    icono(lz, x + 38, 28, 'ojo', 26, '#d29b12', 2)
    # 3. plantilla con espacios
    x = xs[2]
    mini(lz, x - 44, 22, 88, 120, DISENO_A)
    for (zx, zy, t) in [(x + 50, 38, 'foto'), (x + 50, 90, 'titular')]:
        pass
    texto(lz, x, 168, 'Espacios: foto, titular,', 12, '#46525d', False, 'middle', 6)
    texto(lz, x, 184, 'dato y logo', 12, '#46525d', False, 'middle', 6)
    lz.add('<rect x="%d" y="196" width="150" height="22" rx="11" fill="#e0f5f5" stroke="#00a2b1" stroke-width="1.4"/>' % (x - 75), 6)
    texto(lz, x, 211, 'Se prueba con ejemplo', 11.5, '#0b6b7a', True, 'middle', 7)
    # 4. aprobación
    x = xs[3]
    mini(lz, x - 44, 22, 88, 120, DISENO_B)
    lz.add('<circle cx="%d" cy="%d" r="22" fill="#2db36b" filter="url(#sh)"/>' % (x + 38, 128), 7)
    icono(lz, x + 26, 116, 'check', 24, '#ffffff', 2.4)
    texto(lz, x, 176, 'Se ve bien y se puede', 12, '#46525d', False, 'middle', 6)
    texto(lz, x, 192, 'usar sin problemas', 12, '#46525d', False, 'middle', 6)
    lz.add('<rect x="%d" y="204" width="150" height="22" rx="11" fill="#fff3d3" stroke="#d29b12" stroke-width="1.4"/>' % (x - 75), 6)
    texto(lz, x, 219, 'Aprueba una persona', 11.5, '#8a5a00', True, 'middle', 7)
    # 5. rotación y resultados
    x = xs[4]
    mini(lz, x - 62, 40, 52, 70, DISENO_C)
    mini(lz, x - 26, 28, 52, 70, DISENO_A)
    mini(lz, x + 10, 40, 52, 70, DISENO_B)
    barras = [(0.55, '#8fb3c7'), (1.0, '#32b6b5'), (0.4, '#c3ced6')]
    for i, (h, c) in enumerate(barras):
        lz.add('<rect x="%d" y="%.1f" width="22" height="%.1f" rx="3" fill="%s"/>' % (x - 62 + i * 40, 190 - h * 52, h * 52, c), 6)
    texto(lz, x, 208, 'rinde más · rinde menos', 11.5, '#46525d', False, 'middle', 6)
    lz.add('<path d="M%d 190 H%d" stroke="#b8c6d0" stroke-width="1.4"/>' % (x - 66, x + 66), 5)
    # textos de cada paso
    datos = [(xs[0], 'Subir el diseño', 'Un JPG, PDF, brochure o captura de Canva.', 'nuevo'),
             (xs[1], 'Claude lo estudia', 'Ve cómo está armado.', 'parcial'),
             (xs[2], 'Plantilla', 'Queda con espacios para cada elemento.', 'nuevo'),
             (xs[3], 'Aprobar', 'Una persona la revisa.', 'nuevo'),
             (xs[4], 'Rotación', 'Se alterna con los 19 que ya hay.', 'parcial')]
    for i, (x, t, l, k) in enumerate(datos):
        stroke = {'hoy': AZUL, 'parcial': '#d29b12', 'nuevo': CIAN}[k]
        lz.add('<circle cx="%d" cy="%d" r="13" fill="%s"/>' % (x - 62, 252 - 0, stroke), 7) if False else None
    for i, (x, t, l, k) in enumerate(datos):
        stroke = {'hoy': AZUL, 'parcial': '#d29b12', 'nuevo': CIAN}[k]
        lz.add('<circle cx="%d" cy="%d" r="13" fill="%s"/>' % (x - 70, 285, stroke), 7)
        texto(lz, x - 70, 290, str(i + 1), 14, '#ffffff', True, 'middle', 8)
        texto(lz, x - 50, 291, t, 15.5, TINTA, True, 'start', 6)
        for j, ln in enumerate(partir(l, 150, 12.6)):
            texto(lz, x, 316 + j * 16, ln, 12.6, '#46525d', False, 'middle', 6)
    # retorno
    lz.add('<path d="M%d 372 Q500 410 %d 372" fill="none" stroke="#00a2b1" stroke-width="2.4" stroke-dasharray="6 5"/>' % (xs[4], xs[0]), 2)
    lz.add('<path d="M%d 372 l9 -3 -3 10 z" fill="#00a2b1"/>' % xs[0], 2)
    lz.add('<rect x="350" y="396" width="300" height="26" rx="13" fill="#e0f5f5" stroke="#00a2b1" stroke-width="1.4"/>', 3)
    texto(lz, 500, 414, 'Los resultados deciden qué diseño se usa más', 13, '#0b6b7a', True, 'middle', 6)
    lz.add('<rect x="12" y="436" width="976" height="40" rx="10" fill="#fbf8d6" stroke="#e1dc86" stroke-width="1.3"/>', 3)
    texto(lz, 28, 461, 'Los diseños de otras empresas solo sirven de referencia para aprender qué funciona. No se copian.', 13, TINTA, False, 'start', 6)
    leyenda(lz, 14, 496, ['parcial', 'nuevo'], nombres={'parcial': 'Existe a medias', 'nuevo': 'Por construir'})
    lz.guardar(os.path.join(SALIDA, 'flujo_disenos.svg'))


# ---------- pantalla de elegir diseño ----------
def boton(lz, x, y, w, h, t, estilo='sec'):
    fill, stroke, col = {'sec': ('#ffffff', '#9db4c0', '#124b7d'), 'pri': ('#064c70', '#064c70', '#ffffff'), 'acc': ('#00a2b1', '#00a2b1', '#ffffff')}[estilo]
    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="8" fill="%s" stroke="%s" stroke-width="1.4"/>' % (x, y, w, h, fill, stroke), 5)
    texto(lz, x + w / 2, y + h / 2 + 4.8, t, 13.5, col, True, 'middle', 6)


def pantalla_boceto():
    lz = Lienzo(1000, 470)
    lz.add('<rect x="10" y="10" width="980" height="420" rx="16" fill="#ffffff" stroke="#c3ced6" stroke-width="1.6" filter="url(#sh)"/>', 1)
    lz.add('<rect x="10" y="10" width="980" height="46" rx="16" fill="#064c70"/><rect x="10" y="40" width="980" height="16" fill="#064c70"/>', 2)
    texto(lz, 34, 40, 'Generar pieza', 17, '#ffffff', True, 'start', 6)
    # izquierda: formulario
    for i, (et, val) in enumerate([('Red social', 'LinkedIn'), ('Formato', 'Flyer'), ('Tema', 'Automático (según historial)')]):
        y = 84 + i * 82
        texto(lz, 34, y, et, 13, '#46525d', True, 'start', 6)
        lz.add('<rect x="34" y="%d" width="340" height="38" rx="8" fill="#ffffff" stroke="#9db4c0" stroke-width="1.4"/>' % (y + 10), 4)
        texto(lz, 48, y + 34, val, 14, TINTA, False, 'start', 6)
        texto(lz, 354, y + 34, '▾', 13, '#5a6672', False, 'middle', 6)
    texto(lz, 34, 334, 'Diseño', 13, '#46525d', True, 'start', 6)
    lz.add('<rect x="34" y="344" width="340" height="38" rx="8" fill="#e0f5f5" stroke="#00a2b1" stroke-width="1.6"/>', 4)
    texto(lz, 48, 368, 'Automático (según rotación)', 14, TINTA, False, 'start', 6)
    texto(lz, 354, 368, '▾', 13, '#5a6672', False, 'middle', 6)
    # derecha: previsualización
    lz.add('<rect x="420" y="76" width="548" height="338" rx="14" fill="#f7fafb" stroke="#d3dde4" stroke-width="1.2"/>', 1)
    texto(lz, 444, 102, 'PREVISUALIZACIÓN DEL DISEÑO ELEGIDO', 10.5, '#7a8a97', True, 'start', 6, 'letter-spacing="1.2"')
    mini(lz, 444, 114, 150, 195, DISENO_B)
    mini(lz, 612, 134, 108, 140, DISENO_A)
    mini(lz, 734, 134, 108, 140, DISENO_C)
    for x, t in [(519, 'Elegido'), (666, 'Otro'), (788, 'Otro')]:
        texto(lz, x, 326, t, 12, '#46525d', t == 'Elegido', 'middle', 6)
    lz.add('<rect x="444" y="114" width="150" height="195" rx="6" fill="none" stroke="#00a2b1" stroke-width="3"/>', 7)
    texto(lz, 444, 350, 'Foto completa con dato · diseño 7 de 19', 14, TINTA, True, 'start', 6)
    texto(lz, 444, 370, 'Se usó por última vez hace 3 piezas. Rinde por encima del promedio.', 12.5, '#46525d', False, 'start', 6)
    boton(lz, 444, 382, 120, 26, '◀  Anterior', 'sec')
    boton(lz, 572, 382, 120, 26, 'Siguiente  ▶', 'sec')
    boton(lz, 700, 382, 130, 26, 'Otro boceto', 'acc')
    boton(lz, 838, 382, 120, 26, 'Generar', 'pri')
    lz.add('<rect x="10" y="440" width="980" height="24" rx="8" fill="#fbf8d6" stroke="#e1dc86" stroke-width="1.2"/>', 3)
    texto(lz, 24, 457, 'Otro boceto cambia solo el diseño y las fotos; el tema y el texto base se conservan. Cada boceto queda como borrador.', 12.5, TINTA, False, 'start', 6)
    lz.guardar(os.path.join(SALIDA, 'pantalla_boceto.svg'))


# ---------- pantalla única de Marketing ----------
def pantalla_marketing():
    lz = Lienzo(1000, 430)
    lz.add('<rect x="10" y="10" width="980" height="400" rx="16" fill="#ffffff" stroke="#c3ced6" stroke-width="1.6" filter="url(#sh)"/>', 1)
    texto(lz, 34, 46, 'Marketing', 22, '#124b7d', True, 'start', 6)
    texto(lz, 34, 66, 'Piezas, publicaciones y seguimiento de las redes de Noova', 13, '#5a6672', False, 'start', 6)
    tabs = [('Publicaciones', True, 'hoy'), ('Monitoreo de redes', True, 'hoy'), ('Diseños', False, 'nuevo'), ('Calendario', False, 'nuevo')]
    x = 34
    for t, act, k in tabs:
        w = tw(t, 13.5, True) + 32
        if k == 'hoy':
            lz.add('<rect x="%.1f" y="86" width="%.1f" height="32" rx="16" fill="%s" stroke="#064c70" stroke-width="1.4"/>' % (x, w, '#064c70' if t == 'Publicaciones' else '#ffffff'), 4)
            texto(lz, x + w / 2, 107, t, 13.5, '#ffffff' if t == 'Publicaciones' else '#064c70', True, 'middle', 6)
        else:
            lz.add('<rect x="%.1f" y="86" width="%.1f" height="32" rx="16" fill="#e0f5f5" stroke="#00a2b1" stroke-width="1.6" stroke-dasharray="6 4"/>' % (x, w), 4)
            texto(lz, x + w / 2, 107, t, 13.5, '#0b6b7a', True, 'middle', 6)
        x += w + 10
    lz.add('<line x1="34" y1="132" x2="966" y2="132" stroke="#e5edf7" stroke-width="1.4"/>', 2)
    # tarjetas de la pestaña activa (Publicaciones)
    for i in range(5):
        mini(lz, 34 + i * 186, 152, 150, 175, [DISENO_A, DISENO_B, DISENO_C, DISENO_A, DISENO_B][i])
        lz.add('<circle cx="%d" cy="168" r="10" fill="#064c70"/>' % (34 + i * 186 + 134), 6)
    texto(lz, 34, 352, 'Pestaña activa: borradores por red, vista previa, edición y observaciones.', 13, '#46525d', False, 'start', 6)
    texto(lz, 34, 374, 'Todo el trabajo de marketing vive en esta página. Las pestañas punteadas se suman en las siguientes semanas.', 13, '#46525d', False, 'start', 6)
    leyenda(lz, 24, 396, ['hoy', 'nuevo'], nombres={'hoy': 'Ya existe', 'nuevo': 'Se suma después'})
    lz.guardar(os.path.join(SALIDA, 'pantalla_marketing.svg'))


if __name__ == '__main__':
    seis_pasos()
    disenos()
    pantalla_boceto()
    pantalla_marketing()
