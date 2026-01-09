(async function () {
  const app = document.getElementById("app");

  const escapeHtml = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    }[m]));

  const setQuery = (key, value) => {
    const url = new URL(window.location.href);
    if (!value || value === "all") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    window.history.replaceState({}, "", url.toString());
  };

  const getQuery = (key) => new URL(window.location.href).searchParams.get(key);

  app.innerHTML = `
    <h1>PMU — Bibliothèque Hippodromes</h1>

    <div style="display:flex; gap:10px; align-items:flex-end; margin:14px 0 10px 0;">
      <div style="flex:1;">
        <label class="label" for="hippoSelect">Choisir un hippodrome</label>
        <select id="hippoSelect">
          <option value="all">Tous les hippodromes</option>
        </select>
      </div>

      <button id="resetBtn" style="
        padding:12px 14px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,.12);
        background:rgba(255,255,255,.04);
        color:#e9eef7;
        font-size:14px;
      ">Réinitialiser</button>
    </div>

    <div id="list"></div>
    <div id="err" class="error" style="display:none;"></div>
  `;

  const select = document.getElementById("hippoSelect");
  const list = document.getElementById("list");
  const err = document.getElementById("err");
  const resetBtn = document.getElementById("resetBtn");

  function showError(msg) {
    err.style.display = "block";
    err.textContent = msg;
  }
  function hideError() {
    err.style.display = "none";
    err.textContent = "";
  }

  function renderCards(items) {
    list.innerHTML = "";

    if (!items || !items.length) {
      list.innerHTML = `<p style="opacity:.85;">Aucun hippodrome trouvé.</p>`;
      return;
    }

    // Cartes "statique" : pas d'accordéon, pas de clic
    const html = items.map(h => `
      <div class="card static-card">
        <div class="title">${escapeHtml(h.titre)}</div>
        <ul>
          ${(h.details || []).map(d => `<li>${escapeHtml(d)}</li>`).join("")}
        </ul>
      </div>
    `).join("");

    list.innerHTML = html;
  }

  let data;
  try {
    const res = await fetch("./library.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("library.json introuvable");
    data = await res.json();
  } catch (e) {
    showError("Erreur : library.json invalide ou introuvable.");
    return;
  }

  hideError();

  const hippodromes = Array.isArray(data.hippodromes) ? data.hippodromes : [];

  // Remplit le menu
  hippodromes.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.titre;
    select.appendChild(opt);
  });

  function applyFilter() {
    const value = select.value;
    setQuery("h", value);

    if (value === "all") {
      renderCards(hippodromes);
      return;
    }
    const found = hippodromes.find(h => h.id === value);
    renderCards(found ? [found] : []);
  }

  // Init depuis URL
  const initial = getQuery("h") || "all";
  if ([...select.options].some(o => o.value === initial)) select.value = initial;
  else select.value = "all";

  select.addEventListener("change", applyFilter);

  resetBtn.addEventListener("click", () => {
    select.value = "all";
    applyFilter();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  applyFilter();
})();
