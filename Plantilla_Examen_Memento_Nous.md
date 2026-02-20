# Memento-Nous — Plantilla de Examen

**Alumno:** Luis Rodríguez Cedeño · **DNI:** 53945291X  
**Módulo:** Desarrollo de Interfaces · **Curso:** DAM2 2025/26

---

## 1. Introducción

- **Qué es:** Gestor de memorias semánticas con grafos 2D (Canvas) y 3D (Three.js), agrupadas por emociones
- **Contexto:** Módulo de Desarrollo de Interfaces — Canvas 2D, Three.js, IndexedDB, grafos semánticos
- **Objetivos principales:**
  - CRUD de memorias (título, descripción, emoción, personas, tags, fecha)
  - Visualización de grafos semánticos en 2D (Canvas) y 3D (Three.js)
  - Agrupación por emociones, tags, personas, año (sets semánticos)
  - Enlace semántico automático: memorias con tags compartidos se conectan
  - 8 emociones con colores únicos (alegría, tristeza, sorpresa, nostalgia, etc.)
- **Tecnologías clave:**
  - JavaScript vanilla, Canvas 2D (grafos 2D), Three.js (grafos 3D)
  - IndexedDB para persistencia, OrbitControls (navegación 3D)
- **Arquitectura:** `index.html` (SPA con tabs) → `assets/app.js` (449+ líneas: CRUD, grafos, semántica) → `assets/styles.css` (glassmorphism + dark mode)

---

## 2. Desarrollo de las partes

### 2.1 Modelo de emociones con colores

- Mapa `EMOTIONS` → cada emoción tiene etiqueta, icono y color
- El color se usa en grafos (nodos, bordes) y en la UI (badges, tags)

```javascript
const EMOTIONS = {
  alegria: { label: "Alegría", icon: "😊", color: "#22c55e" },
  tristeza: { label: "Tristeza", icon: "😢", color: "#3b82f6" },
  sorpresa: { label: "Sorpresa", icon: "😲", color: "#f59e0b" },
  nostalgia: { label: "Nostalgia", icon: "🌅", color: "#a855f7" },
  miedo: { label: "Miedo", icon: "😰", color: "#ef4444" },
  calma: { label: "Calma", icon: "🧘", color: "#06b6d4" },
  gratitud: { label: "Gratitud", icon: "🙏", color: "#10b981" },
  inspiracion: { label: "Inspiración", icon: "💡", color: "#f97316" },
};
```

> **Explicación:** Cada emoción tiene su color hex. Se reutiliza en toda la app: nodos del grafo se colorean según la emoción de la memoria, badges en la lista, bordes en conexiones.

### 2.2 Modelo de grafo semántico

- `buildGraphModel()` → crea nodos de grupo + nodos de memoria + enlaces
- Enlace semántico: dos memorias se conectan si comparten al menos 1 tag
- Tipos de nodo: `group` (emoción como hub central) y `memory` (individual)

```javascript
function buildGraphModel(memories) {
  const nodes = [],
    links = [];

  // Nodos de grupo (emociones)
  const groups = {};
  memories.forEach((m) => {
    if (!groups[m.emotion]) {
      groups[m.emotion] = {
        id: `grp_${m.emotion}`,
        type: "group",
        label: EMOTIONS[m.emotion]?.label || m.emotion,
        color: EMOTIONS[m.emotion]?.color || "#888",
      };
      nodes.push(groups[m.emotion]);
    }
  });

  // Nodos de memoria + enlace al grupo
  memories.forEach((m) => {
    const node = {
      id: m.id,
      type: "memory",
      label: m.title,
      color: EMOTIONS[m.emotion]?.color || "#888",
      data: m,
    };
    nodes.push(node);
    links.push({ source: `grp_${m.emotion}`, target: m.id });
  });

  // Enlaces semánticos (tags compartidos)
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const shared = memories[i].tags.filter((t) =>
        memories[j].tags.includes(t),
      );
      if (shared.length > 0) {
        links.push({
          source: memories[i].id,
          target: memories[j].id,
          semantic: true,
        });
      }
    }
  }

  return { nodes, links };
}
```

> **Explicación:** Se crean nodos de grupo (uno por emoción) y nodos individuales (uno por memoria). Cada memoria se enlaza a su grupo emocional. Luego, se comparan tags: si dos memorias comparten alguno, se crea un enlace semántico (línea discontinua en el grafo).

### 2.3 Grafo 2D — Canvas

- Posicionamiento circular: ángulos equidistantes desde el centro
- Nodos como círculos (`arc`), enlaces como líneas, labels con `fillText`
- Grupos más grandes en el centro, memorias en órbita

```javascript
function drawGraph2D(model) {
  const canvas = document.getElementById("graph2d");
  const ctx = canvas.getContext("2d");
  const cx = canvas.width / 2,
    cy = canvas.height / 2;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Dibujar enlaces
  model.links.forEach((link) => {
    const src = model.nodes.find((n) => n.id === link.source);
    const tgt = model.nodes.find((n) => n.id === link.target);
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = link.semantic
      ? "rgba(168,85,247,0.3)"
      : "rgba(100,100,100,0.2)";
    ctx.setLineDash(link.semantic ? [4, 4] : []);
    ctx.stroke();
  });

  // Dibujar nodos
  model.nodes.forEach((node) => {
    const r = node.type === "group" ? 18 : 10;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = node.color;
    ctx.fill();
    ctx.fillStyle = "#374151";
    ctx.fillText(node.label, node.x, node.y + r + 14);
  });
}
```

> **Explicación:** Se recorren enlaces (líneas entre nodos) y luego nodos (círculos). Los enlaces semánticos se dibujan con línea discontinua (`setLineDash`). Los nodos de grupo son más grandes (r=18 vs r=10).

### 2.4 Grafo 3D — Three.js

- `THREE.Scene` + `PerspectiveCamera` + `WebGLRenderer`
- Nodos como `SphereGeometry` con `MeshStandardMaterial` (color de emoción)
- Enlaces como `LineBasicMaterial` + `BufferGeometry`
- `OrbitControls` → rotación/zoom interactivo con ratón

```javascript
function drawGraph3D(model) {
  const container = document.getElementById("graph3d");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1a1a2e);

  const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
  );
  camera.position.set(0, 0, 250);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);

  // Luces
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(100, 100, 100);
  scene.add(dir);

  // Nodos como esferas
  model.nodes.forEach((node) => {
    const r = node.type === "group" ? 8 : 4;
    const geo = new THREE.SphereGeometry(r, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: node.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(node.x3d, node.y3d, node.z3d);
    scene.add(mesh);
  });

  // Enlaces como líneas
  model.links.forEach((link) => {
    const points = [
      new THREE.Vector3(src.x3d, src.y3d, src.z3d),
      new THREE.Vector3(tgt.x3d, tgt.y3d, tgt.z3d),
    ];
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: 0x666666, opacity: 0.4 });
    scene.add(new THREE.Line(geo, mat));
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();
}
```

> **Explicación:** Three.js crea una escena 3D con esferas (nodos) y líneas (enlaces). `OrbitControls` permite rotar y hacer zoom. La iluminación (ambient + directional) da profundidad a las esferas. `animate()` ejecuta el render loop a 60 FPS.

### 2.5 Sets semánticos — Agrupación multidimensional

- Agrupaciones por: emoción, tag, persona, año
- Usado para filtrar y navegar memorias desde diferentes perspectivas

```javascript
function buildSemanticSets(memories) {
  const sets = { byEmotion: {}, byTag: {}, byPerson: {}, byYear: {} };

  memories.forEach((m) => {
    // Por emoción
    (sets.byEmotion[m.emotion] ??= []).push(m);
    // Por tag
    m.tags.forEach((tag) => (sets.byTag[tag] ??= []).push(m));
    // Por persona
    m.people.forEach((p) => (sets.byPerson[p] ??= []).push(m));
    // Por año
    const year = new Date(m.date).getFullYear();
    (sets.byYear[year] ??= []).push(m);
  });

  return sets;
}
```

> **Explicación:** Agrupa memorias en 4 dimensiones. El operador `??=` (nullish assignment) crea el array si no existe. Cada dimensión permite explorar memorias desde un punto de vista diferente (ej: "todas las memorias de alegría" o "todas con la tag viaje").

---

## 3. Presentación del proyecto

- **Flujo:** Crear memorias → Asignar emociones/tags/personas → Ver grafo 2D → Rotar grafo 3D → Filtrar por sets semánticos
- **Puntos fuertes:** Doble visualización (2D Canvas + 3D Three.js), enlaces semánticos automáticos, 8 emociones
- **Demo:** Abrir index.html → datos semilla (13 memorias) → pestaña Grafo 2D → pestaña 3D → rotar/zoom
- **Seed data:** 13 memorias predefinidas con variedad de emociones, tags y personas

---

## 4. Conclusión

- **Competencias:** Canvas 2D (grafos), Three.js (3D), IndexedDB, semántica relacional, visualización de datos
- **Concepto clave:** Enlace semántico = relación implícita basada en tags compartidos (no relación explícita)
- **Three.js essentials:** Scene, Camera, Renderer, Geometry, Material, Mesh, OrbitControls, Lights
- **Canvas vs Three.js:** Canvas para grafos planos simples, Three.js para exploración 3D interactiva
- **Valoración:** Proyecto creativo que combina persistencia, semántica y visualización dual 2D/3D
