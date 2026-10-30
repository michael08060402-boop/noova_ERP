"""Diagramas nuevos y simples: flujo en seis pasos, biblioteca de diseños y monitoreo."""
import os
from kit import *

SALIDA = os.path.join(os.path.dirname(__file__), 'svg')


def tarjeta(lz, x, y, w, h, num, titulo, desc, quien, donde, kind):
    fill, stroke, dash, tc = KINDS[kind]
    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="14" fill="%s" stroke="%s" stroke-width="1.8"%s filter="url(#sh)"/>'
           % (x, y, w, h, fill, stroke, ' stroke-dasharray="%s"' % dash if dash else ''), 3)
    lz.add('<circle cx="%.1f" cy="%.1f" r="15" fill="%s"/>' % (x + 28, y + 30, stroke), 4)
    texto(lz, x + 28, y + 35.5, str(num), 15, '#ffffff', True, 'middle', 5)
    texto(lz, x + 52, y + 36, titulo, 16.5, TINTA, True, 'start', 5)
    yy = y + 64
    for l in partir(desc, w - 36, 13):
        texto(lz, x + 18, yy, l, 13, '#2b353e', False, 'start', 5)
        yy += 17.5
    texto(lz, x + 18, y + h - 38, 'Quién:', 12.3, '#46525d', True, 'start', 5)
    texto(lz, x + 18 + tw('Quién: ', 12.3, True), y + h - 38, quien, 12.3, '#46525d', False, 'start', 5)
    texto(lz, x + 18, y + h - 19, 'Dónde:', 12.3, '#46525d', True, 'start', 5)
    texto(lz, x + 18 + tw('Dónde: ', 12.3, True), y + h - 19, donde, 12.3, '#46525d', False, 'start', 5)
    return Nodo(x, y, w, h)


def partir(txt, ancho, size):
    palabras, lineas, act = txt.split(' '), [], ''
    for p in palabras:
        prueba = (act + ' ' + p).strip()
        if tw(prueba, size) <= ancho or not act:
            act = prueba
        else:
            lineas.append(act)
            act = p
    if act:
        lineas.append(act)
    return lineas


def seis(nombre, pasos, nota=None, vuelve='y vuelve a empezar', kinds_leyenda=('hoy', 'parcial', 'nuevo')):
    alto = 520 if nota else 480
    lz = Lienzo(1000, alto)
    w, h, gap = 296, 178, 50
    xs = [12, 12 + w + gap, 12 + 2 * (w + gap)]
    y1, y2 = 24, 248
    pos = [(xs[0], y1), (xs[1], y1), (xs[2], y1), (xs[2], y2), (xs[1], y2), (xs[0], y2)]
    nodos = []
    for i, (p, (x, y)) in enumerate(zip(pasos, pos)):
        nodos.append(tarjeta(lz, x, y, w, h, i + 1, *p))
    flecha(lz, [nodos[0].p('r'), nodos[1].p('l')], MEDIO, ancho=2.2)
    flecha(lz, [nodos[1].p('r'), nodos[2].p('l')], MEDIO, ancho=2.2)
    flecha(lz, [nodos[2].p('b'), nodos[3].p('t')], MEDIO, ancho=2.2)
    flecha(lz, [nodos[3].p('l'), nodos[4].p('r')], MEDIO, ancho=2.2)
    flecha(lz, [nodos[4].p('l'), nodos[5].p('r')], MEDIO, ancho=2.2)
    flecha(lz, [nodos[5].p('t'), nodos[0].p('b')], CIAN, dash='6 4', ancho=2.2, etiqueta=vuelve)
    if nota:
        lz.add('<rect x="12" y="448" width="976" height="40" rx="10" fill="#fbf8d6" stroke="#e1dc86" stroke-width="1.3"/>', 3)
        texto(lz, 28, 473, nota, 13, TINTA, False, 'start', 5)
    leyenda(lz, 14, alto - 20, list(kinds_leyenda), nombres={'hoy': 'Ya existe', 'parcial': 'Existe a medias', 'nuevo': 'Por construir'})
    lz.guardar(os.path.join(SALIDA, nombre + '.svg'))


def monitoreo():
    lz = Lienzo(1000, 540)
    panel(lz, 8, 18, 300, 200, 'Nuestras cuentas')
    a1 = caja(lz, 20, 50, 276, 76, 'Cómo nos va|alcance, seguidores y clics|de cada red', 'externo')
    a2 = caja(lz, 20, 134, 276, 76, 'Qué dicen de nosotros|comentarios, mensajes|y menciones', 'externo')
    panel(lz, 8, 236, 300, 200, 'El sector, cada semana')
    b1 = caja(lz, 20, 268, 276, 76, 'Noticias y tendencias|de minería en 2026|(búsqueda en internet)', 'externo')
    b2 = caja(lz, 20, 352, 276, 76, 'Cuentas de mineras y|proveedores a vigilar|(lectura con el navegador del equipo)', 'externo')
    mod = caja(lz, 372, 168, 200, 120, 'MONITOREO DE REDES|junta, ordena y compara|lo que pasa afuera y adentro', 'oscuro', 15)
    o1 = caja(lz, 640, 40, 210, 76, 'Panel en el ERP|cifras de cada red|y de cada pieza', 'nuevo')
    o2 = caja(lz, 640, 140, 210, 76, 'Alertas|caídas de alcance,|comentarios sin responder', 'nuevo')
    o3 = caja(lz, 640, 240, 210, 100, 'Informe semanal|qué funciona hoy y cómo|redactar para empresas mineras', 'nuevo')
    fin = caja(lz, 640, 366, 210, 70, 'Plan y diseños|se ajustan con lo aprendido', 'parcial')
    for s_ in (a1, a2, b1, b2):
        flecha(lz, [s_.p('r'), mod.p('l')], GRIS, curva=True, ancho=1.8)
    for o in (o1, o2, o3):
        flecha(lz, [mod.p('r'), o.p('l')], CIAN, dash='6 4', curva=True, ancho=1.8)
    flecha(lz, [o3.p('b'), fin.p('t')], CIAN, dash='6 4', ancho=1.8)
    lz.add('<rect x="880" y="40" width="112" height="396" rx="12" fill="#f7fafb" stroke="#d3dde4" stroke-width="1.2"/>', 1)
    texto(lz, 936, 68, 'QUIÉN LO', 10.5, '#7a8a97', True, 'middle', 5, 'letter-spacing="1.2"')
    texto(lz, 936, 82, 'USA', 10.5, '#7a8a97', True, 'middle', 5, 'letter-spacing="1.2"')
    for i, t in enumerate(['Responsable|de marketing', 'Aprobador', 'Gerencia']):
        yy = 112 + i * 100
        for j, l in enumerate(t.split('|')):
            texto(lz, 936, yy + j * 16, l, 13 if j == 0 else 11.5, TINTA if j == 0 else '#5a6672', j == 0, 'middle', 5)
    lz.add('<rect x="8" y="458" width="984" height="44" rx="10" fill="#fbeadf" stroke="#f0bfb0" stroke-width="1.3"/>', 3)
    texto(lz, 24, 485, 'Solo se mira lo público o lo que nuestras cuentas ya muestran. No se entra a cuentas ajenas ni se publica nada desde aquí.', 13, TINTA, False, 'start', 5)
    leyenda(lz, 14, 516, ['externo', 'nuevo', 'parcial'], nombres={'externo': 'Fuente de datos', 'nuevo': 'Por construir', 'parcial': 'Existe a medias'})
    lz.guardar(os.path.join(SALIDA, 'monitoreo.svg'))


def todo():
    seis('flujo_simple', [
        ('Pedir la pieza', 'Elegimos la red, el tema y el formato. Puede salir de un botón del ERP o de una conversación con Claude.', 'Responsable de marketing', 'ERP', 'hoy'),
        ('El sistema la prepara', 'Elige una foto autorizada y un diseño, redacta el texto con datos aprobados y deja el borrador listo.', 'Claude y la fábrica de piezas', 'Carpeta compartida', 'hoy'),
        ('La mejoramos a mano', 'Una persona retoca la imagen o edita el video para que se vea natural, y sube su versión.', 'Editor creativo', 'Su programa de edición y el ERP', 'nuevo'),
        ('Se revisa y se aprueba', 'Se ve como saldrá en cada red. Quien aprueba confirma texto, red, fecha y hora con un botón.', 'Aprobador', 'ERP', 'parcial'),
        ('Se programa y se publica', 'Sale en LinkedIn, Facebook, Instagram o TikTok a la hora acordada. Al inicio, una persona lo sube.', 'Operador de marketing', 'ERP y redes sociales', 'nuevo'),
        ('Medimos y aprendemos', 'Cada semana vemos cómo le fue a cada pieza. Cada mes, un informe con el crecimiento y qué cambiar.', 'Operador y aprobador', 'Panel del ERP', 'nuevo'),
    ])
    seis('flujo_disenos', [
        ('Subimos un diseño nuevo', 'Un JPG, PDF, brochure o captura de Canva, hecho por una persona del equipo o por marketing.', 'Editor creativo o marketing', 'ERP', 'nuevo'),
        ('El asistente lo estudia', 'Mira cómo está armado: composición, colores y dónde van la foto, el titular y el dato.', 'Claude', 'Biblioteca de diseños', 'parcial'),
        ('Se arma la plantilla', 'Queda con espacios para foto, titular, dato y logo, y se prueba con contenido de ejemplo.', 'Claude y sistemas', 'Biblioteca de diseños', 'nuevo'),
        ('Una persona la aprueba', 'Revisa que se vea bien y que se pueda usar sin problemas de derechos.', 'Aprobador', 'ERP', 'nuevo'),
        ('Entra a la rotación', 'Las piezas nuevas alternan entre los diseños aprobados, para no repetir el mismo seguido.', 'Sistema', 'Generador de piezas', 'parcial'),
        ('Los resultados deciden', 'Los diseños que mejor rinden se usan más; los que no, descansan o se mejoran.', 'Sistema y aprobador', 'Panel de métricas', 'nuevo'),
    ], nota='Los diseños de otras empresas solo sirven de referencia para aprender qué funciona. No se copian ni se usan como plantilla.',
        vuelve='cada semana mejora')
    monitoreo()


if __name__ == '__main__':
    todo()
