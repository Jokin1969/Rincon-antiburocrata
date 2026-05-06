# Informe de Implementación — Módulo Animalario

**Versión:** 1.0  
**Fecha:** mayo 2026  
**Proyecto:** Rincón del Adhócrata · CIC bioGUNE  

---

## 1. Resumen del módulo

El **módulo Animalario** es una aplicación web para la gestión documental de proyectos de experimentación animal en el CIC bioGUNE. Permite crear, editar y exportar los formularios requeridos por el Comité Ético de Experimentación Animal (CEEA) y el Comité de Bioética y Bienestar Animal (CBBA) para la aprobación y modificación de proyectos.

**Documentos que genera:**

| Código | Nombre oficial | Endpoint de exportación |
|--------|---------------|------------------------|
| Sección A | Solicitud de evaluación ética de un proyecto | `GET /api/animalario/proyectos/:id/exportar/seccionA` |
| Sección B | Descripción del procedimiento experimental | `GET /api/animalario/procedimientos/:id/exportar` |
| Sección C | Cría de cepas/líneas de ratón | `GET /api/animalario/crias/:id/exportar` |
| Sección D | Productos administrados con riesgo | `GET /api/animalario/proyectos/:id/exportar/seccionD` |
| Modificación | Solicitud de modificación del proyecto | `GET /api/animalario/modificaciones/:id/exportar` |

Los documentos se generan en formato `.docx` (mediante la librería `docx`) y se convierten a `.pdf` usando LibreOffice headless.

---

## 2. Arquitectura de ficheros

### Ficheros nuevos

```
server/routes/animalario-export.js      NUEVO — Generadores docx y endpoints de exportación
src/components/animalario/
  ExportButton.jsx                      NUEVO — Dropdown reutilizable de exportación (docx/pdf/ambos)
  ManualUsuario.jsx                     NUEVO — Modal con manual de usuario completo
docs/animalario/
  INFORME_IMPLEMENTACION.md             NUEVO — Este informe
```

### Ficheros modificados en los 8 prompts

```
server.js                               MOD  — Registro de animalarioExportRouter
server/routes/animalario.js             MOD  — CRUD completo para proyectos, procedimientos,
                                               crías, productos, modificaciones; syncProyectoRiesgo;
                                               soporte ?modificacion_id en POST procedimientos
src/App.jsx                             MOD  — Todas las rutas del módulo Animalario

src/pages/animalario/
  AnimalarioHub.jsx                     NUEVO — Hub principal del módulo
  ProyectosList.jsx                     NUEVO — Lista de proyectos con búsqueda
  ProyectoHub.jsx                       NUEVO — Hub por proyecto con todas las secciones y export
  seccionA/
    SeccionAForm.jsx                    NUEVO — Formulario de 9 bloques para Sección A
    SeccionAForm.module.css             NUEVO
  seccionB/
    ProcedimientosHub.jsx               NUEVO — Hub de procedimientos con botón manual
    SeccionBForm.jsx                    NUEVO — Formulario de 13 bloques para Sección B
    SeccionBForm.module.css             NUEVO
  seccionC/
    SeccionCForm.jsx                    NUEVO — Formulario de cría + bloque OMG condicional
    SeccionCForm.module.css             NUEVO
  seccionD/
    SeccionDForm.jsx                    NUEVO — Formulario de agentes biológicos y químicos
    SeccionDForm.module.css             NUEVO
  modificacion/
    ModificacionForm.jsx                NUEVO — Formulario con 7 tipos de cambio condicionales
    ModificacionForm.module.css         NUEVO

src/styles/animalario/
  animalario.module.css                 NUEVO — Todos los estilos compartidos del módulo

data/animalario/
  proyectos/                            NUEVO — Directorio de datos (+ .gitkeep)
  procedimientos/                       NUEVO
  crias/                                NUEVO
  productos/                            NUEVO
  modificaciones/                       NUEVO
  repositorio/
    campos_frecuentes.json              NUEVO — Valores de autocompletado

public/logos/animalario/
  cicbiogune.png                        NUEVO — Logo CIC bioGUNE
  aaalac.png                            NUEVO — Logo AAALAC International
```

---

## 3. Rutas del frontend

| Ruta React | Componente | Descripción |
|-----------|-----------|-------------|
| `/animalario` | `AnimalarioHub` | Hub principal con acceso rápido y resumen |
| `/animalario/proyectos` | `ProyectosList` | Lista de proyectos con búsqueda |
| `/animalario/proyecto/nuevo` | `SeccionAForm` | Crear nuevo proyecto |
| `/animalario/proyecto/:proyectoId` | `ProyectoHub` | Hub del proyecto (todas las secciones) |
| `/animalario/proyecto/:proyectoId/editar` | `SeccionAForm` | Editar Sección A |
| `/animalario/proyecto/:proyectoId/procedimientos` | `ProcedimientosHub` | Gestión de procedimientos |
| `/animalario/proyecto/:proyectoId/procedimientos/nuevo` | `SeccionBForm` | Nuevo procedimiento |
| `/animalario/proyecto/:proyectoId/procedimientos/:procId` | `SeccionBForm` | Editar procedimiento |
| `/animalario/proyecto/:proyectoId/cria/nueva` | `SeccionCForm` | Nueva cría (con `?cepaIdx=N`) |
| `/animalario/proyecto/:proyectoId/cria/:cId` | `SeccionCForm` | Editar cría |
| `/animalario/proyecto/:proyectoId/productos` | `SeccionDForm` | Sección D — Productos con riesgo |
| `/animalario/proyecto/:proyectoId/modificacion/nueva` | `ModificacionForm` | Nueva modificación |
| `/animalario/proyecto/:proyectoId/modificacion/:mId` | `ModificacionForm` | Editar modificación |

---

## 4. Endpoints del backend

### Repositorio de autocompletado
| Método | Ruta | Descripción | Fichero |
|--------|------|-------------|---------|
| GET | `/api/animalario/repositorio/campo/:campo` | Obtener sugerencias | `repositorio/campos_frecuentes.json` |
| POST | `/api/animalario/repositorio/campo/:campo` | Guardar valor nuevo | `repositorio/campos_frecuentes.json` |

### Proyectos
| Método | Ruta | Descripción | Fichero |
|--------|------|-------------|---------|
| GET | `/api/animalario/proyectos` | Listar proyectos | `proyectos/*.json` |
| POST | `/api/animalario/proyectos` | Crear proyecto | `proyectos/proyecto_{id}.json` |
| GET | `/api/animalario/proyectos/:id` | Obtener proyecto completo | `proyectos/proyecto_{id}.json` |
| PUT | `/api/animalario/proyectos/:id` | Actualizar proyecto | `proyectos/proyecto_{id}.json` |

### Procedimientos (Sección B)
| Método | Ruta | Descripción | Fichero |
|--------|------|-------------|---------|
| GET | `/api/animalario/proyectos/:id/procedimientos` | Listar procedimientos | `procedimientos/proc_*.json` |
| POST | `/api/animalario/proyectos/:id/procedimientos` | Crear procedimiento (`?modificacion_id`) | `procedimientos/proc_{id}.json` |
| GET | `/api/animalario/procedimientos/:id` | Obtener procedimiento | `procedimientos/proc_{id}.json` |
| PUT | `/api/animalario/procedimientos/:id` | Actualizar procedimiento | `procedimientos/proc_{id}.json` |
| DELETE | `/api/animalario/procedimientos/:id` | Eliminar procedimiento | `procedimientos/proc_{id}.json` |
| POST | `/api/animalario/procedimientos/:id/duplicar` | Duplicar procedimiento | nuevo `proc_{uuid}.json` |

### Crías (Sección C)
| Método | Ruta | Descripción | Fichero |
|--------|------|-------------|---------|
| POST | `/api/animalario/proyectos/:id/crias` | Crear cría | `crias/cria_{id}.json` |
| GET | `/api/animalario/crias/:id` | Obtener cría | `crias/cria_{id}.json` |
| PUT | `/api/animalario/crias/:id` | Actualizar cría | `crias/cria_{id}.json` |
| DELETE | `/api/animalario/crias/:id` | Eliminar cría | `crias/cria_{id}.json` |

### Productos con riesgo (Sección D)
| Método | Ruta | Descripción | Fichero |
|--------|------|-------------|---------|
| GET | `/api/animalario/proyectos/:id/productos` | Obtener Sección D | `productos/productos_{id}.json` |
| POST | `/api/animalario/proyectos/:id/productos` | Crear Sección D | `productos/productos_{id}.json` |
| PUT | `/api/animalario/proyectos/:id/productos` | Actualizar Sección D | `productos/productos_{id}.json` |

### Modificaciones
| Método | Ruta | Descripción | Fichero |
|--------|------|-------------|---------|
| GET | `/api/animalario/proyectos/:id/modificaciones` | Listar modificaciones | `modificaciones/modificacion_*.json` |
| POST | `/api/animalario/proyectos/:id/modificaciones` | Crear modificación | `modificaciones/modificacion_{id}.json` |
| GET | `/api/animalario/modificaciones/:id` | Obtener modificación | `modificaciones/modificacion_{id}.json` |
| PUT | `/api/animalario/modificaciones/:id` | Actualizar modificación | `modificaciones/modificacion_{id}.json` |
| DELETE | `/api/animalario/modificaciones/:id` | Eliminar modificación | `modificaciones/modificacion_{id}.json` |

### Exportación (fichero: `server/routes/animalario-export.js`)
| Método | Ruta | Documento generado | Parámetro |
|--------|------|-------------------|-----------|
| GET | `/api/animalario/proyectos/:id/exportar/seccionA` | Sección A completa | `?formato=docx\|pdf\|ambos` |
| GET | `/api/animalario/procedimientos/:id/exportar` | Sección B (procedimiento) | `?formato=docx\|pdf\|ambos` |
| GET | `/api/animalario/crias/:id/exportar` | Sección C (cría) | `?formato=docx\|pdf\|ambos` |
| GET | `/api/animalario/proyectos/:id/exportar/seccionD` | Sección D | `?formato=docx\|pdf\|ambos` |
| GET | `/api/animalario/modificaciones/:id/exportar` | Modificación | `?formato=docx\|pdf\|ambos` |
| GET | `/api/animalario/proyectos/:id/exportar/completo` | ZIP con todo el proyecto | `?formato=docx\|pdf\|ambos` |

---

## 5. Estructura de datos

### `proyectos/proyecto_{id}.json`
```json
{
  "id": "uuid",
  "titulo": "Título del proyecto",
  "referencia_cbba": "CBBA-XXXX",
  "seccionA": { "responsable": {...}, "participantes": [...], ... },
  "procedimientos": ["proc-uuid-1", "proc-uuid-2"],
  "crias": [{ "id": "cria-uuid", "cepa_idx": 0 }],
  "hay_productos_riesgo": false,
  "seccionD_id": "uuid-o-null",
  "modificaciones": ["modif-uuid-1"],
  "fecha_creacion": "ISO",
  "fecha_actualizacion": "ISO"
}
```

**Relaciones:** `procedimientos[]` → `proc_{id}.json`; `crias[].id` → `cria_{id}.json`; `modificaciones[]` → `modificacion_{id}.json`; `seccionD_id` → `productos_{id}.json`.

### `procedimientos/proc_{id}.json`
```json
{
  "id": "uuid",
  "proyecto_id": "uuid",
  "numero": 1,
  "datos_generales": { "titulo_procedimiento": "", "especies": [], "num_animales": 0, ... },
  "metodologia": {...}, "tamano_muestral": {...}, "aislamiento_ayuno": {...},
  "tecnicas": [...], "analgesia_anestesia": {...}, "otras_sustancias": {...},
  "parametros": [...], "muestras_antemortem": [...], "finalizacion": {...},
  "reutilizacion": {...}, "clasificacion_severidad": "none|low|medium|high",
  "firma": {...}
}
```

### `crias/cria_{id}.json`
```json
{
  "id": "uuid",
  "proyecto_id": "uuid",
  "cepa_idx": 0,
  "identificacion": { "nomenclatura_internacional": "", "acronimo": "" },
  "es_omg": false,
  "omg": { "usado_anteriormente": false, "clasificacion_actividad": "", ... },
  ...
}
```

### `productos/productos_{proyectoId}.json`
```json
{
  "seccionD": {
    "agentes_biologicos": [{ "nombre_cientifico": "", "grupo_riesgo": "", ... }],
    "agentes_quimicos":   [{ "nombre": "", "identificacion_riesgo": "", ... }],
    "firmante": ""
  }
}
```

### `modificaciones/modificacion_{id}.json`
```json
{
  "id": "uuid",
  "proyecto_id": "uuid",
  "numero_modificacion": 1,
  "identificacion": { "titulo_proyecto": "", "referencia_cbba": "", ... },
  "tipos_cambio": { "adicion_animales": true, ... },
  "investigadores": { "altas": [...], "bajas": [...] },
  "adicion_animales": { "num_original_aprobados": 0, "porcentaje_incremento_total": 0, ... },
  "procedimientos_nuevos": ["proc-uuid"],
  "justificacion_general": "",
  "firmante": ""
}
```

### `repositorio/campos_frecuentes.json`
Objeto plano `{ campo: [string, ...] }`. Se actualiza en tiempo real al guardar formularios. Campos activos: `cepa_linea`, `tecnica_experimental`, `producto_administrado`, `parametro_medido`, `metodo_eutanasia`, `fuente_financiacion`, `especie`, `via_administracion`, `frecuencia_tecnica`, `muestra_genotipaje`, `tipo_modificacion_omg`, `agente_biologico`, `agente_quimico`.

---

## 6. Lógica condicional implementada

| Condición | Efecto |
|-----------|--------|
| `seccionA.hay_cria === true` | Muestra tarjetas de Sección C (una por cepa en `cepas_cria[]`) |
| `seccionA.cepas_cria.length === 0 && hay_cria` | Muestra aviso "Añadir en Sección A" |
| `cria.es_omg === true` | Muestra bloque C-O en SeccionCForm |
| `cria.omg.usado_anteriormente === true` | Bloque C-O muestra solo referencia al procedimiento previo |
| `cria.omg.es_cruce_omgs === true` | Muestra tabla de cruces OMG |
| `proyecto.hay_productos_riesgo === true` | Muestra tarjeta Sección D en ProyectoHub |
| `hay_productos_riesgo && !seccionD_id` | Muestra banner de aviso en ProyectoHub |
| `form.tipos_cambio.X === true` (en Modificación) | Muestra bloque de datos para ese tipo de cambio |
| `pct > 25 && worstSeverity === 'low'` | Bloquea guardar en ModificacionForm |
| `pct > 10 && worstSeverity === 'medium'` | Bloquea guardar en ModificacionForm |
| `proc.otras_sustancias.hay_riesgo` | Se ejecuta `syncProyectoRiesgo()` → `hay_productos_riesgo = true` |
| `financiacion.ip_es_responsable === false` | Muestra campo de texto para IP alternativo |
| `condiciones_alojamiento.tipo !== 'estandar'` | Muestra campo de descripción |
| `aislamiento_ayuno.hay_aislamiento === 'si'` | Muestra duración de aislamiento |
| `analgesia_anestesia.hay_anestesia === 'si'` | Muestra protocolo de anestesia |
| `reutilizacion.hay_reutilizacion === 'si'` | Muestra descripción/justificación |

---

## 7. Repositorio de autocompletado

| Campo interno | Label en UI | Formularios que lo usan |
|--------------|------------|------------------------|
| `cepa_linea` | Cepa / línea | Sección B (datos generales) |
| `tecnica_experimental` | Técnica | Sección B (tabla de técnicas) |
| `producto_administrado` | Producto | Sección B (otras sustancias) |
| `parametro_medido` | Parámetro | Sección B (parámetros) |
| `metodo_eutanasia` | Método eutanasia | Sección B (finalización) |
| `fuente_financiacion` | Entidad financiadora | Sección A |
| `especie` | Especie | Sección B (datos generales) |
| `via_administracion` | Vía de administración | Sección B (técnicas) |
| `frecuencia_tecnica` | Frecuencia | Sección B (técnicas) |
| `muestra_genotipaje` | Tipo de muestra | Sección C (genotipaje) |
| `tipo_modificacion_omg` | Tipo de modificación | Sección C (bloque OMG) |
| `agente_biologico` | Agente biológico | Sección D |
| `agente_quimico` | Agente químico | Sección D |

Los valores se leen en `GET /api/animalario/repositorio/campo/:campo` y se escriben en `POST` al guardar el formulario.

---

## 8. Generación de documentos

### Librería y conversión

- **Generación docx:** `docx` v8.x (ya instalada en el proyecto)
- **Conversión PDF:** `LibreOffice --headless` vía `utils/pdf.js` (ya existente)
- **Compresión ZIP:** `archiver` (instalado en este prompt)
- **Parámetro de formato:** `?formato=docx` (defecto) | `?formato=pdf` | `?formato=ambos`

### Estructura común de todos los documentos

1. Cabecera con logos incrustados en base64 (cicbiogune.png + aaalac.png)
2. Cuerpo del documento (tablas con encabezados en gris `#D9D9D9`, celdas con bordes simples)
3. Pie de página: `"Sección X. Página N de M     Revisión 2 (agosto 2024)"`
4. Márgenes: 2.5 cm todos los lados; fuente Calibri 11pt

### Endpoints de exportación

| Endpoint | Documento | Secciones incluidas |
|---------|-----------|-------------------|
| `GET /proyectos/:id/exportar/seccionA` | Sección A | Cabecera, establecimiento, A.1–A.7, firma, notas |
| `GET /procedimientos/:id/exportar` | Sección B | B.1–B.10, clasificación severidad, firma, notas |
| `GET /crias/:id/exportar` | Sección C | Identificación, cría, genotipaje, bloque OMG condicional, firma |
| `GET /proyectos/:id/exportar/seccionD` | Sección D | D.1 biológicos, D.2 químicos, firma, nota adjuntos |
| `GET /modificaciones/:id/exportar` | Modificación | Identificación, establecimiento, tipos de cambio, bloques condicionales, justificación, firma |
| `GET /proyectos/:id/exportar/completo` | ZIP completo | A + todas las B + todas las C (si hay_cria) + D (si existe) + modificaciones |

### Nomenclatura de ficheros en el ZIP

```
SeccionA_{titulo_proyecto}.docx/.pdf
SeccionB_Proc{n}_{titulo_procedimiento}.docx/.pdf
SeccionC_{acronimo_cepa}.docx/.pdf
SeccionD_{titulo_proyecto}.docx/.pdf
Modificacion_{n}_{titulo_proyecto}.docx/.pdf
```

---

## 9. Pendientes y mejoras sugeridas

| # | Descripción | Prioridad |
|---|-------------|-----------|
| 1 | **Firmas digitales** — Soporte para incrustar imagen de firma en los documentos exportados (el campo `firmante` solo guarda texto) | Alta |
| 2 | **Validación de campos obligatorios** — Mostrar qué campos faltan antes de exportar o al guardar | Alta |
| 3 | **Historial de versiones** — Guardar versiones anteriores de cada sección al actualizar | Media |
| 4 | **Exportación parcial por sección** desde el Hub del proyecto (actualmente los botones "Solo Sección B", "Solo Crías", etc. generan el ZIP completo) | Media |
| 5 | **Vista previa del documento** — Modal con previsualización HTML antes de descargar | Media |
| 6 | **Importación desde JSON** — Cargar un proyecto existente desde un fichero JSON exportado previamente | Media |
| 7 | **Roles y permisos** — Distinción entre responsable del proyecto, participantes y administrador del animalario | Baja |
| 8 | **Notificaciones de caducidad** — Aviso cuando la fecha de fin del proyecto se acerca | Baja |
| 9 | **Búsqueda de proyectos por referencia CBBA o responsable** | Baja |
| 10 | **Plantillas de procedimiento** — Biblioteca de procedimientos reutilizables predefinidos por especie | Baja |
| 11 | **Plantillas Word personalizables** — Permitir al administrador ajustar el logo o los textos fijos de los documentos | Baja |
| 12 | **Tests automatizados** — Tests unitarios para los generadores docx y tests de integración para los endpoints | Baja |

---

## 10. Instrucciones de mantenimiento

### Añadir un nuevo campo al autocompletado

1. Editar `data/animalario/repositorio/campos_frecuentes.json` añadiendo la nueva clave con array vacío: `"nuevo_campo": []`
2. En el formulario que lo use, añadir `<AutocompleteInput campo="nuevo_campo" ... />`
3. En `doSave()`, añadir `await saveToRepo('nuevo_campo', form.nuevo_campo)`
4. El campo se poblará automáticamente al guardar proyectos.

### Modificar la plantilla de un documento exportado

Todos los generadores están en `server/routes/animalario-export.js`. Cada sección tiene su función `genSeccionX()`:

- Para cambiar estilos globales: modificar las constantes `SZ`, `SZ_H1`, `ALL`, `GF` en la cabecera del fichero.
- Para cambiar el pie de página: modificar la función `makeFooter(label)`.
- Para cambiar los datos del establecimiento: modificar `makeEstablishment()`.
- Para añadir una fila a una sección específica: añadir `kvRow('Etiqueta', valor)` en la función `genSeccionX()` correspondiente.

### Añadir una nueva sección al módulo

1. **Backend CRUD:** Añadir en `server/routes/animalario.js` los directorios, helpers y endpoints GET/POST/PUT/DELETE.
2. **Generador docx:** Añadir `genSeccionX()` y la ruta `GET /proyectos/:id/exportar/seccionX` en `animalario-export.js`.
3. **Formulario React:** Crear `src/pages/animalario/seccionX/SeccionXForm.jsx` y `SeccionXForm.module.css` siguiendo el patrón de `SeccionBForm` (CollapsibleBlock, AutocompleteInput, update(), doSave(), ExportButton).
4. **Ruta:** Añadir en `src/App.jsx` las rutas para el formulario nuevo.
5. **Hub:** Añadir la tarjeta correspondiente en `ProyectoHub.jsx` con la condición de activación.
6. **Exportación global:** Incluir la nueva sección en el endpoint `GET /proyectos/:id/exportar/completo`.
7. **Manual:** Añadir una subsección en `src/components/animalario/ManualUsuario.jsx`.

### Actualizar los logos institucionales

Reemplazar los ficheros en `public/logos/animalario/`:
- `cicbiogune.png` — ancho recomendado 260px, fondo transparente
- `aaalac.png` — ancho recomendado 220px, fondo transparente

Los logos se leen en tiempo de ejecución (no bundleados), por lo que el cambio es inmediato sin necesidad de redeploy.

### Cambiar los datos fijos del establecimiento

En `server/routes/animalario-export.js`, modificar la función `makeEstablishment()`. También actualizar los textos equivalentes en `src/pages/animalario/modificacion/ModificacionForm.jsx` (bloque de lectura en el UI) y en el manual de usuario `src/components/animalario/ManualUsuario.jsx`.
