const DATA_URL = "./library.json";

const typeSelect = document.getElementById("typeSelect");
const hippoSelect = document.getElementById("hippoSelect");
const courseSelect = document.getElementById("courseSelect");
const detail = document.getElementById("detail");
const statusEl = document.getElementById("status");

let db = null;

function setStatus(msg){
  if(!msg){
    statusEl.style.display = "none";
    statusEl.textContent = "";
    return;
  }
  statusEl.style.display = "block";
  statusEl.textContent = msg;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function resetSelect(sel, placeholder){
  sel.innerHTML = `<option value="" selected disabled>${placeholder}</option>`;
  sel.value = "";
}

function setEnabled(sel, enabled){
  sel.disabled = !enabled;
}

function getUniqueSorted(arr){
  return Array.from(new Set(arr)).sort((a,b)=> a.localeCompare(b, "fr"));
}

function renderDetail(item){
  if(!item){
    detail.style.display = "none";
    detail.innerHTML = "";
    return;
  }

  const details = Array.isArray(item.details) ? item.details : [];
  const profils = Array.isArray(item.profils) ? item.profils : [];
  const notes = item.notes ? String(item.notes) : "";

  detail.innerHTML = `
    <div class="detailHeader">
      <div class="badge">Fiche détaillée</div>
      <div class="badge">${escapeHtml(item.type)} • ${escapeHtml(item.hippodrome)}</div>
    </div>

    <h2>${escapeHtml(item.title)}</h2>

    ${details.length ? `
      <h3>Points clés</h3>
      <ul>${details.map(d=>`<li>${escapeHtml(d)}</li>`).join("")}</ul>
    ` : ""}

    ${profils.length ? `
      <h3>Profils / repères</h3>
      <ul>${profils.map(p=>`<li>${escapeHtml(p)}</li>`).join("")}</ul>
    ` : ""}

    ${notes ? `
      <h3>Notes</h3>
      <div style="color:#b8c4d6; font-size:16px; line-height:1.4;">
        ${escapeHtml(notes)}
      </div>
    ` : ""}
  `;

  detail.style.display = "block";
}

function populateTypes(){
  const types = getUniqueSorted(db.courses.map(c => c.type));
  resetSelect(typeSelect, "Choisir : Attelé / Plat / Obstacles…");
  for(const t of types){
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    typeSelect.appendChild(opt);
  }
}

function populateHipposForType(type){
  const hippos = getUniqueSorted(
    db.courses.filter(c => c.type === type).map(c => c.hippodrome)
  );

  resetSelect(hippoSelect, "Choisir un hippodrome…");
  for(const h of hippos){
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    hippoSelect.appendChild(opt);
  }
}

function populateCoursesForHippo(type, hippo){
  const list = db.courses
    .filter(c => c.type === type && c.hippodrome === hippo)
    .sort((a,b)=> a.title.localeCompare(b.title, "fr"));

  resetSelect(courseSelect, "Choisir un parcours…");
  for(const c of list){
    const opt = document.createElement("option");
    opt.value = c.id;
    opt.textContent = c.title;
    courseSelect.appendChild(opt);
  }
}

function findCourseById(id){
  return db.courses.find(c => c.id === id) || null;
}

async function init(){
  try{
    setStatus("");
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if(!res.ok) throw new Error("library.json introuvable");
    const json = await res.json();

    if(!json || !Array.isArray(json.courses)){
      throw new Error("Format invalide: attendu { courses: [...] }");
    }

    db = json;

    // 1) Types
    populateTypes();

    // reset des autres
    resetSelect(hippoSelect, "Choisir un hippodrome…");
    resetSelect(courseSelect, "Choisir un parcours…");
    setEnabled(hippoSelect, false);
    setEnabled(courseSelect, false);
    renderDetail(null);

    // events cascade
    typeSelect.addEventListener("change", () => {
      const type = typeSelect.value;

      // Reset bas
      renderDetail(null);
      resetSelect(hippoSelect, "Choisir un hippodrome…");
      resetSelect(courseSelect, "Choisir un parcours…");
      setEnabled(hippoSelect, true);
      setEnabled(courseSelect, false);

      populateHipposForType(type);

      // Nettoie hash
      history.replaceState(null, "", location.pathname + location.search);
    });

    hippoSelect.addEventListener("change", () => {
      const type = typeSelect.value;
      const hippo = hippoSelect.value;

      renderDetail(null);
      resetSelect(courseSelect, "Choisir un parcours…");
      setEnabled(courseSelect, true);

      populateCoursesForHippo(type, hippo);

      history.replaceState(null, "", location.pathname + location.search);
    });

    courseSelect.addEventListener("change", () => {
      const id = courseSelect.value;
      const item = findCourseById(id);
      renderDetail(item);
      location.hash = id; // optionnel: mémoriser la fiche
    });

    // Si URL contient déjà #id
    if(location.hash && location.hash.length > 1){
      const id = location.hash.slice(1);
      const item = findCourseById(id);
      if(item){
        // pré-sélection cascade
        typeSelect.value = item.type;

        setEnabled(hippoSelect, true);
        populateHipposForType(item.type);
        hippoSelect.value = item.hippodrome;

        setEnabled(courseSelect, true);
        populateCoursesForHippo(item.type, item.hippodrome);
        courseSelect.value = item.id;

        renderDetail(item);
      }
    }

  }catch(err){
    console.error(err);
    setStatus("Erreur : library.json invalide ou introuvable.");
  }
}

init();
