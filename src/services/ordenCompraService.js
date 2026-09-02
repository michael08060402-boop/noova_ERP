import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { calcularTotalesOrden, formatearCodigoOrden } from '../utils/ordenCompra';

const COLLECTION_NAME = 'ordenesCompra';

function limpiar(valor, maximo = 300) {
  return String(valor || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').trim().slice(0, maximo);
}

function normalizarItems(items = []) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) {
    throw new Error('La orden debe contener entre 1 y 100 ítems');
  }
  return items.map((item, index) => {
    const cantidad = Number(item.cantidad);
    const precioUnitario = Number(item.precioUnitario);
    const descripcion = limpiar(item.descripcion, 500);
    if (!descripcion || !Number.isFinite(cantidad) || cantidad <= 0 || !Number.isFinite(precioUnitario) || precioUnitario < 0) {
      throw new Error(`El ítem ${index + 1} tiene datos inválidos`);
    }
    return {
      codigo: limpiar(item.codigo, 60),
      descripcion,
      unidadMedida: limpiar(item.unidadMedida || 'UND.', 20),
      cantidad,
      precioUnitario,
      total: Math.round((cantidad * precioUnitario + Number.EPSILON) * 100) / 100
    };
  });
}

function normalizarOrden(data, proveedor) {
  if (!data.fecha || !limpiar(data.formaPago, 120) || !limpiar(data.lugarEntrega, 300)) {
    throw new Error('Fecha, forma de pago y lugar de entrega son requeridos');
  }
  const items = normalizarItems(data.items);
  const totales = calcularTotalesOrden(items, data.aplicaIgv !== false);
  return {
    fecha: limpiar(data.fecha, 10),
    proveedorId: limpiar(data.proveedorId, 150),
    proveedor: {
      razonSocial: limpiar(proveedor.razonSocial, 180),
      ruc: limpiar(proveedor.ruc, 20),
      contacto: limpiar(proveedor.contacto, 120),
      direccion: limpiar(proveedor.direccion, 300),
      telefono: limpiar(proveedor.telefono, 30),
      email: limpiar(proveedor.email, 160)
    },
    moneda: data.moneda === 'S/' ? 'S/' : 'US$',
    formaPago: limpiar(data.formaPago, 120),
    lugarEntrega: limpiar(data.lugarEntrega, 300),
    referencia: limpiar(data.referencia, 160),
    observaciones: limpiar(data.observaciones, 500),
    aplicaIgv: data.aplicaIgv !== false,
    estado: data.estado === 'Borrador' ? 'Borrador' : 'Emitida',
    items,
    ...totales,
    origenCotizacionId: data.origenCotizacionId || null,
    origenCotizacionCodigo: limpiar(data.origenCotizacionCodigo, 40) || null,
    elaboradoPor: limpiar(data.elaboradoPor, 140),
    cargoElaborador: limpiar(data.cargoElaborador, 100),
    autorizadoPor: limpiar(data.autorizadoPor, 140),
    cargoAutorizador: limpiar(data.cargoAutorizador, 100)
  };
}

export async function getOrdenesCompra() {
  const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function createOrdenCompra(data) {
  const usuario = auth.currentUser;
  if (!usuario) throw new Error('Debes iniciar sesión para crear una orden de compra');
  if (!data.proveedorId) throw new Error('Selecciona un proveedor registrado');

  const configRef = doc(db, 'configuracion', 'general');
  const proveedorRef = doc(db, 'proveedores', data.proveedorId);
  const cotizacionRef = data.origenCotizacionId ? doc(db, 'cotizaciones', data.origenCotizacionId) : null;

  return runTransaction(db, async (tx) => {
    const [configSnap, proveedorSnap, cotizacionSnap] = await Promise.all([
      tx.get(configRef),
      tx.get(proveedorRef),
      cotizacionRef ? tx.get(cotizacionRef) : Promise.resolve(null)
    ]);

    if (!proveedorSnap.exists()) throw new Error('El proveedor seleccionado ya no existe');
    const proveedor = proveedorSnap.data();
    if (proveedor.activo === false) throw new Error('El proveedor seleccionado está inactivo');

    let cotizacionOrigen = null;
    if (cotizacionSnap) {
      if (!cotizacionSnap.exists()) throw new Error('La cotización de origen no existe');
      cotizacionOrigen = cotizacionSnap.data();
      if (cotizacionOrigen.ordenCompraId) {
        throw new Error('Esta cotización ya tiene una orden de compra vinculada');
      }
    }

    const config = configSnap.exists() ? configSnap.data() : {};
    const actual = {
      prefijo: 'OC',
      longitud: 6,
      proximoNumero: 100111,
      ...(config.ordenCompra || {})
    };
    const prefijo = limpiar(actual.prefijo || 'OC', 8).toUpperCase().replace(/[^A-Z0-9-]/g, '') || 'OC';
    const longitud = Math.min(12, Math.max(1, Number(actual.longitud) || 6));
    let numero = Math.max(1, Math.trunc(Number(actual.proximoNumero) || 100111));
    let codigo = formatearCodigoOrden(prefijo, numero, longitud);
    let ordenRef = doc(db, COLLECTION_NAME, codigo);

    for (let intentos = 0; intentos < 100; intentos += 1) {
      const existente = await tx.get(ordenRef);
      if (!existente.exists()) break;
      numero += 1;
      codigo = formatearCodigoOrden(prefijo, numero, longitud);
      ordenRef = doc(db, COLLECTION_NAME, codigo);
      if (intentos === 99) throw new Error('No se pudo reservar un correlativo único');
    }

    const orden = normalizarOrden(data, proveedor);
    const ahora = new Date().toISOString();
    tx.set(ordenRef, {
      ...orden,
      codigo,
      origenCotizacionEstadoAnterior: cotizacionOrigen?.estado || null,
      creadoPorUid: usuario.uid,
      creadoPorNombre: data.elaboradoPor || usuario.email || usuario.uid,
      createdAt: ahora,
      updatedAt: ahora
    });
    tx.set(configRef, {
      ordenCompra: {
        ...actual,
        prefijo,
        longitud,
        ultimoCorrelativo: codigo,
        proximoNumero: numero + 1
      },
      updatedAt: ahora
    }, { merge: true });

    if (cotizacionRef) {
      tx.update(cotizacionRef, {
        estado: 'Aceptada',
        ordenCompraId: ordenRef.id,
        ordenCompraCodigo: codigo,
        fechaAceptacion: ahora,
        aceptadaPorUid: usuario.uid,
        updatedAt: ahora
      });
    }

    return { id: ordenRef.id, codigo };
  });
}

export async function updateOrdenCompra(id, data) {
  const ref = doc(db, COLLECTION_NAME, id);
  const actual = await getDoc(ref);
  if (!actual.exists()) throw new Error('La orden de compra no existe');
  if (!data.proveedorId) throw new Error('Selecciona un proveedor registrado');
  const proveedorSnap = await getDoc(doc(db, 'proveedores', data.proveedorId));
  if (!proveedorSnap.exists()) throw new Error('El proveedor seleccionado ya no existe');
  if (proveedorSnap.data().activo === false && actual.data().proveedorId !== data.proveedorId) {
    throw new Error('No puedes cambiar la orden a un proveedor inactivo');
  }
  const editable = normalizarOrden({
    ...data,
    origenCotizacionId: actual.data().origenCotizacionId,
    origenCotizacionCodigo: actual.data().origenCotizacionCodigo
  }, proveedorSnap.data());
  const { origenCotizacionId, origenCotizacionCodigo, ...camposEditables } = editable;
  await updateDoc(ref, { ...camposEditables, updatedAt: new Date().toISOString() });
}

export async function deleteOrdenCompra(id) {
  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const orden = snap.data();
  if (orden.estado !== 'Borrador') throw new Error('Solo se pueden eliminar órdenes en borrador');

  if (!orden.origenCotizacionId) {
    await deleteDoc(ref);
    return;
  }

  const cotizacionRef = doc(db, 'cotizaciones', orden.origenCotizacionId);
  await runTransaction(db, async (tx) => {
    const [ordenActual, cotizacionActual] = await Promise.all([tx.get(ref), tx.get(cotizacionRef)]);
    if (!ordenActual.exists()) return;
    if (ordenActual.data().estado !== 'Borrador') throw new Error('Solo se pueden eliminar órdenes en borrador');
    tx.delete(ref);
    if (cotizacionActual.exists() && cotizacionActual.data().ordenCompraId === id) {
      const restaurar = {
        ordenCompraId: null,
        ordenCompraCodigo: null,
        updatedAt: new Date().toISOString()
      };
      if (ordenActual.data().origenCotizacionEstadoAnterior) {
        restaurar.estado = ordenActual.data().origenCotizacionEstadoAnterior;
      }
      tx.update(cotizacionRef, restaurar);
    }
  });
}
