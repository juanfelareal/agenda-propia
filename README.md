# Agenda propia

Una ventana para que tus clientes agenden citas contigo desde tu sitio web, como Calendly, pero tuya y gratis.

- La persona llena sus datos, elige día y hora, y listo.
- Solo ve los horarios en que **de verdad estás libre** (lee tu Google Calendar).
- La cita se crea sola en tu calendario y a la persona **le llega la invitación** a su correo.
- Si quieres, te llega un correo de aviso y cada cita queda guardada en un Google Sheet.
- Sirve para cualquier sitio: HTML propio, Shopify, WordPress, Wix, Squarespace.

**Demostración:** https://juanfelareal.github.io/agenda-propia/ (horarios inventados, no se guarda nada).

---

## Cómo funciona

```
Tu sitio web  ──(pide horarios / agenda)──►  Google Apps Script  ──►  Tu Google Calendar
 widget/agenda.js                             apps-script/Codigo.gs     (+ Google Sheet y correo, opcionales)
```

No necesitas servidor, ni pagar nada, ni crear llaves secretas. El Apps Script corre dentro de tu propia cuenta de Google.

Son **4 pasos** y toman unos 20 minutos.

---

## Paso 1 · Crea el Apps Script (el "cerebro" de la agenda)

1. Entra a **https://script.google.com** con la cuenta de Google donde está tu calendario.
2. Clic en **Nuevo proyecto**. Arriba a la izquierda cámbiale el nombre a `Agenda`.
3. Borra lo que viene en el editor y pega **todo** el contenido de [`apps-script/Codigo.gs`](apps-script/Codigo.gs).
4. Cambia el bloque `CONFIG` de arriba con tus datos (ver la tabla de abajo).
5. Guarda con **Ctrl + S** (o **Cmd + S** en Mac).

| Ajuste | Qué hace | Ejemplo |
|---|---|---|
| `zonaHoraria` | Tu zona horaria | `'America/Bogota'`, `'America/Mexico_City'`, `'Europe/Madrid'` |
| `horaInicio` / `horaFin` | Primera hora y hora en que debe haber terminado la última cita | `'09:00'` / `'17:00'` |
| `duracionMinutos` | Lo que dura cada cita | `30`, `45`, `60` |
| `descansoMinutos` | Espacio entre cita y cita | `15` |
| `diasDeTrabajo` | 1 = lunes … 7 = domingo | `[1, 2, 3, 4, 5]` (lunes a viernes) |
| `anticipacionMinimaMinutos` | Cuánto antes mínimo te pueden agendar | `120` (2 horas), `1440` (1 día) |
| `diasHaciaAdelante` | Cuántos días de trabajo se muestran | `15` |
| `calendariosOcupados` | Calendarios que se revisan para saber si estás ocupada | `['primary']` o `['primary', 'otro@gmail.com']` |
| `calendarioCitas` | Dónde se crea la cita | `'primary'` |
| `tituloCita` | Cómo se llama la cita en tu calendario | `'Asesoría'` |
| `enlaceVideollamada` | Un enlace fijo de Zoom/Meet. Vacío = un Meet nuevo por cita (paso 3) | `''` |
| `invitarAlCliente` | Le envía la invitación de Google Calendar a la persona | `true` |
| `correoAviso` | Te llega un correo con cada cita nueva. Vacío = sin aviso | `'tucorreo@gmail.com'` |
| `hojaDeCalculoId` | Guarda cada cita en un Google Sheet. Vacío = no guarda | ver paso 3 |

> Los textos van entre comillas simples `'así'` y cada línea termina en coma. Si borras una coma, el script no corre.

## Paso 2 · Pruébalo y dale permisos

1. Arriba, en la lista de funciones, elige **`probarAgenda`** y dale **▶ Ejecutar**.
2. Google te va a pedir permisos: **Revisar permisos** → elige tu cuenta → si sale "Google no ha verificado esta app", clic en **Configuración avanzada** → **Ir a Agenda (no seguro)** → **Permitir**.
   Es normal: la "app" es tu propio script y solo tú tienes acceso al código.
3. Abajo, en el registro, debes ver los días y tus horarios libres de hoy. Si ves eso, la agenda ya lee tu calendario.

## Paso 3 · Opcionales

**Un Google Meet nuevo para cada cita** (si dejaste `enlaceVideollamada: ''`):
En el menú de la izquierda, junto a **Servicios**, clic en **+** → elige **Google Calendar API** → **Agregar**. Listo: cada cita trae su propio enlace de Meet y le llega a la persona en la invitación.
Si no lo activas y no pones un enlace fijo, la cita se crea igual pero sin enlace.

**Guardar las citas en un Google Sheet:**
Crea una hoja nueva en https://sheets.new. El ID es la parte larga de la dirección:
`docs.google.com/spreadsheets/d/`**`ESTE_ES_EL_ID`**`/edit`. Pégalo en `hojaDeCalculoId`. Las columnas se crean solas en una pestaña llamada `Citas`.

## Paso 4 · Publícalo y conéctalo a tu sitio

### 4.1 Publica el Apps Script
1. Arriba a la derecha: **Implementar** → **Nueva implementación**.
2. En el engranaje ⚙️ elige **Aplicación web**.
3. **Ejecutar como:** Yo. **Quién tiene acceso:** Cualquier persona.
4. **Implementar** y copia la **URL de la aplicación web** (termina en `/exec`).

Abre esa URL en el navegador: debe decir `"La agenda está funcionando."`.

> **Importante:** si después cambias algo en `CONFIG`, debes volver a publicar: **Implementar** → **Administrar implementaciones** → ✏️ → **Versión: Nueva versión** → **Implementar**. Así la URL sigue siendo la misma.

### 4.2 Pega este código en tu sitio
Pégalo **una sola vez**, al final de la página (antes de `</body>`), o en el lugar de "código personalizado" de tu plataforma (ver abajo). Cambia la URL por la tuya:

```html
<script>
  window.AGENDA = {
    url: 'https://script.google.com/macros/s/TU_ID/exec',   // ← la URL del paso 4.1
    titulo: 'Agenda una cita',
    anfitriona: 'conmigo',                                  // "Agenda una cita conmigo."
    subtitulo: 'Videollamada de 30 minutos. Cuéntame un poco para llegar preparada.',
    textoConfirmada: 'Tu cita quedó agendada. Te llegó la invitación a tu correo.',
    correoContacto: 'tucorreo@gmail.com',                   // aparece si algo falla
    pedirCelular: true,
    preguntas: [
      { pregunta: '¿Cómo me conociste?', opciones: ['Instagram', 'Recomendación', 'Google', 'Otro'] },
      { pregunta: 'Tu Instagram', opcional: true },
      { pregunta: '¿Qué quieres resolver?', tipo: 'texto-largo', ejemplo: 'Cuéntame en pocas palabras' },
    ],
    colores: { fondo: '#F3F1ED', tarjeta: '#FBFAF8', texto: '#121212', acento: '#44BF47' },
    fuente: '',   // vacío = usa la fuente de tu sitio
  };
</script>
<script src="https://cdn.jsdelivr.net/gh/juanfelareal/agenda-propia@v1.0.0/widget/agenda.js" defer></script>
```

**Las preguntas:** nombre, correo y celular siempre van. Debajo puedes poner las que quieras:
- `{ pregunta: 'Texto' }` → campo corto
- `{ pregunta: 'Texto', tipo: 'texto-largo', ejemplo: 'Lo que se ve en gris' }` → campo grande
- `{ pregunta: 'Texto', opciones: ['A', 'B', 'C'] }` → lista para elegir
- agrega `opcional: true` si no es obligatoria

Cada respuesta llega en la descripción de la cita en tu calendario (y como columna en el Sheet).

**Los colores:** `fondo` (la ventana), `tarjeta` (los campos), `texto` (letra y botones), `acento` (el puntito del servicio). Opcionales: `boton` y `textoBoton` si quieres los botones de otro color.

### 4.3 Pon los botones
Cualquier botón o enlace abre la agenda de una de estas formas:

```html
<!-- Botón -->
<button data-agenda="">Agendar cita</button>

<!-- Botón que muestra un servicio arriba y lo guarda con la cita -->
<button data-agenda="Asesoría de imagen">Agendar asesoría</button>

<!-- Enlace (sirve en constructores donde no puedes editar el botón) -->
<a href="#agendar">Agendar cita</a>
```

Y un enlace directo para Instagram o WhatsApp: **`https://tusitio.com/#agendar`** abre la página con la agenda ya abierta.

---

## Dónde pegar el código según tu plataforma

| Plataforma | Dónde |
|---|---|
| **HTML propio** | Antes de `</body>` en cada página donde quieras la agenda |
| **Shopify** | Tienda online → Temas → ⋯ → Editar código → `layout/theme.liquid`, antes de `</body>`. Botones: en el editor del tema, un bloque "Liquid personalizado" con `<button data-agenda="">Agendar</button>`, o un botón con enlace `#agendar` |
| **WordPress** | Plugin gratuito *WPCode* → Agregar fragmento → HTML → ubicación "Pie de página en todo el sitio". Botones: bloque "Botón" con enlace `#agendar` |
| **Wix** | Configuración → Código personalizado → + Agregar código → pega → "Todas las páginas" → ubicación **Body - fin**. Botones: enlace a URL externa `https://tusitio.com/#agendar` |
| **Squarespace** | Configuración → Avanzado → Inyección de código → **Pie de página**. Botones: enlace a `#agendar` |

---

## Problemas comunes

| Lo que pasa | Solución |
|---|---|
| Dice "Modo demostración" | Falta poner la `url` en `window.AGENDA`, o tiene un error. |
| "No pudimos cargar la agenda" | Abre tu URL `/exec` en el navegador. Si no dice "La agenda está funcionando", revisa que en la implementación diga **Cualquier persona**. |
| Cambié el `CONFIG` y no se nota | Falta publicar una **nueva versión** (paso 4.1, nota). |
| Me muestra horarios en que estoy ocupada | Revisa que ese calendario esté en `calendariosOcupados`. Los eventos marcados como "Disponible" o de todo el día no bloquean (a menos que pongas `bloquearEventosTodoElDia: true`). |
| No sale el enlace de Meet | Activa el servicio **Google Calendar API** (paso 3) y publica una nueva versión. |
| Quiero ver qué falló | En script.google.com → **Ejecuciones** (menú izquierdo) aparece cada error. |

---

## Archivos

```
apps-script/Codigo.gs   ← se pega en script.google.com (paso 1)
widget/agenda.js        ← la ventana; tu sitio la carga desde jsDelivr (no tienes que tocarla)
index.html              ← página de demostración
```

Si prefieres no depender de este repositorio, haz clic en **Use this template** (o *Fork*) arriba, y cambia `juanfelareal` por tu usuario de GitHub en la línea del `<script src=…>`.
