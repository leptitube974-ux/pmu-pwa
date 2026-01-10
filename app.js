/* PMU — Bibliothèque Hippodromes
   - List view + select filter
   - Detail view (clic carte) avec Profils favorisés
*/

const $ = (id) => document.getElementById(id);

const viewList = $("viewList");
const viewDetail = $("viewDetail");

const filterSelect = $("filterSelect");
const listContainer = $("listContainer");
const listError = $("listError");

const backBtn = $("backBtn");
const detailTitle = $("detailTitle");
const detailBullets = $("detailBullets");
const detailProfils = $("detailProfils");
const detailNote = $("detailNote");

let DATA = null;
let CURRENT_FILTER = "__all__";

function showView(which) {
  if (which === "list") {
    viewList.classList.add("active");
    viewDetail.classList.remove("active");
    window.scrollTo({ top: 0, behavior: "instant" });
  } else {
    viewDetail.classList.add("active");
    viewList.classList.remove("active");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function renderSelectOptions(items) {
  // Reset options (keep first "Tous les hippodromes")
  filterSelect.innerHTML = `<option value="__all__">Tous les hippodromes</option>`;

  for (const it of items) {
    const opt = document.createElement("option");
    opt.value = it.id;
    opt.textContent = it.title;
    filterSelect.appendChild(opt);
  }

  filterSelect.value = CURRENT_FILTER;
}

function makeCard(item) {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("div");
  title.className = "title";
  title.textContent = item.title;

  const ul = document.createElement("ul");
  ul.className = "bullets";
  for (const d of (item.details || []).slice(0, 4)) {
    const li = document.createElement("li");
    li.textContent = d;
    ul.appendChild(li);
  }

  card.appendChild(title);
  card.appendChild(ul);

  card.addEventListener("click", () => openDetail(item.id));
  return card;
}

function renderList() {
  if (!DATA) return;
  listError.style.display = "none";
  listContainer.innerHTML = "";

  const items = DATA.hippodromes || [];
  const filtered = (CURRENT_FILTER === "__all__")
    ? items
    : items.filter(x => x.id === CURRENT_FILTER);

  if (filtered.length === 0) {
    listError.textContent = "Aucun hippodrome trouvé pour ce filtre.";
    listError.style.display = "block";
    return;
  }

  for (const it of filtered) {
    listContainer.appendChild(makeCard(it));
  }
}

function openDetail(id) {
  const items = DATA?.hippodromes || [];
  const item = items.find(x => x.id === id);
  if (!item) return;

  detailTitle.textContent = item.title;

  // bullets
  detailBullets.innerHTML = "";
  for (const d of (item.details || [])) {
    const li = document.createElement("li");
    li.textContent = d;
    detailBullets.appendChild(li);
  }

  // profils (pills)
  detailProfils.innerHTML = "";
  const profils = item.profils || [];
  if (profils.length === 0) {
    const p = document.createElement("div");
    p.className = "muted";
    p.textContent = "Pas encore de profils renseignés.";
    detailProfils.appendChild(p);
  } else {
    for (const pr of profils) {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = pr;
      detailProfils.appendChild(pill);
    }
  }

  detailNote.textContent = item.note || "";

  showView("detail");
}

async function loadLibrary() {
  try {
    const res = await fetch("./library.json", { cache: "no-store" });
    if (!res.ok) throw new Error("library.json introuvable");
    const json = await res.json();
    if (!json || !Array.isArray(json.hippodromes)) {
      throw new Error("library.json invalide (structure attendue: { hippodromes: [] })");
    }
    DATA = json;

    // options select
    renderSelectOptions(DATA.hippodromes);

    // render initial list
    renderList();
  } catch (e) {
    listContainer.innerHTML = "";
    listError.textContent = "Erreur : library.json invalide ou introuvable.";
    listError.style.display = "block";
    console.error(e);
  }
}

// EVENTS
filterSelect.addEventListener("change", (e) => {
  CURRENT_FILTER = e.target.value;
  // IMPORTANT: si on choisit un hippodrome spécifique, on affiche directement sa fiche
  if (CURRENT_FILTER !== "__all__") {
    openDetail(CURRENT_FILTER);
  } else {
    showView("list");
    renderList();
  }
});

backBtn.addEventListener("click", () => {
  // retour à la liste, en gardant le filtre
  showView("list");
  renderList();
});

// INIT
loadLibrary();
