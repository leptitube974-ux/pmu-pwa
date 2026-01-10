// ==============================
// CONFIG
// ==============================
const DATA_URL = "./library.json";

// ==============================
// STATE
// ==============================
let DATA = [];
let selectedType = null;
let selectedHippodrome = null;

// ==============================
// DOM
// ==============================
const typeSelect = document.getElementById("typeSelect");
const hippodromeSelect = document.getElementById("hippodromeSelect");
const parcoursSelect = document.getElementById("parcoursSelect");
const fiche = document.getElementById("fiche");

// ==============================
// INIT
// ==============================
async function init() {
  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("library.json introuvable");
    const json = await res.json();

    if (!Array.isArray(json.courses)) {
      throw new Error("Format invalide : attendu { courses: [] }");
    }

    DATA = json.courses;
    populateTypes();
  } catch (err) {
    console.error(err);
    fiche.innerHTML = `<p style="color:red">Erreur : ${err.message}</p>`;
  }
}

// ==============================
// POPULATE TYPE
// ==============================
function populateTypes() {
  typeSelect.innerHTML = `<option value="">Choisir : Attelé / Plat / Obstacles</option>`;
  hippodromeSelect.innerHTML = `<option value="">Choisir un hippodrome...</option>`;
  parcoursSelect.innerHTML = `<option value="">Choisir un parcours...</option>`;

  const types = [...new Set(DATA.map(c => c.type))];
  types.forEach(type => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    typeSelect.appendChild(opt);
  });
}

// ==============================
// TYPE CHANGE
// ==============================
typeSelect.addEventListener("change", () => {
  selectedType = typeSelect.value;
  hippodromeSelect.innerHTML = `<option value="">Choisir un hippodrome...</option>`;
  parcoursSelect.innerHTML = `<option value="">Choisir un parcours...</option>`;
  fiche.innerHTML = "";

  if (!selectedType) return;

  const hippodromes = [
    ...new Set(
      DATA.filter(c => c.type === selectedType).map(c => c.hippodrome)
    )
  ];

  hippodromes.forEach(h => {
    const opt = document.createElement("option");
    opt.value = h;
    opt.textContent = h;
    hippodromeSelect.appendChild(opt);
  });
});

// ==============================
// HIPPODROME CHANGE
// ==============================
hippodromeSelect.addEventListener("change", () => {
  selectedHippodrome = hippodromeSelect.value;
  parcoursSelect.innerHTML = `<option value="">Choisir un parcours...</option>`;
  fiche.innerHTML = "";

  if (!selectedHippodrome) return;

  const parcours = DATA.filter(
    c => c.type === selectedType && c.hippodrome === selectedHippodrome
  );

  parcours.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.titre;
    parcoursSelect.appendChild(opt);
  });
});

// ==============================
// PARCOURS CHANGE
// ==============================
parcoursSelect.addEventListener("change", () => {
  const id = parcoursSelect.value;
  fiche.innerHTML = "";
  if (!id) return;

  const course = DATA.find(c => c.id === id);
  if (!course) return;

  fiche.innerHTML = `
    <h2>${course.titre}</h2>
    <ul>
      ${course.details.map(d => `<li>${d}</li>`).join("")}
    </ul>
  `;
});

// ==============================
// START
// ==============================
init();
