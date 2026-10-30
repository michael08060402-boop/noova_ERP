"""Modelo de datos en Firestore + exporta los conteos de los mapas."""
import os, json
from kit import *
from dib3 import clase, RAMAS, SALIDA

AQUI = os.path.dirname(__file__)


def datos_firestore():
    lz = Lienzo(1000, 660)
    campos = ['id  (id del archivo en SharePoint)', 'estado', 'red · formato · tema', 'titulo', 'texto · hashtags', 'revision', 'origen  (generado | manual)',
              'disenoId  (plantilla usada)', 'archivoId · jsonEtag', 'fechaProgramada', 'programacion { herramienta, idExterno }', 'urlPublicada', 'aprobadoEn · aprobadoPor']
    main = clase(lz, 20, 40, 340, 'marketingPublicaciones / {id}', campos, (), 'nuevo')
    obs = clase(lz, 430, 40, 250, 'observaciones / {solicitudId}', ['texto', 'usuarioUid · usuarioNombre', 'fecha'], (), 'hoy')
    his = clase(lz, 430, 170, 250, 'historial / {id}', ['accion  (aprobar, devolver, editar…)', 'usuarioUid · revision', 'textoFinal · fecha'], (), 'nuevo')
    met = clase(lz, 430, 300, 250, 'metricas / {1d | 7d | 28d}', ['alcance · impresiones', 'interacciones · clics', 'guardados · compartidos', 'capturadaEn'], (), 'nuevo')
    dis = clase(lz, 20, 335, 340, 'marketingDisenos / {id}', ['nombre · familia · formato', 'origen  (propio | marketing | referencia)', 'estado  (activa | en prueba | descansa)', 'archivoOriginal · plantillaHtml', 'permisoDeUso · rendimiento'], (), 'nuevo')
    mon = clase(lz, 20, 490, 340, 'marketingMonitoreo / {id}', ['tipo  (cuenta | novedad | estudio)', 'red · nombre · enlace', 'fecha · resumen', 'requiereRespuesta · atendidaPor'], (), 'nuevo')
    con = clase(lz, 740, 40, 245, 'marketingConsultas / {id}', ['origen · fecha', 'publicacionId · cotizacionId', 'resultado'], (), 'nuevo')
    inf = clase(lz, 740, 170, 245, 'marketingInformes / {AAAA-MM}', ['resumen', 'aprendizajes[]', 'piezasDestacadas[]'], (), 'nuevo')
    red = clase(lz, 740, 300, 245, 'marketingRedes / {red_AAAA-MM-DD}', ['seguidores', 'alcance · visitasPerfil', 'clicsAlSitio'], (), 'nuevo')
    est = clase(lz, 740, 430, 245, 'marketingEstudios / {AAAA-semana}', ['fuentes consultadas', 'qué funciona en minería', 'cómo redactar · formatos'], (), 'nuevo')
    cfg = clase(lz, 740, 560, 245, 'marketingConfig / catalogo', ['redes · formatos · temas', 'opciones permitidas por red'], (), 'nuevo')
    for sub, ys in ((obs, 100), (his, 175), (met, 250)):
        flecha(lz, [(360, ys), (395, ys), (395, sub.y + 40), (sub.x, sub.y + 40)], AZUL, ancho=1.5, etiqueta='subcolección' if sub is his else None, r=8)
    flecha(lz, [main.p('b', 0.5), dis.p('t', 0.5)], GRIS, dash='5 4', etiqueta='usa un diseño', ep=0.5)
    texto(lz, 20, 25, 'COLECCIONES DE FIRESTORE', 10.5, '#7a8a97', True, 'start', 5, 'letter-spacing="1.2"')
    leyenda(lz, 20, 636, ['hoy', 'nuevo'], nombres={'hoy': 'Existe hoy', 'nuevo': 'Por construir'})
    lz.guardar(os.path.join(SALIDA, 'datos_firestore.svg'))


def exportar_mapas():
    tot = {'e': 0, 'p': 0, 'f': 0}
    ramas = []
    for nombre, color, hojas in RAMAS:
        c = {'e': 0, 'p': 0, 'f': 0}
        for _, h, _ in hojas:
            c[h] += 1
            tot[h] += 1
        ramas.append({'nombre': nombre, 'color': color, **c, 'total': len(hojas)})
    json.dump({'total': tot, 'n': sum(tot.values()), 'ramas': ramas}, open(os.path.join(AQUI, 'mapas.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':
    datos_firestore()
    exportar_mapas()
