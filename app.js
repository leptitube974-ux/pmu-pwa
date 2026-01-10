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

let DATA = { hippodromes: [] };
let CURRENT_FILTER = "__all__";

function showView(which) {
  if (which === "list") {
    viewList.classList.add("active");
    viewDetail.classList.remove("active");
  } else {
    viewDetail.classList.add("active");
    viewList.classList.remove("active");
  }
  window.scrollTo({ top: 0, behavior: "instant" });
}

function setError(msg) {
  listError.textContent = msg;
  listError.style.display = msg ? "block" : "none";
}

function renderSelectOptions(items) {
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

  (item.details || []).slice(0, 4).forEach((d) => {
    const li = document.createElement("li");
    li.textContent = d;
    ul.appendChild(li);
  });

  card.appendChild(title);
  card.appendChild(ul);

  card.addEventListener("click", () => openDetail(item.id));
  return card;
}

function renderList() {
  setError("");

  listContainer.innerHTML = "";

  const items = DATA.hippodromes || [];
  if (items.length === 0) {
    setError("Aucun contenu dans library.json (hippodromes vide).");
    return;
  }

  const filtered = (CURRENT_FILTER === "__all__")
    ? items
    : items.filter(x => x.id === CURRENT_FILTER);

  if (filtered.length === 0) {
    setError("Aucun hippodrome trouvé pour ce filtre.");
    return;
  }

  filtered.forEach((it) => listContainer.appendChild(makeCard(it)));
}

function openDetail(id) {
  const item = (DATA.hippodromes || []).find(x => x.id === id);
  if (!item) return;

  detailTitle.textContent = item.title;

  // Points clés
  detailBullets.innerHTML = "";
  (item.details || []).forEach((d) => {
    const li = document.createElement("li");
    li.textContent = d;
    detailBullets.appendChild(li);
  });

  // Profils
  detailProfils.innerHTML = "";
  const profils = item.profils || [];
  if (profils.length === 0) {
    const p = document.createElement("div");
    p.className = "muted";
    p.textContent = "Pas encore de profils renseignés.";
    detailProfils.appendChild(p);
  } else {
    profils.forEach((pr) => {
      const pill = document.createElement("span");
      pill.className = "pill";
      pill.textContent = pr;
      detailProfils.appendChild(pill);
    });
  }

  detailNote.textContent = item.note || "";

  showView("detail");
}

async function loadLibrary() {
  try {
    const res = await fetch("./library.json", { cache: "no-store" });
    if (!res.ok) throw new Error("HTTP " + res.status);

    const json = await res.json();

    if (!json || !Array.isArray(json.hippodromes)) {
      throw new Error("Structure attendue: { hippodromes: [] }");
    }

    DATA = json;

    // Remplit le menu
    renderSelectOptions(DATA.hippodromes);

    // Affiche la liste par défaut
    CURRENT_FILTER = "__all__";
    filterSelect.value = "__all__";
    showView("list");
    renderList();

  } catch (e) {
    console.error(e);
    setError("Erreur : library.json invalide ou introuvable.");
  }
}

// EVENTS
filterSelect.addEventListener("change", (e) => {
  CURRENT_FILTER = e.target.value;

  if (CURRENT_FILTER === "__all__") {
    showView("list");
    renderList();
  } else {
    openDetail(CURRENT_FILTER);
  }
});

backBtn.addEventListener("click", () => {
  // Revenir à la liste "Tous"
  CURRENT_FILTER = "__all__";
  filterSelect.value = "__all__";
  showView("list");
  renderList();
});

// INIT
loadLibrary();
