async function loadLibrary() {
  const container = document.getElementById("cards");
  container.innerHTML = "<p style='opacity:.8'>Chargement…</p>";

  try {
    const res = await fetch("./library.json?v=" + Date.now());
    if (!res.ok) throw new Error("Erreur chargement library.json");
    const data = await res.json();

    container.innerHTML = "";
    (data.hippodromes || []).forEach((h) => {
      const card = document.createElement("div");
      card.className = "card";

      const header = document.createElement("button");
      header.className = "card-header";
      header.type = "button";
      header.innerText = h.titre || "Hippodrome";
      header.onclick = () => {
        body.classList.toggle("open");
      };

      const body = document.createElement("div");
      body.className = "card-body";

      const ul = document.createElement("ul");
      (h.details || []).forEach((d) => {
        const li = document.createElement("li");
        li.textContent = d;
        ul.appendChild(li);
      });

      body.appendChild(ul);
      card.appendChild(header);
      card.appendChild(body);
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML =
      "<p style='color:#ffb4b4'>Erreur : library.json invalide ou introuvable.</p>";
    console.error(e);
  }
}

loadLibrary();
