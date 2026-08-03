import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { FiEdit2, FiTrash2, FiPlus, FiX, FiSearch, FiMessageCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useClientes } from '../hooks/useClientes';
import { abrirWhatsApp } from '../utils/whatsapp';
import { esCelularValido, sanitizarTexto, contienePatronPeligroso } from '../utils/validation';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import Paginacion from '../components/Paginacion';
import Loading from '../components/Loading';
import '../styles/shared.css';
import './Clientes.css';

const CONTACTO_VACIO = { nombre: '', celular: '', email: '' };

const FORMULARIO_VACIO = {
  razonSocial: '',
  ruc: '',
  direccion: '',
  contactos: [{ ...CONTACTO_VACIO }]
};

export default function Clientes() {
  const { clientes, loading, addCliente, editCliente, removeCliente } = useClientes();
  const navigate = useNavigate();

  const [mostrarModal, setMostrarModal] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [eliminarId, setEliminarId] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  // Estado del modal de envío rápido de WhatsApp
  const [modalWhatsapp, setModalWhatsapp] = useState(null);
  const [textoWhatsapp, setTextoWhatsapp] = useState('');
  const [errorWhatsapp, setErrorWhatsapp] = useState(null);

  const [terminoBusqueda, setTerminoBusqueda] = useState('');
  const [orden, setOrden] = useState('asc');
  const [guardando, setGuardando] = useState(false);
  const [contactos, setContactos] = useState([{ ...CONTACTO_VACIO }]);

  const [paginaActual, setPaginaActual] = useState(1);
  const [porPagina, setPorPagina] = useState(10);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({ defaultValues: FORMULARIO_VACIO });

  function mostrarMensaje(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 5000);
  }

  const clientesFiltrados = useMemo(() => {
    return clientes
      .filter((c) => {
        const term = terminoBusqueda.toLowerCase();
        const nombresContactos = (c.contactos || []).map(ct => ct.nombre?.toLowerCase()).join(' ');
        return (
          c.razonSocial?.toLowerCase().includes(term) ||
          c.ruc?.toLowerCase().includes(term) ||
          nombresContactos.includes(term)
        );
      })
      .sort((a, b) => {
        if (orden === 'asc' || orden === 'desc') {
          const nameA = a.razonSocial?.toLowerCase() || '';
          const nameB = b.razonSocial?.toLowerCase() || '';
          return orden === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
        }
        if (orden === 'recent' || orden === 'oldest') {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return orden === 'recent' ? dateB - dateA : dateA - dateB;
        }
        return 0;
      });
  }, [clientes, terminoBusqueda, orden]);

  const clientesPaginados = useMemo(() => {
    const inicio = (paginaActual - 1) * porPagina;
    return clientesFiltrados.slice(inicio, inicio + porPagina);
  }, [clientesFiltrados, paginaActual, porPagina]);

  function alCambiarBusqueda(valor) {
    setTerminoBusqueda(valor);
    setPaginaActual(1);
  }

  function alCambiarOrden(valor) {
    setOrden(valor);
    setPaginaActual(1);
  }

  function nuevoCliente() {
    setEditandoId(null);
    reset({ razonSocial: '', ruc: '', direccion: '' });
    setContactos([{ ...CONTACTO_VACIO }]);
    setMostrarModal(true);
  }

  function editarCliente(cliente) {
    setEditandoId(cliente.id);
    reset({
      razonSocial: cliente.razonSocial || '',
      ruc: cliente.ruc || '',
      direccion: cliente.direccion || ''
    });
    // Carga los contactos del cliente (soporta array o formato legacy)
    if (cliente.contactos && cliente.contactos.length > 0) {
      setContactos(cliente.contactos.map(c => ({ ...c })));
    } else {
      setContactos([{
        nombre: cliente.contacto || '',
        celular: cliente.telefono || cliente.celular || '',
        email: cliente.email || ''
      }]);
    }
    setMostrarModal(true);
  }

  function solicitarEliminar(id) {
    setEliminarId(id);
    setMostrarConfirm(true);
  }

  function agregarContacto() {
    setContactos([...contactos, { ...CONTACTO_VACIO }]);
  }

  function quitarContacto(index) {
    if (contactos.length <= 1) return;
    setContactos(contactos.filter((_, i) => i !== index));
  }

  function cambiarContacto(index, campo, valor) {
    const actualizado = [...contactos];
    // Sanitización en vivo para evitar caracteres peligrosos
    const valorLimpio = sanitizarTexto(valor, campo === 'celular' ? 20 : 120);
    actualizado[index] = { ...actualizado[index], [campo]: valorLimpio };
    setContactos(actualizado);
  }

  // ── WhatsApp rápido desde la tabla ──
  function abrirWhatsappRapido(cliente, contacto) {
    if (!contacto?.celular) {
      mostrarMensaje('error', 'Este contacto no tiene celular configurado');
      return;
    }
    if (!esCelularValido(contacto.celular)) {
      mostrarMensaje('error', `Celular inválido para ${contacto.nombre || cliente.razonSocial}: ${contacto.celular}`);
      return;
    }
    setModalWhatsapp({ cliente, contacto });
    setTextoWhatsapp(`Hola ${contacto.nombre || ''}, le contacto de parte de NOOVA S.A.C.`);
    setErrorWhatsapp(null);
  }

  function cerrarWhatsappRapido() {
    setModalWhatsapp(null);
    setTextoWhatsapp('');
    setErrorWhatsapp(null);
  }

  function enviarWhatsappRapido() {
    if (!modalWhatsapp) return;
    const txt = textoWhatsapp.trim();
    if (!txt) {
      setErrorWhatsapp('El mensaje no puede estar vacío');
      return;
    }
    if (contienePatronPeligroso(txt)) {
      setErrorWhatsapp('El mensaje contiene contenido no permitido');
      return;
    }
    if (txt.length > 4000) {
      setErrorWhatsapp('El mensaje excede el límite de 4000 caracteres');
      return;
    }
    const resultado = abrirWhatsApp(modalWhatsapp.contacto.celular, txt);
    if (!resultado.ok) {
      setErrorWhatsapp(resultado.error || 'No se pudo abrir WhatsApp');
      return;
    }
    mostrarMensaje('success', `WhatsApp abierto para ${modalWhatsapp.contacto.nombre || modalWhatsapp.cliente.razonSocial}`);
    cerrarWhatsappRapido();
  }

  // ── Envío a la página completa de mensajería ──
  function irAMensajeria() {
    navigate('/mensajeria');
  }

  async function alEnviar(data) {
    setGuardando(true);
    try {
      // Validación reforzada de contactos
      const contactosValidados = contactos
        .filter(c => c.nombre.trim() || c.email.trim() || c.celular.trim())
        .map(c => ({
          nombre: sanitizarTexto(c.nombre, 100),
          celular: sanitizarTexto(c.celular, 20),
          email: sanitizarTexto(c.email, 120).toLowerCase()
        }));

      // Validar emails y celulares
      for (const c of contactosValidados) {
        if (c.email && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(c.email)) {
          mostrarMensaje('error', `Email inválido: ${c.email}`);
          setGuardando(false);
          return;
        }
        if (c.celular && !esCelularValido(c.celular)) {
          mostrarMensaje('error', `Celular inválido: ${c.celular}. Use formato peruano 9XXXXXXXX o +51 9XXXXXXXX`);
          setGuardando(false);
          return;
        }
      }

      // Sanitizar datos del cliente
      const razonSocialLimpia = sanitizarTexto(data.razonSocial, 150);
      const rucLimpio = sanitizarTexto(data.ruc, 11);
      const direccionLimpia = sanitizarTexto(data.direccion, 200);

      if (contienePatronPeligroso(razonSocialLimpia) || contienePatronPeligroso(direccionLimpia)) {
        mostrarMensaje('error', 'Se detectó contenido no permitido en los campos');
        setGuardando(false);
        return;
      }

      const clienteData = {
        razonSocial: razonSocialLimpia,
        ruc: rucLimpio,
        direccion: direccionLimpia,
        contactos: contactosValidados,
        contacto: contactosValidados[0]?.nombre || '',
        telefono: contactosValidados[0]?.celular || '',
        email: contactosValidados[0]?.email || ''
      };

      if (editandoId) {
        await editCliente(editandoId, clienteData);
      } else {
        await addCliente(clienteData);
      }
      setMostrarModal(false);
      reset({ razonSocial: '', ruc: '', direccion: '' });
      setContactos([{ ...CONTACTO_VACIO }]);
    } catch (err) {
      console.error('Error guardando cliente:', err);
      mostrarMensaje('error', 'Error al guardar cliente: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    try {
      await removeCliente(eliminarId);
      setMostrarConfirm(false);
      setEliminarId(null);
    } catch (err) {
      console.error('Error eliminando cliente:', err);
      mostrarMensaje('error', 'Error al eliminar cliente: ' + err.message);
    }
  }

  if (loading) return <Loading message="Cargando clientes..." />;

  return (
    <div className="pagina">
      <div className="pagina-header">
        <div>
          <h1 className="pagina-titulo">Clientes</h1>
          <p className="pagina-subtitle">Gestión de clientes y contactos clave • {clientes.length} registrados</p>
        </div>
        <button className="btn-principal" onClick={nuevoCliente}>
          <FiPlus size={16} /> Nuevo Cliente
        </button>
      </div>

      {mensaje && (
        <div className={`mensaje-flash mensaje-${mensaje.tipo}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="filtros-barra">
        <div className="barra-busqueda">
          <FiSearch className="icono-busqueda" size={18} />
          <input
            type="text"
            placeholder="Buscar por razón social, RUC o contacto..."
            value={terminoBusqueda}
            onChange={(e) => alCambiarBusqueda(e.target.value)}
          />
        </div>
        <select
          className="selector-orden"
          value={orden}
          onChange={(e) => alCambiarOrden(e.target.value)}
        >
          <option value="asc">A-Z</option>
          <option value="desc">Z-A</option>
          <option value="recent">Más recientes</option>
          <option value="oldest">Más antiguos</option>
        </select>
      </div>

      <div className="tarjeta-tabla">
        {clientesFiltrados.length === 0 ? (
          <div className="estado-vacio">
            <p>No se encontraron clientes</p>
            {terminoBusqueda && <p className="pista">Intente con otro término de búsqueda</p>}
          </div>
        ) : (
          <>
            <Paginacion
              total={clientesFiltrados.length}
              paginaActual={paginaActual}
              porPagina={porPagina}
              onCambiarPagina={setPaginaActual}
              onCambiarPorPagina={setPorPagina}
            />
            <div className="tabla-contenedor">
              <table className="tabla-datos">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>RUC</th>
                    <th>Contactos</th>
                    <th>Dirección</th>
                    <th className="texto-centro">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {clientesPaginados.map((c) => {
                    const contactosLista = c.contactos && c.contactos.length > 0
                      ? c.contactos
                      : (c.contacto || c.email ? [{
                          nombre: c.contacto || '',
                          celular: c.telefono || c.celular || '',
                          email: c.email || ''
                        }] : []);

                    return (
                      <tr key={c.id}>
                        <td className="texto-negrita">{c.razonSocial}</td>
                        <td className="texto-codigo">{c.ruc}</td>
                        <td>
                          <div className="contactos-celda">
                            {contactosLista.map((ct, idx) => (
                              <div key={idx} className="contacto-item">
                                <span className="contacto-nombre">{ct.nombre || '-'}</span>
                                {ct.celular && <span className="contacto-dato">{ct.celular}</span>}
                                {ct.email && <span className="contacto-dato">{ct.email}</span>}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="texto-truncado">{c.direccion || '-'}</td>
                        <td className="texto-centro">
                          <div className="acciones-tabla">
                            {contactosLista.filter(ct => ct.celular && esCelularValido(ct.celular)).length > 0 && (
                              <button
                                className="btn-accion btn-wsp"
                                onClick={() => abrirWhatsappRapido(
                                  c,
                                  contactosLista.find(ct => ct.celular && esCelularValido(ct.celular))
                                )}
                                title="Enviar WhatsApp"
                              >
                                <FiMessageCircle size={16} />
                              </button>
                            )}
                            <button className="btn-accion" onClick={() => editarCliente(c)} title="Editar">
                              <FiEdit2 size={16} />
                            </button>
                            <button className="btn-accion btn-eliminar" onClick={() => solicitarEliminar(c.id)} title="Eliminar">
                              <FiTrash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Modal
        isOpen={mostrarModal}
        onClose={() => setMostrarModal(false)}
        title={editandoId ? 'Editar Cliente' : 'Nuevo Cliente'}
      >
        <form onSubmit={handleSubmit(alEnviar)} className="formulario">
          <div className="campo">
            <label>Cliente *</label>
            <input
              {...register('razonSocial', { required: 'La razón social es requerida' })}
              className={errors.razonSocial ? 'input-error' : ''}
              placeholder="Ingrese razón social / nombre de la empresa"
            />
            {errors.razonSocial && <span className="mensaje-error">{errors.razonSocial.message}</span>}
          </div>

          <div className="fila-form">
            <div className="campo">
              <label>RUC *</label>
              <input
                {...register('ruc', {
                  required: 'El RUC es requerido',
                  pattern: { value: /^[0-9]{11}$/, message: 'El RUC debe tener 11 dígitos' }
                })}
                className={errors.ruc ? 'input-error' : ''}
                placeholder="20201234567"
                maxLength={11}
              />
              {errors.ruc && <span className="mensaje-error">{errors.ruc.message}</span>}
            </div>
            <div className="campo">
              <label>Dirección</label>
              <input {...register('direccion')} placeholder="Dirección del cliente" />
            </div>
          </div>

          <div className="contactos-seccion">
            <div className="contactos-header">
              <label className="contactos-label">Contacto(s) / Cliente(s)</label>
              <button type="button" className="btn-secundario btn-pequeno" onClick={agregarContacto}>
                <FiPlus size={14} /> Añadir
              </button>
            </div>
            {contactos.map((ct, index) => (
              <div key={index} className="contacto-fila">
                <div className="campo">
                  <label>Nombre</label>
                  <input
                    type="text"
                    value={ct.nombre}
                    onChange={(e) => cambiarContacto(index, 'nombre', e.target.value)}
                    placeholder="Nombre del contacto"
                  />
                </div>
                <div className="campo">
                  <label>Celular</label>
                  <input
                    type="text"
                    value={ct.celular}
                    onChange={(e) => cambiarContacto(index, 'celular', e.target.value)}
                    placeholder="+51 999 999 999"
                  />
                </div>
                <div className="campo">
                  <label>Email</label>
                  <input
                    type="email"
                    value={ct.email}
                    onChange={(e) => cambiarContacto(index, 'email', e.target.value)}
                    placeholder="correo@empresa.com"
                  />
                </div>
                {contactos.length > 1 && (
                  <button
                    type="button"
                    className="btn-quitar-contacto"
                    onClick={() => quitarContacto(index)}
                    title="Eliminar contacto"
                  >
                    <FiX size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="acciones-form">
            <button type="button" className="btn-secundario" onClick={() => setMostrarModal(false)}>
              Cancelar
            </button>
            <button type="submit" className="btn-principal" disabled={guardando}>
              {guardando ? 'Guardando...' : editandoId ? 'Actualizar' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={mostrarConfirm}
        onClose={() => setMostrarConfirm(false)}
        onConfirm={confirmarEliminar}
        title="¿Eliminar cliente?"
        message="Esta acción eliminará el cliente permanentemente. ¿Está seguro?"
      />

      {/* Modal de envío rápido de WhatsApp */}
      <Modal
        isOpen={!!modalWhatsapp}
        onClose={cerrarWhatsappRapido}
        title="Enviar WhatsApp"
        size="small"
      >
        {modalWhatsapp && (
          <div className="formulario">
            <div className="wsp-destino-info">
              <div className="wsp-destino-fila">
                <span className="wsp-destino-label">Cliente:</span>
                <span className="wsp-destino-valor">{modalWhatsapp.cliente.razonSocial}</span>
              </div>
              <div className="wsp-destino-fila">
                <span className="wsp-destino-label">Contacto:</span>
                <span className="wsp-destino-valor">{modalWhatsapp.contacto.nombre || 'Sin nombre'}</span>
              </div>
              <div className="wsp-destino-fila">
                <span className="wsp-destino-label">Número:</span>
                <span className="wsp-destino-valor wsp-numero">{modalWhatsapp.contacto.celular}</span>
              </div>
            </div>

            <div className="campo">
              <label>Mensaje</label>
              <textarea
                className="wsp-textarea"
                value={textoWhatsapp}
                onChange={(e) => {
                  setTextoWhatsapp(e.target.value.slice(0, 4000));
                  setErrorWhatsapp(null);
                }}
                placeholder="Escriba aquí el mensaje..."
                rows={5}
                maxLength={4000}
              />
              <span className="pista-form">{textoWhatsapp.length} / 4000 caracteres</span>
            </div>

            {errorWhatsapp && (
              <div className="mensaje-flash mensaje-error" style={{ display: 'block', padding: '0.5rem 0.75rem', fontSize: '0.8rem' }}>
                {errorWhatsapp}
              </div>
            )}

            <div className="acciones-form">
              <button type="button" className="btn-secundario" onClick={cerrarWhatsappRapido}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn-principal btn-enviar-whatsapp"
                onClick={enviarWhatsappRapido}
                disabled={!textoWhatsapp.trim()}
              >
                <FiMessageCircle size={16} /> Abrir WhatsApp
              </button>
            </div>

            <p className="pista-form">
              ¿Necesita más opciones? Use la sección de <button type="button" className="btn-enlace" onClick={() => { cerrarWhatsappRapido(); irAMensajeria(); }}>Mensajería</button> para plantillas e historial.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
