"""Diagramas de secuencia con el motor propio (legibles en una página vertical)."""
import os
from kit import *

SALIDA = os.path.join(os.path.dirname(__file__), 'svg')


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


def secuencia(nombre, actores, pasos, ancho=780, size=12.8):
    n = len(actores)
    gap = (ancho - 16) / n
    cx = [8 + gap * (i + 0.5) for i in range(n)]
    # primero calculamos altura total
    lh = size * 1.28
    ops = []
    y = 74
    for p in pasos:
        t = p[0]
        if t == 'm':
            _, a, b, txt = p[:4]
            dash = len(p) > 4 and p[4]
            dist = abs(cx[b] - cx[a])
            lin = partir(txt, max(dist - 14, 96), size)
            ops.append(('m', y, a, b, lin, dash))
            y += len(lin) * lh + 22
        elif t == 's':
            _, a, txt = p
            lin = partir(txt, gap * 1.15, size)
            ops.append(('s', y, a, lin))
            y += max(len(lin) * lh + 16, 36)
        else:
            _, a, b, txt = p
            w = (cx[b] - cx[a]) + gap * 0.86 if a != b else gap * 0.9
            lin = partir(txt, w - 18, size)
            ops.append(('n', y, a, b, lin, w))
            y += len(lin) * lh + 30
    alto = y + 20
    lz = Lienzo(ancho, int(alto) + 6)
    # lifelines
    for c in cx:
        lz.add('<line x1="%.1f" y1="54" x2="%.1f" y2="%.1f" stroke="#c3ced6" stroke-width="1.4" stroke-dasharray="4 4"/>' % (c, c, alto - 8), 1)
    for (nom, kind), c in zip(actores, cx):
        w = min(gap - 10, 132)
        caja(lz, c - w / 2, 8, w, 44, nom, kind, 13)
    for op in ops:
        if op[0] == 'm':
            _, y0, a, b, lin, dash = op
            alto_lin = len(lin) * lh
            for i, l in enumerate(lin):
                xm = (cx[a] + cx[b]) / 2
                wl = tw(l, size) + 8
                lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="4" fill="#ffffff" fill-opacity="0.92"/>' % (xm - wl / 2, y0 + i * lh - 1, wl, lh), 4)
                texto(lz, xm, y0 + i * lh + size, l, size, TINTA, False, 'middle', 5)
            ya = y0 + alto_lin + 8
            col = TINTA
            m = lz.marca(col)
            x1, x2 = cx[a], cx[b]
            lz.add('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1.5"%s marker-end="%s"/>'
                   % (x1, ya, x2 + (-3 if x2 > x1 else 3), ya, col, ' stroke-dasharray="5 4"' if dash else '', m), 3)
        elif op[0] == 's':
            _, y0, a, lin = op
            x = cx[a]
            h = len(lin) * lh + 8
            m = lz.marca(TINTA)
            ancho_max = max(tw(l, size) for l in lin) + 12
            izq = x + 36 + ancho_max > ancho - 4
            d = 1 if not izq else -1
            lz.add('<path d="M%.1f %.1f h%d v%.1f h%d" fill="none" stroke="%s" stroke-width="1.5" marker-end="%s"/>' % (x, y0 + 4, 26 * d, h, -24 * d, TINTA, m), 3)
            for i, l in enumerate(lin):
                wl = tw(l, size) + 8
                if izq:
                    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="4" fill="#ffffff" fill-opacity="0.92"/>' % (x - 32 - wl, y0 + i * lh, wl, lh), 4)
                    texto(lz, x - 36, y0 + i * lh + size, l, size, '#46525d', False, 'end', 5)
                else:
                    lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="4" fill="#ffffff" fill-opacity="0.92"/>' % (x + 32, y0 + i * lh, wl, lh), 4)
                    texto(lz, x + 36, y0 + i * lh + size, l, size, '#46525d', False, 'start', 5)
        else:
            _, y0, a, b, lin, w = op
            xm = (cx[a] + cx[b]) / 2
            h = len(lin) * lh + 16
            lz.add('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="8" fill="#fbf8d6" stroke="#e1dc86" stroke-width="1.3"/>' % (xm - w / 2, y0, w, h), 4)
            for i, l in enumerate(lin):
                texto(lz, xm, y0 + 8 + i * lh + size, l, size, TINTA, False, 'middle', 5)
    lz.guardar(os.path.join(SALIDA, nombre + '.svg'))


def todas():
    P, H, N, E = 'persona', 'hoy', 'nuevo', 'externo'
    secuencia('sec_generar',
              [('Usuario', P), ('ERP', H), ('Cloud Function', H), ('GitHub', E), ('Workflow', H), ('SharePoint', E)],
              [('m', 0, 1, 'Elige red, formato y tema'), ('m', 1, 2, 'marketingGenerarPieza'), ('s', 2, 'Valida rol y opciones'),
               ('m', 2, 3, 'dispatch de generar-pieza.yml'), ('m', 3, 2, '204, sin id de ejecución', True), ('m', 2, 1, 'ok', True),
               ('m', 1, 0, 'Aparecerá en unos minutos', True), ('m', 3, 4, 'Inicia en Windows'), ('s', 4, 'Planifica, materializa y exporta'),
               ('m', 4, 5, 'Sube la imagen y publicacion.json'),
               ('n', 1, 5, 'Hoy el ERP no sabe cuándo termina ni si falló.'),
               ('m', 0, 1, 'Pulsa Actualizar'), ('m', 1, 2, 'marketingListarPublicaciones'), ('m', 2, 5, 'Lee carpetas y JSON'),
               ('m', 5, 1, 'Borrador nuevo', True)])
    secuencia('sec_taller',
              [('Editor creativo', P), ('ERP', H), ('Cloud Function', N), ('SharePoint', E), ('Programa de edición', P)],
              [('m', 0, 1, 'Abre la pieza y pulsa Descargar paquete'), ('m', 1, 2, 'marketingDescargarPaquete'), ('m', 2, 3, 'Pide enlaces temporales'),
               ('m', 3, 0, 'HTML fuente, PNG, texto y fotos autorizadas', True), ('m', 0, 4, 'Edita a mano'), ('m', 4, 0, 'Imagen o MP4 final', True),
               ('m', 0, 1, 'Sube la versión editada'), ('m', 1, 2, 'marketingSubirVersion'), ('s', 2, 'Valida tipo, tamaño, huella y ETag'),
               ('m', 2, 3, 'Guarda la versión; JSON con origen manual y revisión + 1'), ('m', 2, 1, 'Estado: en revisión', True),
               ('n', 0, 3, 'Editar siempre anula una aprobación previa.')])
    secuencia('sec_aprobar',
              [('Aprobador', P), ('ERP', H), ('Cloud Function', N), ('Firestore', N), ('SharePoint', E), ('Programador', N), ('Red social', E)],
              [('m', 0, 1, 'Revisa y pulsa Aprobar'), ('m', 1, 0, 'Pide confirmar texto final, red, fecha y hora', True), ('m', 0, 1, 'Confirma'),
               ('m', 1, 2, 'marketingAprobar'), ('s', 2, 'Comprueba rol, estado y pendientes'), ('m', 2, 3, 'Guarda el historial'),
               ('m', 2, 4, 'JSON: estado aprobado y aprobado_en'), ('m', 2, 1, 'Pieza aprobada', True),
               ('n', 2, 5, 'Camino 1: una persona carga la pieza en la red. Camino 2: queda en la cola de Buffer. Camino 3: publicador automático, que exige reescribir la regla 1.'),
               ('m', 2, 5, 'Programa en la fecha y hora aprobadas'), ('m', 5, 2, 'Identificador externo', True), ('m', 2, 3, 'Estado: programada'),
               ('m', 5, 6, 'Publica a la hora acordada'), ('m', 6, 5, 'Enlace de la publicación', True), ('m', 2, 3, 'Estado: publicada y enlace')])
    secuencia('sec_medir',
              [('Reloj semanal', N), ('Cloud Function', N), ('Redes sociales', E), ('Firestore', N), ('Aprobador', P), ('Claude Code', H)],
              [('m', 0, 1, 'Lunes 07:00, hora de Lima'), ('m', 1, 2, 'Pide métricas a 1, 7 y 28 días'), ('m', 2, 1, 'Alcance, interacciones y clics', True),
               ('m', 1, 3, 'Guarda por pieza y por red'), ('n', 1, 3, 'Sin API conectada, una persona carga los números en un formulario.'),
               ('m', 4, 3, 'Exporta el CSV del mes'), ('m', 4, 5, 'Pide el informe mensual'), ('s', 5, 'Compara con la línea base y el mes anterior'),
               ('m', 5, 4, 'Borrador de informe y propuesta de calendario', True), ('m', 4, 3, 'Registra decisiones y aprendizajes')])


if __name__ == '__main__':
    todas()
