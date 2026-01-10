let data = [];

const typeSelect = document.getElementById("type");
const hippoSelect = document.getElementById("hippodrome");
const parcoursSelect = document.getElementById("parcours");
const result = document.getElementById("result");

fetch("./library.json")
  .then(res => res.json())
  .then(json => {
    data = json.courses;

    const types = [...new Set(data.map(c => c.type))];
    types.forEach(t => {
      typeSelect.innerHTML += `<option value="${t}">${t}</option>`;
    });
  });

typeSelect.onchange = () => {
  hippoSelect.innerHTML = `<option value="">Choisir l’hippodrome</option>`;
  parcoursSelect.innerHTML = `<option value="">Choisir le parcours</option>`;
  result.innerHTML = "";

  hippoSelect.disabled = false;
  parcoursSelect.disabled = true;

  const hippos = [...new Set(
    data.filter(c => c.type === typeSelect.value).map(c => c.hippodrome)
  )];

  hippos.forEach(h => {
    hippoSelect.innerHTML += `<option value="${h}">${h}</option>`;
  });
};

hippoSelect.onchange = () => {
  parcoursSelect.innerHTML = `<option value="">Choisir le parcours</option>`;
  result.innerHTML = "";
  parcoursSelect.disabled = false;

  const parcours = data.filter(
    c => c.type === typeSelect.value && c.hippodrome === hippoSelect.value
  );

  parcours.forEach(p => {
    parcoursSelect.innerHTML += `<option value="${p.id}">${p.parcours}</option>`;
  });
};

parcoursSelect.onchange = () => {
  const course = data.find(c => c.id === parcoursSelect.value);

  result.innerHTML = `
    <div class="card">
      <h2>${course.titre}</h2>
      <ul>
        ${course.details.map(d => `<li>${d}</li>`).join("")}
      </ul>
    </div>
  `;
};
