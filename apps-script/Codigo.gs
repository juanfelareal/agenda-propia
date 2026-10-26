/**
 * AGENDA PROPIA — backend en Google Apps Script
 * --------------------------------------------------------------
 * Revisa tu Google Calendar, muestra solo los horarios libres y,
 * cuando alguien agenda, crea la cita en tu calendario, le envía
 * la invitación a la persona y (opcional) guarda una fila en Google Sheets.
 *
 * Solo tienes que cambiar el bloque CONFIG. Todo lo demás funciona solo.
 * Instrucciones completas en el README del repositorio.
 */

const CONFIG = {
  // ---- Tu horario ----
  zonaHoraria: 'America/Bogota',     // https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
  horaInicio: '09:00',               // la primera cita puede empezar a esta hora
  horaFin: '17:00',                  // y todas terminan a más tardar a esta hora
  duracionMinutos: 30,               // duración de cada cita
  descansoMinutos: 15,               // espacio entre una cita y la siguiente
  diasDeTrabajo: [1, 2, 3, 4, 5],    // 1 = lunes … 7 = domingo
  anticipacionMinimaMinutos: 120,    // no se puede agendar con menos de 2 horas
  diasHaciaAdelante: 15,             // cuántos días de trabajo se muestran

  // ---- Calendarios ----
  // Dónde se revisa si estás ocupada. 'primary' = tu calendario principal.
  // Puedes sumar otros calendarios que veas en tu cuenta (por su ID o correo).
  calendariosOcupados: ['primary'],
  // Dónde se crea la cita.
  calendarioCitas: 'primary',
  // ¿Los eventos de "todo el día" (cumpleaños, festivos) bloquean el día?
  bloquearEventosTodoElDia: false,

  // ---- La cita ----
  tituloCita: 'Cita',                // queda: "Cita · Servicio — Nombre"
  enlaceVideollamada: '',            // un enlace fijo de Meet/Zoom. Vacío = se crea un Meet nuevo por cita (ver README, paso 3)
  invitarAlCliente: true,            // le llega la invitación de Google Calendar a su correo

  // ---- Avisos y registro (opcionales) ----
  correoAviso: '',                   // tu correo para recibir un aviso por cada cita. Vacío = sin aviso
  hojaDeCalculoId: '',               // ID de un Google Sheet para guardar cada cita. Vacío = no se guarda
};

// ===================== No necesitas cambiar nada de aquí hacia abajo =====================

function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'dias') return json_({ dias: diasDisponibles_(), duracion: CONFIG.duracionMinutos, zona: etiquetaZona_() });
    if (p.action === 'horarios') return json_({ fecha: p.fecha, horarios: esFechaValida_(p.fecha) ? horariosLibres_(p.fecha) : [] });
    return json_({ ok: true, mensaje: 'La agenda está funcionando.' });
  } catch (err) {
    console.error(err);
    return json_({ error: 'No pudimos leer la agenda.' });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.empresa_web) return json_({ ok: true }); // trampa para robots: un humano nunca llena este campo

    const faltan = ['name', 'email', 'fecha', 'hora'].filter((k) => !String(body[k] || '').trim());
    if (faltan.length) return json_({ error: 'Faltan datos.', faltan: faltan });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return json_({ error: 'El correo no es válido.' });
    if (!esFechaValida_(body.fecha) || !/^\d{2}:\d{2}$/.test(body.hora)) return json_({ error: 'Fecha u hora no válida.' });

    // Evita que dos personas tomen el mismo horario al mismo tiempo
    lock.waitLock(20000);
    if (horariosLibres_(body.fecha).indexOf(body.hora) === -1) {
      return json_({ error: 'Ese horario se acaba de ocupar. Elige otro.', ocupado: true });
    }

    const inicio = fechaHora_(body.fecha, body.hora);
    const fin = new Date(inicio.getTime() + CONFIG.duracionMinutos * 60000);
    const titulo = [CONFIG.tituloCita, body.service].filter(Boolean).join(' · ') + ' — ' + body.name;
    const descripcion = descripcion_(body);
    const enlace = crearEvento_(titulo, descripcion, inicio, fin, body.email);

    guardarEnHoja_(body, enlace);
    avisar_(titulo, descripcion, inicio, enlace);

    return json_({ ok: true, fecha: body.fecha, hora: body.hora, enlace: enlace });
  } catch (err) {
    console.error(err);
    return json_({ error: 'No pudimos agendar la cita. Intenta de nuevo.' });
  } finally {
    lock.releaseLock();
  }
}

// ---------- Horarios ----------

function fechaHora_(fecha, hora) {
  return Utilities.parseDate(fecha + ' ' + hora, CONFIG.zonaHoraria, 'yyyy-MM-dd HH:mm');
}

function hoy_() {
  return Utilities.formatDate(new Date(), CONFIG.zonaHoraria, 'yyyy-MM-dd');
}

function diaSemana_(fecha) {
  return Number(Utilities.formatDate(fechaHora_(fecha, '12:00'), CONFIG.zonaHoraria, 'u')); // 1 = lunes
}

function diasDisponibles_() {
  const dias = [];
  const base = fechaHora_(hoy_(), '12:00');
  for (let i = 0; dias.length < CONFIG.diasHaciaAdelante && i < 90; i++) {
    const d = new Date(base.getTime() + i * 86400000);
    const iso = Utilities.formatDate(d, CONFIG.zonaHoraria, 'yyyy-MM-dd');
    if (CONFIG.diasDeTrabajo.indexOf(diaSemana_(iso)) !== -1) dias.push(iso);
  }
  return dias;
}

function esFechaValida_(fecha) {
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha || '') && diasDisponibles_().indexOf(fecha) !== -1;
}

function todosLosHorarios_() {
  const aMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const out = [];
  for (let m = aMin(CONFIG.horaInicio); m + CONFIG.duracionMinutos <= aMin(CONFIG.horaFin); m += CONFIG.duracionMinutos + CONFIG.descansoMinutos) {
    out.push(('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2));
  }
  return out;
}

function ocupados_(fecha) {
  const desde = fechaHora_(fecha, '00:00');
  const hasta = new Date(desde.getTime() + 86400000);
  const ocupado = [];
  CONFIG.calendariosOcupados.forEach((id) => {
    const cal = id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(id);
    if (!cal) { console.error('No tengo acceso al calendario ' + id); return; }
    cal.getEvents(desde, hasta).forEach((ev) => {
      if (ev.isAllDayEvent() && !CONFIG.bloquearEventosTodoElDia) return;
      if (ev.getMyStatus() === CalendarApp.GuestStatus.NO) return; // eventos que rechazaste
      if (ev.getTransparency && CalendarApp.EventTransparency && ev.getTransparency() === CalendarApp.EventTransparency.TRANSPARENT) return; // marcados como "Disponible"
      ocupado.push([ev.getStartTime().getTime(), ev.getEndTime().getTime()]);
    });
  });
  return ocupado;
}

function horariosLibres_(fecha) {
  const ocupado = ocupados_(fecha);
  const minimo = Date.now() + CONFIG.anticipacionMinimaMinutos * 60000;
  return todosLosHorarios_().filter((t) => {
    const ini = fechaHora_(fecha, t).getTime();
    const fin = ini + CONFIG.duracionMinutos * 60000;
    if (ini < minimo) return false;
    return !ocupado.some((b) => ini < b[1] && fin > b[0]);
  });
}

function etiquetaZona_() {
  const off = Utilities.formatDate(new Date(), CONFIG.zonaHoraria, 'XXX'); // ej. -05:00
  return 'GMT' + off.replace(':00', '').replace(/^([+-])0/, '$1');
}

// ---------- Cita ----------

function descripcion_(body) {
  const lineas = [];
  if (body.service) lineas.push('Servicio: ' + body.service, '');
  lineas.push('Nombre: ' + body.name, 'Correo: ' + body.email);
  if (body.phone) lineas.push('Celular: ' + body.phone);
  (body.respuestas || []).forEach((r) => { if (r && r.valor) lineas.push(r.pregunta + ': ' + r.valor); });
  return lineas.join('\n');
}

function crearEvento_(titulo, descripcion, inicio, fin, correoCliente) {
  const calId = CONFIG.calendarioCitas;

  // Sin enlace fijo: se crea un Google Meet nuevo (requiere el servicio avanzado "Google Calendar API")
  if (!CONFIG.enlaceVideollamada && typeof Calendar !== 'undefined') {
    const ev = Calendar.Events.insert({
      summary: titulo,
      description: descripcion,
      start: { dateTime: inicio.toISOString(), timeZone: CONFIG.zonaHoraria },
      end: { dateTime: fin.toISOString(), timeZone: CONFIG.zonaHoraria },
      attendees: CONFIG.invitarAlCliente ? [{ email: correoCliente }] : [],
      conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] },
    }, calId, { conferenceDataVersion: 1, sendUpdates: CONFIG.invitarAlCliente ? 'all' : 'none' });
    return ev.hangoutLink || '';
  }

  const cal = calId === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(calId);
  const enlace = CONFIG.enlaceVideollamada;
  const ev = cal.createEvent(titulo, inicio, fin, {
    description: descripcion + (enlace ? '\n\nVideollamada: ' + enlace : ''),
    location: enlace,
    guests: CONFIG.invitarAlCliente ? correoCliente : '',
    sendInvites: CONFIG.invitarAlCliente,
  });
  ev.removeAllReminders();
  ev.addPopupReminder(15);
  return enlace;
}

function guardarEnHoja_(body, enlace) {
  if (!CONFIG.hojaDeCalculoId) return;
  try {
    const ss = SpreadsheetApp.openById(CONFIG.hojaDeCalculoId);
    const hoja = ss.getSheetByName('Citas') || ss.insertSheet('Citas');
    const fijas = ['Agendada el', 'Fecha cita', 'Hora cita', 'Servicio', 'Nombre', 'Correo', 'Celular', 'Enlace'];
    const extra = (body.respuestas || []).map((r) => r.pregunta);

    // Encabezados: se crean solos y se agregan columnas si sumas preguntas nuevas al formulario
    let enc = hoja.getLastRow() ? hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0] : [];
    if (!enc.length) { enc = fijas.slice(); hoja.appendRow(enc); hoja.getRange(1, 1, 1, enc.length).setFontWeight('bold'); hoja.setFrozenRows(1); }
    extra.forEach((p) => { if (enc.indexOf(p) === -1) { enc.push(p); hoja.getRange(1, enc.length).setValue(p).setFontWeight('bold'); } });

    const valores = {
      'Agendada el': Utilities.formatDate(new Date(), CONFIG.zonaHoraria, 'yyyy-MM-dd HH:mm'),
      'Fecha cita': body.fecha, 'Hora cita': body.hora, 'Servicio': body.service || '',
      'Nombre': body.name, 'Correo': body.email, 'Celular': body.phone ? "'" + body.phone : '', 'Enlace': enlace,
    };
    (body.respuestas || []).forEach((r) => { valores[r.pregunta] = r.valor; });
    hoja.appendRow(enc.map((h) => valores[h] || ''));
  } catch (err) {
    console.error('No se pudo guardar en la hoja (la cita sí quedó creada):', err);
  }
}

function avisar_(titulo, descripcion, inicio, enlace) {
  if (!CONFIG.correoAviso) return;
  const cuando = Utilities.formatDate(inicio, CONFIG.zonaHoraria, 'yyyy-MM-dd · HH:mm');
  MailApp.sendEmail(CONFIG.correoAviso, 'Nueva cita: ' + titulo, 'Cuándo: ' + cuando + '\n' + (enlace ? 'Enlace: ' + enlace + '\n' : '') + '\n' + descripcion);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Prueba rápida desde el editor ----------
// Elige "probarAgenda" arriba y dale ▶ Ejecutar. La primera vez Google te pide permisos.
function probarAgenda() {
  const dias = diasDisponibles_();
  console.log('Días que se muestran: ' + dias.join(', '));
  console.log('Horarios libres el ' + dias[0] + ': ' + (horariosLibres_(dias[0]).join(', ') || 'ninguno'));
  console.log('Zona: ' + etiquetaZona_());
}
