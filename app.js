async function loadLibrary() {
  const res = await fetch("library.json");
  const data = await res.json();

  const app = document.getElementById("app");
  app.innerHTML = "";

  data.profiles.forEach(p => {
    const div = document.createElement("div");
    div.style.border = "1px solid #1f2937";
    div.style.borderRadius = "12px";
    div.style.padding = "10px";
    div.style.marginBottom = "10px";

    div.innerHTML = `
      <strong>${p.hippodrome}</strong> – ${p.parcours}<br>
      <small>${p.rules_text.join(" • ")}</small>
    `;

    app.appendChild(div);
  });
}

document.addEventListener("DOMContentLoaded", loadLibrary);
