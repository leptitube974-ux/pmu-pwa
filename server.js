const express = require('express');
const path = require('path');

const app = express();
const PMU = 'https://online.turfinfo.api.pmu.fr/rest/client/7';

const HEADERS = {
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Origin': 'https://www.pmu.fr',
  'Referer': 'https://www.pmu.fr/'
};

app.use(express.static(path.join(__dirname)));

async function pmuFetch(url) {
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`PMU ${res.status}: ${url}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Réponse invalide de l\'API PMU');
  }
}

// Programme du jour
app.get('/api/programme/:date', async (req, res) => {
  try {
    const data = await pmuFetch(`${PMU}/programme/${req.params.date}`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Partants d'une course
app.get('/api/participants/:date/:reunion/:course', async (req, res) => {
  const { date, reunion, course } = req.params;
  try {
    const data = await pmuFetch(
      `${PMU}/programme/${date}/R${reunion}/C${course}/participants?specialisation=INTERNET`
    );
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Interviews (déclarations pilotes/entraîneurs)
app.get('/api/interviews/:date/:reunion/:course', async (req, res) => {
  const { date, reunion, course } = req.params;
  try {
    const data = await pmuFetch(
      `${PMU}/programme/${date}/R${reunion}/C${course}/interviews`
    );
    res.json(data);
  } catch {
    res.json({ interviews: [] });
  }
});

// Historique performances d'un cheval (optionnel, enrichissement)
app.get('/api/performances/:date/:reunion/:course/:numPmu', async (req, res) => {
  const { date, reunion, course, numPmu } = req.params;
  try {
    const data = await pmuFetch(
      `${PMU}/programme/${date}/R${reunion}/C${course}/participants/${numPmu}/performances-detaillees/pmu`
    );
    res.json(data);
  } catch {
    res.json({ performances: [] });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ PMU Assistant démarré → http://localhost:${PORT}\n`);
});
