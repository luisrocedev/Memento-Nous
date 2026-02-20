# Sistema de Recuerdos Semánticos - Memento Nous

**DNI:** 53945291X  
**Curso:** DAM2 — Desarrollo de interfaces  
**Actividad:** 003-Proyecto Memento  
**Tecnologías:** HTML5 · IndexedDB · Canvas API · Three.js · JavaScript ES6  
**Fecha:** 17 de febrero de 2026

---

## 1. Introducción breve y contextualización (25%)

### Concepto general

Un sistema de gestión semántica de recuerdos es una aplicación que permite almacenar, organizar y visualizar memorias personales utilizando metadatos enriquecidos y relaciones entre elementos. A diferencia de un diario tradicional lineal, este sistema organiza los recuerdos mediante:

- **Metadatos semánticos:** Emoción, personas, tags, fecha, lugar
- **Relaciones automáticas:** Conexiones entre recuerdos por tags compartidos
- **Conjuntos dinámicos:** Agrupación por diferentes criterios (emoción, tag, persona, año)
- **Visualización relacional:** Grafos 2D y 3D que muestran las conexiones entre recuerdos

### Contexto y utilidad

La gestión semántica de información mejora significativamente la organización de datos personales porque:

- **Descubrimiento de patrones:** Visualizar relaciones ocultas entre experiencias
- **Navegación no lineal:** Acceder a recuerdos por múltiples vías (emoción, persona, tema)
- **Memoria asociativa:** Imita cómo funciona la memoria humana por asociaciones
- **Análisis temporal:** Identificar evolución emocional o temática a lo largo del tiempo

Este proyecto demuestra técnicas avanzadas de visualización de datos (Canvas 2D, Three.js 3D), persistencia local (IndexedDB), y procesamiento semántico mediante estructuras de datos relacionales.

### Arquitectura del sistema

El sistema se compone de cinco módulos principales:

1. **Capa de persistencia (IndexedDB):** Almacenamiento local de recuerdos con índices
2. **Gestor CRUD:** Operaciones de creación, lectura, actualización y eliminación
3. **Motor semántico:** Procesamiento de tags, construcción de relaciones y sets
4. **Motor de visualización:** Grafos 2D (Canvas) y 3D (Three.js)
5. **Interfaz de usuario:** Formularios, filtros, y paneles de control

---

## 2. Desarrollo detallado y preciso (25%)

### Sistema de persistencia con IndexedDB

```javascript
// assets/app.js - Configuración de base de datos
const DB_NAME = "memento_nous_db";
const DB_VERSION = 1;
const STORE_MEMORIES = "memories";

/**
 * Abre conexión a IndexedDB y crea estructura si no existe
 * @returns {Promise<IDBDatabase>}
 */
function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    // Evento de actualización de esquema
    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Crear object store con keyPath autoincremental
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        const store = db.createObjectStore(STORE_MEMORIES, {
          keyPath: "id",
          autoIncrement: true,
        });

        // Índices para búsquedas eficientes
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("emotion", "emotion", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Abstracción de transacciones IndexedDB
 * @param {string} mode - 'readonly' o 'readwrite'
 * @param {Function} callback - Función que recibe el object store
 */
async function dbAction(mode, callback) {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_MEMORIES, mode);
    const store = transaction.objectStore(STORE_MEMORIES);
    const request = callback(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    // Cerrar conexión al completar transacción
    transaction.oncomplete = () => db.close();
  });
}

// Operaciones CRUD simplificadas
const getAllMemories = () => dbAction("readonly", (store) => store.getAll());
const addMemory = (memory) =>
  dbAction("readwrite", (store) => store.add(memory));
const deleteMemory = (id) => dbAction("readwrite", (store) => store.delete(id));
const clearMemories = () => dbAction("readwrite", (store) => store.clear());
```

### Gestor de estado y filtrado

```javascript
// Estado global de la aplicación
const state = {
  memories: [], // Todos los recuerdos cargados
  filtered: [], // Recuerdos después de filtros
  groupBy: "emotion", // Criterio de agrupación actual
  graphMode: "2d", // Modo de visualización (2d/3d)
  search: "", // Término de búsqueda
  emotionFilter: "all", // Filtro de emoción activo
  graph3d: null, // Instancia de Three.js
};

/**
 * Parsea campos CSV (personas, tags)
 * @param {string} input - "juan, ana, pedro"
 * @returns {Array<string>} - ["juan", "ana", "pedro"]
 */
function parseCsv(input) {
  return String(input || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * Aplica filtros activos sobre todos los recuerdos
 * Actualiza state.filtered con resultados
 */
function applyFilters() {
  const query = state.search.toLowerCase();

  state.filtered = state.memories.filter((memory) => {
    // Filtro de emoción
    const matchesEmotion =
      state.emotionFilter === "all" || memory.emotion === state.emotionFilter;

    // Filtro de búsqueda textual (busca en todos los campos)
    const searchableText = [
      memory.title,
      memory.text,
      memory.place,
      ...(memory.people || []),
      ...(memory.tags || []),
    ]
      .join(" ")
      .toLowerCase();

    const matchesQuery = query === "" || searchableText.includes(query);

    return matchesEmotion && matchesQuery;
  });
}

/**
 * Determina valor de agrupación según criterio
 * @param {Object} memory - Recuerdo a procesar
 * @param {string} groupBy - 'emotion', 'tag', 'person', 'year'
 * @returns {string} - Valor del grupo
 */
function getGroupValue(memory, groupBy) {
  if (groupBy === "emotion") {
    return memory.emotion || "sin_emocion";
  }
  if (groupBy === "tag") {
    return (memory.tags && memory.tags[0]) || "sin_tag";
  }
  if (groupBy === "person") {
    return (memory.people && memory.people[0]) || "sin_persona";
  }
  if (groupBy === "year") {
    const year = new Date(memory.date).getFullYear();
    return String(year) || "sin_año";
  }
  return "general";
}
```

### Motor semántico: construcción de sets

```javascript
/**
 * Agrupa recuerdos filtrados según criterio activo
 * @returns {Array<Object>} - Array de sets con metadatos
 */
function buildSemanticSets() {
  const groups = new Map();

  // Agrupar recuerdos
  for (const memory of state.filtered) {
    const groupKey = getGroupValue(memory, state.groupBy);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }

    groups.get(groupKey).push(memory);
  }

  // Convertir a array de sets con metadatos
  const sets = [...groups.entries()].map(([groupKey, memories]) => ({
    group: groupKey,
    count: memories.length,
    ids: memories.map((m) => m.id),
    titles: memories.map((m) => m.title),
  }));

  // Ordenar por tamaño (sets más grandes primero)
  sets.sort((a, b) => b.count - a.count);

  return sets;
}

/**
 * Renderiza sets en el DOM
 */
function renderSets() {
  const sets = buildSemanticSets();
  const container = document.getElementById("setsList");

  if (!sets.length) {
    container.innerHTML =
      '<article class="set">Sin sets para mostrar.</article>';
    return;
  }

  container.innerHTML = sets
    .map(
      (set) => `
        <article class="set">
            <strong>${escapeHtml(set.group)} · ${set.count} recuerdo(s)</strong>
            <span>${set.titles.map(escapeHtml).join(" · ")}</span>
        </article>
    `,
    )
    .join("");
}
```

### Modelo de grafo con relaciones semánticas

```javascript
/**
 * Construye modelo de grafo con nodos (grupos y recuerdos) y enlaces
 * @returns {Object} - { nodes: Array, links: Array }
 */
function buildGraphModel() {
  const groupNodesMap = new Map();
  const memoryNodes = [];
  const links = [];

  // Crear nodos de grupo y recuerdo
  for (const memory of state.filtered) {
    const groupKey = getGroupValue(memory, state.groupBy);
    const groupNodeId = `g:${groupKey}`;

    // Nodo de grupo (si no existe)
    if (!groupNodesMap.has(groupNodeId)) {
      groupNodesMap.set(groupNodeId, {
        id: groupNodeId,
        label: groupKey,
        type: "group",
      });
    }

    // Nodo de recuerdo
    const memoryNodeId = `m:${memory.id}`;
    memoryNodes.push({
      id: memoryNodeId,
      label: memory.title,
      type: "memory",
      raw: memory,
    });

    // Enlace: grupo → recuerdo
    links.push({
      source: groupNodeId,
      target: memoryNodeId,
      kind: "group",
    });
  }

  // Crear relaciones semánticas (recuerdos con tags compartidos)
  for (let i = 0; i < memoryNodes.length; i++) {
    const memoryA = memoryNodes[i].raw;

    for (let j = i + 1; j < memoryNodes.length; j++) {
      const memoryB = memoryNodes[j].raw;

      // Detectar tags compartidos
      const tagsA = memoryA.tags || [];
      const tagsB = memoryB.tags || [];
      const sharedTags = tagsA.filter((tag) => tagsB.includes(tag));

      // Si comparten al menos un tag, crear enlace semántico
      if (sharedTags.length > 0) {
        links.push({
          source: `m:${memoryA.id}`,
          target: `m:${memoryB.id}`,
          kind: "semantic",
        });
      }
    }
  }

  const allNodes = [...groupNodesMap.values(), ...memoryNodes];

  return { nodes: allNodes, links };
}
```

### Visualización 2D con Canvas API

```javascript
/**
 * Dibuja grafo 2D usando Canvas API
 */
function drawGraph2D() {
  const { nodes, links } = buildGraphModel();
  const canvas = document.getElementById("graph2D");
  const ctx = canvas.getContext("2d");

  // Limpiar canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!nodes.length) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "16px Inter";
    ctx.fillText("No hay nodos para mostrar", 20, 36);
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Separar nodos por tipo
  const groupNodes = nodes.filter((n) => n.type === "group");
  const memoryNodes = nodes.filter((n) => n.type === "memory");

  // Calcular posiciones (layout circular)
  const positions = new Map();

  // Posicionar nodos de grupo en círculo interior
  groupNodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(groupNodes.length, 1);
    const radius = 160;

    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
      r: 26, // Radio del nodo
      color: "#374151",
    });
  });

  // Posicionar nodos de recuerdo en círculo exterior
  memoryNodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(memoryNodes.length, 1);
    const radius = 240;

    // Añadir variación aleatoria para evitar superposiciones
    const jitterX = (Math.random() - 0.5) * 20;
    const jitterY = (Math.random() - 0.5) * 20;

    positions.set(node.id, {
      x: centerX + Math.cos(angle) * radius + jitterX,
      y: centerY + Math.sin(angle) * radius + jitterY,
      r: 12,
      color: "#9ca3af",
    });
  });

  // Dibujar enlaces
  for (const link of links) {
    const source = positions.get(link.source);
    const target = positions.get(link.target);

    if (!source || !target) continue;

    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    ctx.lineTo(target.x, target.y);

    // Estilo según tipo de enlace
    if (link.kind === "group") {
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1.4;
    } else {
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 1;
    }

    ctx.stroke();
  }

  // Dibujar nodos
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (!pos) continue;

    // Círculo del nodo
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, pos.r, 0, Math.PI * 2);
    ctx.fillStyle = pos.color;
    ctx.fill();

    // Etiqueta
    ctx.font = node.type === "group" ? "600 12px Inter" : "11px Inter";
    ctx.fillStyle = "#111827";

    const label =
      node.label.length > 22 ? `${node.label.slice(0, 22)}…` : node.label;

    ctx.fillText(label, pos.x + pos.r + 4, pos.y + 3);
  }
}
```

### Visualización 3D con Three.js

```javascript
/**
 * Inicializa escena 3D con Three.js
 * @returns {Object} - Componentes de la escena
 */
function ensureGraph3D() {
  if (state.graph3d) return state.graph3d;

  const container = document.getElementById("graph3D");
  const width = container.clientWidth || 900;
  const height = 500;

  // Crear escena
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfbfbfa);

  // Configurar cámara
  const camera = new THREE.PerspectiveCamera(
    60, // FOV
    width / height, // Aspecto
    0.1, // Near plane
    2000, // Far plane
  );
  camera.position.set(0, 80, 240);

  // Crear renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.innerHTML = "";
  container.appendChild(renderer.domElement);

  // Controles de órbita
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; // Suavizado

  // Iluminación
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
  directionalLight.position.set(40, 100, 80);
  scene.add(directionalLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Grupos para organizar objetos
  const nodesGroup = new THREE.Group();
  const linksGroup = new THREE.Group();
  scene.add(linksGroup);
  scene.add(nodesGroup);

  // Loop de animación
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Guardar instancia
  state.graph3d = {
    scene,
    camera,
    renderer,
    controls,
    nodesGroup,
    linksGroup,
  };

  return state.graph3d;
}

/**
 * Dibuja grafo 3D usando Three.js
 */
function drawGraph3D() {
  const graph = ensureGraph3D();
  const { nodes, links } = buildGraphModel();

  // Limpiar objetos anteriores
  graph.nodesGroup.clear();
  graph.linksGroup.clear();

  if (!nodes.length) return;

  const groupNodes = nodes.filter((n) => n.type === "group");
  const memoryNodes = nodes.filter((n) => n.type === "memory");
  const positions = new Map();

  // Posicionar nodos de grupo en círculo interior
  groupNodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(groupNodes.length, 1);
    const position = new THREE.Vector3(
      Math.cos(angle) * 70,
      20,
      Math.sin(angle) * 70,
    );
    positions.set(node.id, position);

    // Crear esfera para grupo
    const geometry = new THREE.SphereGeometry(6, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color: 0x374151,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    graph.nodesGroup.add(mesh);
  });

  // Posicionar nodos de recuerdo en círculo exterior
  memoryNodes.forEach((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(memoryNodes.length, 1);
    const position = new THREE.Vector3(
      Math.cos(angle) * 120,
      (Math.random() - 0.5) * 40, // Variación vertical
      Math.sin(angle) * 120,
    );
    positions.set(node.id, position);

    // Crear esfera para recuerdo
    const geometry = new THREE.SphereGeometry(3.3, 12, 12);
    const material = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    graph.nodesGroup.add(mesh);
  });

  // Crear líneas de conexión
  links.forEach((link) => {
    const sourcePos = positions.get(link.source);
    const targetPos = positions.get(link.target);

    if (!sourcePos || !targetPos) return;

    const points = [sourcePos, targetPos];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const color = link.kind === "group" ? 0xcbd5e1 : 0xe5e7eb;
    const material = new THREE.LineBasicMaterial({ color });

    const line = new THREE.Line(geometry, material);
    graph.linksGroup.add(line);
  });
}
```

### Gestión de formularios y eventos

```javascript
// Referencias a elementos DOM
const elements = {
  addMemoryBtn: document.getElementById("addMemoryBtn"),
  resetDbBtn: document.getElementById("resetDbBtn"),
  searchInput: document.getElementById("searchInput"),
  emotionFilter: document.getElementById("emotionFilter"),
  graphMode: document.getElementById("graphMode"),
  groupBy: document.getElementById("groupBy"),
  memoryDialog: document.getElementById("memoryDialog"),
  memoryForm: document.getElementById("memoryForm"),
  cancelDialogBtn: document.getElementById("cancelDialogBtn"),
  memTitle: document.getElementById("memTitle"),
  memDate: document.getElementById("memDate"),
  memPlace: document.getElementById("memPlace"),
  memEmotion: document.getElementById("memEmotion"),
  memPeople: document.getElementById("memPeople"),
  memTags: document.getElementById("memTags"),
  memText: document.getElementById("memText"),
};

/**
 * Abre modal para crear nuevo recuerdo
 */
elements.addMemoryBtn.addEventListener("click", () => {
  elements.memoryDialog.showModal();
});

/**
 * Cierra modal sin guardar
 */
elements.cancelDialogBtn.addEventListener("click", () => {
  elements.memoryDialog.close();
});

/**
 * Procesa formulario de nuevo recuerdo
 */
elements.memoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const memory = {
    title: elements.memTitle.value.trim(),
    date: elements.memDate.value,
    place: elements.memPlace.value.trim(),
    emotion: elements.memEmotion.value,
    people: parseCsv(elements.memPeople.value),
    tags: parseCsv(elements.memTags.value),
    text: elements.memText.value.trim(),
    createdAt: new Date().toISOString(),
  };

  // Validación básica
  if (!memory.title || !memory.text || !memory.date) {
    alert("Título, fecha y texto son obligatorios");
    return;
  }

  await addMemory(memory);
  elements.memoryForm.reset();
  elements.memoryDialog.close();
  await refresh();
});

/**
 * Maneja eliminación de recuerdos
 */
document
  .getElementById("memoryList")
  .addEventListener("click", async (event) => {
    const deleteBtn = event.target.closest('button[data-action="delete"]');
    if (!deleteBtn) return;

    const article = event.target.closest(".memory[data-id]");
    if (!article) return;

    const id = Number(article.dataset.id);
    if (!id || !confirm("¿Eliminar este recuerdo?")) return;

    await deleteMemory(id);
    await refresh();
  });

/**
 * Filtro de búsqueda textual
 */
elements.searchInput.addEventListener("input", () => {
  state.search = elements.searchInput.value.trim();
  renderAll();
});

/**
 * Filtro de emoción
 */
elements.emotionFilter.addEventListener("change", () => {
  state.emotionFilter = elements.emotionFilter.value;
  renderAll();
});

/**
 * Cambio de criterio de agrupación
 */
elements.groupBy.addEventListener("change", () => {
  state.groupBy = elements.groupBy.value;
  renderAll();
});

/**
 * Cambio de modo de visualización (2D/3D)
 */
elements.graphMode.addEventListener("change", () => {
  state.graphMode = elements.graphMode.value;
  renderGraph();
});

/**
 * Recalcula sets manualmente
 */
document.getElementById("buildSetsBtn").addEventListener("click", () => {
  renderSets();
});

/**
 * Carga datos iniciales
 */
async function refresh() {
  state.memories = await getAllMemories();
  state.memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  renderAll();
}

function renderAll() {
  applyFilters();
  renderStats();
  renderMemoryList();
  renderSets();
  renderGraph();
}

// Inicializar aplicación
refresh().catch(console.error);
```

---

## 3. Aplicación práctica (25%)

### Estructura HTML completa

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Memento Nous · Memorias semánticas</title>
    <link rel="stylesheet" href="assets/styles.css" />

    <!-- Three.js desde CDN -->
    <script src="https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.161.0/examples/js/controls/OrbitControls.js"></script>
  </head>
  <body>
    <main class="shell">
      <!-- Header -->
      <section class="panel header">
        <div>
          <h1>Memento Nous</h1>
          <p>
            Proyecto de recuerdos semánticos con relaciones, conjuntos y
            visualización de nodos en 2D y 3D.
          </p>
        </div>
        <div class="actions">
          <button id="addMemoryBtn">+ Nuevo recuerdo</button>
          <button id="resetDbBtn" class="secondary">Reset BD</button>
        </div>
      </section>

      <!-- Controles y filtros -->
      <section class="panel controls">
        <div class="row row-4">
          <label
            >Búsqueda global
            <input
              id="searchInput"
              placeholder="Buscar por título, texto, lugar, personas o tags..."
            />
          </label>

          <label
            >Filtrar emoción
            <select id="emotionFilter">
              <option value="all">Todas</option>
              <option value="alegria">Alegría</option>
              <option value="nostalgia">Nostalgia</option>
              <option value="orgullo">Orgullo</option>
              <option value="tristeza">Tristeza</option>
              <option value="sorpresa">Sorpresa</option>
            </select>
          </label>

          <label
            >Vista grafo
            <select id="graphMode">
              <option value="2d">2D</option>
              <option value="3d">3D</option>
            </select>
          </label>

          <label
            >Agrupar por
            <select id="groupBy">
              <option value="emotion">Emoción</option>
              <option value="tag">Tag principal</option>
              <option value="person">Persona principal</option>
              <option value="year">Año</option>
            </select>
          </label>
        </div>

        <div class="stats" id="statsBox"></div>
      </section>

      <!-- Grid de visualización -->
      <section class="grid-2">
        <article class="panel">
          <h2>Mapa semántico de recuerdos</h2>

          <div id="graph2DWrap" class="graph-wrap">
            <canvas id="graph2D" width="900" height="500"></canvas>
          </div>

          <div id="graph3DWrap" class="graph-wrap hidden">
            <div id="graph3D"></div>
          </div>
        </article>

        <article class="panel">
          <h2>Recuerdos guardados</h2>
          <div id="memoryList" class="list"></div>
        </article>
      </section>

      <!-- Sets semánticos -->
      <section class="panel">
        <h2>Conjuntos (sets) de recuerdos</h2>
        <div class="actions">
          <button id="buildSetsBtn" class="secondary">Recalcular sets</button>
        </div>
        <div id="setsList" class="sets"></div>
      </section>
    </main>

    <!-- Modal de formulario -->
    <dialog id="memoryDialog" class="dialog">
      <form id="memoryForm" method="dialog" class="dialog-form">
        <header>
          <h3>Nuevo recuerdo</h3>
        </header>

        <label
          >Título
          <input
            id="memTitle"
            required
            maxlength="120"
            placeholder="Primer día de prácticas"
          />
        </label>

        <div class="row">
          <label
            >Fecha
            <input id="memDate" type="date" required />
          </label>
          <label
            >Lugar
            <input id="memPlace" maxlength="120" placeholder="Valencia" />
          </label>
        </div>

        <label
          >Emoción principal
          <select id="memEmotion" required>
            <option value="">Seleccionar...</option>
            <option value="alegria">Alegría</option>
            <option value="nostalgia">Nostalgia</option>
            <option value="orgullo">Orgullo</option>
            <option value="tristeza">Tristeza</option>
            <option value="sorpresa">Sorpresa</option>
          </select>
        </label>

        <label
          >Personas (separadas por comas)
          <input id="memPeople" placeholder="Juan, Ana, Pedro" />
        </label>

        <label
          >Tags semánticos (separados por comas)
          <input id="memTags" placeholder="trabajo, crecimiento, desafío" />
        </label>

        <label
          >Descripción del recuerdo
          <textarea
            id="memText"
            required
            rows="5"
            placeholder="Descripción detallada del recuerdo..."
          ></textarea>
        </label>

        <footer class="dialog-actions">
          <button type="submit" class="primary">💾 Guardar</button>
          <button type="button" id="cancelDialogBtn" class="secondary">
            Cancelar
          </button>
        </footer>
      </form>
    </dialog>

    <script src="assets/app.js"></script>
  </body>
</html>
```

### Renderizado de estadísticas

```javascript
/**
 * Muestra KPIs del sistema
 */
function renderStats() {
  const totalMemories = state.memories.length;
  const filteredMemories = state.filtered.length;

  // Calcular tags únicos
  const uniqueTags = new Set(state.memories.flatMap((m) => m.tags || [])).size;

  // Calcular personas únicas
  const uniquePeople = new Set(state.memories.flatMap((m) => m.people || []))
    .size;

  document.getElementById("statsBox").innerHTML = `
        <article class="kpi">
            <strong>${totalMemories}</strong>
            <span>Recuerdos totales</span>
        </article>
        <article class="kpi">
            <strong>${filteredMemories}</strong>
            <span>Recuerdos visibles</span>
        </article>
        <article class="kpi">
            <strong>${uniqueTags}</strong>
            <span>Tags semánticos</span>
        </article>
        <article class="kpi">
            <strong>${uniquePeople}</strong>
            <span>Personas únicas</span>
        </article>
    `;
}
```

### Renderizado de lista de recuerdos

```javascript
/**
 * Escapar HTML para prevenir XSS
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * Formatear fechas ISO a formato español
 */
function formatDate(isoDate) {
  if (!isoDate) return "sin fecha";
  try {
    return new Date(isoDate).toLocaleDateString("es-ES");
  } catch {
    return isoDate;
  }
}

/**
 * Renderiza lista de recuerdos filtrados
 */
function renderMemoryList() {
  const container = document.getElementById("memoryList");

  if (!state.filtered.length) {
    container.innerHTML = `
            <article class="memory">
                <p>No hay recuerdos que coincidan.</p>
            </article>
        `;
    return;
  }

  container.innerHTML = state.filtered
    .map(
      (memory) => `
        <article class="memory" data-id="${memory.id}">
            <h4>${escapeHtml(memory.title)}</h4>
            <small>
                ${formatDate(memory.date)} · 
                ${escapeHtml(memory.place || "sin lugar")} · 
                ${emotionLabel(memory.emotion)}
            </small>
            <p>${escapeHtml(memory.text)}</p>
            
            <div class="meta">
                ${(memory.tags || [])
                  .map((tag) => `<span class="chip">#${escapeHtml(tag)}</span>`)
                  .join("")}
                ${(memory.people || [])
                  .map(
                    (person) =>
                      `<span class="chip">@${escapeHtml(person)}</span>`,
                  )
                  .join("")}
            </div>
            
            <div class="actions" style="margin-top:8px">
                <button class="secondary" data-action="delete">Eliminar</button>
            </div>
        </article>
    `,
    )
    .join("");
}

/**
 * Traduce códigos de emoción a etiquetas legibles
 */
function emotionLabel(emotion) {
  const labels = {
    alegria: "Alegría",
    nostalgia: "Nostalgia",
    orgullo: "Orgullo",
    tristeza: "Tristeza",
    sorpresa: "Sorpresa",
  };
  return labels[emotion] || emotion;
}
```

### Casos de uso prácticos

**Caso 1: Crear recuerdo con múltiples tags**

```javascript
const memory = {
  title: "Primer hackathon",
  date: "2025-11-15",
  place: "Barcelona",
  emotion: "orgullo",
  people: ["Ana", "Carlos", "Luis"],
  tags: ["programación", "competición", "equipo", "reto"],
  text: "Participamos en el hackathon nacional y ganamos el tercer premio...",
  createdAt: new Date().toISOString(),
};

await addMemory(memory);
```

**Caso 2: Buscar recuerdos por persona**

```javascript
// El usuario escribe "Ana" en el input de búsqueda
state.search = "Ana";
applyFilters();
// Devuelve todos los recuerdos donde "Ana" aparece en people[]
```

**Caso 3: Visualizar relaciones semánticas**

```javascript
// Dos recuerdos con tags compartidos:
// Recuerdo A: tags = ["programación", "equipo", "JavaScript"]
// Recuerdo B: tags = ["JavaScript", "backend", "API"]
// → Se crea enlace semántico por compartir "JavaScript"
```

### Errores comunes y soluciones

**Error 1:** No manejar ausencia de tags/people.

```javascript
// Incorrecto
const tags = memory.tags.map((t) => t.toLowerCase());

// Correcto
const tags = (memory.tags || []).map((t) => t.toLowerCase());
```

**Error 2:** No limpiar escena 3D antes de redibujar.

```javascript
// Incorrecto
function drawGraph3D() {
  // Añadir objetos directamente
  scene.add(mesh);
}

// Correcto
function drawGraph3D() {
  graph.nodesGroup.clear(); // Limpiar objetos anteriores
  graph.linksGroup.clear();
  // ... añadir nuevos objetos
}
```

**Error 3:** No cerrar conexión IndexedDB.

```javascript
// Incorrecto
request.onsuccess = () => {
  const db = request.result;
  // ... usar db
  resolve(result);
};

// Correcto
transaction.oncomplete = () => {
  db.close(); // Cerrar al finalizar transacción
};
```

---

## 4. Conclusión breve (25%)

### Resumen de puntos clave

Este proyecto de gestión semántica de recuerdos demuestra:

1. **Persistencia local avanzada:** IndexedDB con índices y transacciones
2. **Procesamiento semántico:** Construcción automática de relaciones por tags compartidos
3. **Visualización multimodal:** Grafos 2D (Canvas) y 3D (Three.js) con diferentes layouts
4. **Agrupación dinámica:** Sets generados según múltiples criterios (emoción, tag, persona, año)
5. **Filtrado en tiempo real:** Búsqueda textual y filtros combinables

### Enlace con contenidos de la unidad

Este proyecto integra conceptos del módulo:

- **Bases de datos cliente (Unidad 4):** IndexedDB con object stores, índices y transacciones
- **Canvas API (Unidad 3):** Dibujo 2D de grafos con círculos, líneas y textos
- **Bibliotecas 3D (Unidad 3):** Three.js para renderizado 3D, materiales y controles de cámara
- **Componentes visuales (Unidad 3):** Modal dialogs, formularios dinámicos, chips de tags
- **Estructuras de datos:** Grafos, conjuntos (sets), mapas, relaciones many-to-many

### Aplicaciones en el mundo real

La gestión semántica de información tiene aplicaciones directas en:

- **PKM (Personal Knowledge Management):** Sistemas como Obsidian, Roam Research, Logseq
- **Sistemas de recomendación:** Sugerencias basadas en relaciones semánticas
- **Análisis de redes sociales:** Visualización de comunidades y conexiones
- **Herramientas de investigación:** Organización de literatura científica con etiquetas y relaciones

Los grafos de conocimiento representan un paradigma fundamental en la organización moderna de información, permitiendo descubrir patrones y conexiones que permanecen ocultos en estructuras lineales tradicionales.

### Futuras mejoras

Posibles extensiones del proyecto:

- **Algoritmo de layout:** Force-directed graph para posicionamiento automático óptimo
- **Exportación de datos:** JSON, CSV, Markdown para backup y portabilidad
- **Importación masiva:** Cargar recuerdos desde archivos externos
- **Análisis temporal:** Timeline interactivo mostrando evolución de emociones
- **Búsqueda avanzada:** Operadores booleanos (AND, OR, NOT) y filtros compuestos
- **Compartir grafos:** Exportar visualizaciones como imágenes PNG/SVG

---

## Anexo — Mejoras UI/UX aplicadas (v2)

A continuación se documentan las mejoras implementadas sobre la versión original del proyecto, orientadas a mejorar la experiencia de usuario, la legibilidad visual y la funcionalidad de la aplicación.

### A.1 Navegación por pestañas

Se ha reorganizado la interfaz en **3 pestañas** para reducir el scroll y mejorar la organización:

| Pestaña       | Contenido                                                 |
| ------------- | --------------------------------------------------------- |
| **Recuerdos** | Controles de búsqueda/filtro y lista de recuerdos         |
| **Grafo**     | Visualización 2D/3D del grafo semántico con leyenda       |
| **Conjuntos** | Generación de conjuntos semánticos agrupados por criterio |

El sistema de tabs es declarativo con `data-tab` y clases `.active`, sin librerías externas.

### A.2 Sistema de KPIs en tiempo real

Se añade una **barra de estadísticas** sobre las pestañas con 4 indicadores actualizados en tiempo real:

| KPI       | Color | Fuente de datos                          |
| --------- | ----- | ---------------------------------------- |
| Recuerdos | Azul  | Total de recuerdos almacenados           |
| Filtrados | Verde | Recuerdos visibles tras aplicar filtros  |
| Etiquetas | Ámbar | Set único de tags en todos los recuerdos |
| Personas  | Rojo  | Set único de personas referenciadas      |

Cada KPI tiene barra lateral coloreada e incremento visual con animación hover.

### A.3 Modo oscuro persistente

Se implementa un **toggle de modo oscuro** persistente en `localStorage`:

```javascript
document.body.classList.toggle("dark");
localStorage.setItem("memento-dark", isDark ? "1" : "0");
```

El modo oscuro redefine las CSS Custom Properties (`--bg`, `--panel`, `--text`, etc.) mediante la clase `body.dark`, afectando a todos los componentes automáticamente. El fondo de la escena Three.js también se adapta.

### A.4 Emotion badges coloreados

Cada recuerdo muestra una **insignia de emoción** con color semántico:

| Emoción  | Color de fondo          | Color de texto |
| -------- | ----------------------- | -------------- |
| Alegría  | `rgba(34,197,94,.12)`   | `#16a34a`      |
| Tristeza | `rgba(59,130,246,.12)`  | `#2563eb`      |
| Miedo    | `rgba(139,92,246,.12)`  | `#7c3aed`      |
| Ira      | `rgba(239,68,68,.12)`   | `#dc2626`      |
| Sorpresa | `rgba(245,158,11,.12)`  | `#d97706`      |
| Asco     | `rgba(107,114,128,.12)` | `#4b5563`      |
| Neutral  | `rgba(107,114,128,.08)` | `var(--muted)` |

Los mismos colores se aplican a los nodos del grafo 2D/3D, creando coherencia visual entre lista y grafo.

### A.5 Chips diferenciados para tags y personas

Se añaden **dos estilos de chip distintos**:

- `chip-tag` (azul): para etiquetas con prefijo `#`
- `chip-person` (violeta): para personas con prefijo `@`

Esto permite identificar rápidamente la naturaleza de cada metadato en las tarjetas de recuerdos.

### A.6 Notificaciones toast

Se implementa un **sistema de toasts** con 4 tonos visuales:

| Tono    | Icono | Uso                                   |
| ------- | ----- | ------------------------------------- |
| success | ✓     | Operaciones completadas correctamente |
| error   | ✗     | Errores y fallos                      |
| info    | ℹ     | Información general                   |
| warning | ⚠     | Advertencias                          |

Las notificaciones se apilan en la esquina inferior derecha y desaparecen automáticamente tras 3.5 segundos.

### A.7 Diálogos de confirmación personalizados

Se sustituye el `confirm()` nativo del navegador por **diálogos overlay estilizados** con Promise:

```javascript
const ok = await nousConfirm(
  "Vaciar recuerdos",
  "¿Eliminar todos los recuerdos?",
);
if (!ok) return;
```

Esto unifica la experiencia visual y funciona correctamente en todos los navegadores, incluyendo aquellos que bloquean el `confirm()` nativo.

### A.8 Exportación de recuerdos (JSON)

Nuevo botón **⬇ Exportar** que descarga todos los recuerdos en formato JSON:

```javascript
const blob = new Blob([JSON.stringify(data, null, 2)], {
  type: "application/json",
});
a.download = `memento_nous_${date}.json`;
```

Esto cubre la mejora futura "Exportación de datos" mencionada en la sección 4.

### A.9 Importación de recuerdos (JSON)

Nuevo botón **⬆ Importar** que permite cargar recuerdos desde un archivo JSON externo:

```javascript
const text = await file.text();
const data = JSON.parse(text);
await importMemories(data);
```

Esto cubre la mejora futura "Importación masiva" mencionada en la sección 4.

### A.10 Datos semilla (Seed data)

En la primera ejecución (cuando IndexedDB está vacío), se cargan automáticamente **13 recuerdos de ejemplo** que cubren la totalidad de emociones y múltiples etiquetas/personas, permitiendo evaluar de inmediato el grafo semántico, los filtros y los conjuntos.

### A.11 Leyenda del grafo

Se añade un **panel de leyenda** junto al grafo que muestra los nodos de grupo con su color correspondiente, facilitando la lectura de un grafo con muchos nodos.

### A.12 Enlaces semánticos visuales

En el grafo 2D, los **enlaces semánticos** (por tags compartidos) se dibujan con línea discontinua violeta, diferenciándolos de los enlaces estructurales grupo→recuerdo. Esto ofrece una doble capa de relaciones muy visible.

### A.13 Dialog rediseñado

El formulario de nuevo recuerdo usa `<dialog>` nativo con:

- `::backdrop` con `backdrop-filter: blur(4px)` para foco visual
- Layout estructurado con `dialog-header`, `dialog-body` y `dialog-footer`
- Labels en uppercase con tracking para jerarquía visual
- Animación `slideUp` al abrir

### A.14 Mejoras CSS generales

- **Variables CSS** ampliadas con colores semánticos (`--blue`, `--green`, `--red`, `--amber`, `--violet`)
- **Animaciones**: `fadeIn`, `slideUp`, `pulse` para feedback visual suave
- **Responsive** con breakpoints a 1000px y 680px
- **Sombras y transiciones** sutiles en hover para tarjetas y KPIs
- **Header** rediseñado con logotipo y acciones agrupadas (export/import/dark mode)
- **Footer** con información del curso
- **Scrollbar** personalizado en la lista de recuerdos
- **Focus states** con ring azul en inputs y selects
