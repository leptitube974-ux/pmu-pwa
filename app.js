"use strict";

const DATA_URL = "./library.json";

const els = {
  type: document.getElementById("typeSelect"),
  hippo: document.getElementById("hippoSelect"),
  parcours: document.getElementById("parcoursSelect"),
  err: document.getElementById("err"),
  fiche: document.getElementById("fiche"),
  ficheTitre: document.getElementById("ficheTitre"),
  fichePills: document.getElementById("fichePills"),
  ficheDetails: document.getElementById("ficheDetails"),
  partantsInput: document.getElementById("partantsInput"),
  chaosInput: document.getElementById("chaosInput"),
  scenarioSelect: document.getElementById("scenarioSelect"),
  buildGridBtn: document.getElementById("buildGridBtn"),
  calcBtn: document.getElementById("calcBtn"),
  gridWrap: document.getElementById("gridWrap"),
  results: document.getElementById("results"),
};

let DB = null;
let currentCourse = null;

function showError(msg){
  els.err.style.display = "block";
  els.err.textContent = msg;
}
function hideError(){
  els.err.style.display = "none";
  els.err.textContent = "";
}

function uniq(arr){ return [...new Set(arr)]; }

function parsePartants(text){
  // accepte "1,2,3", "1 2 3", lignes, etc.
  const raw = (text || "").trim();
  if(!raw) return [];
  const nums = raw
    .replace(/[^\d\s,;]+/g, " ")
    .split(/[\s,;]+/g)
    .map(s => s.trim())
    .filter(Boolean)
    .map(n => parseInt(n,10))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= 20);
  return uniq(nums).sort((a,b)=>a-b);
}

function storageKey(courseId){
  return `pmu_pwa_manual_${courseId}`;
}

function loadSaved(courseId){
  try{
    const s = localStorage.getItem(storageKey(courseId));
    return s ? JSON.parse(s) : null;
  }catch(_e){
    return null;
  }
}

function saveState(courseId, state){
  try{
    localStorage.setItem(storageKey(courseId), JSON.stringify(state));
  }catch(_e){}
}

function getStateFromUI(){
  const chaos = parseInt(els.chaosInput.value,10);
  const scenario = String(els.scenarioSelect.value || "2");
  const partants = parsePartants(els.partantsInput.value);

  // lecture lignes tableau
  const rows = Array.from(document.querySelectorAll("[data-row-horse]"));
  const horses = rows.map(r => {
    const n = parseInt(r.getAttribute("data-row-horse"),10);
    const cote = parseFloat(r.querySelector(`[data-field="cote"]`)?.value || "");
    const forme = parseInt(r.querySelector(`[data-field="forme"]`)?.value || "0",10);
    const parcours = parseInt(r.querySelector(`[data-field="parcours"]`)?.value || "0",10);
    const driver = parseInt(r.querySelector(`[data-field="driver"]`)?.value || "0",10);
    const dai = r.querySelector(`[data-field="dai"]`)?.checked || false;
    const note = r.querySelector(`[data-field="note"]`)?.value || "";
    return { n, cote: Number.isFinite(cote) ? cote : null, forme, parcours, driver, dai, note };
  });

  return { chaos, scenario, partants, horses };
}

function applyStateToUI(state){
  if(!state) return;
  if(Number.isFinite(state.chaos)) els.chaosInput.value = String(state.chaos);
  if(state.scenario) els.scenarioSelect.value = String(state.scenario);
  if(Array.isArray(state.partants)) els.partantsInput.value = state.partants.join(",");
}

function buildGrid(partants, previousState){
  if(!partants.length){
    els.gridWrap.innerHTML = "";
    els.gridWrap.style.display = "none";
    return;
  }

  // map previous notes
  const prev = new Map();
  if(previousState?.horses){
    for(const h of previousState.horses){
      prev.set(h.n, h);
    }
  }

  const html = `
    <table>
      <thead>
        <tr>
          <th>N°</th>
          <th>Cote</th>
          <th>Forme (0-5)</th>
          <th>Parcours (0-5)</th>
          <th>Driver (0-5)</th>
          <th>Risque DAI</th>
          <th>Note (option)</th>
        </tr>
      </thead>
      <tbody>
        ${partants.map(n=>{
          const p = prev.get(n) || {};
          const cote = (p.cote ?? "") === null ? "" : (p.cote ?? "");
          const forme = Number.isFinite(p.forme) ? p.forme : 0;
          const parcours = Number.isFinite(p.parcours) ? p.parcours : 0;
          const driver = Number.isFinite(p.driver) ? p.driver : 0;
          const dai = !!p.dai;
          const note = p.note || "";
          return `
            <tr data-row-horse="${n}">
              <td><b>${n}</b></td>
              <td><input data-field="cote" inputmode="decimal" placeholder="ex: 8.5" value="${cote}"></td>
              <td>
                <select data-field="forme">
                  ${[0,1,2,3,4,5].map(v=>`<option value="${v}" ${v===forme?"selected":""}>${v}</option>`).join("")}
                </select>
              </td>
              <td>
                <select data-field="parcours">
                  ${[0,1,2,3,4,5].map(v=>`<option value="${v}" ${v===parcours?"selected":""}>${v}</option>`).join("")}
                </select>
              </td>
              <td>
                <select data-field="driver">
                  ${[0,1,2,3,4,5].map(v=>`<option value="${v}" ${v===driver?"selected":""}>${v}</option>`).join("")}
                </select>
              </td>
              <td style="text-align:center;">
                <input data-field="dai" type="checkbox" ${dai?"checked":""} />
              </td>
              <td><input data-field="note" placeholder="ex: bon départ / caché" value="${note.replace(/"/g,'&quot;')}"></td>
            </tr>
          `;
        }).join("")}
      </tbody>
    </table>
  `;

  els.gridWrap.innerHTML = html;
  els.gridWrap.style.display = "block";

  // autosave
  els.gridWrap.addEventListener("input", () => {
    if(!currentCourse) return;
    const st = getStateFromUI();
    saveState(currentCourse.id, st);
  }, { once: true }); // attach once per rebuild

  // also autosave on text changes
  els.partantsInput.addEventListener("input", () => {
    if(!currentCourse) return;
    const st = getStateFromUI();
    saveState(currentCourse.id, st);
  }, { once: true });

  els.chaosInput.addEventListener("input", () => {
    if(!currentCourse) return;
    const st = getStateFromUI();
    saveState(currentCourse.id, st);
  }, { once: true });

  els.scenarioSelect.addEventListener("change", () => {
    if(!currentCourse) return;
    const st = getStateFromUI();
    saveState(currentCourse.id, st);
  }, { once: true });
}

function scoreHorse(h, chaos, scenario){
  // score simple et transparent (tu pourras l'ajuster après)
  // base = parcours x2 + forme + driver
  let s = (h.parcours * 2) + h.forme + h.driver;

  // petite logique cote (si tu la mets)
  if(h.cote !== null){
    if(h.cote <= 6) s += 1;          // logique favori
    else if(h.cote >= 20) s += 1;    // logique “value” outsider
  }

  // risque DAI
  if(h.dai) s -= 3;

  // scenario 2 : on “récompense” un peu les profils value/outsiders (si cote)
  if(String(scenario) === "2" && h.cote !== null && h.cote >= 12) s += 1;

  // chaos élevé : pénalise un peu les chevaux “fragiles” (dai) + bonifie légèrement les profils réguliers
  if(chaos >= 7){
    if(h.dai) s -= 1;
    if(h.forme >= 4) s += 1;
  }

  return s;
}

function pickSelection(state){
  const chaos = Math.max(0, Math.min(10, Number(state.chaos ?? 6)));
  const scenario = state.scenario ?? "2";

  const horses = (state.horses || []).map(h => ({
    ...h,
    score: scoreHorse(h, chaos, scenario),
  })).sort((a,b)=> b.score - a.score);

  const bases = horses.slice(0,2);
  const regular = horses.slice(2,5);
  const outsiders = horses.slice(5,8);

  const risques = horses.filter(h => h.dai).slice(0,3);

  // petit texte scénario
  const scenarioTxt = (String(scenario)==="2")
    ? `Scénario 2 (aléas) — chaos=${chaos}/10 : on couvre, on garde de la marge avec 1-2 outsiders.`
    : `Scénario 1 (verrouillé) — chaos=${chaos}/10 : on privilégie les chevaux “propres” et les bases solides.`;

  return { horses, bases, regular, outsiders, risques, scenarioTxt };
}

function renderResults(sel){
  const box = (title, arr, extra="") => `
    <div class="resultBox">
      <h3>${title}</h3>
      ${arr.length ? `<div class="nums">${arr.map(h=>h.n).join(" - ")}</div>` : `<div class="small">Aucun</div>`}
      ${extra ? `<div class="small" style="margin-top:6px">${extra}</div>` : ""}
    </div>
  `;

  els.results.innerHTML = `
    ${box("Bases", sel.bases, "2 chevaux pour sécuriser.")}
    ${box("Chances régulières", sel.regular, "Pour Trio/Quarté/Multi.")}
    ${box("Outsiders", sel.outsiders, "À garder en couverture (scénario 2).")}
    ${box("Risques (DAI)", sel.risques, "Chevaux notés “risque” : prudence.")}
    <div class="resultBox">
      <h3>Scénario</h3>
      <div class="small">${sel.scenarioTxt}</div>
    </div>
  `;
}

function renderFiche(course){
  els.fiche.style.display = "block";
  els.ficheTitre.textContent = course.title;

  // pills
  els.fichePills.innerHTML = "";
  const pills = [
    `Type : ${course.type}`,
    `Hippodrome : ${course.hippodrome}`,
    `Parcours : ${course.parcours}`,
    ...(course.tags || []).map(t=>`Tag : ${t}`)
  ];
  for(const p of pills){
    const span = document.createElement("span");
    span.className = "pill";
    span.textContent = p;
    els.fichePills.appendChild(span);
  }

  // details
  els.ficheDetails.innerHTML = "";
  (course.details || []).forEach(d=>{
    const li = document.createElement("li");
    li.textContent = d;
    els.ficheDetails.appendChild(li);
  });

  // restore state
  const saved = loadSaved(course.id);
  applyStateToUI(saved);

  // rebuild grid with saved partants
  const partants = parsePartants(els.partantsInput.value);
  buildGrid(partants, saved);
  els.results.innerHTML = "";
}

function populateDropdowns(){
  // Type list
  const types = uniq(DB.courses.map(c=>c.type)).sort();
  els.type.innerHTML = `<option value="">Choisir : Attelé / Plat / Obstacles…</option>` +
    types.map(t=>`<option value="${t}">${t}</option>`).join("");

  els.hippo.innerHTML = `<option value="">Choisir un hippodrome…</option>`;
  els.parcours.innerHTML = `<option value="">Choisir un parcours…</option>`;
  els.hippo.disabled = true;
  els.parcours.disabled = true;
}

function onTypeChange(){
  const t = els.type.value;
  currentCourse = null;
  els.fiche.style.display = "none";
  els.results.innerHTML = "";
  els.gridWrap.innerHTML = "";
  els.gridWrap.style.display = "none";

  if(!t){
    els.hippo.disabled = true;
    els.parcours.disabled = true;
    els.hippo.innerHTML = `<option value="">Choisir un hippodrome…</option>`;
    els.parcours.innerHTML = `<option value="">Choisir un parcours…</option>`;
    return;
  }

  const hippos = uniq(DB.courses.filter(c=>c.type===t).map(c=>c.hippodrome)).sort();
  els.hippo.innerHTML = `<option value="">Choisir un hippodrome…</option>` +
    hippos.map(h=>`<option value="${h}">${h}</option>`).join("");
  els.hippo.disabled = false;

  els.parcours.innerHTML = `<option value="">Choisir un parcours…</option>`;
  els.parcours.disabled = true;
}

function onHippoChange(){
  const t = els.type.value;
  const h = els.hippo.value;

  currentCourse = null;
  els.fiche.style.display = "none";
  els.results.innerHTML = "";
  els.gridWrap.innerHTML = "";
  els.gridWrap.style.display = "none";

  if(!t || !h){
    els.parcours.innerHTML = `<option value="">Choisir un parcours…</option>`;
    els.parcours.disabled = true;
    return;
  }

  const courses = DB.courses
    .filter(c=>c.type===t && c.hippodrome===h)
    .sort((a,b)=> a.title.localeCompare(b.title));

  els.parcours.innerHTML = `<option value="">Choisir un parcours…</option>` +
    courses.map(c=>`<option value="${c.id}">${c.parcours}</option>`).join("");
  els.parcours.disabled = false;
}

function onParcoursChange(){
  const id = els.parcours.value;
  if(!id){
    currentCourse = null;
    els.fiche.style.display = "none";
    return;
  }
  const course = DB.courses.find(c=>c.id===id);
  if(!course){
    showError("Course introuvable.");
    return;
  }
  hideError();
  currentCourse = course;
  renderFiche(course);
}

async function init(){
  hideError();
  try{
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if(!res.ok) throw new Error("library.json introuvable");
    const json = await res.json();
    if(!json || !Array.isArray(json.courses)) throw new Error("Format invalide (attendu { courses: [...] })");
    DB = json;

    populateDropdowns();

    els.type.addEventListener("change", onTypeChange);
    els.hippo.addEventListener("change", onHippoChange);
    els.parcours.addEventListener("change", onParcoursChange);

    els.buildGridBtn.addEventListener("click", ()=>{
      if(!currentCourse) return;
      const partants = parsePartants(els.partantsInput.value);
      const saved = loadSaved(currentCourse.id);
      buildGrid(partants, saved);
      saveState(currentCourse.id, getStateFromUI());
    });

    els.calcBtn.addEventListener("click", ()=>{
      if(!currentCourse) return;
      const state = getStateFromUI();
      // si grille pas créée, on la crée
      if(!state.partants.length){
        showError("Colle d’abord les partants (ex: 1,2,3,4...).");
        return;
      }
      hideError();
      saveState(currentCourse.id, state);
      const sel = pickSelection(state);
      renderResults(sel);
    });

  }catch(e){
    showError("Erreur : library.json invalide ou introuvable.");
    console.error(e);
  }
}

init();
