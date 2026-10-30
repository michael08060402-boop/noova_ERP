import { useMemo } from 'react';
import { FiArrowDownRight, FiArrowUpRight, FiClock, FiPlus, FiRefreshCw } from 'react-icons/fi';
import {
  Chart as ChartJS, ArcElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip
} from 'chart.js';
import { Doughnut, Line } from 'react-chartjs-2';
import { formatDate } from '../../../utils/formatDate';
import { REDES_MONITOREO, getRedMonitoreo } from '../components/redesSociales';
import { FECHA_BASE, FECHA_META, calcularVariacion, formatearNumero, metaEsperada } from '../utils/metricasRedes';
import { sumarDias } from '../utils/calendario';
import {
  PERIODOS, audienciaPorRed, avanceHaciaMeta, borradoresParaRevisar, cuentasDeRed, fechasDelEje, haceCuanto,
  proximasPublicaciones, resumenPiezas, serieIndice, totales, trayectoriaEsperada, valorActual
} from '../utils/tablero';

ChartJS.register(ArcElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

// Cada cuenta se distingue por color; las dos de LinkedIn comparten el azul de la red y se separan por tono y trazo.
const COLOR_CUENTA = {
  'linkedin-perfil': '#0a66c2', 'linkedin-empresa': '#1e3a8a', facebook: '#0d9488', instagram: '#c13584', tiktok: '#111827', youtube: '#d92d20'
};
const COLOR_TOTAL = '#e08a00';
const COLOR_META = '#8a97a3';

const nombreCorto = (cuenta) => (cuenta.red === 'linkedin'
  ? `LinkedIn · ${cuenta.id === 'linkedin-perfil' ? 'perfil' : 'página'}`
  : getRedMonitoreo(cuenta.red).label);

// Cómo se lee cada cuenta: la conexión automática puede estar al día, pendiente, no existir o fallar.
const CONEXION = {
  ok: ['Automático', 'ok'],
  pendiente: ['Pendiente', 'pendiente'],
  sin_api: ['Sin API', 'sin'],
  error: ['Error', 'error']
};

const signo = (n) => `${n > 0 ? '+' : ''}${n.toLocaleString('es-PE')}`;

function Delta({ cambio, porcentaje }) {
  if (cambio === 0) return null;
  const sube = cambio > 0;
  const Flecha = sube ? FiArrowUpRight : FiArrowDownRight;
  return (
    <span className={`mk-delta ${sube ? 'mk-delta-sube' : 'mk-delta-baja'}`}>
      <Flecha size={14} /> {sube ? '+' : '−'}{formatearNumero(Math.abs(cambio))} · {Math.abs(porcentaje).toLocaleString('es-PE')} %
    </span>
  );
}

function Anillo({ porcentaje }) {
  const radio = 30;
  const largo = 2 * Math.PI * radio;
  return (
    <svg className="mk-anillo" viewBox="0 0 76 76" role="img" aria-label={`${porcentaje} % de avance`}>
      <circle cx="38" cy="38" r={radio} fill="none" stroke="rgb(7 155 181 / 18%)" strokeWidth="8" />
      <circle
        cx="38" cy="38" r={radio} fill="none" stroke="#079bb5" strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${(porcentaje / 100) * largo} ${largo}`} transform="rotate(-90 38 38)"
      />
      <text x="38" y="43" textAnchor="middle" className="mk-anillo-texto">{porcentaje} %</text>
    </svg>
  );
}

function Mosaico({ titulo, children, className = '' }) {
  return (
    <section className={`mk-mosaico ${className}`}>
      <h3 className="mk-mosaico-titulo">{titulo}</h3>
      {children}
    </section>
  );
}

function Indicador({ destacado = false, etiqueta, numero, extra, onClick }) {
  const clase = `mk-kpi ${destacado ? 'mk-kpi-destacado' : ''}`;
  const contenido = (
    <>
      <span className="mk-kpi-cab">{etiqueta}</span>
      <span className="mk-kpi-cuerpo">
        <span className="mk-kpi-datos">
          <span className="mk-kpi-numero">{numero}</span>
          {extra?.pie}
        </span>
        {extra?.grafico}
      </span>
    </>
  );
  return onClick
    ? <button type="button" className={`${clase} mk-kpi-boton`} onClick={onClick}>{contenido}</button>
    : <div className={clase}>{contenido}</div>;
}

function ListaPiezas({ items, ahora, vacio, conMomento = false, onAbrir }) {
  if (items.length === 0) return <p className="mk-lista-vacia">{vacio}</p>;
  return (
    <ul className="mk-lista">
      {items.map((item) => {
        const p = conMomento ? item.publicacion : item;
        const r = getRedMonitoreo(p.red);
        return (
          <li key={p.id}>
            <button type="button" className="mk-lista-item" onClick={() => onAbrir(p)}>
              {p.urlMiniatura ? <img src={p.urlMiniatura} alt="" loading="lazy" /> : <span className="mk-lista-sin" />}
              <span className="mk-lista-texto">
                <b>{p.titulo || p.nombre}</b>
                {conMomento ? (
                  <small className={item.atrasada ? 'mk-atrasada' : ''}>
                    <FiClock size={11} aria-hidden="true" /> {formatDate(item.momento.split(' ')[0])} {item.momento.split(' ')[1]}{item.atrasada ? ' · atrasada' : ''}
                  </small>
                ) : (
                  <small>{haceCuanto(p.fechaModificacion, ahora)}</small>
                )}
              </span>
              {r && <span className="mk-red" style={{ background: r.color }} title={r.label}><r.Icono size={12} aria-hidden="true" /></span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TarjetaCuenta({ cuenta, capturas, conexion }) {
  const red = getRedMonitoreo(cuenta.red);
  const actual = valorActual(capturas, cuenta.id);
  const variacion = calcularVariacion(actual, cuenta.base.seguidores);
  const meta = metaEsperada(cuenta.id);
  const avance = avanceHaciaMeta(actual, cuenta.base.seguidores, meta);
  const [etiqueta, tono] = CONEXION[conexion?.estado] || ['Sin lectura', 'sin'];
  const aviso = conexion && (conexion.estado === 'pendiente' || conexion.estado === 'error') ? conexion.mensaje : '';
  return (
    <article className="mk-cuenta" style={{ '--mk-color-red': COLOR_CUENTA[cuenta.id] }}>
      <red.Icono className="mk-cuenta-marca" size={130} aria-hidden="true" />
      <header className="mk-cuenta-cab">
        <span className="mk-cuenta-icono"><red.Icono size={20} aria-hidden="true" /></span>
        <span className="mk-cuenta-nombre"><b>{nombreCorto(cuenta)}</b><small>{cuenta.nombre.split('·')[1]?.trim()}</small></span>
        <span className={`mk-conexion mk-conexion-${tono}`} title={conexion?.mensaje || undefined}>{etiqueta}</span>
      </header>
      <div className="mk-cuenta-fila">
        <span className="mk-cuenta-cifra">
          <span className="mk-cuenta-numero">{formatearNumero(actual)}</span>
          <small>seguidores</small>
        </span>
        <Delta cambio={variacion.absoluta} porcentaje={variacion.porcentaje} />
      </div>
      <div className="mk-meta" title={`Meta a 30 días: ${formatearNumero(meta)}`}>
        <span className="mk-meta-pista"><span className="mk-meta-barra" style={{ width: `${avance}%` }} /></span>
        <span className="mk-meta-texto"><b>{avance} % de la meta</b><span>{formatearNumero(meta)}</span></span>
      </div>
      {aviso && <small className="mk-cuenta-aviso" title={aviso}>{aviso}</small>}
    </article>
  );
}

// Presentación pura del tablero: recibe los datos ya cargados y avisa lo que el usuario hace.
export default function TableroVista({
  capturas, estado, cargando, error, piezas, cargandoPiezas, hoy, ahora,
  periodo, red, onPeriodo, onRed,
  puedeActualizar, actualizando, avisoActualizar, errorActualizar, onActualizarRedes,
  onGenerar, onVerBorradores, onAbrir
}) {
  const cuentas = useMemo(() => cuentasDeRed(red), [red]);
  const resumen = useMemo(() => totales(capturas, cuentas), [capturas, cuentas]);
  const fechas = useMemo(() => fechasDelEje(capturas, cuentas, periodo, hoy), [capturas, cuentas, periodo, hoy]);
  const conteo = useMemo(() => resumenPiezas(piezas), [piezas]);
  const borradores = useMemo(() => borradoresParaRevisar(piezas, 4), [piezas]);
  const proximas = useMemo(() => proximasPublicaciones(piezas, ahora, 4), [piezas, ahora]);
  const audiencia = useMemo(
    () => audienciaPorRed(capturas, cuentas, Object.fromEntries(REDES_MONITOREO.map((r) => [r.key, r]))),
    [capturas, cuentas]
  );
  const totalAudiencia = audiencia.reduce((suma, r) => suma + r.valor, 0);
  const serieTotal = useMemo(() => serieIndice(capturas, cuentas, fechas, hoy), [capturas, cuentas, fechas, hoy]);
  const cuentasConEstado = estado?.cuentas || {};

  // Eje de tiempo real; la altura es el cambio en % respecto al punto de partida.
  const dia = (fecha) => Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${FECHA_BASE}T12:00:00Z`)) / 86400000);
  const puntos = (valores) => valores
    .map((indice, i) => (indice === null ? null : { x: dia(fechas[i]), y: Math.round((indice - 100) * 10) / 10 }))
    .filter(Boolean);
  const lineas = [
    ...(cuentas.length > 1
      ? cuentas.map((c) => ({
        label: nombreCorto(c), data: puntos(serieIndice(capturas, [c], fechas, hoy)), borderColor: COLOR_CUENTA[c.id], backgroundColor: COLOR_CUENTA[c.id],
        borderWidth: 2, pointRadius: 3, tension: 0.25, borderDash: c.id === 'linkedin-empresa' ? [2, 3] : []
      }))
      : []),
    {
      label: cuentas.length > 1 ? 'Total' : nombreCorto(cuentas[0]), data: puntos(serieTotal), borderColor: COLOR_TOTAL, backgroundColor: 'rgb(224 138 0 / 12%)',
      fill: cuentas.length === 1, borderWidth: 4, pointRadius: 5, pointBackgroundColor: COLOR_TOTAL, tension: 0.25
    },
    { label: 'Meta', data: puntos(trayectoriaEsperada(cuentas, fechas)), borderColor: COLOR_META, borderDash: [8, 6], borderWidth: 2, pointRadius: 0, fill: false }
  ];
  const opcionesLinea = {
    responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { title: (items) => formatDate(sumarDias(FECHA_BASE, items[0].parsed.x)), label: (c) => `${c.dataset.label}: ${signo(c.parsed.y)} %` } }
    },
    scales: {
      y: { suggestedMin: 0, grid: { color: '#eef2f5' }, border: { display: false }, ticks: { maxTicksLimit: 5, callback: (v) => `${signo(v)} %` } },
      x: { type: 'linear', min: 0, max: dia(FECHA_META), grid: { display: false }, ticks: { maxTicksLimit: 5, callback: (v) => formatDate(sumarDias(FECHA_BASE, v)) } }
    }
  };

  const datosAudiencia = {
    labels: audiencia.map((r) => r.label),
    datasets: [{ data: audiencia.map((r) => r.valor), backgroundColor: audiencia.map((r) => r.color), borderWidth: 2, borderColor: '#fff' }]
  };
  const opcionesAudiencia = {
    responsive: true, maintainAspectRatio: false, cutout: '64%',
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 10, boxHeight: 10 } },
      tooltip: { callbacks: { label: (c) => `${c.label}: ${formatearNumero(c.parsed)} (${Math.round((c.parsed / totalAudiencia) * 100)} %)` } }
    }
  };

  const lectura = error ? ['Sin conexión', 'error'] : cargando ? ['Conectando…', 'espera'] : estado?.actualizadoEn ? [`Leído ${haceCuanto(estado.actualizadoEn)}`, 'ok'] : null;

  return (
    <div className="mk-tablero">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Marketing</h1>
          {lectura && <p className={`pagina-subtitle mk-lectura mk-lectura-${lectura[1]}`} role="status"><i aria-hidden="true" /> {lectura[0]}</p>}
        </div>
        <div className="mk-acciones">
          {puedeActualizar && (
            <button type="button" className="btn-secundario" onClick={onActualizarRedes} disabled={actualizando}>
              <FiRefreshCw size={15} className={actualizando ? 'mk-girando' : ''} /> {actualizando ? 'Leyendo…' : 'Actualizar redes'}
            </button>
          )}
          <button type="button" className="btn-principal" onClick={onGenerar}><FiPlus size={15} /> Generar pieza</button>
        </div>
      </div>

      <div className="mk-filtros" role="group" aria-label="Filtros del tablero">
        <div className="mk-segmentos" role="tablist" aria-label="Periodo">
          {PERIODOS.map(({ key, label }) => (
            <button key={key} type="button" role="tab" aria-selected={periodo === key} className="mk-segmento" onClick={() => onPeriodo(key)}>{label}</button>
          ))}
        </div>
        <div className="mk-chips" role="group" aria-label="Red">
          {[{ key: 'todas', label: 'Todas' }, ...REDES_MONITOREO].map(({ key, label, Icono, color }) => (
            <button key={key} type="button" aria-pressed={red === key} className={`mk-chip ${Icono ? '' : 'mk-chip-todas'}`} onClick={() => onRed(key)}>
              {Icono && <span className="mk-red" style={{ background: color }}><Icono size={12} aria-hidden="true" /></span>}
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mk-error" role="alert">{error}</p>}
      {errorActualizar && <p className="mk-error" role="alert">{errorActualizar}</p>}
      {avisoActualizar && <p className="mk-aviso" role="status">{avisoActualizar}</p>}

      <section className="mk-seccion" aria-labelledby="mk-cuentas-titulo">
        <h2 id="mk-cuentas-titulo" className="mk-seccion-titulo">Cuentas</h2>
        <div className="mk-cuentas">
          {cuentas.map((c) => <TarjetaCuenta key={c.id} cuenta={c} capturas={capturas} conexion={cuentasConEstado[c.id]} />)}
        </div>
      </section>

      <section className="mk-seccion" aria-labelledby="mk-resumen-titulo">
        <h2 id="mk-resumen-titulo" className="mk-seccion-titulo">Resumen</h2>
      <div className="mk-kpis">
        <Indicador etiqueta="Seguidores" numero={formatearNumero(resumen.actual)} />
        <Indicador etiqueta="Crecimiento" numero={signo(resumen.cambio)} extra={{ pie: <Delta cambio={resumen.cambio} porcentaje={resumen.porcentaje} /> }} />
        <Indicador etiqueta="Meta" numero={formatearNumero(resumen.meta)} extra={{ grafico: <Anillo porcentaje={resumen.avance} /> }} />
        <Indicador destacado={conteo.borradores > 0} etiqueta="Por revisar" numero={cargandoPiezas ? '…' : conteo.borradores} onClick={onVerBorradores} />
        <Indicador etiqueta="Por publicar" numero={cargandoPiezas ? '…' : conteo.aprobadas} />
        <Indicador etiqueta="Publicadas" numero={cargandoPiezas ? '…' : conteo.publicadas} />
      </div>

      <div className="mk-rejilla">
        <Mosaico titulo="Evolución" className="mk-mosaico-ancho">
          <div className="mk-grafico"><Line data={{ datasets: lineas }} options={opcionesLinea} /></div>
          <ul className="mk-leyenda" aria-label="Leyenda del gráfico">
            {lineas.map((l) => (
              <li key={l.label}>
                <svg width="22" height="8" aria-hidden="true"><line x1="1" y1="4" x2="21" y2="4" stroke={l.borderColor} strokeWidth={Math.min(l.borderWidth, 4)} strokeLinecap="round" strokeDasharray={l.borderDash?.length ? l.borderDash.join(' ') : undefined} /></svg>
                {l.label}
              </li>
            ))}
          </ul>
        </Mosaico>
        <Mosaico titulo="Audiencia">
          <div className="mk-grafico"><Doughnut data={datosAudiencia} options={opcionesAudiencia} /></div>
        </Mosaico>
      </div>

      <div className="mk-rejilla mk-rejilla-dos">
        <Mosaico titulo={`Para revisar${conteo.borradores > 0 ? ` · ${conteo.borradores}` : ''}`}>
          <ListaPiezas items={borradores} ahora={ahora} vacio={cargandoPiezas ? 'Cargando…' : 'Nada por revisar'} onAbrir={onAbrir} />
          {conteo.borradores > borradores.length && <button type="button" className="mk-enlace" onClick={onVerBorradores}>Ver todos</button>}
        </Mosaico>
        <Mosaico titulo={`Próximas a publicar${conteo.aprobadas > 0 ? ` · ${conteo.aprobadas}` : ''}`}>
          <ListaPiezas items={proximas} ahora={ahora} conMomento vacio={cargandoPiezas ? 'Cargando…' : 'Nada programado'} onAbrir={onAbrir} />
        </Mosaico>
      </div>
      </section>
    </div>
  );
}
