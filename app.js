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

  // Hash routing: #/detail/<id>
  const getRouteId = () => {
    const h = (window.location.hash || "").trim();
    const m = h.match(/^#\/detail\/(.+)$/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  const goHome = () => { window.location.hash = ""; };
  const goDetail = (id) => { window.location.hash = `#/detail/${encodeURIComponent(id)}`; };

  // Load JSON
  let data;
  try {
    const res = await fetch("./library.json?v=" + Date.now(), { cache: "no-store" });
    if (!res.ok) throw new Error("library.json introuvable");
    data = await res.json();
  } catch (e) {
    app.innerHTML = `
      <h1>PMU — Bibliothèque Hippodromes</h1>
      <div class="error">Erreur : library.json invalide ou introuvable.</div>
      <div class="footer">Vérifie que <b>library.json</b> existe à la racine du repo.</div>
    `;
    return;
  }

  const hippodromes = Array.isArray(data.hippodromes) ? data.hippodromes : [];

  // UI: Home (list + dropdown filter)
  function renderHome(selectedId = "all") {
    const options = hippodromes.map(h =>
      `<option value="${escapeHtml(h.id)}">${escapeHtml(h.titre)}</option>`
    ).join("");

    const filtered = (selectedId === "all")
      ? hippodromes
      : hippodromes.filter(h => h.id === selectedId);

    const cards = filtered.map(h => `
      <div class="card">
        <button class="cardBtn" type="button" data-id="${escapeHtml(h.id)}">
          <div class="title">${escapeHtml(h.titre)}</div>
          <p class="sub">Appuie pour ouvrir la fiche détaillée</p>
        </button>
      </div>
    `).join("");

    app.innerHTML = `
      <h1>PMU — Bibliothèque Hippodromes</h1>

      <div class="row">
        <div class="field">
          <label class="label" for="hippoSelect">Filtrer la liste</label>
          <select id="hippoSelect">
            <option value="all">Tous les hippodromes</option>
            ${options}
          </select>
        </div>

        <button id="resetBtn">Réinitialiser</button>
      </div>

      <div id="list">${cards || `<p style="color:rgba(233,238,247,.75)">Aucun résultat.</p>`}</div>

      <div class="footer">Astuce : tu peux partager une fiche via l’URL (hash).</div>
    `;

    // Set select value
    const select = document.getElementById("hippoSelect");
    select.value = selectedId;

    // Events: dropdown
    select.addEventListener("change", () => {
      const val = select.value;
      renderHome(val);
      // On reste sur la home (pas de hash)
      goHome();
      // Ne pas scroller tout en bas
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Events: reset
    document.getElementById("resetBtn").addEventListener("click", () => {
      renderHome("all");
      goHome();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    // Events: open detail
    document.querySelectorAll(".cardBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (id) goDetail(id);
      });
    });
  }

  // UI: Detail page
  function renderDetail(id) {
    const h = hippodromes.find(x => x.id === id);
    if (!h) {
      app.innerHTML = `
        <div class="topbar">
          <button class="back" id="backBtn">← Retour</button>
          <span class="pill">Fiche introuvable</span>
        </div>
        <div class="panel">
          <div class="title">Ce profil n’existe pas</div>
          <p class="sub">Vérifie l’identifiant dans l’URL.</p>
        </div>
      `;
      document.getElementById("backBtn").addEventListener("click", goHome);
      return;
    }

    const bullets = (h.details || []).map(d => `<li>${escapeHtml(d)}</li>`).join("");

    app.innerHTML = `
      <div class="topbar">
        <button class="back" id="backBtn">← Retour</button>
        <span class="pill">Fiche détaillée</span>
      </div>

      <h1 style="font-size:34px;margin:6px 0 14px;">${escapeHtml(h.titre)}</h1>

      <div class="panel">
        <div class="title" style="font-size:20px;margin:0 0 8px;">Points clés</div>
        <ul>${bullets || "<li>Aucun détail.</li>"}</ul>
      </div>

      <div class="footer">Prochaine étape : ajouter “chaos / scénario / tags” sur cette fiche.</div>
    `;

    document.getElementById("backBtn").addEventListener("click", goHome);
  }

  // Router
  function renderByRoute() {
    const id = getRouteId();
    if (id) renderDetail(id);
    else renderHome("all");
  }

  window.addEventListener("hashchange", renderByRoute);
  renderByRoute();
})();
