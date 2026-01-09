(async function () {
  const root = document.getElementById("app");

  // Style pour éviter la sélection de texte + rendre cliquable
  const style = document.createElement("style");
  style.textContent = `
    .card { user-select:none; -webkit-user-select:none; cursor:pointer; }
    .details { display:none; margin-top:10px; font-size:14px; color:#d1d5db; line-height:1.4; }
    .card.open .details { display:block; }
  `;
  document.head.appendChild(style);

  // Charge la bibliothèque
  const res = await fetch("library.json", { cache: "no-store" });
  const data = await res.json();

  // Affiche les cartes
  root.innerHTML = `
    <h1>PMU – Bibliothèque Hippodromes</h1>
    <div id="list"></div>
  `;

  const list = document.getElementById("list");

  data.profiles.forEach((p) => {
    const card = document.createElement("
