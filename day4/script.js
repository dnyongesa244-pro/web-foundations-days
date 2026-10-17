const noteText = document.querySelector("#note-text");
const charCount = document.querySelector("#char-count");
const wordCount = document.querySelector("#word-count");
const clearButton = document.querySelector("#clear-btn");
const themeToggle = document.querySelector("#theme-toggle");

const draftStorageKey = "quick-note-draft";
const themeStorageKey = "quick-note-dark-mode";

function updateCounts() {
  const text = noteText.value;
  const characterTotal = text.length;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  charCount.textContent = `${characterTotal} / 200 characters`;
  wordCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
  charCount.classList.toggle("warning", characterTotal > 180);
  charCount.classList.toggle("over", characterTotal > 200);
}

function clearNote() {
  noteText.value = "";
  updateCounts();
  localStorage.removeItem(draftStorageKey);
}

function updateThemeButton() {
  themeToggle.textContent = document.body.classList.contains("dark")
    ? "Light mode"
    : "Dark mode";
}

noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem(draftStorageKey, noteText.value);
});

clearButton.addEventListener("click", clearNote);

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});

themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark");
  localStorage.setItem(themeStorageKey, String(isDark));
  updateThemeButton();
});

const savedDraft = localStorage.getItem(draftStorageKey);
if (savedDraft !== null) {
  noteText.value = savedDraft;
}

if (localStorage.getItem(themeStorageKey) === "true") {
  document.body.classList.add("dark");
}

updateThemeButton();
updateCounts();
