const { create } = require('xmlbuilder2');

// Códigos oficiales de SUNAT (Catálogos)
const TIPO_DOC = { Factura: '01', Boleta: '03', 'Nota de Crédito': '07' };
const TIPO_IGV = '10';
const TIPO_OPERACION_POR_DEFECTO = '0101';
const COD_UNIDAD = 'NIU';
const COD_LOCAL_ANEXO = '0000';
const COD_IGV = '1000';
const MEDIO_PAGO_POR_DEFECTO = '001';

// Identificador de la firma — debe coincidir con el usado en firmarXml.js
const SIG_ID = 'IDSignNOOVA';

function generarXmlUBL(factura, empresa) {
    const tipoDocCod = TIPO_DOC[factura.tipo] || '01';
    const moneda = factura.moneda === 'US$' ? 'USD' : 'PEN';
    const tipoOperacion = normalizarTipoOperacion(
        factura.tipoOperacion || factura.operacion || TIPO_OPERACION_POR_DEFECTO
    );
    const medioPago = factura.medioPago || MEDIO_PAGO_POR_DEFECTO;

    const subtotalSinIgv = parseFloat(factura.subtotal || 0).toFixed(2);
    const igv = parseFloat(factura.igv || 0).toFixed(2);
    const total = parseFloat(factura.total || 0).toFixed(2);

    const razonSocialEmisor = (empresa.razonSocial && String(empresa.razonSocial).trim())
        ? String(empresa.razonSocial).trim() : empresa.ruc;
    const razonSocialCliente = (factura.cliente?.razonSocial && String(factura.cliente.razonSocial).trim())
        ? String(factura.cliente.razonSocial).trim() : factura.cliente?.ruc || 'CLIENTE';
    const tipoDocCliente = factura.tipo === 'Factura' ? '6' : '1';

    // Parsing robusto de fecha y hora (maneja timezone y milisegundos)
    const partesFecha = String(factura.fechaEmision).split('T');
    const fechaSolo = partesFecha[0];
    const horaCruda = partesFecha[1] || '00:00:00';
    const horaMatch = horaCruda.match(/^(\d{2}:\d{2}:\d{2})/);
    const horaSolo = horaMatch ? horaMatch[1] : '00:00:00';

    const doc = create({ version: '1.0', encoding: 'UTF-8' })
        .ele('Invoice', {
            'xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
            'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
            'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
            'xmlns:ccts': 'urn:un:unece:uncefact:documentation:2',
            'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
            'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
            'xmlns:qdt': 'urn:oasis:names:specification:ubl:schema:xsd:QualifiedDatatypes-2',
            'xmlns:udt': 'urn:un:unece:uncefact:data:specification:UnqualifiedDataTypesSchemaModule:2',
            'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        });

    // 0. UBLExtensions (contenedor de la firma)
    doc.ele('ext:UBLExtensions').ele('ext:UBLExtension').ele('ext:ExtensionContent').up().up().up();

    // 1. Encabezado
    doc.ele('cbc:UBLVersionID').txt('2.1').up();
    doc.ele('cbc:CustomizationID').txt('2.0').up();

    // ProfileID — Tipo de Operación (Catálogo 51)
    doc.ele('cbc:ProfileID', {
        schemeName: 'SUNAT:Identificador de Tipo de Operación',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo51'
    }).txt(tipoOperacion).up();

    doc.ele('cbc:ID').txt(`${factura.serie}-${factura.numero}`).up();
    doc.ele('cbc:IssueDate').txt(fechaSolo).up();
    doc.ele('cbc:IssueTime').txt(horaSolo).up();

    // InvoiceTypeCode — Tipo de Documento (Catálogo 01)
    doc.ele('cbc:InvoiceTypeCode', {
        listID: tipoOperacion,
        name: 'Tipo de Operacion',
        listSchemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo51',
        listAgencyName: 'PE:SUNAT',
        listName: 'Tipo de Documento',
        listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01'
    }).txt(tipoDocCod).up();

    // Note — Leyenda con monto en letras (languageLocaleID=1000 indica "leyenda")
    const nombreMoneda = moneda === 'USD' ? 'DOLARES AMERICANOS' : 'SOLES';
    doc.ele('cbc:Note', { languageLocaleID: '1000' })
        .txt(`SON ${numeroALetras(total)} ${nombreMoneda}`).up();

    // DocumentCurrencyCode — Tipo de Moneda (Catálogo 04 = ISO 4217)
    doc.ele('cbc:DocumentCurrencyCode', {
        listID: 'ISO 4217 Alpha',
        listName: 'Currency',
        listAgencyName: 'United Nations Economic Commission for Europe'
    }).txt(moneda).up();

    doc.ele('cbc:LineCountNumeric').txt(factura.items.length).up();

    // 2. Firma (referencia al bloque Signature que se incrusta en UBLExtensions)
    doc.ele('cac:Signature')
        .ele('cbc:ID').txt(SIG_ID).up()
        .ele('cac:SignatoryParty')
            .ele('cac:PartyIdentification').ele('cbc:ID').txt(empresa.ruc).up().up()
            .ele('cac:PartyName').ele('cbc:Name').txt(razonSocialEmisor).up().up()
        .up()
        .ele('cac:DigitalSignatureAttachment')
            .ele('cac:ExternalReference').ele('cbc:URI').txt(`#${SIG_ID}`).up().up()
        .up()
    .up();

    // 3. Emisor (AccountingSupplierParty)
    doc.ele('cac:AccountingSupplierParty')
        .ele('cac:Party')
            .ele('cac:PartyIdentification').ele('cbc:ID', { schemeID: '6' }).txt(empresa.ruc).up().up()
            .ele('cac:PartyName').ele('cbc:Name').txt(razonSocialEmisor).up().up()
            .ele('cac:PartyTaxScheme')
                .ele('cbc:RegistrationName').txt(razonSocialEmisor).up()
                .ele('cbc:CompanyID', {
                    schemeID: '6',
                    schemeName: 'SUNAT:Identificador de Documento de Identidad',
                    schemeAgencyName: 'PE:SUNAT',
                    schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06'
                }).txt(empresa.ruc).up()
                .ele('cac:RegistrationAddress')
                    .ele('cbc:ID', { schemeName: 'SUNAT:Establecimientos anexos' }).txt(COD_LOCAL_ANEXO).up()
                    .ele('cbc:AddressTypeCode', {
                        listAgencyName: 'PE:SUNAT',
                        listName: 'Establecimientos anexos'
                    }).txt(COD_LOCAL_ANEXO).up()
                .up()
                .ele('cac:TaxScheme')
                    .ele('cbc:ID', {
                        schemeID: 'UN/ECE 5153',
                        schemeName: 'Tax Scheme Identifier',
                        schemeAgencyName: 'United Nations Economic Commission for Europe'
                    }).txt('VAT').up()
                .up()
            .up()
            .ele('cac:PartyLegalEntity')
                .ele('cbc:RegistrationName').txt(razonSocialEmisor).up()
                .ele('cbc:CompanyID', {
                    schemeID: '6',
                    schemeName: 'SUNAT:Identificador de Documento de Identidad',
                    schemeAgencyName: 'PE:SUNAT',
                    schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06'
                }).txt(empresa.ruc).up()
                .ele('cac:RegistrationAddress')
                    .ele('cbc:ID', { schemeName: 'SUNAT:Establecimientos anexos' }).txt(COD_LOCAL_ANEXO).up()
                    .ele('cbc:AddressTypeCode', {
                        listAgencyName: 'PE:SUNAT',
                        listName: 'Establecimientos anexos'
                    }).txt(COD_LOCAL_ANEXO).up()
                .up()
            .up()
        .up()
    .up();

    // 4. Receptor (AccountingCustomerParty)
    doc.ele('cac:AccountingCustomerParty')
        .ele('cac:Party')
            .ele('cac:PartyIdentification').ele('cbc:ID', { schemeID: tipoDocCliente }).txt(factura.cliente.ruc).up().up()
            .ele('cac:PartyName').ele('cbc:Name').txt(razonSocialCliente).up().up()
            .ele('cac:PartyTaxScheme')
                .ele('cbc:RegistrationName').txt(razonSocialCliente).up()
                .ele('cbc:CompanyID', {
                    schemeID: tipoDocCliente,
                    schemeName: 'SUNAT:Identificador de Documento de Identidad',
                    schemeAgencyName: 'PE:SUNAT',
                    schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06'
                }).txt(factura.cliente.ruc).up()
                .ele('cac:RegistrationAddress')
                    .ele('cbc:ID', { schemeName: 'SUNAT:Establecimientos anexos' }).txt(COD_LOCAL_ANEXO).up()
                    .ele('cbc:AddressTypeCode', {
                        listAgencyName: 'PE:SUNAT',
                        listName: 'Establecimientos anexos'
                    }).txt(COD_LOCAL_ANEXO).up()
                .up()
                .ele('cac:TaxScheme')
                    .ele('cbc:ID', {
                        schemeID: 'UN/ECE 5153',
                        schemeName: 'Tax Scheme Identifier',
                        schemeAgencyName: 'United Nations Economic Commission for Europe'
                    }).txt('VAT').up()
                .up()
            .up()
            .ele('cac:PartyLegalEntity')
                .ele('cbc:RegistrationName').txt(razonSocialCliente).up()
                .ele('cbc:CompanyID', {
                    schemeID: tipoDocCliente,
                    schemeName: 'SUNAT:Identificador de Documento de Identidad',
                    schemeAgencyName: 'PE:SUNAT',
                    schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06'
                }).txt(factura.cliente.ruc).up()
            .up()
        .up()
    .up();

    // 5. PaymentMeans — Medio de Pago (Catálogo 59)
    doc.ele('cac:PaymentMeans')
        .ele('cbc:PaymentMeansCode', {
            listID: 'SUNAT:Codigo de tipo de medio de pago',
            listAgencyName: 'PE:SUNAT',
            listName: 'SUNAT:Codigo de tipo de medio de pago',
            listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo59'
        }).txt(medioPago).up()
    .up();

    // 5b. PaymentTerms — Forma de Pago (Contado / Credito)
    const formaPago = factura.formaPago || 'Contado';
    doc.ele('cac:PaymentTerms')
        .ele('cbc:ID').txt('FormaPago').up()
        .ele('cbc:PaymentMeansID').txt(formaPago).up();

    // Si la forma de pago es a crédito, añadir monto pendiente
    if (formaPago === 'Credito') {
        const montoPendiente = parseFloat(factura.montoCredito || total).toFixed(2);
        doc.ele('cbc:Amount', { currencyID: moneda }).txt(montoPendiente).up();
    }
    doc.up();

    // 6. TaxTotal (cabecera)
    doc.ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: moneda }).txt(igv).up()
        .ele('cac:TaxSubtotal')
            .ele('cbc:TaxableAmount', { currencyID: moneda }).txt(subtotalSinIgv).up()
            .ele('cbc:TaxAmount', { currencyID: moneda }).txt(igv).up()
            .ele('cac:TaxCategory')
                .ele('cbc:ID', {
                    schemeID: 'UN/ECE 5305',
                    schemeName: 'Tax Category Identifier',
                    schemeAgencyName: 'United Nations Economic Commission for Europe'
                }).txt('S').up()
                .ele('cac:TaxScheme')
                    .ele('cbc:ID', {
                        schemeID: 'UN/ECE 5153',
                        schemeName: 'Tax Scheme Identifier',
                        schemeAgencyName: 'United Nations Economic Commission for Europe'
                    }).txt(COD_IGV).up()
                    .ele('cbc:Name').txt('IGV').up()
                    .ele('cbc:TaxTypeCode').txt('VAT').up()
                .up()
            .up()
        .up()
    .up();

    // 7. LegalMonetaryTotal
    doc.ele('cac:LegalMonetaryTotal')
        .ele('cbc:LineExtensionAmount', { currencyID: moneda }).txt(subtotalSinIgv).up()
        .ele('cbc:TaxInclusiveAmount', { currencyID: moneda }).txt(total).up()
        .ele('cbc:PayableAmount', { currencyID: moneda }).txt(total).up()
    .up();

    // 8. InvoiceLine
    factura.items.forEach((item, idx) => {
        const importeItem = parseFloat(item.importe || item.cantidad * item.precioUnitario).toFixed(2);
        const igvItem = (parseFloat(importeItem) * 0.18).toFixed(2);
        const precioConIgv = (parseFloat(item.precioUnitario) * 1.18).toFixed(2);
        const precioSinIgv = parseFloat(item.precioUnitario).toFixed(2);

        doc.ele('cac:InvoiceLine')
            .ele('cbc:ID').txt(idx + 1).up()
            .ele('cbc:InvoicedQuantity', {
                unitCode: COD_UNIDAD,
                unitCodeListID: 'UN/ECE rec 20',
                unitCodeListAgencyName: 'United Nations Economic Commission for Europe'
            }).txt(item.cantidad).up()
            .ele('cbc:LineExtensionAmount', { currencyID: moneda }).txt(importeItem).up()
            .ele('cac:PricingReference')
                .ele('cac:AlternativeConditionPrice')
                    .ele('cbc:PriceAmount', { currencyID: moneda }).txt(precioConIgv).up()
                    .ele('cbc:PriceTypeCode', {
                        listName: 'SUNAT:Indicador de Tipo de Precio',
                        listAgencyName: 'PE:SUNAT',
                        listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16'
                    }).txt('01').up()
                .up()
            .up()
            .ele('cac:TaxTotal')
                .ele('cbc:TaxAmount', { currencyID: moneda }).txt(igvItem).up()
                .ele('cac:TaxSubtotal')
                    .ele('cbc:TaxableAmount', { currencyID: moneda }).txt(importeItem).up()
                    .ele('cbc:TaxAmount', { currencyID: moneda }).txt(igvItem).up()
                    .ele('cac:TaxCategory')
                        .ele('cbc:ID', {
                            schemeID: 'UN/ECE 5305',
                            schemeName: 'Tax Category Identifier',
                            schemeAgencyName: 'United Nations Economic Commission for Europe'
                        }).txt('S').up()
                        .ele('cbc:Percent').txt('18.00').up()
                        .ele('cbc:TaxExemptionReasonCode', {
                            listAgencyName: 'PE:SUNAT',
                            listName: 'SUNAT:Codigo de Tipo de Afectación del IGV',
                            listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07'
                        }).txt(TIPO_IGV).up()
                        .ele('cac:TaxScheme')
                            .ele('cbc:ID', {
                                schemeID: 'UN/ECE 5153',
                                schemeName: 'Tax Scheme Identifier',
                                schemeAgencyName: 'United Nations Economic Commission for Europe'
                            }).txt(COD_IGV).up()
                            .ele('cbc:Name').txt('IGV').up()
                            .ele('cbc:TaxTypeCode').txt('VAT').up()
                        .up()
                    .up()
                .up()
            .up()
            .ele('cac:Item')
                .ele('cbc:Description').txt(item.descripcion).up()
                .ele('cac:SellersItemIdentification').ele('cbc:ID').txt(`SVC${String(idx + 1).padStart(3, '0')}`).up().up()
            .up()
            .ele('cac:Price').ele('cbc:PriceAmount', { currencyID: moneda }).txt(precioSinIgv).up().up()
        .up();
    });

    const xmlFinal = doc.end({ prettyPrint: false });

    return xmlFinal;
}

function normalizarTipoOperacion(valor) {
    const codigo = String(valor || '').trim();
    if (!codigo) return TIPO_OPERACION_POR_DEFECTO;
    if (!/^\d{4}$/.test(codigo)) {
        throw new Error(`Tipo de operación inválido: ${codigo}. Debe tener 4 dígitos.`);
    }
    return codigo;
}

function numeroALetras(num) {
    num = parseFloat(num);
    if (isNaN(num)) return 'CERO Y 00/100';

    const entero = Math.floor(num);
    const decimales = Math.round((num - entero) * 100);

    const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince',
                        'dieciseis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta',
                     'sesenta', 'setenta', 'ochenta', 'noventa'];
    const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos',
                      'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    function convertirDecenas(n) {
        if (n < 10) return unidades[n];
        if (n < 20) return especiales[n - 10];
        if (n === 20) return 'veinte';
        if (n < 30) return 'veinti' + unidades[n - 20];
        const d = Math.floor(n / 10);
        const u = n % 10;
        if (u === 0) return decenas[d];
        return decenas[d] + ' y ' + unidades[u];
    }

    function convertirCentenas(n) {
        if (n === 100) return 'cien';
        const c = Math.floor(n / 100);
        const resto = n % 100;
        let resultado = '';
        if (c > 0) resultado = centenas[c];
        if (resto > 0) {
            if (resultado) resultado += ' ';
            resultado += convertirDecenas(resto);
        }
        return resultado;
    }

    function convertirMiles(n) {
        if (n < 1000) return convertirCentenas(n);
        const m = Math.floor(n / 1000);
        const resto = n % 1000;
        let prefijo;
        if (m === 1) prefijo = 'mil';
        else prefijo = convertirCentenas(m) + ' mil';
        if (resto > 0) return prefijo + ' ' + convertirCentenas(resto);
        return prefijo;
    }

    function convertirMillones(n) {
        if (n < 1000000) return convertirMiles(n);
        const mm = Math.floor(n / 1000000);
        const resto = n % 1000000;
        let prefijo;
        if (mm === 1) prefijo = 'un millon';
        else prefijo = convertirMiles(mm) + ' millones';
        if (resto > 0) return prefijo + ' ' + convertirMiles(resto);
        return prefijo;
    }

    let resultado;
    if (entero === 0) {
        resultado = 'cero';
    } else {
        resultado = convertirMillones(entero);
    }

    const decStr = decimales.toString().padStart(2, '0');
    resultado = resultado + ' Y ' + decStr + '/100';

    return resultado.toUpperCase();
}

module.exports = { generarXmlUBL, SIG_ID };
