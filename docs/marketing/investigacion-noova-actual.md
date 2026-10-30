# Noova hoy en redes: investigación y prompt de automatización

Fecha de lectura: **2026-10-30**. Método: lectura pública desde el Chrome del equipo, sin reaccionar, seguir ni comentar. No hay cifras de alcance ni de clics porque eso exige entrar como administrador de cada cuenta.

## 1. Los dos LinkedIn

| | Perfil «Noova (NOOVA S.A.C.) Consulting» | Página «NOOVA SAC - CONSULTORIA Y CONSTRUCCIÓN» |
|---|---|---|
| Dirección | `linkedin.com/in/noova-consulting-970a0a174/` | `linkedin.com/company/noova-sac-consultoria-y-construcción/` (con tilde) |
| Seguidores | **5.308**, más de 500 contactos | **3.700**, 11 a 50 empleados |
| Última publicación | **hace 1 semana** | hace 10 meses |
| Publicaciones vistas | 10 en 6 meses | 3 en 10 meses |
| Conclusión | **Es la cuenta con movimiento. Se toma como principal.** | Detenida |

Lo que publica el perfil activo: auditoría energética con termografía (hace 1 semana), un post de Testo (1 mes), dos convocatorias de personal (1 semana y 1 mes), dos posts del SIVM 2026 en Ayacucho (1 mes, 5 y 24 reacciones), capacitación del Testo 400 a AIRTEC (3 meses), fases de una consultoría de ventilación (4 meses), medición con Testo 400 (5 meses), drenaje o bombeo (6 meses) y servicios de ventilación (6 meses). Reacciones por publicación: de 1 a 24; lo normal es de 2 a 5 con 5.308 seguidores.

Detalles a tener en cuenta:
- Es un **perfil**, no una página. LinkedIn no da estadísticas de alcance de perfiles personales por API: los números de esta cuenta se registran a mano.
- El perfil enlaza al canal de WhatsApp de ventas (`wa.me/51958136491`), que ya funciona como cierre de venta.
- Hay una publicación que usa el nombre de la empresa en una oferta de empleo con link acortado: conviene medir clics con etiquetas propias.

## 2. Las demás cuentas

| Red | Cuenta | Números del 30/10/2026 | Estado |
|---|---|---|---|
| Facebook | NOOVA (`contratistasgeneralesnoovasac`) | 7.600 seguidores, 275 seguidos, 2 opiniones | Con movimiento, sobre todo convocatorias de personal |
| Instagram | `@noova_sac` | 552 seguidores, 389 seguidos, 244 publicaciones | Sin acceso aún |
| TikTok | `@noova.sac` | 1.279 seguidores, 3.320 me gusta, 16 videos | Sin acceso aún. Vistas por video: de 157 a 1.175 |
| YouTube | `@noovas.a.c.831` | 159 suscriptores, 35 videos | Sin acceso aún. Los videos tienen de 2 a 3 años; vistas de 56 a 1.100 |
| **Total** | | **18.598 seguidores** | 16.608 en las tres cuentas con acceso |

Estos números son el punto de partida del módulo de monitoreo del ERP (`src/modules/marketing/utils/metricasRedes.js`).

## 3. Hallazgos que importan

1. **El contenido ya es bueno y técnico, pero se publica poco**: de 1 a 3 veces al mes en la cuenta con más movimiento. El ritmo acordado (LinkedIn 2, Facebook 2, Instagram 3 por semana) multiplica la frecuencia por 3 o 4.
2. **Facebook tiene la audiencia más grande (7.600) y no muestra trabajo técnico**: casi todo son convocatorias. Hay margen para llevar a Facebook versiones cortas de los casos.
3. **TikTok tiene más vistas que seguidores en sus mejores videos** (hasta 1.175 con 1.279 seguidores): el formato corto funciona mejor de lo que parece y es la cuenta con más potencial de crecimiento relativo.
4. **La página de empresa de LinkedIn quedó parada.** Dos cuentas con el mismo nombre dividen la audiencia. Hay que decidir si se reactiva la página o se deja solo el perfil.
5. **Instagram tiene 244 publicaciones y solo 552 seguidores**: mucho contenido, poca audiencia; el problema no es la cantidad sino qué se publica.
6. **Los textos nombran al equipo, ponen teléfonos y correos de personas y usan listas largas con muchos emojis.** Sirven de contraste con la guía de voz actual.

## 4. Crecimiento estimado a 30 días de la versión final

Estimación **propia**, no una medición ni un dato de mercado. Supone publicar al ritmo acordado durante esos 30 días y tener cada cuenta conectada. La versión final está prevista para el 31/12/2026, así que la comparación sería el 31/01/2027.

| Cuenta | Partida | Conservador | **Esperado** | Optimista | Seguidores esperados |
|---|---|---|---|---|---|
| LinkedIn · perfil | 5.308 | +0,8 % | **+2 %** | +4 % | +106 |
| LinkedIn · empresa | 3.700 | +0,3 % | **+1 %** | +2 % | +37 |
| Facebook | 7.600 | +0,3 % | **+1 %** | +2 % | +76 |
| Instagram | 552 | +2 % | **+5 %** | +9 % | +28 |
| TikTok | 1.279 | +3 % | **+8 %** | +15 % | +102 |
| YouTube | 159 | +1 % | **+3 %** | +6 % | +5 |
| **Total con acceso hoy** (3 cuentas) | 16.608 | | **+1,3 %** | | **+219** |
| **Total con las 6 cuentas** | 18.598 | | **+1,9 %** | | **+354** |

Por qué estas cifras:
- **Las cuentas grandes crecen poco en un mes.** Con 5.000 a 7.000 seguidores, un punto porcentual son 50 a 76 personas; en 30 días un cambio de ritmo se nota más en alcance e interacción que en seguidores.
- **Las cuentas chicas suben más en porcentaje** (TikTok, Instagram), pero solo si se publica de forma constante y se tiene acceso.
- **El primer mes tiene retraso**: los algoritmos tardan semanas en premiar un cambio de frecuencia.
- Instagram, TikTok y YouTube solo cuentan si se consigue el acceso antes de la versión final.

Lo que sí se puede esperar con más seguridad que el número de seguidores:
- **Frecuencia en LinkedIn:** de 1 a 3 publicaciones al mes a unas 8.
- **Reacciones por publicación en LinkedIn:** de 2 a 5 hoy; una meta razonable es de 5 a 10 con contenido más corto y visual.
- **Alcance:** no se puede estimar hasta tener las estadísticas de administrador de los primeros 30 días.

Después del primer mes se reemplazan estas estimaciones por datos reales; el módulo de monitoreo muestra cada cuenta contra su meta esperada.

## 5. Cómo se mide en el ERP

Marketing → pestaña **Monitoreo de redes**. Cada captura nueva se guarda en la colección `marketingRedes` (id `cuenta_fecha`) y la pantalla se actualiza en tiempo real. Hoy la captura es manual (formulario «Registrar números») porque las cuentas no tienen API conectada. Cuando se conecte una, una tarea programada puede escribir en la misma colección sin cambiar la pantalla.

## 6. Prompt para automatizar el estudio semanal

Uso: una rutina semanal de Claude Code con el repositorio `noova-marketing` (lunes 07:00, hora de Lima) o una sesión manual. Presupuesto cero: corre con la cuenta de Claude que ya tiene Noova. No usa claves.

```text
Eres el analista de redes de Noova Consulting. Trabaja con el repositorio clonado.

REGLAS (de CLAUDE.md, no se rompen):
- Solo lectura pública. No reacciones, no sigas, no comentes, no escribas mensajes.
- Ningún dato personal de terceros. No copies textos ni diseños ajenos: resume y cita la fuente.
- No inventes cifras. Lo que no puedas leer va como [NO LEÍDO].
- No publiques ni programes nada. Solo creas archivos nuevos en calendario/ y aprendizaje/.

1. NUESTRAS CUENTAS. Lee, con el navegador conectado y solo en modo lectura:
   LinkedIn perfil (linkedin.com/in/noova-consulting-970a0a174), LinkedIn empresa
   (linkedin.com/company/noova-sac-consultoria-y-construcción), Facebook (contratistasgeneralesnoovasac),
   Instagram (@noova_sac), TikTok (@noova.sac), YouTube (@noovas.a.c.831).
   Para cada una anota: seguidores, publicaciones nuevas desde la semana pasada, y las 3 con más reacciones.
   Compara contra aprendizaje/capturas-redes.csv (créalo si no existe: fecha,cuenta,seguidores,nota).
   Agrega una fila por cuenta con la fecha de hoy.

2. EL SECTOR. Busca en la web, de los últimos 7 días, noticias, normas y eventos de minería subterránea
   en Perú y Latinoamérica (ventilación, bombeo y drenaje, seguridad, equipos de medición).
   Registra la fecha real de cada nota; descarta las que no puedas fechar.

3. LO QUE FUNCIONA EN 2026. Mira de 8 a 10 publicaciones recientes de mineras y proveedores del sector
   (lista en conocimiento/competencia-y-referentes.md). Resume en un máximo de 6 líneas:
   formatos con más reacciones, largo de los textos, tipo de dato que usan y qué llamada a la acción.
   Explica cómo redactar para empresas mineras esta semana: tono, estructura y qué evitar.

4. INFORME. Escribe calendario/estudio-AAAA-MM-DD.md con estas secciones, cada una de una página como máximo:
   a) Cifras de la semana (tabla: cuenta, seguidores, cambio, nota).
   b) Qué publicó Noova y cómo le fue.
   c) Noticias del sector con enlace y fecha.
   d) Qué funciona hoy y cómo redactar.
   e) Propuesta para la semana: 3 temas con fuente en conocimiento/afirmaciones-aprobadas.md,
      cada uno con red y formato sugeridos.
   Termina con una lista de los pendientes [POR CONFIRMAR].

5. NO MODIFIQUES conocimiento/, .claude/, docs/ ni assets/. Una persona revisa el informe y carga las cifras
   en el ERP (Marketing, Monitoreo de redes, Registrar números).
```

Límites conocidos: LinkedIn e Instagram piden sesión para mostrar todo, por eso la lectura usa el navegador del equipo; TikTok y Facebook cargan con retraso y a veces hay que repetir la lectura. Si una cuenta no se puede leer, el informe lo dice en lugar de estimar.
