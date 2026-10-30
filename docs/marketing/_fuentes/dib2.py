"""Flujos, estados, checklist, taller, métricas y KPIs."""
import os
from kit import *

SALIDA = os.path.join(os.path.dirname(__file__), 'svg')


def rutas_produccion():
    lz = Lienzo(780, 360)
    datos = [('Ruta A · Rápida', 'Botón del ERP|sin esperar a nadie', 'Recetas y plantillas|listo en minutos', 'hoy', 'hoy'),
             ('Ruta B · Con Claude', 'Pedido a Claude Code|con contexto de la marca', 'Skills y revisión|de calidad', 'hoy', 'hoy'),
             ('Ruta C · A mano', 'Con o sin borrador|punto de partida', 'Edición humana|imagen o video', 'nuevo', 'nuevo')]
    ult = []
    for i, (titulo, a, b, ka, kb) in enumerate(datos):
        y = 14 + i * 110
        panel(lz, 8, y, 440, 98, titulo)
        n1 = caja(lz, 22, y + 30, 190, 56, a, ka)
        n2 = caja(lz, 242, y + 30, 190, 56, b, kb)
        flecha(lz, [n1.p('r'), n2.p('l')], MEDIO if ka == 'hoy' else CIAN, dash=None if ka == 'hoy' else '6 4')
        ult.append(n2)
    sp = caja(lz, 500, 118, 130, 92, 'Borrador en|SharePoint|+ publicacion.json', 'hoy')
    rv = caja(lz, 660, 118, 112, 92, 'Revisión y|aprobación', 'decision')
    for n in ult:
        flecha(lz, [n.p('r'), sp.p('l', 0.5)], GRIS, curva=True)
    flecha(lz, [sp.p('r'), rv.p('l')], AZUL)
    leyenda(lz, 20, 342, ['hoy', 'nuevo'])
    lz.guardar(os.path.join(SALIDA, 'rutas_produccion.svg'))


def flujo_hoy():
    lz = Lienzo(1000, 430)
    cab = [(10, 175, '1 · Pedir'), (205, 190, '2 · Crear'), (560, 175, '3 · Revisar'), (765, 225, '4 y 5 · Publicar y medir')]
    for x, w, t in cab:
        panel(lz, x - 4, 20, w + 8, 385, t)
    a1 = caja(lz, 10, 70, 175, 76, 'Botón Generar pieza|red · formato · tema', 'hoy')
    a2 = caja(lz, 10, 250, 175, 76, 'Sesión con Claude Code|pedido libre', 'hoy')
    b1 = caja(lz, 205, 70, 190, 76, 'El workflow arma|la pieza con recetas|y plantillas', 'hoy')
    b2 = caja(lz, 205, 250, 190, 76, 'Claude redacta y diseña|con skills y revisión', 'hoy')
    sp = caja(lz, 425, 150, 105, 100, 'SharePoint|borrador|+ JSON', 'hoy')
    c1 = caja(lz, 560, 70, 175, 66, 'ERP: vista previa|como en la red', 'hoy')
    c2 = caja(lz, 560, 168, 175, 66, 'Edita texto|y comenta', 'hoy')
    c3 = caja(lz, 560, 266, 175, 66, 'Aprueba en el chat|y lo anota a mano', 'hoy')
    d1 = caja(lz, 765, 70, 225, 62, 'Descarga y carga a mano|en cada red', 'brecha')
    d2 = caja(lz, 765, 158, 225, 62, 'Buffer|documentado, sin conectar', 'brecha')
    e = caja(lz, 765, 290, 225, 78, 'Medir|no existe todavía:|sin línea base ni métricas', 'brecha')
    flecha(lz, [a1.p('r'), b1.p('l')], MEDIO)
    flecha(lz, [a2.p('r'), b2.p('l')], MEDIO)
    flecha(lz, [b1.p('r'), sp.p('l', 0.25)], MEDIO, curva=True)
    flecha(lz, [b2.p('r'), sp.p('l', 0.75)], MEDIO, curva=True)
    flecha(lz, [sp.p('r', 0.2), c1.p('l')], MEDIO, curva=True)
    flecha(lz, [c1.p('b'), c2.p('t')], MEDIO)
    flecha(lz, [c2.p('b'), c3.p('t')], MEDIO)
    flecha(lz, [c3.p('r', 0.3), d1.p('l', 0.5)], CORAL, curva=True)
    flecha(lz, [c3.p('r', 0.6), d2.p('l', 0.5)], CORAL, dash='6 4', curva=True)
    flecha(lz, [d2.p('b'), e.p('t')], CORAL, dash='6 4')
    leyenda(lz, 12, 412, ['hoy', 'brecha'])
    lz.guardar(os.path.join(SALIDA, 'flujo_hoy.svg'))


def flujo_objetivo():
    lz = Lienzo(1000, 360)
    w, g, h = 165, 34, 74
    xs = [12 + i * (w + g) for i in range(5)]
    y1, y2 = 70, 232
    p = caja(lz, xs[0], y1, w, h, 'Planificar|calendario quincenal|con métricas y noticias', 'nuevo')
    c = caja(lz, xs[1], y1, w, h, 'Crear|botón · Claude · a mano', 'hoy')
    t = caja(lz, xs[2], y1, w, h, 'Taller manual|imagen y video|con criterio humano', 'nuevo')
    r = caja(lz, xs[3], y1, w, h, 'Revisar|vista previa · notas|lista de calidad', 'hoy')
    d = caja(lz, xs[4], y1, w, h, '¿Aprobar?|devolver o descartar', 'decision')
    q = caja(lz, xs[4], y2, w, h, 'Cola de aprobadas|con fecha y hora', 'nuevo')
    pu = caja(lz, xs[3], y2, w, h, 'Publicar|asistida, en la red|elegida', 'nuevo')
    m = caja(lz, xs[2], y2, w, h, 'Medir|a 24 h · 7 d · 28 d', 'nuevo')
    a = caja(lz, xs[1], y2, w, h, 'Aprender|informe mensual', 'nuevo')
    flecha(lz, [p.p('r'), c.p('l')], CIAN, dash='6 4')
    flecha(lz, [c.p('r'), t.p('l')], CIAN, dash='6 4')
    flecha(lz, [t.p('r'), r.p('l')], CIAN, dash='6 4')
    flecha(lz, [r.p('r'), d.p('l')], MEDIO)
    flecha(lz, [d.p('b'), q.p('t')], CIAN, dash='6 4', etiqueta='sí')
    flecha(lz, [q.p('l'), pu.p('r')], CIAN, dash='6 4')
    flecha(lz, [pu.p('l'), m.p('r')], CIAN, dash='6 4')
    flecha(lz, [m.p('l'), a.p('r')], CIAN, dash='6 4')
    flecha(lz, [a.p('l'), (xs[0] + w / 2, y2 + h / 2), p.p('b')], CIAN, dash='6 4', etiqueta='ajusta el plan', ep=0.62)
    flecha(lz, [c.p('t', 0.5), (c.p('t', 0.5)[0], 46), (r.p('t', 0.3)[0], 46), r.p('t', 0.3)], GRIS, etiqueta='sin taller', ep=0.5, r=8)
    flecha(lz, [d.p('t', 0.5), (d.p('t', 0.5)[0], 22), (t.p('t', 0.75)[0], 22), t.p('t', 0.75)], CORAL, etiqueta='devolver con motivo', ep=0.5, r=8)
    leyenda(lz, 12, 336, ['hoy', 'nuevo', 'decision'], nombres={'decision': 'Decisión de una persona'})
    lz.guardar(os.path.join(SALIDA, 'flujo_objetivo.svg'))


def pipeline_workflow():
    lz = Lienzo(740, 440)
    w, g, h = 150, 30, 70
    xs = [10 + i * (w + g) for i in range(4)]
    y1, y2, y3 = 30, 170, 310
    n1 = caja(lz, xs[0], y1, w, h, 'Entradas|red · formato|tema · fecha', 'persona')
    n2 = caja(lz, xs[1], y1, w, h, '1 · Planificar|tema, variante|y fotos autorizadas', 'hoy')
    n3 = caja(lz, xs[2], y1, w, h, '2 · Materializar|HTML + texto|propuesto', 'hoy')
    n4 = caja(lz, xs[3], y1, w, h, '3 · ¿Campos sin|completar?', 'decision')
    av = caja(lz, xs[3], y2, w, h, 'Avisa en el resumen|y sube igual', 'brecha')
    n5 = caja(lz, xs[2], y2, w, h, '4 · Detector de|diseño genérico', 'hoy')
    n6 = caja(lz, xs[1], y2, w, h, '5 · Exportar|PNG · PDF · láminas', 'hoy')
    n7 = caja(lz, xs[0], y2, w, h, '6 · Subir a SharePoint|el JSON, al final', 'hoy')
    n8 = caja(lz, xs[0], y3, w, h, '7 · Resumen del run|paquete de 14 días', 'hoy')
    for a, b in [(n1, n2), (n2, n3), (n3, n4)]:
        flecha(lz, [a.p('r'), b.p('l')], MEDIO)
    flecha(lz, [n4.p('b'), av.p('t')], CORAL, dash='6 4', etiqueta='sí')
    flecha(lz, [av.p('l'), n5.p('r')], CORAL, dash='6 4')
    flecha(lz, [n4.p('b', 0.12), (n4.p('b', 0.12)[0], 148), (n5.p('t', 0.7)[0], 148), n5.p('t', 0.7)], MEDIO, etiqueta='no', ep=0.35, r=7)
    flecha(lz, [n5.p('l'), n6.p('r')], MEDIO)
    flecha(lz, [n6.p('l'), n7.p('r')], MEDIO)
    flecha(lz, [n7.p('b'), n8.p('t')], MEDIO)
    leyenda(lz, 12, 418, ['hoy', 'brecha'])
    lz.guardar(os.path.join(SALIDA, 'pipeline_workflow.svg'))


def estados():
    lz = Lienzo(820, 520)
    w, g, h = 108, 66, 56
    xs = [12 + i * (w + g) for i in range(5)]
    r1, r2, r3, r4 = 60, 180, 300, 420
    s = {}
    s['sol'] = caja(lz, xs[0], r1, w, h, 'Solicitada', 'nuevo')
    s['gen'] = caja(lz, xs[1], r1, w, h, 'Generando', 'nuevo')
    s['bor'] = caja(lz, xs[2], r1, w, h, 'Borrador', 'hoy')
    s['rev'] = caja(lz, xs[3], r1, w, h, 'En revisión', 'nuevo')
    s['apr'] = caja(lz, xs[4], r1, w, h, 'Aprobada', 'nuevo')
    s['err'] = caja(lz, xs[1], r2, w, h, 'Error|reintentar', 'brecha')
    s['des'] = caja(lz, xs[2], r2, w, h, 'Descartada', 'persona')
    s['pro'] = caja(lz, xs[4], r2, w, h, 'Programada', 'nuevo')
    s['erp'] = caja(lz, xs[3], r3, w, h, 'Error de|publicación', 'brecha')
    s['pub'] = caja(lz, xs[4], r3, w, h, 'Publicada', 'nuevo')
    s['arc'] = caja(lz, xs[4], r4, w, h, 'Archivada', 'persona')
    lz.add('<circle cx="%.1f" cy="%.1f" r="6" fill="%s"/>' % (xs[0] - 4 + 6, r1 - 20, AZUL), 3)
    flecha(lz, [s['sol'].p('r'), s['gen'].p('l')], MEDIO)
    flecha(lz, [s['gen'].p('r'), s['bor'].p('l')], MEDIO)
    flecha(lz, [s['gen'].p('b'), s['err'].p('t')], CORAL, dash='6 4')
    flecha(lz, [s['err'].p('l'), (s['sol'].p('b')[0], s['err'].p('l')[1]), s['sol'].p('b')], CORAL, dash='6 4', etiqueta='reintentar', ep=0.55, r=8)
    flecha(lz, [s['bor'].p('r', 0.3), s['rev'].p('l', 0.3)], MEDIO, etiqueta='enviar', ep=0.5)
    flecha(lz, [s['rev'].p('l', 0.75), s['bor'].p('r', 0.75)], GRIS, etiqueta='devolver', ep=0.5)
    flecha(lz, [s['rev'].p('r'), s['apr'].p('l')], MEDIO, etiqueta='aprobar')
    flecha(lz, [s['apr'].p('t', 0.5), (s['apr'].p('t')[0], 20), (s['bor'].p('t', 0.5)[0], 20), s['bor'].p('t', 0.5)], GRIS, dash='4 3', etiqueta='editar anula la aprobación', ep=0.5, r=8)
    flecha(lz, [s['bor'].p('b'), s['des'].p('t')], GRIS, dash='4 3')
    flecha(lz, [s['rev'].p('b', 0.3), (s['rev'].p('b', 0.3)[0], s['des'].p('r')[1]), s['des'].p('r')], GRIS, dash='4 3', r=8)
    flecha(lz, [s['apr'].p('b', 0.3), s['pro'].p('t', 0.3)], MEDIO, etiqueta='programar', ep=0.5)
    flecha(lz, [s['pro'].p('t', 0.75), s['apr'].p('b', 0.75)], GRIS, dash='4 3')
    flecha(lz, [s['pro'].p('b', 0.5), s['pub'].p('t', 0.5)], MEDIO, etiqueta='la red confirma', ep=0.5)
    flecha(lz, [s['pro'].p('l'), (s['erp'].p('t')[0], s['pro'].p('l')[1]), s['erp'].p('t')], CORAL, dash='6 4', etiqueta='la red rechaza', ep=0.35, r=8)
    flecha(lz, [s['pub'].p('b'), s['arc'].p('t')], MEDIO, etiqueta='con métricas', ep=0.5)
    leyenda(lz, 12, 498, ['hoy', 'nuevo', 'brecha', 'persona'], nombres={'brecha': 'Error', 'persona': 'Estado final'})
    lz.guardar(os.path.join(SALIDA, 'estados.svg'))


def revision_checklist():
    lz = Lienzo(740, 590)
    preguntas = [('Cada dato sale de las afirmaciones aprobadas', 'cifras, años y alcance de servicios'),
                 ('Las fotos están autorizadas', 'y nadie aparece sin permiso ni sin equipo de protección'),
                 ('No serviría para otra empresa', 'cambia el nombre y la pieza deja de tener sentido'),
                 ('Pasa las tres preguntas de dirección', 'refuerza la marca · no arriesga a las mineras · lo aprobaría el gerente'),
                 ('Sin pendientes y sin alertas del detector', 'campos completos y diseño sin rasgos genéricos')]
    cards = []
    for i, (t, s) in enumerate(preguntas):
        y = 24 + i * 92
        card = caja(lz, 56, y, 400, 68, '%s|%s' % (t, s), 'hoy', 13.5)
        lz.add('<circle cx="30" cy="%.1f" r="14" fill="%s"/>' % (y + 34, AZUL), 4)
        texto(lz, 30, y + 39.5, str(i + 1), 14, '#ffffff', True, 'middle', 5)
        cards.append(card)
        if i:
            flecha(lz, [cards[i - 1].p('b'), card.p('t')], AZUL, etiqueta='sí', ep=0.5)
    dev = caja(lz, 540, 24, 190, 6 * 70 + 20, '', 'brecha')
    texto(lz, 635, 210, 'Devolver', 17, TINTA, True)
    texto(lz, 635, 232, 'con motivo', 17, TINTA, True)
    for i, linea in enumerate(['La pieza vuelve al taller', 'con la causa escrita', 'y no avanza hasta', 'que se corrija']):
        texto(lz, 635, 266 + i * 19, linea, 12.5, '#46525d')
    for c in cards:
        flecha(lz, [c.p('r'), (540, c.p('r')[1])], CORAL, dash='6 4', etiqueta='no', ep=0.45)
    ok = caja(lz, 56, 24 + 5 * 92, 400, 70, 'Aprobar|texto final · red · fecha · hora', 'oscuro', 15)
    flecha(lz, [cards[-1].p('b'), ok.p('t')], AZUL, etiqueta='sí', ep=0.5)
    lz.guardar(os.path.join(SALIDA, 'revision_checklist.svg'))


def taller_imagen():
    lz = Lienzo(760, 330)
    w, g, h = 214, 40, 74
    xs = [10 + i * (w + g) for i in range(3)]
    y1, y2 = 30, 190
    a = caja(lz, xs[0], y1, w, h, 'Borrador generado|botón del ERP o Claude', 'hoy')
    b = caja(lz, xs[1], y1, w, h, 'Paquete de la pieza|HTML · PNG · fotos · texto', 'nuevo')
    c = caja(lz, xs[2], y1, w, h, 'Edición a mano|recorte · luz · grano|composición', 'persona')
    d = caja(lz, xs[2], y2, w, h, 'Guía de contenido|orgánico: 6 preguntas', 'decision')
    e = caja(lz, xs[1], y2, w, h, 'Subir versión editada|origen = manual', 'nuevo')
    f = caja(lz, xs[0], y2, w, h, 'Revisión y|aprobación', 'hoy')
    flecha(lz, [a.p('r'), b.p('l')], CIAN, dash='6 4')
    flecha(lz, [b.p('r'), c.p('l')], CIAN, dash='6 4')
    flecha(lz, [c.p('b', 0.3), d.p('t', 0.3)], MEDIO)
    flecha(lz, [d.p('t', 0.75), c.p('b', 0.75)], CORAL, dash='6 4', etiqueta='falta naturalidad', ep=0.5)
    flecha(lz, [d.p('l'), e.p('r')], CIAN, dash='6 4', etiqueta='listo')
    flecha(lz, [e.p('l'), f.p('r')], CIAN, dash='6 4')
    leyenda(lz, 12, 308, ['hoy', 'nuevo', 'persona'], nombres={'persona': 'Trabajo humano'})
    lz.guardar(os.path.join(SALIDA, 'taller_imagen.svg'))


def taller_video():
    lz = Lienzo(800, 500)
    w, g = 160, 38
    xs = [10 + i * (w + g) for i in range(4)]
    titulos = ['Antes de grabar', 'En campo', 'En edición', 'En el ERP']
    for x, t in zip(xs, titulos):
        panel(lz, x - 4, 8, w + 8, 458, t)
    g1 = caja(lz, xs[0], 52, w, 72, 'Guion de 30 a 40 s|gancho · mensaje · cierre', 'nuevo')
    t1 = caja(lz, xs[0], 140, w, 72, 'Lista de tomas|a grabar en campo', 'nuevo')
    r1 = caja(lz, xs[1], 136, w, 80, 'Grabación real|con permiso de|las personas', 'persona')
    e1 = caja(lz, xs[2], 136, w, 80, 'Edición a mano|ritmo · subtítulos|música sin derechos', 'persona')
    v1 = caja(lz, xs[2], 244, w, 72, 'Versiones|16:9 y 9:16', 'persona')
    u1 = caja(lz, xs[3], 244, w, 72, 'Subir el MP4|tipo = video', 'nuevo')
    q1 = caja(lz, xs[3], 336, w, 64, 'Revisión y aprobación', 'hoy')
    p1 = caja(lz, xs[3], 410, w, 46, 'Publicar', 'nuevo')
    flecha(lz, [g1.p('b'), t1.p('t')], CIAN, dash='6 4')
    flecha(lz, [t1.p('r'), r1.p('l', 0.5)], CIAN, dash='6 4')
    flecha(lz, [r1.p('r'), e1.p('l')], MEDIO)
    flecha(lz, [e1.p('b'), v1.p('t')], MEDIO)
    flecha(lz, [v1.p('r'), u1.p('l')], CIAN, dash='6 4')
    flecha(lz, [u1.p('b'), q1.p('t')], CIAN, dash='6 4')
    flecha(lz, [q1.p('b'), p1.p('t')], CIAN, dash='6 4')
    leyenda(lz, 12, 482, ['nuevo', 'hoy', 'persona'], nombres={'persona': 'Trabajo humano'})
    lz.guardar(os.path.join(SALIDA, 'taller_video.svg'))


def pipeline_metricas():
    lz = Lienzo(1000, 360)
    panel(lz, 8, 24, 205, 270, 'Fuentes')
    f1 = caja(lz, 20, 54, 181, 66, 'LinkedIn · Meta · TikTok|exportación o API', 'externo')
    f2 = caja(lz, 20, 134, 181, 66, 'Sitio web|visitas con UTM', 'externo')
    f3 = caja(lz, 20, 214, 181, 66, 'ERP|origen de cada consulta', 'hoy')
    cap = caja(lz, 246, 110, 128, 90, 'Captura|semanal a mano,|luego automática', 'nuevo')
    db = caja(lz, 404, 110, 142, 90, 'Firestore|por pieza, por red|y por consulta', 'nuevo')
    pa = caja(lz, 580, 64, 128, 66, 'Panel|en el ERP', 'nuevo')
    inf = caja(lz, 580, 178, 128, 66, 'Informe|mensual', 'nuevo')
    pro = caja(lz, 742, 178, 130, 66, 'Propuesta de ajustes|temas · formatos', 'nuevo')
    dec = caja(lz, 892, 178, 100, 66, 'Decide|el aprobador', 'persona')
    for f in (f1, f2, f3):
        flecha(lz, [f.p('r'), cap.p('l')], GRIS, curva=True)
    flecha(lz, [cap.p('r'), db.p('l')], CIAN, dash='6 4')
    flecha(lz, [db.p('r', 0.3), pa.p('l')], CIAN, dash='6 4', curva=True)
    flecha(lz, [db.p('r', 0.7), inf.p('l')], CIAN, dash='6 4', curva=True)
    flecha(lz, [inf.p('r'), pro.p('l')], CIAN, dash='6 4')
    flecha(lz, [pro.p('r'), dec.p('l')], CIAN, dash='6 4')
    flecha(lz, [dec.p('b'), (dec.p('b')[0], 322), (cap.p('b')[0], 322), cap.p('b')], GRIS, dash='4 3', etiqueta='ajusta qué se mide y qué se publica', ep=0.5, r=8)
    leyenda(lz, 12, 340, ['hoy', 'nuevo', 'persona', 'externo'])
    lz.guardar(os.path.join(SALIDA, 'pipeline_metricas.svg'))


def kpis():
    lz = Lienzo(1000, 600)
    grupos = [
        ('Negocio', AZUL, [('Consultas desde redes', 'campo origen en clientes'), ('Cotizaciones con origen redes', 'cotizaciones del ERP'), ('Ventas ganadas con origen redes', 'cotizaciones ganadas')]),
        ('Audiencia', MEDIO, [('Seguidores netos', 'panel de cada red'), ('Alcance e impresiones', 'panel de cada red'), ('Tasa de interacción', 'interacciones ÷ alcance'), ('Clics al sitio', 'enlaces con UTM')]),
        ('Contenido', CIAN, [('Rendimiento por formato', 'métricas por pieza'), ('Rendimiento por tema', 'métricas por pieza'), ('Mejores y peores 3 piezas', 'métricas a 28 días')]),
        ('Proceso', INDIGO, [('Piezas por mes', 'estado publicada'), ('Horas por pieza', 'registro del editor'), ('De la idea a publicada', 'fechas del historial'), ('% aprobadas sin edición', 'revisión = 1'), ('Costo por pieza', 'horas + herramientas')]),
    ]
    texto(lz, 456, 18, 'INDICADOR', 10.5, '#7a8a97', True, 'start', 4, 'letter-spacing="1.2"')
    texto(lz, 756, 18, 'DE DÓNDE SALE EL DATO', 10.5, '#7a8a97', True, 'start', 4, 'letter-spacing="1.2"')
    y = 30
    centros = []
    ch, gap = 30, 5
    for nombre, color, hojas in grupos:
        alto = len(hojas) * (ch + gap) - gap
        gy = y + alto / 2 - 26
        lz.add('<rect x="206" y="%.1f" width="150" height="52" rx="12" fill="%s" filter="url(#sh)"/>' % (gy, color), 3)
        texto(lz, 281, gy + 31, nombre, 16, '#ffffff', True)
        centros.append((gy + 26, color))
        for i, (t, fuente) in enumerate(hojas):
            yy = y + i * (ch + gap)
            lz.add('<rect x="396" y="%.1f" width="300" height="%d" rx="9" fill="#ffffff" stroke="%s" stroke-width="1.6" stroke-dasharray="7 4"/>' % (yy, ch, color), 3)
            texto(lz, 410, yy + 19.8, t, 13.5, TINTA, True, 'start')
            texto(lz, 756, yy + 19.8, fuente, 12.5, '#46525d', False, 'start')
            flecha(lz, [(356, gy + 26), (376, gy + 26), (376, yy + ch / 2), (396, yy + ch / 2)], color, r=8, ancho=1.4, sin_punta=True)
        y += alto + 16
    lz.add('<rect x="12" y="%.1f" width="150" height="80" rx="14" fill="%s" filter="url(#sh)"/>' % (303 - 40, AZUL), 3)
    texto(lz, 87, 296, 'Aporte', 17, '#ffffff', True)
    texto(lz, 87, 318, 'del proyecto', 17, '#ffffff', True)
    for (cy, color) in centros:
        flecha(lz, [(162, 303), (184, 303), (184, cy), (206, cy)], color, r=10, ancho=1.6, sin_punta=True)
    lz.guardar(os.path.join(SALIDA, 'kpis.svg'))


if __name__ == '__main__':
    for f in (rutas_produccion, flujo_hoy, flujo_objetivo, pipeline_workflow, estados, revision_checklist, taller_imagen, taller_video, pipeline_metricas, kpis):
        f()
