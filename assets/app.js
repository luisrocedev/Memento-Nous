/**
 * Memento Nous — app.js v2
 * Dark mode, tabs, toasts, custom confirm, export/import, auto-seed,
 * emotion badges, differentiated chips, graph legend, semantic link styling.
 */

const DB_NAME = 'memento_nous_db';
const DB_VERSION = 1;
const STORE_MEMORIES = 'memories';

/* ───── Emotion config ───── */
const EMOTIONS = {
  alegria:   { label: 'Alegría',   color: '#16a34a', hex: 0x22c55e },
  nostalgia: { label: 'Nostalgia', color: '#2563eb', hex: 0x3b82f6 },
  orgullo:   { label: 'Orgullo',   color: '#d97706', hex: 0xf59e0b },
  tristeza:  { label: 'Tristeza',  color: '#7c3aed', hex: 0x8b5cf6 },
  sorpresa:  { label: 'Sorpresa',  color: '#dc2626', hex: 0xef4444 },
};

/* ───── DOM refs ───── */
const el = {
  addMemoryBtn:   document.getElementById('addMemoryBtn'),
  resetDbBtn:     document.getElementById('resetDbBtn'),
  exportBtn:      document.getElementById('exportBtn'),
  importBtn:      document.getElementById('importBtn'),
  importFile:     document.getElementById('importFile'),
  darkModeBtn:    document.getElementById('darkModeBtn'),
  searchInput:    document.getElementById('searchInput'),
  emotionFilter:  document.getElementById('emotionFilter'),
  graphMode:      document.getElementById('graphMode'),
  groupBy:        document.getElementById('groupBy'),
  statsBox:       document.getElementById('statsBox'),
  memoryList:     document.getElementById('memoryList'),
  setsList:       document.getElementById('setsList'),
  buildSetsBtn:   document.getElementById('buildSetsBtn'),
  graphLegend:    document.getElementById('graphLegend'),
  graph2DWrap:    document.getElementById('graph2DWrap'),
  graph3DWrap:    document.getElementById('graph3DWrap'),
  graph2D:        document.getElementById('graph2D'),
  graph3D:        document.getElementById('graph3D'),
  memoryDialog:   document.getElementById('memoryDialog'),
  memoryForm:     document.getElementById('memoryForm'),
  cancelDialogBtn:document.getElementById('cancelDialogBtn'),
  closeDialogBtn: document.getElementById('closeDialogBtn'),
  memTitle:       document.getElementById('memTitle'),
  memDate:        document.getElementById('memDate'),
  memPlace:       document.getElementById('memPlace'),
  memEmotion:     document.getElementById('memEmotion'),
  memPeople:      document.getElementById('memPeople'),
  memTags:        document.getElementById('memTags'),
  memText:        document.getElementById('memText'),
  toastContainer: document.getElementById('toastContainer'),
  confirmDialog:  document.getElementById('confirmDialog'),
  confirmTitle:   document.getElementById('confirmTitle'),
  confirmMsg:     document.getElementById('confirmMsg'),
  confirmOk:      document.getElementById('confirmOk'),
  confirmCancel:  document.getElementById('confirmCancel'),
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

/* ───── Dark mode ───── */
function applyDark(dark) {
  document.body.classList.toggle('dark', dark);
  localStorage.setItem('memento-dark', dark ? '1' : '0');
  // Update Three.js scene bg
  if (state.graph3d) {
    state.graph3d.scene.background = new THREE.Color(dark ? 0x26262b : 0xfbfbfa);
  }
  renderGraph();
}
(function initDark() {
  const stored = localStorage.getItem('memento-dark');
  const prefer = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = stored !== null ? stored === '1' : prefer;
  document.body.classList.toggle('dark', isDark);
})();
el.darkModeBtn?.addEventListener('click', () => {
  applyDark(!document.body.classList.contains('dark'));
});

/* ───── Tabs ───── */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    // Re-render graph when switching to graph tab
    if (btn.dataset.tab === 'graph') renderGraph();
  });
});

/* ───── Toast ───── */
function toast(msg, tone = 'info') {
  const div = document.createElement('div');
  div.className = `toast toast-${tone}`;
  const icons = { success: '\u2713', error: '\u2717', info: '\u2139', warning: '\u26A0' };
  div.textContent = `${icons[tone] || ''} ${msg}`;
  el.toastContainer.appendChild(div);
  setTimeout(() => div.remove(), 3500);
}

/* ───── Custom confirm ───── */
function nousConfirm(title, msg) {
  return new Promise(resolve => {
    el.confirmTitle.textContent = title;
    el.confirmMsg.textContent = msg;
    el.confirmDialog.showModal();
    const cleanup = val => { el.confirmDialog.close(); resolve(val); };
    el.confirmOk.onclick = () => cleanup(true);
    el.confirmCancel.onclick = () => cleanup(false);
  });
}

/* ───── IndexedDB ───── */
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

async function dbAction(mode, cb) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEMORIES, mode);
    const store = tx.objectStore(STORE_MEMORIES);
    const req = cb(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

const getAllMemories = () => dbAction('readonly', s => s.getAll());
const addMemory = row => dbAction('readwrite', s => s.add(row));
const deleteMemory = id => dbAction('readwrite', s => s.delete(id));
const clearMemories = () => dbAction('readwrite', s => s.clear());

/* ───── Seed data (13 recuerdos) ───── */
function seedData() {
  return [
    { title:'Primer día de prácticas', date:'2025-09-01', place:'Oviedo', emotion:'alegria',
      people:['Ana','Carlos'], tags:['trabajo','crecimiento','inicio'], text:'Llegué nervioso pero todo fue muy bien. El equipo me recibió con los brazos abiertos.' },
    { title:'Hackathon universitario', date:'2025-11-15', place:'Barcelona', emotion:'orgullo',
      people:['Luis','María','Carlos'], tags:['programación','competición','equipo'], text:'Participamos en el hackathon nacional y ganamos el tercer premio con nuestro proyecto de IA.' },
    { title:'Despedida de promoción', date:'2025-06-20', place:'Gijón', emotion:'nostalgia',
      people:['Ana','Pedro','Lucía','Jorge'], tags:['universidad','amigos','final'], text:'Celebramos el fin de carrera en la playa. Risas, recuerdos y mucha nostalgia.' },
    { title:'Entrevista en startup', date:'2025-10-05', place:'Madrid', emotion:'sorpresa',
      people:['Elena'], tags:['trabajo','entrevista','startup'], text:'No esperaba que me llamasen, pero la entrevista fue genial y me hicieron oferta en el acto.' },
    { title:'Proyecto cancelado', date:'2025-03-12', place:'Oviedo', emotion:'tristeza',
      people:['Carlos','Ana'], tags:['trabajo','frustración','aprendizaje'], text:'Tras meses de trabajo, el cliente canceló el proyecto. Fue duro pero aprendimos mucho.' },
    { title:'Charla sobre Canvas API', date:'2025-04-18', place:'Valencia', emotion:'orgullo',
      people:['Profesor García'], tags:['programación','conferencia','aprendizaje'], text:'Di mi primera charla técnica sobre visualización con Canvas API frente a 60 personas.' },
    { title:'Viaje a Lisboa', date:'2025-08-10', place:'Lisboa', emotion:'alegria',
      people:['Ana','Luis'], tags:['viaje','cultura','amigos'], text:'Tres días increíbles descubriendo la ciudad: tranvías, pasteles de Belém y fado.' },
    { title:'Examen final DAM', date:'2026-01-28', place:'Gijón', emotion:'sorpresa',
      people:['Pedro','María'], tags:['universidad','examen','estrés'], text:'El examen salió mucho mejor de lo esperado. Celebramos con tortilla en el bar de siempre.' },
    { title:'Mudanza al piso nuevo', date:'2025-07-01', place:'Oviedo', emotion:'alegria',
      people:['Familia'], tags:['hogar','cambio','independencia'], text:'Por fin independiente. Montar muebles de IKEA nunca fue tan divertido (ni frustrante).' },
    { title:'Bug en producción', date:'2025-12-03', place:'Remoto', emotion:'tristeza',
      people:['Carlos'], tags:['trabajo','bug','producción','aprendizaje'], text:'Un bug en el deploy de viernes provocó caída del servicio. Aprendí que nunca se deploya en viernes.' },
    { title:'Cumpleaños sorpresa', date:'2025-05-22', place:'Gijón', emotion:'sorpresa',
      people:['Ana','Lucía','Pedro','Jorge','Familia'], tags:['cumpleaños','amigos','familia'], text:'Llegué a casa y estaban todos esperándome. La mejor sorpresa de mi vida.' },
    { title:'Taller de Three.js', date:'2025-11-08', place:'Online', emotion:'orgullo',
      people:['Profesor García','María'], tags:['programación','3d','aprendizaje','three.js'], text:'Completé el taller avanzado de Three.js. Monté una escena 3D completa con iluminación y controles.' },
    { title:'Última clase del módulo', date:'2026-02-14', place:'Gijón', emotion:'nostalgia',
      people:['Profesor García','Ana','Carlos','Pedro'], tags:['universidad','final','equipo','recuerdos'], text:'La última clase de Desarrollo de Interfaces. El profesor nos deseó suerte y todos aplaudimos.' },
  ].map(m => ({ ...m, createdAt: new Date(m.date).toISOString() }));
}

/* ───── Helpers ───── */
function parseCsv(input) {
  return String(input || '').split(',').map(x => x.trim()).filter(Boolean);
}

function escapeHtml(v) {
  return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

function formatDate(iso) {
  if (!iso) return 'sin fecha';
  try { return new Date(iso).toLocaleDateString('es-ES'); } catch { return iso; }
}

function emotionLabel(e) {
  return EMOTIONS[e]?.label || e;
}

function emotionColor(e) {
  return EMOTIONS[e]?.color || '#6b7280';
}

/* ───── Filters ───── */
function applyFilters() {
  const q = state.search.toLowerCase();
  state.filtered = state.memories.filter(m => {
    const byEmotion = state.emotionFilter === 'all' || m.emotion === state.emotionFilter;
    const text = [m.title, m.text, m.place, ...(m.people||[]), ...(m.tags||[])].join(' ').toLowerCase();
    return byEmotion && (q === '' || text.includes(q));
  });
}

/* ───── KPIs ───── */
function renderStats() {
  const total = state.memories.length;
  const filtered = state.filtered.length;
  const tags = new Set(state.memories.flatMap(m => m.tags || [])).size;
  const people = new Set(state.memories.flatMap(m => m.people || [])).size;

  el.statsBox.innerHTML = `
    <article class="kpi kpi-blue"><strong>${total}</strong><span>Recuerdos totales</span></article>
    <article class="kpi kpi-green"><strong>${filtered}</strong><span>Recuerdos visibles</span></article>
    <article class="kpi kpi-amber"><strong>${tags}</strong><span>Tags semánticos</span></article>
    <article class="kpi kpi-red"><strong>${people}</strong><span>Personas únicas</span></article>
  `;
}

/* ───── Memory list ───── */
function renderMemoryList() {
  if (!state.filtered.length) {
    el.memoryList.innerHTML = '<article class="memory"><p>No hay recuerdos que coincidan.</p></article>';
    return;
  }

  el.memoryList.innerHTML = state.filtered.map(m => `
    <article class="memory" data-id="${m.id}">
      <h4>${escapeHtml(m.title)}</h4>
      <small>
        ${formatDate(m.date)} · ${escapeHtml(m.place || 'sin lugar')} ·
        <span class="emotion-badge emotion-${m.emotion}">${emotionLabel(m.emotion)}</span>
      </small>
      <p>${escapeHtml(m.text)}</p>
      <div class="meta">
        ${(m.tags||[]).map(t => `<span class="chip chip-tag">#${escapeHtml(t)}</span>`).join('')}
        ${(m.people||[]).map(p => `<span class="chip chip-person">@${escapeHtml(p)}</span>`).join('')}
      </div>
      <div class="actions" style="margin-top:8px">
        <button class="secondary" data-action="delete">Eliminar</button>
      </div>
    </article>
  `).join('');
}

/* ───── Semantic sets ───── */
function getGroupValue(m, g) {
  if (g === 'emotion') return m.emotion || 'sin_emocion';
  if (g === 'tag') return (m.tags && m.tags[0]) || 'sin_tag';
  if (g === 'person') return (m.people && m.people[0]) || 'sin_persona';
  if (g === 'year') return String(new Date(m.date).getFullYear() || 'sin_anio');
  return 'general';
}

function buildSemanticSets() {
  const byGroup = new Map();
  for (const m of state.filtered) {
    const g = getGroupValue(m, state.groupBy);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(m);
  }
  return [...byGroup.entries()].map(([g, rows]) => ({
    group: g, count: rows.length,
    ids: rows.map(r => r.id),
    titles: rows.map(r => r.title),
  })).sort((a, b) => b.count - a.count);
}

function renderSets() {
  const sets = buildSemanticSets();
  if (!sets.length) {
    el.setsList.innerHTML = '<article class="set">Sin sets para mostrar.</article>';
    return;
  }
  el.setsList.innerHTML = sets.map(s => `
    <article class="set">
      <strong>${escapeHtml(s.group)} · ${s.count} recuerdo(s)</strong>
      <span>${s.titles.map(escapeHtml).join(' · ')}</span>
    </article>
  `).join('');
}

/* ───── Graph model ───── */
function buildGraphModel() {
  const groupNodes = new Map();
  const memoryNodes = [];
  const links = [];

  for (const m of state.filtered) {
    const g = getGroupValue(m, state.groupBy);
    const gid = `g:${g}`;
    if (!groupNodes.has(gid)) groupNodes.set(gid, { id: gid, label: g, type: 'group' });

    const mid = `m:${m.id}`;
    memoryNodes.push({ id: mid, label: m.title, type: 'memory', raw: m });
    links.push({ source: gid, target: mid, kind: 'group' });
  }

  // Semantic links (shared tags)
  for (let i = 0; i < memoryNodes.length; i++) {
    for (let j = i + 1; j < memoryNodes.length; j++) {
      const a = memoryNodes[i].raw, b = memoryNodes[j].raw;
      const shared = (a.tags||[]).filter(t => (b.tags||[]).includes(t));
      if (shared.length > 0) {
        links.push({ source: memoryNodes[i].id, target: memoryNodes[j].id, kind: 'semantic' });
      }
    }
  }

  return { nodes: [...groupNodes.values(), ...memoryNodes], links };
}

/* ───── Graph colors (dark adaptive) ───── */
function getGraphColors() {
  const d = document.body.classList.contains('dark');
  return {
    bg:       d ? '#26262b' : '#fcfcfb',
    text:     d ? '#d4d4d8' : '#111827',
    muted:    d ? '#71717a' : '#6b7280',
    groupFill:d ? '#71717a' : '#374151',
    memFill:  d ? '#52525b' : '#9ca3af',
    linkGroup:d ? '#4a4a50' : '#cbd5e1',
    linkSem:  d ? '#7c3aed' : '#8b5cf6',
    sceneBg:  d ? 0x26262b : 0xfbfbfa,
    groupHex: d ? 0x71717a : 0x374151,
    memHex:   d ? 0x52525b : 0x9ca3af,
    linkGHex: d ? 0x4a4a50 : 0xcbd5e1,
    linkSHex: d ? 0x7c3aed : 0x8b5cf6,
  };
}

/* ───── Graph 2D ───── */
function drawGraph2D() {
  const { nodes, links } = buildGraphModel();
  const canvas = el.graph2D;
  const ctx = canvas.getContext('2d');
  const cc = getGraphColors();

  ctx.fillStyle = cc.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!nodes.length) {
    ctx.fillStyle = cc.muted;
    ctx.font = '16px Inter';
    ctx.fillText('No hay nodos para mostrar', 20, 36);
    return;
  }

  const cx = canvas.width / 2, cy = canvas.height / 2;
  const groups = nodes.filter(n => n.type === 'group');
  const mems = nodes.filter(n => n.type === 'memory');
  const pos = new Map();

  groups.forEach((g, i) => {
    const a = (Math.PI * 2 * i) / Math.max(groups.length, 1);
    pos.set(g.id, { x: cx + Math.cos(a) * 160, y: cy + Math.sin(a) * 160, r: 26, color: cc.groupFill });
  });

  mems.forEach((m, i) => {
    const a = (Math.PI * 2 * i) / Math.max(mems.length, 1);
    const eColor = emotionColor(m.raw.emotion);
    pos.set(m.id, {
      x: cx + Math.cos(a) * 240 + (Math.random() - 0.5) * 20,
      y: cy + Math.sin(a) * 240 + (Math.random() - 0.5) * 20,
      r: 12, color: eColor,
    });
  });

  // Draw links
  for (const l of links) {
    const a = pos.get(l.source), b = pos.get(l.target);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    if (l.kind === 'group') {
      ctx.strokeStyle = cc.linkGroup;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = cc.linkSem;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 4]);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Draw nodes
  for (const n of nodes) {
    const p = pos.get(n.id);
    if (!p) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();

    ctx.font = n.type === 'group' ? '600 12px Inter' : '11px Inter';
    ctx.fillStyle = cc.text;
    const label = n.label.length > 22 ? `${n.label.slice(0, 22)}…` : n.label;
    ctx.fillText(label, p.x + p.r + 4, p.y + 3);
  }
}

/* ───── Graph 3D ───── */
function ensureGraph3D() {
  if (state.graph3d) return state.graph3d;

  const wrap = el.graph3D;
  const w = wrap.clientWidth || 900, h = 500;
  const cc = getGraphColors();

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(cc.sceneBg);

  const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 2000);
  camera.position.set(0, 80, 240);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  wrap.innerHTML = '';
  wrap.appendChild(renderer.domElement);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  scene.add(new THREE.DirectionalLight(0xffffff, 0.9).translateX(40).translateY(100).translateZ(80));
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));

  const nodesGroup = new THREE.Group();
  const linksGroup = new THREE.Group();
  scene.add(linksGroup);
  scene.add(nodesGroup);

  (function animate() { requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();

  state.graph3d = { scene, camera, renderer, controls, nodesGroup, linksGroup };
  return state.graph3d;
}

function drawGraph3D() {
  const graph = ensureGraph3D();
  const { nodes, links } = buildGraphModel();
  const cc = getGraphColors();

  graph.scene.background = new THREE.Color(cc.sceneBg);
  graph.nodesGroup.clear();
  graph.linksGroup.clear();

  if (!nodes.length) return;

  const groups = nodes.filter(n => n.type === 'group');
  const mems = nodes.filter(n => n.type === 'memory');
  const pos = new Map();

  groups.forEach((g, i) => {
    const a = (Math.PI * 2 * i) / Math.max(groups.length, 1);
    const p = new THREE.Vector3(Math.cos(a) * 70, 20, Math.sin(a) * 70);
    pos.set(g.id, p);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 16),
      new THREE.MeshStandardMaterial({ color: cc.groupHex })
    );
    mesh.position.copy(p);
    graph.nodesGroup.add(mesh);
  });

  mems.forEach((m, i) => {
    const a = (Math.PI * 2 * i) / Math.max(mems.length, 1);
    const p = new THREE.Vector3(Math.cos(a) * 120, (Math.random() - 0.5) * 40, Math.sin(a) * 120);
    pos.set(m.id, p);
    const eHex = EMOTIONS[m.raw?.emotion]?.hex || cc.memHex;
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(3.3, 12, 12),
      new THREE.MeshStandardMaterial({ color: eHex })
    );
    mesh.position.copy(p);
    graph.nodesGroup.add(mesh);
  });

  links.forEach(l => {
    const a = pos.get(l.source), b = pos.get(l.target);
    if (!a || !b) return;
    const geom = new THREE.BufferGeometry().setFromPoints([a, b]);
    const color = l.kind === 'group' ? cc.linkGHex : cc.linkSHex;
    graph.linksGroup.add(new THREE.Line(geom, new THREE.LineBasicMaterial({ color })));
  });
}

/* ───── Legend ───── */
function renderLegend() {
  const groups = [...new Set(state.filtered.map(m => getGroupValue(m, state.groupBy)))];
  if (!groups.length) {
    el.graphLegend.innerHTML = '<p style="color:var(--muted);font-size:.82rem">Sin nodos</p>';
    return;
  }

  el.graphLegend.innerHTML = groups.map(g => {
    const color = state.groupBy === 'emotion' ? emotionColor(g) : '#374151';
    const label = state.groupBy === 'emotion' ? emotionLabel(g) : escapeHtml(g);
    return `<div class="legend-item"><span class="legend-dot" style="background:${color}"></span>${label}</div>`;
  }).join('');
}

/* ───── Render graph ───── */
function renderGraph() {
  renderLegend();
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

/* ───── Render all ───── */
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

/* ───── Events ───── */
el.addMemoryBtn.addEventListener('click', () => el.memoryDialog.showModal());
el.cancelDialogBtn.addEventListener('click', () => el.memoryDialog.close());
el.closeDialogBtn?.addEventListener('click', () => el.memoryDialog.close());

el.memoryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
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
  if (!payload.title || !payload.text || !payload.date || !payload.emotion) {
    toast('Título, fecha, emoción y texto son obligatorios', 'warning');
    return;
  }
  await addMemory(payload);
  el.memoryForm.reset();
  el.memoryDialog.close();
  toast('Recuerdo guardado', 'success');
  await refresh();
});

el.memoryList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action="delete"]');
  if (!btn) return;
  const article = e.target.closest('.memory[data-id]');
  if (!article) return;
  const ok = await nousConfirm('Eliminar recuerdo', 'Se eliminará este recuerdo de la base de datos.');
  if (!ok) return;
  await deleteMemory(Number(article.dataset.id));
  toast('Recuerdo eliminado', 'success');
  await refresh();
});

el.resetDbBtn.addEventListener('click', async () => {
  const ok = await nousConfirm('Vaciar recuerdos', '¿Eliminar todos los recuerdos? Esta acción no se puede deshacer.');
  if (!ok) return;
  await clearMemories();
  toast('Base de datos vaciada', 'success');
  await refresh();
});

/* Export */
el.exportBtn.addEventListener('click', async () => {
  const data = await getAllMemories();
  if (!data.length) { toast('Sin datos para exportar', 'warning'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `memento_nous_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Recuerdos exportados como JSON', 'success');
});

/* Import */
el.importBtn.addEventListener('click', () => el.importFile.click());
el.importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data)) throw new Error('El archivo debe contener un array JSON');
    let count = 0;
    for (const row of data) {
      if (row.title && row.date && row.emotion) {
        const { id, ...clean } = row;
        clean.createdAt = clean.createdAt || new Date().toISOString();
        await addMemory(clean);
        count++;
      }
    }
    toast(`${count} recuerdos importados`, 'success');
    await refresh();
  } catch (err) {
    toast(`Error al importar: ${err.message}`, 'error');
  }
  el.importFile.value = '';
});

/* Filters */
el.searchInput.addEventListener('input', () => { state.search = el.searchInput.value.trim(); renderAll(); });
el.emotionFilter.addEventListener('change', () => { state.emotionFilter = el.emotionFilter.value; renderAll(); });
el.groupBy.addEventListener('change', () => { state.groupBy = el.groupBy.value; renderAll(); });
el.graphMode.addEventListener('change', () => { state.graphMode = el.graphMode.value; renderGraph(); });
el.buildSetsBtn.addEventListener('click', () => renderSets());

/* Resize */
window.addEventListener('resize', () => {
  if (state.graphMode === '3d' && state.graph3d) {
    const w = el.graph3D.clientWidth || 900, h = 500;
    state.graph3d.camera.aspect = w / h;
    state.graph3d.camera.updateProjectionMatrix();
    state.graph3d.renderer.setSize(w, h);
  }
});

/* ───── Boot ───── */
(async function boot() {
  try {
    state.memories = await getAllMemories();
    if (!state.memories.length) {
      for (const m of seedData()) await addMemory(m);
      state.memories = await getAllMemories();
      toast('Recuerdos de ejemplo cargados automáticamente', 'info');
    }
    state.memories.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    renderAll();
  } catch (err) { console.error(err); }
})();
