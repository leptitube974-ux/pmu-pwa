// ============================================================
//  PMU Assistant — app.js  (v2 — analyse automatique)
// ============================================================

// ---- NAVIGATION -------------------------------------------

const TABS = [
  ['tab-home',      'view-home'],
  ['tab-quinte',    'view-quinte'],
  ['tab-biblio',    'view-biblio'],
  ['tab-assistant', 'view-assistant'],
  ['tab-grille',    'view-grille'],
];

function showTab(viewId, tabId) {
  for (const [t, v] of TABS) {
    document.getElementById(v)?.classList.toggle('hidden', v !== viewId);
    document.getElementById(t)?.classList.toggle('active', t === tabId);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---- DATE UTILS -------------------------------------------

function tomorrowValue() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dateToApi(val) {
  // "2026-05-31" → "20260531"
  return val.replace(/-/g, '');
}

function displayDate(apiDate) {
  // "20260531" → "31/05/2026"
  return `${apiDate.slice(6)}/${apiDate.slice(4, 6)}/${apiDate.slice(0, 4)}`;
}

// ---- API CLIENT -------------------------------------------

async function apiFetch(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

const fetchProgramme    = d => apiFetch(`/api/programme/${d}`);
const fetchParticipants = (d, r, c) => apiFetch(`/api/participants/${d}/${r}/${c}`);
const fetchInterviews   = (d, r, c) => apiFetch(`/api/interviews/${d}/${r}/${c}`).catch(() => ({ interviews: [] }));

// ---- LIBRARY ----------------------------------------------

let lib = null;

async function loadLib() {
  if (lib) return lib;
  const d = await fetch('./library.json').then(r => r.json());
  lib = d.courses || [];
  return lib;
}

function findLibEntry(hippodrome, distance, discipline) {
  if (!lib) return null;
  const h = (hippodrome || '').toLowerCase();
  const disc = (discipline || '').toLowerCase().slice(0, 4);
  const dist = String(distance || '');

  // Try exact match first (hippodrome + distance + discipline)
  return lib.find(c =>
    h.includes(c.hippodrome.toLowerCase().split(/[-\s]/)[0].toLowerCase())
    && c.type.toLowerCase().includes(disc)
    && c.parcours.includes(dist)
  ) || lib.find(c =>
    // Fallback: hippodrome + discipline only
    h.includes(c.hippodrome.toLowerCase().split(/[-\s]/)[0].toLowerCase())
    && c.type.toLowerCase().includes(disc)
  );
}

// ---- MUSIQUE PARSER ---------------------------------------

const DISC_CODE = {
  ATTELE: 'a', ATTELÉ: 'a', MONTE: 'm', MONTÉ: 'm',
  PLAT: 'p', HAIES: 'h', STEEPLE: 's', CROSS: 'c'
};

function discCode(disc) {
  return DISC_CODE[(disc || '').toUpperCase()] || 'p';
}

function posScore(pos) {
  const p = String(pos).toUpperCase();
  if (!p || p === 'D' || p === 'A' || p === '0') return 0;
  const n = parseInt(p);
  if (isNaN(n)) return 0;
  if (n === 1) return 10; if (n === 2) return 8; if (n === 3) return 6;
  if (n === 4) return 5;  if (n === 5) return 4; if (n <= 10) return 3;
  return 2;
}

function parseMusique(musique, discipline) {
  const empty = { score: 0, results: [], totalRaces: 0, victoires: 0, places: 0, disquals: 0, consistency: 0, label: 'Inédit' };
  if (!musique || !musique.trim()) return empty;

  const dc = discCode(discipline);
  // Remove parenthesized secondary meetings
  const clean = musique.replace(/\([^)]*\)/g, '').replace(/\s+/g, '');
  const tokens = [];
  const re = /(\d+|[DAda])([a-zA-Z]+)/g;
  let m;
  while ((m = re.exec(clean)) !== null) tokens.push({ pos: m[1], disc: m[2].toLowerCase() });

  const same   = tokens.filter(t => t.disc === dc);
  const recent = same.slice(-5);

  // Weighted score: most recent races count more
  const W = [5, 4, 3, 2, 1];
  let score = 0, total = 0;
  [...recent].reverse().forEach((r, i) => {
    score += posScore(r.pos) * W[i];
    total += 10 * W[i];
  });

  const victoires   = same.filter(r => r.pos === '1').length;
  const places      = same.filter(r => ['1','2','3'].includes(r.pos)).length;
  const disquals    = same.filter(r => r.pos.toUpperCase() === 'D').length;
  const top5        = same.filter(r => { const n = parseInt(r.pos); return n >= 1 && n <= 5; }).length;
  const consistency = same.length ? Math.round(top5 / same.length * 100) : 0;
  const norm        = total ? Math.round(score / total * 100) : 0;

  let label;
  if (!same.length)    label = 'Inédit';
  else if (norm >= 75) label = '🔥 Excellente';
  else if (norm >= 55) label = '✅ Bonne';
  else if (norm >= 35) label = '➡️ Moyenne';
  else                 label = '⚠️ Faible';

  return { score: norm, results: recent, totalRaces: same.length, victoires, places, disquals, consistency, label };
}

// ---- SCORING ----------------------------------------------

function weightScore(poids, horses) {
  const ws = horses.map(h => h.poids || 0).filter(w => w > 0);
  if (!ws.length || !poids) return 50;
  const mn = Math.min(...ws), mx = Math.max(...ws);
  return mx === mn ? 50 : Math.round((1 - (poids - mn) / (mx - mn)) * 100);
}

function cordeScore(numPmu, total) {
  if (!numPmu || !total) return 50;
  const r = numPmu / total;
  return r <= 0.33 ? 75 : r <= 0.66 ? 50 : 30;
}

// ---- ANALYSIS ENGINE --------------------------------------

function analyzeRace(raceData, partData, interviewData, libEntry) {
  const horses  = (partData.participants || []).filter(h => !h.statut || h.statut === 'PARTANT');
  const total   = horses.length;
  const terrain = (raceData.terrain || '').toUpperCase();
  const ivMap   = buildInterviewMap(interviewData);

  const scored = horses.map(h => {
    const mus = parseMusique(h.musique, raceData.discipline);
    const ws  = weightScore(h.poids, horses);
    const cs  = cordeScore(h.numPmu, total);
    // Weighted score: musique 55%, poids 25%, corde 20%
    const combined = Math.round(mus.score * 0.55 + ws * 0.25 + cs * 0.20);

    const terrainAlert = ['LOURD','TRES_LOURD','SOUPLE'].includes(terrain) && mus.consistency < 30;
    const disqualAlert = mus.disquals >= 2;
    const nom          = (h.nom || h.name || '').toLowerCase();
    const interview    = ivMap[nom] || null;

    return { ...h, mus, ws, cs, combined, terrainAlert, disqualAlert, interview };
  }).sort((a, b) => b.combined - a.combined);

  const base      = scored.slice(0, 3);
  const outsiders = scored.slice(3, 5);
  const chaos     = computeChaos(raceData, scored, libEntry);
  const scenario  = buildScenario(raceData, libEntry);

  return { race: raceData, libEntry, horses: scored, base, outsiders, chaos, scenario };
}

function buildInterviewMap(ivData) {
  const map = {};
  for (const iv of (ivData?.interviews || [])) {
    const nom = (iv.nomCheval || iv.nom || '').toLowerCase();
    if (nom) map[nom] = iv;
  }
  return map;
}

function computeChaos(race, horses, libEntry) {
  let idx = 30;
  const n = horses.length;
  if (n >= 16) idx += 20; else if (n >= 12) idx += 10;
  if (libEntry?.tags?.includes('autostart')) idx += 15;
  const t = (race.terrain || '').toUpperCase();
  if (['LOURD','TRES_LOURD'].includes(t)) idx += 15;
  if (horses.length > 2) {
    const spread = Math.max(...horses.map(h => h.combined)) - Math.min(...horses.map(h => h.combined));
    if (spread < 20) idx += 15; else if (spread > 45) idx -= 10;
  }
  idx = Math.max(10, Math.min(95, idx));
  const label = idx >= 70 ? '🔴 Élevé' : idx >= 45 ? '🟡 Modéré' : '🟢 Faible';
  const color = idx >= 70 ? 'var(--red)' : idx >= 45 ? 'var(--yellow)' : 'var(--green)';
  return { idx, label, color };
}

function buildScenario(race, libEntry) {
  const lines = [];
  const t    = (race.terrain || '').toUpperCase();
  const d    = race.distance || 0;
  const disc = (race.discipline || '').toUpperCase();

  if (t === 'BON' || t === 'TRES_BON')           lines.push('Terrain bon → vitesse valorisée, forme récente prime.');
  else if (t === 'SOUPLE' || t === 'BON_SOUPLE') lines.push('Terrain souple → profils de tenue avantagés, vitesse pure pénalisée.');
  else if (t === 'LOURD' || t === 'TRES_LOURD')  lines.push('⚠️ Terrain lourd → seuls les combatifs s\'en sortent. Vérifier l\'historique sur terrain gras.');
  else if (t === 'FERME' || t === 'BON_FERME')   lines.push('Terrain ferme → vitesse de base requise, attention aux coups.');

  if (d < 1800)       lines.push('Distance courte → départ et placement décisifs dès les premières foulées.');
  else if (d >= 2700) lines.push('Longue distance → tenue primordiale. Les chevaux qui "reculent" à 400 m sont hors jeu.');

  if (libEntry) {
    for (const detail of libEntry.details) lines.push(detail);
  }

  if (disc === 'ATTELE' || disc === 'ATTELÉ') {
    if (libEntry?.tags?.includes('autostart')) lines.push('Autostart : numéros de corde bas souvent avantagés. Surveiller la formation à l\'autostart.');
    if (libEntry?.tags?.includes('tenue')) lines.push('Parcours de tenue : éliminer les irréguliers et les allergiques au long effort.');
  }

  return lines;
}

// ---- TERRAIN LABELS ---------------------------------------

const TERRAIN_FR = {
  BON:'Bon', TRES_BON:'Très bon', SOUPLE:'Souple', LOURD:'Lourd',
  TRES_LOURD:'Très lourd', LEGER:'Léger', FERME:'Ferme',
  BON_SOUPLE:'Bon/Souple', BON_FERME:'Bon/Ferme'
};
const terrainFr = t => TERRAIN_FR[(t||'').toUpperCase()] || t || '—';

function scoreColor(s) {
  if (s >= 70) return 'var(--green)';
  if (s >= 50) return 'var(--yellow)';
  if (s >= 30) return 'var(--orange)';
  return 'var(--red)';
}

// ---- RENDER PROGRAMME -------------------------------------

function renderProgramme(data, dateStr) {
  const reunions = data?.programme?.reunions || [];
  if (!reunions.length) return `<div class="error">Aucune réunion trouvée pour le ${displayDate(dateStr)}.</div>`;

  let h = `<div class="prog-title">Programme du ${displayDate(dateStr)} — clique sur une course pour l'analyser</div>`;

  for (const r of reunions) {
    const hippo = r.hippodrome?.libelleLong || r.hippodrome?.libelleCourt || '';
    h += `<div class="reunion-block">
      <div class="reunion-header">
        <span class="hippo-name">${hippo}</span>
        <span class="reunion-num">R${r.numOfficiel}</span>
      </div>`;
    for (const c of (r.courses || [])) {
      const isQ = c.specialite === 'QUINTE_PLUS'
        || (c.libelle || '').toUpperCase().includes('QUINTÉ')
        || (c.libelle || '').toUpperCase().includes('QUINTE');
      h += `<div class="course-row${isQ ? ' quinte' : ''}"
        data-date="${dateStr}" data-reunion="${r.numOfficiel}" data-course="${c.numOrdre}"
        data-discipline="${c.discipline||''}" data-distance="${c.distance||''}"
        data-hippodrome="${hippo}" data-libelle="${(c.libelle||'').replace(/"/g,'&quot;')}"
        data-terrain="${c.terrain||''}" data-corde="${c.corde||''}"
        data-partants="${c.nombreDeclaresPartants||''}" data-penetro="${c.penetrometre||''}">
        <div class="course-info">
          ${isQ ? '<span class="badge-quinte">QUINTÉ+</span>' : ''}
          <span class="course-num">C${c.numOrdre}</span>
          <span class="course-libelle">${c.libelle||''}</span>
        </div>
        <div class="course-meta">
          <span>${c.distance||'?'} m</span>
          <span>${c.discipline||''}</span>
          <span>Terrain : ${terrainFr(c.terrain)}</span>
          ${c.penetrometre ? `<span>Pénétro : ${c.penetrometre}</span>` : ''}
          <span>${c.nombreDeclaresPartants||'?'} partants</span>
        </div>
      </div>`;
    }
    h += `</div>`;
  }
  return h;
}

// ---- RENDER ANALYSIS --------------------------------------

function renderAnalysis(analysis) {
  const { race, libEntry, horses, base, outsiders, chaos, scenario } = analysis;
  let h = `<button class="back-btn" id="backBtn" type="button">← Programme</button>`;

  h += `<div class="analysis-header">
    <h2 style="margin:0 0 4px;font-size:20px">${race.hippodrome} — C${race.numOrdre}</h2>
    <p style="margin:0;color:var(--muted);font-size:14px">${race.libelle}</p>
    <div class="race-meta-row">
      <span class="meta-chip">${race.distance} m</span>
      <span class="meta-chip">${race.discipline}</span>
      <span class="meta-chip terrain-chip">Terrain : ${terrainFr(race.terrain)}</span>
      ${race.penetrometre ? `<span class="meta-chip">Pénétro : ${race.penetrometre}</span>` : ''}
      <span class="meta-chip">Corde : ${race.corde||'—'}</span>
      <span class="meta-chip">${horses.length} partants</span>
    </div>
  </div>`;

  h += `<div class="chaos-block" style="border-left:4px solid ${chaos.color}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-weight:800;font-size:15px">Indice Chaos</span>
      <span style="font-weight:800;color:${chaos.color}">${chaos.label} — ${chaos.idx}/100</span>
    </div>
    <div style="font-size:13px;color:var(--muted)">
      ${scenario.map(s => `<div style="margin-bottom:4px">• ${s}</div>`).join('')}
    </div>
  </div>`;

  if (libEntry) {
    h += `<div class="library-block">
      <div class="section-title">📌 Fiche : ${libEntry.title}</div>
      <div style="font-size:13px;color:var(--muted)">
        ${libEntry.details.map(d => `<div style="margin-bottom:3px">• ${d}</div>`).join('')}
      </div>
    </div>`;
  }

  h += `<div class="selection-block">
    <div class="sel-section">
      <div class="sel-label" style="color:var(--green)">BASE (Top 3)</div>
      ${base.map(hr => `<span class="horse-chip base">${hr.numPmu}. ${hr.nom||hr.name||'?'}</span>`).join('')}
    </div>
    <div class="sel-section">
      <div class="sel-label" style="color:var(--yellow)">OUTSIDERS</div>
      ${outsiders.map(hr => `<span class="horse-chip outsider">${hr.numPmu}. ${hr.nom||hr.name||'?'}</span>`).join('')}
    </div>
  </div>`;

  h += `<div class="section-title">Analyse des partants</div>`;

  for (const horse of horses) {
    const mus    = horse.mus;
    const isBase = base.includes(horse);
    const isOut  = outsiders.includes(horse);
    const nom    = horse.nom || horse.name || '—';
    const driver = horse.driver || horse.jockey || '—';
    const trainer= horse.entraineur || horse.trainer || '—';

    h += `<div class="horse-card${isBase?' is-base':''}${isOut?' is-outsider':''}">
      <div class="horse-header">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="horse-num">${horse.numPmu||'?'}</span>
          <div>
            <div style="font-weight:700;font-size:15px">${nom}</div>
            <div style="font-size:12px;color:var(--muted)">${driver} · ${trainer}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:26px;font-weight:900;color:${scoreColor(horse.combined)}">${horse.combined}</div>
          <div style="font-size:11px;color:var(--muted)">score / 100</div>
        </div>
      </div>

      <div class="score-bar-wrap">
        <div class="score-bar" style="width:${horse.combined}%;background:${scoreColor(horse.combined)}"></div>
      </div>

      <div class="horse-data">
        <div class="data-item"><span class="di-label">Poids</span>${horse.poids ? horse.poids+' kg' : '—'}</div>
        <div class="data-item"><span class="di-label">Cote</span>${horse.coteCurrent ? horse.coteCurrent+'×' : horse.coteProbable ? horse.coteProbable+'×' : '—'}</div>
        <div class="data-item"><span class="di-label">Âge / Sexe</span>${horse.age||'?'} ans · ${horse.sexe||'—'}</div>
        <div class="data-item"><span class="di-label">Déferré</span>${horse.deferre||'—'}</div>
        <div class="data-item"><span class="di-label">Courses</span>${mus.totalRaces||0}</div>
        <div class="data-item"><span class="di-label">Victoires</span>${mus.victoires||0}</div>
        <div class="data-item"><span class="di-label">Places</span>${mus.places||0}</div>
        <div class="data-item"><span class="di-label">Consistance</span>${mus.consistency}%</div>
      </div>

      <div class="musique-row">
        <span style="font-size:11px;color:var(--muted);margin-right:6px">Musique :</span>
        <span style="font-family:monospace">${horse.musique||'—'}</span>
        <span class="form-badge" style="margin-left:8px">${mus.label}</span>
      </div>

      ${horse.terrainAlert ? `<div class="alert-row">⚠️ Consistance faible — à surveiller avec terrain difficile</div>` : ''}
      ${horse.disqualAlert ? `<div class="alert-row">🚩 Plusieurs disqualifications en musique — risque en attelé</div>` : ''}

      ${renderInterview(horse.interview)}
    </div>`;
  }

  return h;
}

function renderInterview(iv) {
  if (!iv) return '';
  const texte  = iv.texteInterview || iv.contenu || iv.texte || iv.text;
  const auteur = iv.auteur || iv.nomPilote || iv.source || '';
  if (!texte) return '';
  return `<div class="interview-block">
    <div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:5px">💬 INTERVIEW${auteur ? ' — ' + auteur : ''}</div>
    <div style="font-size:13px;line-height:1.55">"${texte}"</div>
  </div>`;
}

// ---- BIBLIOTHÈQUE VIEW ------------------------------------

async function initBiblio() {
  await loadLib();
  const typeEl  = document.getElementById('biblioType');
  const hippoEl = document.getElementById('biblioHippo');
  const out     = document.getElementById('biblioOut');
  if (!typeEl) return;

  const types = [...new Set(lib.map(c => c.type))].sort();
  typeEl.innerHTML = '<option value="">Discipline…</option>' +
    types.map(t => `<option>${t}</option>`).join('');

  function updateHippos() {
    const t = typeEl.value;
    const hippos = [...new Set(lib.filter(c => !t || c.type === t).map(c => c.hippodrome))].sort();
    hippoEl.innerHTML = '<option value="">Hippodrome…</option>' +
      hippos.map(h => `<option>${h}</option>`).join('');
    showBiblio();
  }

  function showBiblio() {
    const t = typeEl.value, hip = hippoEl.value;
    const entries = lib.filter(c => (!t || c.type === t) && (!hip || c.hippodrome === hip));
    if (!entries.length) { out.innerHTML = '<span style="color:var(--muted)">Aucune fiche trouvée.</span>'; return; }
    out.innerHTML = entries.map(e => `
      <div style="margin-bottom:14px;padding:12px 14px;background:var(--card2);border-radius:12px;border:1px solid var(--border)">
        <div style="font-weight:700;font-size:15px;margin-bottom:6px">${e.title}</div>
        <div style="margin-bottom:6px">
          ${e.tags.map(tag => `<span style="font-size:11px;padding:2px 8px;border-radius:999px;background:rgba(106,167,255,.12);border:1px solid rgba(106,167,255,.2);margin-right:4px;color:var(--accent)">${tag}</span>`).join('')}
        </div>
        <div style="font-size:13px;color:var(--muted)">
          ${e.details.map(d => `<div style="margin-bottom:3px">• ${d}</div>`).join('')}
        </div>
      </div>`).join('');
  }

  typeEl.addEventListener('change', updateHippos);
  hippoEl.addEventListener('change', showBiblio);
  updateHippos();
}

// ---- QUINTÉ+ LOGIC ----------------------------------------

let savedProgramme = null;

async function loadAndRenderProgramme() {
  const dateEl  = document.getElementById('quinteDate');
  const dateStr = dateToApi(dateEl?.value || tomorrowValue());
  const out     = document.getElementById('quinteOut');
  out.innerHTML = `<div class="loading">⏳ Chargement du programme PMU (${displayDate(dateStr)})…</div>`;

  try {
    const data = await fetchProgramme(dateStr);
    savedProgramme = { data, dateStr };
    out.innerHTML = renderProgramme(data, dateStr);
    attachCourseClicks(out);
  } catch (err) {
    out.innerHTML = `<div class="error">❌ ${err.message}<br><br>
      <small>Vérifiez que le serveur Node.js tourne : <code>node server.js</code> dans le dossier du projet.</small></div>`;
  }
}

function attachCourseClicks(container) {
  container.querySelectorAll('.course-row').forEach(row => {
    row.addEventListener('click', () => loadCourse(row));
  });
}

async function loadCourse(row) {
  const { date, reunion, course, discipline, distance, hippodrome, libelle, terrain, corde, penetro } = row.dataset;
  const out = document.getElementById('quinteOut');
  out.innerHTML = `<div class="loading">⏳ Chargement partants — ${hippodrome} C${course}…</div>`;

  try {
    await loadLib();
    const [partData, ivData] = await Promise.all([
      fetchParticipants(date, reunion, course),
      fetchInterviews(date, reunion, course)
    ]);

    const libEntry = findLibEntry(hippodrome, parseInt(distance), discipline);
    const raceData = {
      hippodrome, libelle, discipline,
      distance: parseInt(distance),
      terrain, corde, numOrdre: course, penetrometre: penetro
    };

    const analysis = analyzeRace(raceData, partData, ivData, libEntry);
    out.innerHTML   = renderAnalysis(analysis);

    document.getElementById('backBtn')?.addEventListener('click', () => {
      if (savedProgramme) {
        out.innerHTML = renderProgramme(savedProgramme.data, savedProgramme.dateStr);
        attachCourseClicks(out);
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    out.innerHTML = `<div class="error">❌ ${err.message}</div>
      <button class="back-btn" id="backBtn" type="button">← Programme</button>`;
    document.getElementById('backBtn')?.addEventListener('click', () => {
      if (savedProgramme) {
        out.innerHTML = renderProgramme(savedProgramme.data, savedProgramme.dateStr);
        attachCourseClicks(out);
      }
    });
  }
}

// ---- INIT -------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  // Tabs
  for (const [tabId, viewId] of TABS) {
    document.getElementById(tabId)?.addEventListener('click', () => showTab(viewId, tabId));
  }
  showTab('view-home', 'tab-home');

  // Default date = tomorrow
  const dateEl = document.getElementById('quinteDate');
  if (dateEl) dateEl.value = tomorrowValue();

  // Load programme
  document.getElementById('loadProgramBtn')?.addEventListener('click', loadAndRenderProgramme);

  // Biblio
  initBiblio().catch(() => {});

  // Assistant (legacy manual mode)
  document.getElementById('analyzeBtn')?.addEventListener('click', () => {
    const text = document.getElementById('raceText')?.value || '';
    const out  = document.getElementById('assistantOut');
    out.innerHTML = text
      ? `<div style="color:var(--muted);font-size:13px">➡️ Pour l'analyse automatique complète, utilise l'onglet <b>🏇 Quinté+</b>.<br>L'assistant manuel sera intégré prochainement.</div>`
      : '';
  });
  document.getElementById('resetBtn')?.addEventListener('click', () => {
    const t = document.getElementById('raceText');
    const o = document.getElementById('assistantOut');
    if (t) t.value = '';
    if (o) o.innerHTML = '';
  });
});
