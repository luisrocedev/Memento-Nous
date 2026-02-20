<div align="center">

# Memento Nous

**Sistema de recuerdos semánticos · Grafos 2D/3D · IndexedDB · Relaciones automáticas**

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=fff)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=fff)
![JavaScript](https://img.shields.io/badge/ES6+-F7DF1E?logo=javascript&logoColor=000)
![Canvas](https://img.shields.io/badge/Canvas_API-292929?logo=html5&logoColor=fff)
![Three.js](https://img.shields.io/badge/Three.js-000?logo=threedotjs&logoColor=fff)
![IndexedDB](https://img.shields.io/badge/IndexedDB-4285F4?logo=googlechrome&logoColor=fff)
![License](https://img.shields.io/badge/License-MIT-green)

</div>

---

## Resumen

**Memento Nous** es una aplicación de gestión semántica de recuerdos que permite almacenar memorias personales con metadatos enriquecidos (emoción, personas, tags, lugar, fecha) y descubrir automáticamente las relaciones entre ellos. Los recuerdos se visualizan como grafos interactivos en 2D (Canvas API) y 3D (Three.js), se agrupan en conjuntos dinámicos y se persisten offline con IndexedDB.

---

## Características principales

| Característica | Detalle |
|---|---|
| **Recuerdos semánticos** | Título · fecha · lugar · emoción · personas · tags · texto descriptivo |
| **Relaciones automáticas** | Conexiones entre recuerdos por tags compartidos |
| **Grafo 2D** | Canvas API con layout circular, nodos coloreados por emoción, enlaces semánticos discontinuos |
| **Grafo 3D** | Three.js + OrbitControls con esferas, iluminación y cámara orbital |
| **Conjuntos dinámicos** | Agrupación por emoción · tag · persona · año |
| **Dark mode** | Toggle manual + auto-detección · Escena Three.js adaptativa |
| **3 pestañas** | Recuerdos · Grafo · Conjuntos |
| **KPIs en tiempo real** | Recuerdos totales · visibles · tags · personas — con bordes semánticos |
| **Emotion badges** | Insignias coloreadas por emoción en cada tarjeta |
| **Chips diferenciados** | `#tag` (azul) · `@persona` (violeta) |
| **Export / Import** | JSON con nombre fechado · Validación al importar |
| **Toasts** | Notificaciones contextuales: success · error · info · warning |
| **Confirm personalizado** | `<dialog>` con Promise en lugar de `confirm()` nativo |
| **Auto-seed** | 13 recuerdos de ejemplo en primera ejecución |
| **Leyenda del grafo** | Panel lateral con nodos de grupo coloreados + tipos de enlace |
| **Responsive** | Breakpoints a 1000px y 680px |

---

## Inicio rápido

```bash
git clone https://github.com/luisrocedev/Memento-Nous.git
cd Memento-Nous
open index.html
```

Sin backend. Al abrir por primera vez se cargan **13 recuerdos de ejemplo** con emociones variadas, múltiples tags y personas para evaluar el grafo semántico de inmediato.

---

## Estructura del proyecto

```
Memento-Nous/
├── index.html        → SPA: header, tabs, grafos, diálogos, footer
├── assets/
│   ├── app.js        → IndexedDB, grafos 2D/3D, dark mode, toasts, confirm
│   └── styles.css    → CSS vars, dark mode, tabs, emotion badges, responsive
└── README.md
```

| Archivo | Líneas | Responsabilidad |
|---|---|---|
| `assets/app.js` | ~530 | Motor semántico, grafos Canvas + Three.js, CRUD, seed, export/import |
| `assets/styles.css` | ~270 | Variables CSS, modo oscuro, tabs, badges, chips, toasts, leyenda |
| `index.html` | ~175 | Estructura SPA con 3 tabs, diálogos, toast container, footer |

---

## Flujo de datos

```
Usuario → Filtros (Emoción / Búsqueda / Agrupación)
                │
                ▼
          IndexedDB (memories)
                │
                ├─ applyFilters() → filtered[]
                │
                ├─ buildSemanticSets() → Conjuntos agrupados
                │
                └─ buildGraphModel() → { nodes, links }
                        │
                        ├─ drawGraph2D() → Canvas 2D
                        └─ drawGraph3D() → Three.js 3D
```

---

## Visualización semántica

| Modo | Tecnología | Nodos grupo | Nodos recuerdo | Enlaces |
|---|---|---|---|---|
| **2D** | Canvas API | Círculos grandes (r=26) | Círculos coloreados por emoción (r=12) | Sólidos (grupo) + discontinuos violeta (semánticos) |
| **3D** | Three.js | Esferas (r=6) | Esferas coloreadas por emoción (r=3.3) | Líneas con color diferenciado |

Los **enlaces semánticos** conectan recuerdos que comparten al menos un tag, creando una red de asociaciones similar a la memoria humana.

---

## Dark mode

Detecta `prefers-color-scheme: dark` automáticamente y persiste la elección en `localStorage`. La escena Three.js actualiza su `scene.background` al cambiar de tema. Todos los colores del grafo 2D se adaptan mediante `getGraphColors()`.

---

## Tecnologías

- **HTML5** — Canvas API, `<dialog>`, estructura semántica
- **CSS3** — Custom properties, `color-mix()`, `backdrop-filter`, `@media prefers-color-scheme`
- **JavaScript ES6** — `async/await`, `Promise`, `Map`, `Set`, desestructuración
- **Three.js** — Escena 3D, `SphereGeometry`, `MeshStandardMaterial`, `OrbitControls`
- **IndexedDB** — Persistencia offline con índices por `createdAt` y `emotion`
- **Google Fonts** — Inter (300, 400, 600)

---

## Autor

**Luis Adolfo Roces Dapena** · DAM2 — Desarrollo de Interfaces

---

## Licencia

MIT
