"""Diagramas de contexto y arquitectura."""
import os
from kit import *

SALIDA = os.path.join(os.path.dirname(__file__), 'svg')
os.makedirs(SALIDA, exist_ok=True)


def contexto():
    lz = Lienzo(1000, 565)
    panel(lz, 10, 30, 190, 350, 'Personas')
    nombres = [('Aprobador|gerencia', 'aprueba'), ('Responsable|de marketing', 'pide y revisa'),
               ('Editor creativo|imagen y video a mano', 'sube versiones'), ('TI|mantiene el sistema', 'despliega y vigila')]
    gente = []
    for i, (t, _) in enumerate(nombres):
        gente.append(caja(lz, 22, 62 + i * 78, 166, 56, t, 'persona'))
    core = caja(lz, 330, 160, 172, 112, 'NOOVA MARKETING|ERP · fábrica de piezas|y medición', 'oscuro', 15)
    panel(lz, 570, 30, 215, 430, 'Servicios que usa')
    serv = [caja(lz, 585, 62 + i * 78, 185, 56, t, k) for i, (t, k) in enumerate([
        ('SharePoint|guarda las piezas', 'externo'), ('GitHub Actions|arma las piezas', 'externo'),
        ('Claude|redacta y revisa', 'externo'), ('Buffer o nativas|programan lo aprobado', 'nuevo'), ('Internet y cuentas del sector|se estudian cada semana', 'nuevo')])]
    panel(lz, 830, 30, 162, 350, 'Dónde se publica')
    redes = [caja(lz, 846, 66 + i * 78, 130, 46, t, k) for i, (t, k) in enumerate([
        ('LinkedIn', 'externo'), ('Facebook', 'externo'), ('Instagram', 'externo'), ('TikTok', 'nuevo')])]
    for i, g in enumerate(gente):
        flecha(lz, [g.p('r'), core.p('l', 0.25 + i * 0.17)], MEDIO, etiqueta=nombres[i][1], curva=True, ep=0.5)
    for i, s in enumerate(serv):
        ambos = i in (0, 2)
        if i == 4:
            flecha(lz, [s.p('l'), core.p('r', 0.9)], CIAN, dash='6 4', curva=True)
        else:
            flecha(lz, [core.p('r', 0.1 + i * 0.2), s.p('l')], AZUL if i < 3 else CIAN, dash=None if i < 3 else '6 4', ambos=ambos, curva=True)
    for r in redes:
        flecha(lz, [serv[3].p('r'), r.p('l')], CIAN, dash='6 4', curva=True)
    web = caja(lz, 22, 470, 166, 56, 'Sitio web y correo|llegan las consultas', 'externo')
    cx = core.p('b')[0]
    flecha(lz, [(911, 380), (911, 498), (cx, 498), (cx, 272)], CIAN, dash='6 4', etiqueta='métricas y consultas', ep=0.48)
    flecha(lz, [web.p('r'), (cx, 498)], CIAN, dash='6 4', sin_punta=True)
    leyenda(lz, 22, 540, ['persona', 'externo', 'nuevo'])
    lz.guardar(os.path.join(SALIDA, 'contexto.svg'))


def arquitectura_hoy():
    lz = Lienzo(1000, 520)
    panel(lz, 8, 40, 180, 215, 'Navegador')
    erp = caja(lz, 20, 80, 140, 100, 'ERP React + Vite|grilla · visor|modal Generar', 'hoy')
    panel(lz, 205, 40, 305, 290, 'Firebase · noova-sac')
    fn = caja(lz, 220, 80, 275, 92, 'Cloud Functions · us-central1|listar · generarPieza · actualizarTexto|eliminar · observaciones', 'hoy')
    fs = caja(lz, 220, 200, 105, 66, 'Firestore|solo observaciones', 'hoy')
    sec = caja(lz, 335, 200, 160, 66, 'Secretos|GRAPH_*|MARKETING_GH_TOKEN', 'hoy')
    panel(lz, 575, 40, 255, 290, 'GitHub · cuenta Luanho11')
    wf = caja(lz, 590, 78, 225, 64, 'Workflow generar-pieza|Windows · Python · Chrome', 'hoy')
    cache = caja(lz, 590, 166, 225, 50, 'Caché de Actions|historial de rotación', 'hoy')
    repo = caja(lz, 590, 240, 225, 64, 'Repositorio noova-marketing|skills · conocimiento · plantillas', 'hoy')
    panel(lz, 855, 40, 137, 290, 'Microsoft')
    sp = caja(lz, 866, 78, 115, 226, 'SharePoint|04. MARKETING|BORRADORES IA|FACEBOOK|INSTAGRAM|LINKEDIN|imagen o PDF|+ JSON', 'hoy')
    panel(lz, 575, 370, 417, 120, 'PC del equipo de sistemas')
    cc = caja(lz, 590, 402, 215, 62, 'Claude Code|7 skills noova-* + 18 de terceros', 'hoy')
    hf = caja(lz, 820, 402, 160, 62, 'HyperFrames + FFmpeg|video ejecutivo', 'hoy')
    flecha(lz, [erp.p('r'), fn.p('l')], MEDIO, etiqueta='llama')
    flecha(lz, [fn.p('b', 0.25), fs.p('t', 0.5)], MEDIO)
    flecha(lz, [fn.p('b', 0.8), sec.p('t', 0.5)], GRIS, dash='3 3')
    flecha(lz, [fn.p('r', 0.35), wf.p('l', 0.45)], MEDIO, etiqueta='dispatch')
    flecha(lz, [wf.p('r', 0.4), sp.p('l', 0.1)], MEDIO, etiqueta='sube')
    flecha(lz, [wf.p('b', 0.5), cache.p('t', 0.5)], GRIS, dash='3 3')
    flecha(lz, [cache.p('b', 0.5), repo.p('t', 0.5)], MEDIO)
    flecha(lz, [fn.p('t', 0.8), (440, 20), (969, 20), (969, 78)], AZUL, etiqueta='Graph: lee, edita y borra', ep=0.5)
    flecha(lz, [cc.p('t', 0.5), repo.p('b', 0.5)], MEDIO, etiqueta='git')
    flecha(lz, [cc.p('r'), hf.p('l')], MEDIO)
    leyenda(lz, 22, 494, ['hoy'])
    lz.guardar(os.path.join(SALIDA, 'arquitectura_hoy.svg'))


def arquitectura_objetivo():
    lz = Lienzo(1000, 632)
    panel(lz, 8, 40, 185, 425, 'ERP · navegador')
    ui1 = caja(lz, 20, 78, 161, 62, 'Publicaciones|grilla · visor · notas', 'hoy')
    ui2 = caja(lz, 20, 160, 161, 62, 'Calendario|por red y por semana', 'nuevo')
    ui4 = caja(lz, 20, 270, 161, 62, 'Panel y monitoreo|métricas, comentarios|y cuentas del sector', 'nuevo')
    ui3 = caja(lz, 20, 372, 161, 62, 'Taller y diseños|versión editada, video|y diseños nuevos', 'nuevo')
    panel(lz, 215, 40, 290, 540, 'Firebase')
    fn1 = caja(lz, 230, 78, 250, 62, 'Funciones actuales|listar · generar · texto · eliminar', 'hoy')
    fn2 = caja(lz, 230, 160, 250, 72, 'Funciones nuevas|aprobar · devolver · programar|subir versión · métricas', 'nuevo')
    fs = caja(lz, 230, 262, 250, 72, 'Firestore|publicaciones · historial · métricas|consultas · informes', 'nuevo')
    fn3 = caja(lz, 230, 355, 250, 62, 'Tareas programadas|publicar aprobadas · capturar métricas', 'nuevo')
    sec = caja(lz, 230, 450, 250, 58, 'Secret Manager|Graph · GitHub · tokens de redes', 'hoy')
    panel(lz, 535, 40, 215, 205, 'GitHub · org. de Noova')
    wf = caja(lz, 548, 78, 189, 64, 'Workflow generar-pieza|suma tiktok y folleto', 'hoy')
    repo = caja(lz, 548, 164, 189, 64, 'Repositorio|conocimiento · plantillas|skills · catálogo de diseños', 'hoy')
    panel(lz, 535, 395, 215, 185, 'Puestos de trabajo')
    cc = caja(lz, 548, 432, 189, 62, 'Claude Code|informes, estudio semanal|y propuestas', 'hoy')
    edi = caja(lz, 548, 506, 189, 56, 'Edición a mano|Canva · CapCut · DaVinci', 'persona')
    sp = caja(lz, 790, 78, 190, 64, 'SharePoint|archivos · versiones · JSON', 'hoy')
    panel(lz, 775, 300, 217, 275, 'Publicación')
    bf = caja(lz, 790, 340, 190, 62, 'Buffer o nativas|programan lo aprobado', 'nuevo')
    rs = caja(lz, 790, 452, 190, 70, 'LinkedIn · Facebook|Instagram · TikTok', 'externo')
    flecha(lz, [ui1.p('r'), fn1.p('l')], MEDIO)
    flecha(lz, [ui2.p('r'), (206, 191), fn2.p('l', 0.25)], CIAN, dash='6 4', r=6)
    flecha(lz, [ui4.p('r'), (206, 301), fs.p('l', 0.5)], CIAN, dash='6 4', r=6)
    flecha(lz, [ui3.p('r', 0.4), (206, 387), (206, 213), fn2.p('l', 0.8)], CIAN, dash='6 4', r=6)
    flecha(lz, [fn1.p('r', 0.4), wf.p('l', 0.4)], MEDIO, etiqueta='dispatch')
    flecha(lz, [wf.p('r', 0.5), sp.p('l', 0.5)], MEDIO, etiqueta='sube')
    flecha(lz, [fn1.p('t', 0.5), (360, 20), (960, 20), sp.p('t', 0.9)], AZUL, etiqueta='Graph: lee, edita, guarda versiones', ep=0.5)
    flecha(lz, [fn2.p('b', 0.5), fs.p('t', 0.5)], CIAN, dash='6 4')
    flecha(lz, [fn3.p('t', 0.5), fs.p('b', 0.5)], CIAN, dash='6 4')
    flecha(lz, [fn3.p('r', 0.5), bf.p('l', 0.5)], CIAN, dash='6 4', etiqueta='programa', ep=0.45)
    flecha(lz, [bf.p('b'), rs.p('t')], CIAN, dash='6 4', etiqueta='publica')
    flecha(lz, [wf.p('b'), repo.p('t')], MEDIO)
    flecha(lz, [cc.p('t', 0.85), repo.p('b', 0.85)], MEDIO, etiqueta='git', ep=0.7)
    flecha(lz, [edi.p('l', 0.5), (524, 534), (524, 592), (100, 592), ui3.p('b')], GRIS, dash='3 3', etiqueta='MP4 o PNG editado', ep=0.5, r=8)
    leyenda(lz, 22, 608, ['hoy', 'nuevo', 'persona', 'externo'])
    lz.guardar(os.path.join(SALIDA, 'arquitectura_objetivo.svg'))


if __name__ == '__main__':
    contexto()
    arquitectura_hoy()
    arquitectura_objetivo()
