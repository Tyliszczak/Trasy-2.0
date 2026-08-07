/* ================================================================= /
/ ADRES URL DO TWOJEGO SKRYPTU GOOGLE APPS SCRIPT (SEJFU) /
/ ================================================================= */
// Tutaj wkleisz docelowy adres Web App otrzymany po wdrożeniu skryptu w Google
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbyQcnU6xvvrUZNVUJRhQ293L47hZwlvsc6i3n9s9hiYqhLUAoKSqGbPohe_lSB0apfUcw/exec";

// Zmienna przechowująca pobrane dane tras z serwera
let appData = null;

// Uruchomienie skryptu po załadowaniu całej strony HTML
document.addEventListener("DOMContentLoaded", () => {
initUI();
loadRoutesData();
});

/* ================================================================= /
/ INICJALIZACJA ELEMENTÓW INTERFEJSU I OBSŁUGA ZDARZEŃ /
/ ================================================================= */
function initUI() {
const adminToggleBtn = document.getElementById("adminToggleBtn");
const loginModal = document.getElementById("loginModal");
const loginCancelBtn = document.getElementById("loginCancelBtn");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");
const logoutBtn = document.getElementById("logoutBtn");

const publicView = document.getElementById("publicView");
const adminView = document.getElementById("adminView");
const routeSelect = document.getElementById("routeSelect");
const timeSelect = document.getElementById("timeSelect");
const showScheduleBtn = document.getElementById("showScheduleBtn");

// 1. Kliknięcie ikony kłódki – pokazuje okienko logowania administratora
adminToggleBtn.addEventListener("click", () => {
loginModal.style.display = "flex";
document.getElementById("adminPasswordInput").value = "";
document.getElementById("loginErrorMsg").innerText = "";
});

// 2. Anulowanie logowania – zamknij okienko
loginCancelBtn.addEventListener("click", () => {
loginModal.style.display = "none";
});

// 3. Przycisk wylogowania z panelu administratora
logoutBtn.addEventListener("click", () => {
adminView.style.display = "none";
publicView.style.display = "block";
});

// 4. Zatwierdzenie logowania (sprawdzenie hasła przez Google Apps Script)
loginSubmitBtn.addEventListener("click", async () => {
const password = document.getElementById("adminPasswordInput").value;
const errorMsg = document.getElementById("loginErrorMsg");

if (!password) {
errorMsg.innerText = "Wprowadź hasło!";
return;
}

errorMsg.innerText = "Sprawdzanie hasła...";

try {
// Wysyłamy zapytanie POST do skryptu weryfikującego hasło
const response = await fetch(GAS_API_URL, {
method: "POST",
body: JSON.stringify({ action: "verifyAdmin", password: password })
});
const result = await response.json();

if (result.success) {
// Hasło poprawne: zamykamy modal i przełączamy widok na panel administratora
loginModal.style.display = "none";
publicView.style.display = "none";
adminView.style.display = "block";
} else {
errorMsg.innerText = "Błędne hasło administratora!";
}
} catch (error) {
console.error("Błąd połączenia:", error);
errorMsg.innerText = "Błąd połączenia z serwerem.";
}
});

// 5. Zmiana wybranej trasy -> dynamiczna aktualizacja dostępnych godzin
routeSelect.addEventListener("change", (e) => {
const selectedRouteName = e.target.value;
timeSelect.innerHTML = '<option value="">-- Wybierz godzinę zmiany --</option>';

if (!appData || !selectedRouteName) return;

// Szukamy wybranej trasy w pobranych danych JSON
const routeObj = appData.find(r => r.nazwa === selectedRouteName);
if (routeObj && routeObj.godziny) {
routeObj.godziny.forEach(time => {
const opt = document.createElement("option");
opt.value = time;
opt.textContent = time;
timeSelect.appendChild(opt);
});
}
});

// 6. Kliknięcie "Pokaż harmonogram" dla pracowników/kierowców
showScheduleBtn.addEventListener("click", () => {
const route = routeSelect.value;
const time = timeSelect.value;
const resultContainer = document.getElementById("scheduleResult");

if (!route || !time) {
alert("Wybierz zarówno trasę, jak i godzinę zmiany!");
return;
}

// Generowanie prostej tabeli harmonogramu dla wybranej trasy i godziny
const routeObj = appData.find(r => r.nazwa === route);
if (!routeObj) return;

let html = <h3&gt;Harmonogram trasy: ${route} (${time})&lt;/h3>;
html += <table class="schedule-table" style="width:100%; border-collapse:collapse; margin-top:10px;">;
html += <tr style="background:#2c3e50; color:#fff;"&gt;&lt;th style="padding:8px; text-align:left;"&gt;Przystanek&lt;/th&gt;&lt;th style="padding:8px; text-align:left;"&gt;Godzina&lt;/th&gt;&lt;/tr>;

routeObj.przystanki.forEach((p, idx) => {
const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
html += <tr style="background:${rowBg}; border-bottom:1px solid #e2e8f0;">; html +=<td style="padding:8px;">${p.nazwa}&lt;/td>;
html += <td style="padding:8px;"&gt;${p.godziny[time] || "-"}&lt;/td>;
html += </tr>;
});
html += </table>;

resultContainer.innerHTML = html;
});
}

/* ================================================================= /
/ POBIERANIE DANYCH TRAS (JSON) Z GOOGLE APPS SCRIPT /
/ ================================================================= */
async function loadRoutesData() {
try {
const response = await fetch(GAS_API_URL + "?action=getRoutes");
appData = await response.json();
console.log("Dane tras wczytane poprawnie:", appData);
} catch (error) {
console.error("Nie udało się pobrać danych tras:", error);
}
}
