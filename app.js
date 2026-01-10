// app.js — PMU Bibliothèque Hippodromes
// Charge library.json (GitHub Pages compatible) + 3 dropdowns

(() => {
  // ✅ URL RELATIVE ROBUSTE (marche même si ton site est /pmu-pwa/)
  const DATA_URL = new URL("./library.json", window.location.href).toString();

  const $ = (sel) => document.querySelector(sel);

  const els = {
    type: $("#selectType"),
    hippo: $("#selectHippo"),
    parcours: $("#selectParcours"),
    result: $("#result"),
    error: $("#errorBox"),
  };

  const state = {
    courses: [],
    selectedType: "",
    selectedHippo: "",
    selectedParcoursId: "",
  };

  function showError(msg) {
    if (!els.error) return;
    els.error.style.display = "block";
    els.error.textContent = msg;
  }

  function clearError() {
    if (!els.error) return;
    els.error.style.display = "none";
    els.error.textContent = "";
  }

  function setSelectOptions(selectEl, options, placeholder) {
    selectEl.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = placeholder;
    opt0.disabled = true;
    opt0.selected = true;
    selectEl.appendChild(opt0);

    for (const { value, label } of options) {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = label;
      selectEl.appendChild(opt);
    }

    selectEl.disabled = options.length === 0;
  }

  function uniqSorted(arr) {
    return [...new Set(arr)].sort((a, b) => a.localeCompare(b, "fr"));
  }

  function renderResult(course) {
    if (!els.result) return;
    if (!course) {
      els.result.innerHTML = "";
      return;
    }

    const details = Array.isArray(course.details) ? course.details : [];
    els.result.innerHTML = `
      <div class="card">
        <div class="cardTitle">${escapeHtml(course.titre || course.title || "")}</div>
        <div class="muted">${escapeHtml(course.type)} • ${escapeHtml(course.hippodrome)} • ${escapeHtml(course.parcours)}</div>

        ${details.length ? `
          <h3>Points clés</h3>
          <ul>
            ${details.map(d => `<li>${escapeHtml(d)}</li>`).join("")}
          </ul>
        ` : `<div class="muted">Aucun détail pour l’instant.</div>`}
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function onTypeChange() {
    state.selectedType = els.type.value;
    state.selectedHippo = "";
    state.selectedParcoursId = "";

    // reset selects
    setSelectOptions(els.hippo, [], "Choisir un hippodrome…");
    setSelectOptions(els.parcours, [], "Choisir un parcours…");
    renderResult(null);

    const list = state.courses.filter(c => (c.type || "").toLowerCase() === state.selectedType.toLowerCase());
    const hippos = uniqSorted(list.map(c => c.hippodrome).filter(Boolean));

    setSelectOptions(
      els.hippo,
      hippos.map(h => ({ value: h, label: h })),
      "Choisir un hippodrome…"
    );
  }

  function onHippoChange() {
    state.selectedHippo = els.hippo.value;
    state.selectedParcoursId = "";

    setSelectOptions(els.parcours, [], "Choisir un parcours…");
    renderResult(null);

    const list = state.courses.filter(c =>
      (c.type || "").toLowerCase() === state.selectedType.toLowerCase() &&
      (c.hippodrome || "") === state.selectedHippo
    );

    // parcours dropdown = id unique (mais label = parcours)
    const options = list
      .filter(c => c.id && c.parcours)
      .map(c => ({ value: c.id, label: c.parcours }));

    // tri alphabétique sur label
    options.sort((a, b) => a.label.localeCompare(b.label, "fr"));

    setSelectOptions(els.parcours, options, "Choisir un parcours…");
  }

  function onParcoursChange() {
    state.selectedParcoursId = els.parcours.value;
    const course = state.courses.find(c => c.id === state.selectedParcoursId) || null;
    renderResult(course);
  }

  async function load() {
    clearError();

    // ✅ Anti-cache (utile sur GitHub Pages)
    const urlNoCache = `${DATA_URL}?v=${Date.now()}`;

    try {
      const res = await fetch(urlNoCache, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Fetch library.json échoué (${res.status}) : ${res.statusText}`);
      }
      const json = await res.json();

      // ✅ format attendu
      if (!json || !Array.isArray(json.courses)) {
        throw new Error(`Format JSON invalide : attendu { "courses": [ ... ] }`);
      }

      state.courses = json.courses;

      // Types
      const types = uniqSorted(state.courses.map(c => c.type).filter(Boolean));

      setSelectOptions(
        els.type,
        types.map(t => ({ value: t, label: t })),
        "Choisir : Attelé / Plat / Obstacles…"
      );

      // désactiver hippo/parcours au départ
      setSelectOptions(els.hippo, [], "Choisir un hippodrome…");
      setSelectOptions(els.parcours, [], "Choisir un parcours…");
      renderResult(null);

    } catch (err) {
      showError(
        `Erreur : library.json invalide ou introuvable.\n` +
        `Détail : ${err.message}\n` +
        `URL testée : ${DATA_URL}`
      );

      // menus vides mais propres
      setSelectOptions(els.type, [], "Choisir : Attelé / Plat / Obstacles…");
      setSelectOptions(els.hippo, [], "Choisir un hippodrome…");
      setSelectOptions(els.parcours, [], "Choisir un parcours…");
      renderResult(null);
    }
  }

  function wire() {
    els.type?.addEventListener("change", onTypeChange);
    els.hippo?.addEventListener("change", onHippoChange);
    els.parcours?.addEventListener("change", onParcoursChange);
  }

  // init
  wire();
  load();
})();
