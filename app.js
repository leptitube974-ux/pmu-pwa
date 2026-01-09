(async function () {
  const app = document.getElementById("app");

  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (m) => ({
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

  const getQuery = (key) => {
    const url = new URL(window.location.href);
    return url.searchParams.get(key);
  };

  app.innerHTML = `
    <h1>PMU — Bibliothèque Hippodromes</h1>

    <label class="label" for="hippoSelect">Choisir un hippodrome</label>
    <select id="hippoSelect">
      <option value="all">Tous les hippodromes</option>
    </select>

    <div id="list"></div>
    <div id="err" class="error" style="display:none;"></div>
  `;

  const select = document.getElementById("hippoSelect");
  const list = document.getElementById("list");
  const err = document.getElementById("err");

  function showError(msg) {
    err.style.display = "block";
    err.textContent = msg;
  }

  function renderCards(items) {
    if (!items.length) {
      list.innerHTML = `<p style="opacity:.85;">Aucun hippodrome trouvé.</p>`;
      return;
    }

    list.innerHTML = items.map(h => `
      <div class="card">
        <div class="title">${escapeHtml(h.titre)}</div>
        <ul>
          ${(h.details || []).map(d => `<li>${escapeHtml(d)}</li>`).join("")}
        </ul>
      </div>
    `).join("");
  }

  let data;
  try {
    const res = await fetch("./library.json", { cache: "no-store" });
    if (!res.ok) throw new Error("library.json introuvable");
    data = await res.json();
  } catch (e) {
    showError("Erreur : library.json invalide ou introuvable.");
    return;
  }

  const hippodromes = Array.isArray(data.hippodromes) ? data.hippodromes : [];

  // Remplit le menu déroulant
  hippodromes.forEach((h) => {
    const opt = document.createElement("option");
    opt.value = h.id;
    opt.textContent = h.titre;
    select.appendChild(opt);
  });

  // Si on a un paramètre d'URL ?h=...
  const initial = getQuery("h") || "all";
  if ([...select.options].some(o => o.value === initial)) select.value = initial;

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

  select.addEventListener("change", applyFilter);

  // Premier affichage
  applyFilter();
})();
