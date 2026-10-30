"""Recorta el margen blanco sobrante de cada diagrama (deja 12 px naturales)."""
import glob, os
from PIL import Image, ImageChops

AQUI = os.path.dirname(__file__)
ESCALA = 2.4
PAD = int(12 * ESCALA)
for f in glob.glob(os.path.join(AQUI, 'out', '*.png')):
    nombre = os.path.basename(f)
    if nombre.startswith('portada'):
        continue
    im = Image.open(f).convert('RGB')
    fondo = Image.new('RGB', im.size, (255, 255, 255))
    caja = ImageChops.difference(im, fondo).getbbox()
    if not caja:
        continue
    x0, y0, x1, y1 = caja
    x0, y0 = max(0, x0 - PAD), max(0, y0 - PAD)
    x1, y1 = min(im.size[0], x1 + PAD), min(im.size[1], y1 + PAD)
    im.crop((x0, y0, x1, y1)).save(f, optimize=True)
    print('recortado', nombre, (x1 - x0) / ESCALA, 'x', (y1 - y0) / ESCALA)
