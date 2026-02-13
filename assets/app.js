const DB_NAME = 'memento_nous_db';
const DB_VERSION = 1;
const STORE_MEMORIES = 'memories';

const el = {
  addMemoryBtn: document.getElementById('addMemoryBtn'),
  resetDbBtn: document.getElementById('resetDbBtn'),
  searchInput: document.getElementById('searchInput'),
  emotionFilter: document.getElementById('emotionFilter'),
  graphMode: document.getElementById('graphMode'),
  groupBy: document.getElementById('groupBy'),
  statsBox: document.getElementById('statsBox'),
  memoryList: document.getElementById('memoryList'),
  setsList: document.getElementById('setsList'),
  buildSetsBtn: document.getElementById('buildSetsBtn'),
  graph2DWrap: document.getElementById('graph2DWrap'),
  graph3DWrap: document.getElementById('graph3DWrap'),
  graph2D: document.getElementById('graph2D'),
  graph3D: document.getElementById('graph3D'),
  memoryDialog: document.getElementById('memoryDialog'),
  memoryForm: document.getElementById('memoryForm'),
  cancelDialogBtn: document.getElementById('cancelDialogBtn'),
  memTitle: document.getElementById('memTitle'),
  memDate: document.getElementById('memDate'),
  memPlace: document.getElementById('memPlace'),
  memEmotion: document.getElementById('memEmotion'),
  memPeople: document.getElementById('memPeople'),
  memTags: document.getElementById('memTags'),
  memText: document.getElementById('memText'),
};

const state = {
  memories: [],
  filtered: [],
  groupBy: 'emotion',
  graphMode: '2d',
  search: '',
  emotionFilter: 'all',
  graph3d: null,
};

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_MEMORIES)) {
        const store = db.createObjectStore(STORE_MEMORIES, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('emotion', 'emotion', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbAction(mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEMORIES, mode);
    const store = tx.objectStore(STORE_MEMORIES);
    const req = callback(store);

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

const getAllMemories = () => dbAction('readonly', (store) => store.getAll());
const addMemory = (row) => dbAction('readwrite', (store) => store.add(row));
const deleteMemory = (id) => dbAction('readwrite', (store) => store.delete(id));
const clearMemories = () => dbAction('readwrite', (store) => store.clear());

function parseCsv(input) {
  return String(input || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(iso) {
  if (!iso) return 'sin fecha';
  try { return new Date(iso).toLocaleDateString('es-ES'); } catch { return iso; }
}

function emotionLabel(e) {
  const map = {
    alegria: 'Alegría',
    nostalgia: 'Nostalgia',
    orgullo: 'Orgullo',
    tristeza: 'Tristeza',
    sorpresa: 'Sorpresa',
  };
  return map[e] || e;
}

function applyFilters() {
  const q = state.search.toLowerCase();

  state.filtered = state.memories.filter((m) => {
    const hayEmotion = state.emotionFilter === 'all' || m.emotion === state.emotionFilter;

    const hayQuery = q === '' || [
      m.title,
      m.text,
      m.place,
      ...(m.people || []),
      ...(m.tags || []),
    ].join(' ').toLowerCase().includes(q);

    return hayEmotion && hayQuery;
  });
}

function renderStats() {
  const total = state.memories.length;
  const filtered = state.filtered.length;
  const tags = new Set(state.memories.flatMap((m) => m.tags || [])).size;
  const people = new Set(state.memories.flatMap((m) => m.people || [])).size;

  el.statsBox.innerHTML = `
    <article class="kpi"><strong>${total}</strong><span>Recuerdos totales</span></article>
    <article class="kpi"><strong>${filtered}</strong><span>Recuerdos visibles</span></article>
    <article class="kpi"><strong>${tags}</strong><span>Tags semánticos</span></article>
    <article class="kpi"><strong>${people}</strong><span>Personas únicas</span></article>
  `;
}

function renderMemoryList() {
  if (!state.filtered.length) {
    el.memoryList.innerHTML = '<article class="memory"><p>No hay recuerdos que coincidan.</p></article>';
    return;
  }

  el.memoryList.innerHTML = state.filtered.map((m) => `
    <article class="memory" data-id="${m.id}">
      <h4>${escapeHtml(m.title)}</h4>
      <small>${formatDate(m.date)} · ${escapeHtml(m.place || 'sin lugar')} · ${emotionLabel(m.emotion)}</small>
      <p>${escapeHtml(m.text)}</p>
      <div class="meta">
        ${(m.tags || []).map((t) => `<span class="chip">#${escapeHtml(t)}</span>`).join('')}
        ${(m.people || []).map((p) => `<span class="chip">@${escapeHtml(p)}</span>`).join('')}
      </div>
      <div class="actions" style="margin-top:8px">
        <button class="secondary" data-action="delete">Eliminar</button>
      </div>
    </article>
  `).join('');
}

function getGroupValue(memory, groupBy) {
  if (groupBy === 'emotion') return memory.emotion || 'sin_emocion';
  if (groupBy === 'tag') return (memory.tags && memory.tags[0]) || 'sin_tag';
  if (groupBy === 'person') return (memory.people && memory.people[0]) || 'sin_persona';
  if (groupBy === 'year') return String(new Date(memory.date).getFullYear() || 'sin_anio');
  return 'general';
}

function buildSemanticSets() {
  const byGroup = new Map();

  for (const memory of state.filtered) {
    const group = getGroupValue(memory, state.groupBy);
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push(memory);
  }

  const sets = [...byGroup.entries()].map(([group, rows]) => ({
    group,
    count: rows.length,
    ids: rows.map((r) => r.id),
    titles: rows.map((r) => r.title),
  })).sort((a, b) => b.count - a.count);

  return sets;
}

function renderSets() {
  const sets = buildSemanticSets();

  if (!sets.length) {
    el.setsList.innerHTML = '<article class="set">Sin sets para mostrar.</article>';
    return;
  }

  el.setsList.innerHTML = sets.map((s) => `
    <article class="set">
      <strong>${escapeHtml(s.group)} · ${s.count} recuerdo(s)</strong>
      <span>${s.titles.map(escapeHtml).join(' · ')}</span>
    </article>
  `).join('');
}

function buildGraphModel() {
  const groupNodes = new Map();
  const memoryNodes = [];
  const links = [];

  for (const memory of state.filtered) {
    const group = getGroupValue(memory, state.groupBy);
    const gid = `g:${group}`;

    if (!groupNodes.has(gid)) {
      groupNodes.set(gid, { id: gid, label: group, type: 'group' });
    }

    const mid = `m:${memory.id}`;
    memoryNodes.push({ id: mid, label: memory.title, type: 'memory', raw: memory });

    links.push({ source: gid, target: mid, kind: 'group' });

    const peers = state.filtered.filter((x) => x.id !== memory.id);
    for (const other of peers) {
      const sharedTags = (memory.tags || []).filter((t) => (other.tags || []).includes(t));
      if (sharedTags.length > 0 && Number(memory.id) < Number(other.id)) {
        links.push({ source: `m:${memory.id}`, target: `m:${other.id}`, kind: 'semantic' });
      }
    }
  }

  const nodes = [...groupNodes.values(), ...memoryNodes];
  return { nodes, links };
}

function drawGraph2D() {
  const { nodes, links } = buildGraphModel();
  const canvas = el.graph2D;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!nodes.length) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '16px Inter';
    ctx.fillText('No hay nodos para mostrar', 20, 36);
    return;
  }

  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const groups = nodes.filter((n) => n.type === 'group');
  const memories = nodes.filter((n) => n.type === 'memory');

  const pos = new Map();

  groups.forEach((g, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(groups.length, 1);
    const r = 160;
    pos.set(g.id, {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
      r: 26,
      color: '#374151',
    });
  });

  memories.forEach((m, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(memories.length, 1);
    const r = 240;
    pos.set(m.id, {
      x: centerX + Math.cos(angle) * r + (Math.random() - 0.5) * 20,
      y: centerY + Math.sin(angle) * r + (Math.random() - 0.5) * 20,
      r: 12,
      color: '#9ca3af',
    });
  });

  for (const link of links) {
    const a = pos.get(link.source);
    const b = pos.get(link.target);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = link.kind === 'group' ? '#cbd5e1' : '#e5e7eb';
    ctx.lineWidth = link.kind === 'group' ? 1.4 : 1;
    ctx.stroke();
  }

  for (const node of nodes) {
    const p = pos.get(node.id);
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    ctx.font = node.type === 'group' ? '600 12px Inter' : '11px Inter';
    ctx.fillStyle = '#111827';
    const label = node.label.length > 22 ? `${node.label.slice(0, 22)}…` : node.label;
    ctx.fillText(label, p.x + p.r + 4, p.y + 3);
  }
}

function ensureGraph3D() {
  if (state.graph3d) return state.graph3d;

  const wrap = el.graph3D;
  const width = wrap.clientWidth || 900;
  const height = 500;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfbfbfa);

  const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
  camera.position.set(0, 80, 240);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  wrap.innerHTML = '';
  wrap.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  const light = new THREE.DirectionalLight(0xffffff, 0.9);
  light.position.set(40, 100, 80);
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const nodesGroup = new THREE.Group();
  const linksGroup = new THREE.Group();
  scene.add(linksGroup);
  scene.add(nodesGroup);

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  state.graph3d = { scene, camera, renderer, controls, nodesGroup, linksGroup };
  return state.graph3d;
}

function drawGraph3D() {
  const graph = ensureGraph3D();
  const { nodes, links } = buildGraphModel();

  graph.nodesGroup.clear();
  graph.linksGroup.clear();

  if (!nodes.length) return;

  const groupNodes = nodes.filter((n) => n.type === 'group');
  const memoryNodes = nodes.filter((n) => n.type === 'memory');
  const pos = new Map();

  groupNodes.forEach((g, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(groupNodes.length, 1);
    const p = new THREE.Vector3(Math.cos(angle) * 70, 20, Math.sin(angle) * 70);
    pos.set(g.id, p);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0x374151 })
    );
    mesh.position.copy(p);
    graph.nodesGroup.add(mesh);
  });

  memoryNodes.forEach((m, i) => {
    const angle = (Math.PI * 2 * i) / Math.max(memoryNodes.length, 1);
    const p = new THREE.Vector3(Math.cos(angle) * 120, (Math.random() - 0.5) * 40, Math.sin(angle) * 120);
    pos.set(m.id, p);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(3.3, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x9ca3af })
    );
    mesh.position.copy(p);
    graph.nodesGroup.add(mesh);
  });

  links.forEach((l) => {
    const a = pos.get(l.source);
    const b = pos.get(l.target);
    if (!a || !b) return;
    const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const mat = new THREE.LineBasicMaterial({ color: l.kind === 'group' ? 0xcbd5e1 : 0xe5e7eb });
    const line = new THREE.Line(geom, mat);
    graph.linksGroup.add(line);
  });
}

function renderGraph() {
  if (state.graphMode === '2d') {
    el.graph2DWrap.classList.remove('hidden');
    el.graph3DWrap.classList.add('hidden');
    drawGraph2D();
  } else {
    el.graph2DWrap.classList.add('hidden');
    el.graph3DWrap.classList.remove('hidden');
    drawGraph3D();
  }
}

function renderAll() {
  applyFilters();
  renderStats();
  renderMemoryList();
  renderSets();
  renderGraph();
}

async function refresh() {
  state.memories = await getAllMemories();
  state.memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  renderAll();
}

el.addMemoryBtn.addEventListener('click', () => {
  el.memoryDialog.showModal();
});

el.cancelDialogBtn.addEventListener('click', () => {
  el.memoryDialog.close();
});

el.memoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const payload = {
    title: el.memTitle.value.trim(),
    date: el.memDate.value,
    place: el.memPlace.value.trim(),
    emotion: el.memEmotion.value,
    people: parseCsv(el.memPeople.value),
    tags: parseCsv(el.memTags.value),
    text: el.memText.value.trim(),
    createdAt: new Date().toISOString(),
  };

  if (!payload.title || !payload.text || !payload.date) return;

  await addMemory(payload);
  el.memoryForm.reset();
  el.memoryDialog.close();
  await refresh();
});

el.memoryList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action="delete"]');
  if (!button) return;

  const article = event.target.closest('.memory[data-id]');
  if (!article) return;

  const id = Number(article.dataset.id);
  if (!id) return;

  await deleteMemory(id);
  await refresh();
});

el.resetDbBtn.addEventListener('click', async () => {
  const ok = confirm('¿Vaciar todos los recuerdos?');
  if (!ok) return;
  await clearMemories();
  await refresh();
});

el.searchInput.addEventListener('input', () => {
  state.search = el.searchInput.value.trim();
  renderAll();
});

el.emotionFilter.addEventListener('change', () => {
  state.emotionFilter = el.emotionFilter.value;
  renderAll();
});

el.groupBy.addEventListener('change', () => {
  state.groupBy = el.groupBy.value;
  renderAll();
});

el.graphMode.addEventListener('change', () => {
  state.graphMode = el.graphMode.value;
  renderGraph();
});

el.buildSetsBtn.addEventListener('click', () => {
  renderSets();
});

window.addEventListener('resize', () => {
  if (state.graphMode === '3d' && state.graph3d) {
    const wrap = el.graph3D;
    const w = wrap.clientWidth || 900;
    const h = 500;
    state.graph3d.camera.aspect = w / h;
    state.graph3d.camera.updateProjectionMatrix();
    state.graph3d.renderer.setSize(w, h);
  }
});

refresh().catch(console.error);
