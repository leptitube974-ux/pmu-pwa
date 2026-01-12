const raceText = document.getElementById("raceText");
const analyzeBtn = document.getElementById("analyzeBtn");
const resetBtn = document.getElementById("resetBtn");
const assistantOut = document.getElementById("assistantOut");

if (raceText && analyzeBtn) {
  analyzeBtn.addEventListener("click", () => {
    // ton code d'analyse ici…
    assistantOut.textContent = "OK (analyse lancée)";
  });
}

if (resetBtn && raceText) {
  resetBtn.addEventListener("click", () => {
    raceText.value = "";
    if (assistantOut) assistantOut.textContent = "";
  });
}
