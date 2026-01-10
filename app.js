"use strict";

/**
 * PMU Assistant — Auto (chaos/scénario/profil) + sélection Base/Chance/Outsider
 * Fonctionne sans API et sur téléphone.
 */

const els = {
  conditions: document.getElementById("conditionsInput"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  resetBtn: document.getElementById("resetBtn"),
  errorBox: document.getElementById("errorBox"),

  autoSummary: document.getElementById("autoSummary"),
  summaryPills: document.getElementById("summaryPills"),
  chaosOut: document.getElementById("chaosOut"),
  scenarioOut: document.getElementById("scenarioOut"),
  profileOut: document.getElementById("profileOut"),
  reasonsOut: document.getElementById("reasonsOut"),

  manualBlock: document.getElementById("manualBlock"),
  partants: document.getElementById("partantsInput"),
  buildBtn: document.getElementById("buildBtn"),
  finalBtn: document.getElementById("finalBtn"),

  chipsWrap: document.getElementById("chipsWrap"),
  basesOut: document.getElementById("basesOut"),
  chancesOut: document.getElementById("chancesOut"),
  outsOut: document.getElementById("outsOut"),
  playOut: document.getElementById("playOut"),
};

const HIPPODROMES = [
  "Vincennes",
  "Cagnes-sur-Mer",
  "Enghien",
  "Croisé-Laroche",
  "ParisLongchamp",
  "Longchamp",
  "Chantilly",
  "Compiègne",
  "Auteuil",
  "Marseille-Borély",
  "Marseille Borely",
  "Marseille-Borely",
];

let lastAuto = null; // {hippodrome, distance, partants, type, groupe, autostart, piste, corde, chaos, scenario, profile, reasons[]}
let pickState = new Map(); // num -> "base" | "chance" | "out" | ""

function showError(msg) {
  els.errorBox.style.display = "block";
  els.errorBox.textContent = msg;
}
function clearError() {
  els.errorBox.style.display = "none";
  els.errorBox.textContent = "";
}

function norm(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractNumberAfter(patterns, text) {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) return parseInt(m[1], 10);
  }
  return null;
}

function parseConditions(raw) {
  const text = raw || "";
  const t = norm(text);

  // Type
  let type = null;
  if (t.includes("atte")) type = "Attelé";
  if (t.includes("plat")) type = "Plat";
  if (t.includes("haies") || t.includes("steeple") || t.includes("obstacle")) type = "Obstacles";

  // Hippodrome (match souple)
  let hippodrome = null;
  for (const h of HIPPODROMES) {
    const hn = norm(h);
    if (t.includes(hn)) {
      hippodrome = h === "Longchamp" ? "ParisLongchamp" : h;
      break;
    }
  }
  // fallback: Vincennes (R1) etc.
  if (!hippodrome) {
    const m = text.match(/:\s*([A-Za-zÀ-ÿ' -]+)\s*\(R/i);
    if (m && m[1]) hippodrome = m[1].trim();
  }

  // Distance (ex: 2850m, 2700 m)
  const distance = extractNumberAfter(
    [/(\d{3,4})\s*m\b/i, /(\d{3,4})m\b/i],
    text
  );

  // Partants
  const partants = extractNumberAfter(
    [/(\d{1,2})\s*partants?\b/i],
    text
  );

  // Groupe / classe
  let groupe = null;
  const gm = text.match(/Groupe\s*(I{1,3}|IV|V)\b/i);
  if (gm && gm[1]) groupe = gm[1].toUpperCase();

  // Autostart vs Volté
  const autostart = t.includes("autostart");
  const volte = t.includes("volte") || t.includes("volté") || (!autostart && (type === "Attelé")); // défaut attelé = volté si rien

  // Piste / corde
  const grandePiste = t.includes("grande piste");
  const petitePiste = t.includes("petite piste");
  const cordeGauche = t.includes("corde") && (t.includes("a gauche") || t.includes("à gauche") || t.includes("gauche"));
  const surface = t.includes("psf") ? "PSF" : (t.includes("gazon") ? "Gazon" : (t.includes("cendree") ? "Cendrée" : null));

  return {
    type,
    hippodrome,
    distance,
    partants,
    groupe,
    autostart,
    volte,
    grandePiste,
    petitePiste,
    cordeGauche,
    surface,
    raw: text,
  };
}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function computeChaosScenarioProfile(info) {
  const reasons = [];
  let chaos = 0;

  // Type (base)
  if (info.type === "Obstacles") { chaos += 2; reasons.push("+2 Obstacles (aléas sauts/terrain)"); }
  else if (info.type === "Attelé") { chaos += 1; reasons.push("+1 Attelé (un minimum d’aléas)"); }
  else if (info.type === "Plat") { chaos += 1; reasons.push("+1 Plat (rythme/placement)"); }

  // Départ
  if (info.autostart) { chaos += 2; reasons.push("+2 Autostart (numéros + trafic)"); }
  else if (info.volte) { chaos += 1; reasons.push("+1 Volté (départ délicat possible)"); }

  // Partants
  if (Number.isFinite(info.partants)) {
    if (info.partants >= 14) { chaos += 2; reasons.push("+2 14–16 partants"); }
    else if (info.partants >= 11) { chaos += 1; reasons.push("+1 11–13 partants"); }
    else { reasons.push("+0 ≤10 partants"); }
  }

  // Distance (heuristique)
  if (Number.isFinite(info.distance)) {
    if (info.distance <= 2100) { chaos += 1; reasons.push("+1 Distance courte (course rapide)"); }
    else if (info.distance >= 2700 && info.type === "Attelé") { chaos -= 1; reasons.push("−1 Distance tenue (tri par l’effort)"); }
    else if (info.distance >= 2400 && info.type === "Plat") { chaos -= 1; reasons.push("−1 Longue distance (tenue)"); }
  }

  // Niveau (Groupes = plus propre)
  if (info.groupe) {
    if (info.groupe === "I") { chaos -= 2; reasons.push("−2 Groupe I (course très cadrée)"); }
    if (info.groupe === "II") { chaos -= 2; reasons.push("−2 Groupe II (course cadrée)"); }
    if (info.groupe === "III") { chaos -= 1; reasons.push("−1 Groupe III"); }
  }

  // Hippodrome/piste
  const hip = norm(info.hippodrome || "");
  if (hip.includes("vincennes") && info.grandePiste) { chaos -= 1; reasons.push("−1 Vincennes Grande Piste (sélectif)"); }
  if (hip.includes("cagnes")) { chaos += 1; reasons.push("+1 Cagnes (aléas/rythme)"); }
  if (hip.includes("enghien")) { chaos += 1; reasons.push("+1 Enghien (rythme/placement)"); }

  // Obstacles terrain (si on détecte lourd/collant dans texte)
  const t = norm(info.raw || "");
  if (info.type === "Obstacles" && (t.includes("lourd") || t.includes("collant") || t.includes("tres souple") || t.includes("très souple"))) {
    chaos += 1; reasons.push("+1 Terrain pénible (obstacles)");
  }

  chaos = clamp(chaos, 0, 10);

  // Scénario
  // Règle simple : Groupe I/II ou chaos bas => S1 ; chaos haut => S2
  let scenario = "2";
  if ((info.groupe === "I" || info.groupe === "II") && chaos <= 6) scenario = "1";
  else if (chaos <= 4) scenario = "1";
  else scenario = "2";

  // Profil
  let profile = "Mixte";
  if (info.type === "Attelé") {
    if (info.autostart || (info.distance && info.distance <= 2100)) profile = "Vitesse / placement / numéros";
    else profile = "Tenue / effort long / course sélective";
  }
  if (info.type === "Plat") {
    if (info.surface === "PSF") profile = "PSF : régularité + placement";
    else if (info.distance && info.distance >= 2400) profile = "Tenue (longue distance)";
    else profile = "Vitesse + changement de rythme";
  }
  if (info.type === "Obstacles") {
    profile = "Sauts + terrain + cheval dur";
  }

  return { chaos, scenario, profile, reasons };
}

function pillsFrom(info, computed) {
  const p = [];
  if (info.type) p.push(`Type: ${info.type}`);
  if (info.hippodrome) p.push(`Hippodrome: ${info.hippodrome}`);
  if (info.distance) p.push(`Distance: ${info.distance} m`);
  if (info.partants) p.push(`Partants: ${info.partants}`);
  if (info.groupe) p.push(`Groupe: ${info.groupe}`);
  if (info.autostart) p.push(`Départ: Autostart`);
  else if (info.volte) p.push(`Départ: Volté`);
  if (info.grandePiste) p.push(`Piste: Grande`);
  if (info.surface) p.push(`Surface: ${info.surface}`);
  p.push(`Chaos: ${computed.chaos}/10`);
  p.push(`Scénario: ${computed.scenario}`);
  return p;
}

function renderAuto(info, computed) {
  els.autoSummary.style.display = "block";
  els.manualBlock.style.display = "block";

  els.summaryPills.innerHTML = "";
  for (const s of pillsFrom(info, computed)) {
    const span = document.createElement("span");
    span.className = "pill";
    span.textContent = s;
    els.summaryPills.appendChild(span);
  }

  els.chaosOut.textContent = `${computed.chaos}/10`;
  els.scenarioOut.textContent = computed.scenario === "1" ? "Scénario 1 (verrouillé)" : "Scénario 2 (aléas)";
  els.profileOut.textContent = computed.profile;

  // raisons courtes (3 lignes max)
  const top = computed.reasons.slice(0, 5);
  els.reasonsOut.textContent = top.join(" • ");

  lastAuto = { ...info, ...computed };
}

function parsePartants(text) {
  const raw = (text || "").trim();
  if (!raw) return [];
  const nums = raw
    .replace(/[^\d\s,;]+/g, " ")
    .split(/[\s,;]+/g)
    .map(s => s.trim())
    .filter(Boolean)
    .map(n => parseInt(n, 10))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= 20);
  return [...new Set(nums)].sort((a, b) => a - b);
}

function setPick(num, kind) {
  pickState.set(num, kind);
}

function getPick(num) {
  return pickState.get(num) || "";
}

function buildChips(nums) {
  els.chipsWrap.innerHTML = "";
  if (!nums.length) return;

  for (const n of nums) {
    const chip = document.createElement("div");
    chip.className = "chip";

    chip.innerHTML = `
      <div class="chipTop">
        <div class="chipNum">N°${n}</div>
        <div class="muted" style="font-size:13px">${lastAuto?.scenario === "1" ? "S1" : "S2"} • chaos ${lastAuto?.chaos ?? "?"}/10</div>
      </div>
      <div class="chipBtns">
        <button class="bBase" data-kind="base">Base</button>
        <button class="bChance" data-kind="chance">Chance</button>
        <button class="bOut" data-kind="out">Outsider</button>
      </div>
      <div class="muted" style="margin-top:8px;font-size:13px" data-line>Choisis 1 catégorie (ou rien).</div>
    `;

    const btns = Array.from(chip.querySelectorAll("button"));
    const line = chip.querySelector("[data-line]");

    function refresh() {
      const k = getPick(n);
      btns.forEach(b => b.classList.remove("active"));
      if (k) {
        const b = btns.find(x => x.getAttribute("data-kind") === k);
        if (b) b.classList.add("active");
        line.textContent =
          k === "base" ? "✅ Base : fiable / logique" :
          k === "chance" ? "🔁 Chance : jouable" :
          "🎲 Outsider : couverture";
      } else {
        line.textContent = "Choisis 1 catégorie (ou rien).";
      }
    }

    btns.forEach(b => {
      b.addEventListener("click", () => {
        const kind = b.getAttribute("data-kind");
        const cur = getPick(n);
        // toggle
        setPick(n, cur === kind ? "" : kind);
        refresh();
      });
    });

    refresh();
    els.chipsWrap.appendChild(chip);
  }
}

function generateSummary() {
  const bases = [];
  const chances = [];
  const outs = [];
  for (const [n, k] of pickState.entries()) {
    if (k === "base") bases.push(n);
    if (k === "chance") chances.push(n);
    if (k === "out") outs.push(n);
  }
  bases.sort((a,b)=>a-b);
  chances.sort((a,b)=>a-b);
  outs.sort((a,b)=>a-b);

  els.basesOut.textContent = bases.length ? bases.join(" - ") : "—";
  els.chancesOut.textContent = chances.length ? chances.join(" - ") : "—";
  els.outsOut.textContent = outs.length ? outs.join(" - ") : "—";

  // Jeu conseillé très simple (mode téléphone)
  const scenario = lastAuto?.scenario || "2";
  const chaos = lastAuto?.chaos ?? 6;

  let play = "";
  if (scenario === "1") {
    play = `S1 : Base(s) + 3 chances. Exemple : Multi en 5-6 chevaux. Si 2 bases seulement → 2sur4 avec bases.`;
  } else {
    play = `S2 : 2 bases + 3 chances + 1–2 outsiders en couverture. Exemple : Multi 6/7 ou 2sur4 base(s).`;
  }
  play += ` (chaos=${chaos}/10)`;
  els.playOut.textContent = play;
}

function resetAll() {
  lastAuto = null;
  pickState = new Map();
  els.conditions.value = "";
  els.partants.value = "";
  els.autoSummary.style.display = "none";
  els.manualBlock.style.display = "none";
  els.chipsWrap.innerHTML = "";
  els.basesOut.textContent = "—";
  els.chancesOut.textContent = "—";
  els.outsOut.textContent = "—";
  els.playOut.textContent = "—";
  clearError();
}

els.analyzeBtn.addEventListener("click", () => {
  clearError();
  const raw = els.conditions.value.trim();
  if (!raw) {
    showError("Colle les conditions de course d’abord.");
    return;
  }

  const info = parseConditions(raw);

  if (!info.type || !info.hippodrome || !info.distance) {
    showError(
      "Je ne détecte pas tout.\n" +
      `Détecté: type=${info.type || "?"}, hippodrome=${info.hippodrome || "?"}, distance=${info.distance || "?"}\n` +
      "Astuce: assure-toi qu'il y a bien 'Attelé/Plat/Haies', le nom de l'hippodrome, et 'xxxxm'."
    );
    return;
  }

  const computed = computeChaosScenarioProfile(info);
  renderAuto(info, computed);

  // Pré-remplit les partants si on a le nombre
  if (Number.isFinite(info.partants) && !els.partants.value.trim()) {
    const list = Array.from({ length: info.partants }, (_, i) => i + 1).join(",");
    els.partants.value = list;
  }
});

els.buildBtn.addEventListener("click", () => {
  clearError();
  const nums = parsePartants(els.partants.value);
  if (!nums.length) {
    showError("Colle les partants (ex: 1,2,3,4...).");
    return;
  }
  pickState = new Map(); // reset picks
  buildChips(nums);
});

els.finalBtn.addEventListener("click", () => {
  generateSummary();
});

els.resetBtn.addEventListener("click", resetAll);
