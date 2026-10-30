"""Genera una imagen real de cada variante del catalogo, con contenido de muestra.

Usa las mismas plantillas, hoja de estilos, tipografias y logos que las piezas de verdad, y el mismo
navegador del exportador, asi que la imagen muestra los colores, la tipografia y la composicion finales.
Solo cambian los textos y la foto, que son de muestra. Los carruseles salen como una tira con todas sus laminas.

Uso: python scripts/previsualizar_variantes.py [--salida DIRECTORIO] [--solo ID ...]
Las piezas HTML van a salidas/previsualizaciones/ (ignorado por git); los .webp, a --salida.
"""

from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import exportar_pieza as exportador
import preparar_pieza as prep
import uso_imagenes as uso

RAIZ = Path(__file__).resolve().parents[1]
CARPETA = RAIZ / 'salidas/previsualizaciones'
ANCHO_WEBP = 540
IMPRESAS = {'folleto'}  # sus variantes son para impresion, no se piden desde el ERP

# Texto de muestra: cifras y afirmaciones tomadas de conocimiento/afirmaciones-aprobadas.md.
MUESTRA = {
    'TITULAR': 'Más de 65 proyectos ejecutados',
    'DATO': '65+',
    'CUERPO': 'Más de 65 proyectos ejecutados en minería subterránea.',
    'APERTURA': 'Primero se mide en campo.',
    'TITULAR_2': 'Experiencia documentada en ventilación y bombeo',
    'CIFRA_1': '65+', 'ROTULO_1': 'proyectos ejecutados', 'PREFIJO_1': 'más de',
    'CIFRA_2': '180+', 'ROTULO_2': 'operaciones mineras atendidas', 'PREFIJO_2': 'más de',
    'CIFRA_3': '6', 'ROTULO_3': 'países de Latinoamérica', 'PREFIJO_3': 'en',
    'TITULO_2': 'Se mide en campo', 'CUERPO_2': 'Aforos y mediciones de velocidad y temperatura.',
    'TITULO_3': 'Se calibra el modelo', 'CUERPO_3': 'El modelo 3D se contrasta con lo medido.',
    'TITULO_4': 'Se proyecta', 'CUERPO_4': 'Escenarios a corto, mediano y largo plazo.',
}


# Textos entre corchetes que las plantillas dejan para completar a mano; en la muestra se sustituyen.
TEXTOS_ENTRE_CORCHETES = {
    'Una invitacion concreta': 'Consulte por el alcance de su estudio.',
    'Una actividad de campo documentada': 'Aforos y mediciones en galerías.',
    'Sintesis del metodo y contacto': 'Medir, modelar y proyectar. administracion@noovasac.com',
    'Siguiente fase documentada': 'Modelamiento y calibración.',
    'Metodo documentado': 'Método documentado',
    'Fase real': 'Inspección de campo',
    'Fase real: actividad y entrega': 'Inspección de campo y registro de datos.',
    'Explicar el servicio con fuente': 'Estudio de ventilación con datos de campo.',
    'Evidencia y fuente': 'Datos de campo y modelo 3D calibrado.',
    'Entregables por validar': 'Informe técnico y modelo de simulación.',
    'Entrega real': 'Informe y modelo',
    'Criterio tecnico respaldado': 'Se decide con datos medidos.',
    'Cierre y contacto': 'administracion@noovasac.com',
    'Alcance por validar': 'Ventilación, bombeo y drenaje.',
    'Alcance documentado': 'Minería subterránea',
    'Actividad respaldada': 'Medición en campo',
}


# Algunos diseños están pensados para un titular corto (una palabra, una frase breve).
MUESTRA_POR_VARIANTE = {
    'flyer-foto-palabra': {'TITULAR': 'Medir'},
    'flyer-foto-cifras': {'TITULAR': 'Experiencia en cifras'},
    'flyer-foto-apertura': {'TITULAR': 'Medir primero', 'APERTURA': 'En campo, antes del modelo.', 'TITULAR_2': 'Datos reales para decidir'},
}


def rellenar(plantilla: str, valores: dict[str, str]) -> str:
    for clave, valor in valores.items():
        plantilla = plantilla.replace('{{' + clave + '}}', valor)
    for texto, muestra in TEXTOS_ENTRE_CORCHETES.items():
        plantilla = plantilla.replace(f'[{texto}]', html.escape(muestra))
    pendientes = sorted(set(re.findall(r'\{\{(\w+)\}\}', plantilla)))
    if pendientes:
        raise ValueError(f"La plantilla tiene campos sin resolver: {', '.join(pendientes)}.")
    return plantilla


def fotos_candidatas(catalogo: list[dict]) -> dict[str, list[dict]]:
    """Fotos autorizadas y existentes, de mayor a menor resolucion, por orientacion."""
    por_orientacion: dict[str, list[dict]] = {'horizontal': [], 'vertical': []}
    for ficha in catalogo:
        if not str(ficha.get('autorizacion', '')).startswith('Autorizada'):
            continue
        if ficha.get('categoria') in {'logo', 'qr'} or 'NO USAR' in str(ficha.get('uso', '')).upper():
            continue
        if not (RAIZ / ficha['ruta']).is_file():
            continue
        orientacion = 'vertical' if ficha.get('orientacion') == 'vertical' else 'horizontal'
        por_orientacion[orientacion].append(ficha)
    for lista in por_orientacion.values():
        lista.sort(key=lambda f: -(f.get('ancho', 0) * f.get('alto', 0)))
    return por_orientacion


def valores_para(variante: dict, destino: Path, fotos: dict[str, list[dict]], numero: int) -> dict[str, str]:
    valores = {clave: html.escape(texto) for clave, texto in {**MUESTRA, **MUESTRA_POR_VARIANTE.get(variante['id'], {})}.items()}
    valores['BASE_CSS'] = Path(
        __import__('os').path.relpath(RAIZ / 'plantillas/variantes/base.css', destino.parent)).as_posix()
    valores['LOGO_CLARO'] = prep.logo(destino, False)
    valores['LOGO_OSCURO'] = prep.logo(destino, True)
    orientacion = variante.get('orientacion_preferida', 'horizontal')
    lista = fotos.get(orientacion) or fotos['horizontal'] or fotos['vertical']
    for n in (1, 2):
        ficha = lista[(numero + n - 1) % len(lista)]
        valores[f'FOTO_{n}'] = prep.recurso_imagen(ficha['ruta'], destino, 'foto')
    return valores


def pagina_de_muestra(plantilla: str) -> str:
    """Oculta la marca de borrador: la imagen es una muestra del diseno, no una pieza para publicar."""
    return plantilla.replace('</head>', '<style>.aviso { display: none !important; }</style></head>', 1)


def a_webp(png: Path, destino: Path, laminas: int, ancho: int, alto: int) -> Path:
    from PIL import Image

    with Image.open(png) as imagen:
        imagen = imagen.convert('RGB')
        if laminas > 1:
            # Todas las laminas en una tira, para ver el carrusel completo.
            tira = Image.new('RGB', (ancho * laminas, alto), 'white')
            for i in range(laminas):
                tira.paste(imagen.crop((0, alto * i, ancho, alto * (i + 1))), (ancho * i, 0))
            imagen = tira
        ancho_final = ANCHO_WEBP * (2 if laminas > 1 else 1)
        ancho_final = min(ancho_final, imagen.width)
        imagen = imagen.resize((ancho_final, round(imagen.height * ancho_final / imagen.width)), Image.LANCZOS)
        destino.parent.mkdir(parents=True, exist_ok=True)
        imagen.save(destino, 'WEBP', quality=82, method=6)
    return destino


def generar(variante: dict, numero: int, fotos: dict, salida: Path) -> Path:
    html_ruta = CARPETA / f"{variante['id']}.html"
    CARPETA.mkdir(parents=True, exist_ok=True)
    plantilla = uso.ruta_local(variante['archivo']).read_text(encoding='utf-8')
    html_ruta.write_text(pagina_de_muestra(rellenar(plantilla, valores_para(variante, html_ruta, fotos, numero))), encoding='utf-8')
    ancho, alto, laminas = variante['ancho'], variante['alto'], variante.get('laminas', 1)
    if laminas > 1:
        # Chrome recorta la altura de captura; Edge devuelve la pagina completa.
        png = exportador.exportar(html_ruta, 'png', ancho, alto * laminas, exportador.NAVEGADORES[2:] + exportador.NAVEGADORES[:2])
    else:
        png = exportador.exportar(html_ruta, 'png', ancho, alto)
    return a_webp(png, salida / f"{variante['id']}.webp", laminas, ancho, alto)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--salida', type=Path, default=RAIZ / 'salidas/previsualizaciones/webp')
    parser.add_argument('--solo', nargs='*', help='ids de variantes a generar; sin ellos, todas')
    args = parser.parse_args()
    variantes = [v for v in uso.leer_json(prep.VARIANTES)
                 if v['formato'] not in IMPRESAS and (not args.solo or v['id'] in args.solo)]
    fotos = fotos_candidatas(uso.leer_json(uso.CATALOGO))
    if not (fotos['horizontal'] or fotos['vertical']):
        raise SystemExit('No hay fotos autorizadas disponibles en recursos/.')
    for numero, variante in enumerate(variantes):
        destino = generar(variante, numero, fotos, args.salida)
        print(f"{variante['id']}: {destino} ({destino.stat().st_size // 1024} KB)")


if __name__ == '__main__':
    main()
