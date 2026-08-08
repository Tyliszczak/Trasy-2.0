import { ROUTES as FALLBACK_ROUTES } from "./routes.js";
import { getRoute, getSchedule, mapUrl } from "./schedule.js";

const API_URL = "https://script.google.com/macros/s/AKfycbyQcnU6xvvrUZNVUJRhQ293L47hZwlvsc6i3n9s9hiYqhLUAoKSqGbPohe_lSB0apfUcw/exec";
const DATA_KEY = "trasy2.routes";
const SYNC_KEY = "trasy2.lastSuccessfulSync";
const THREE_DAYS = 72 * 60 * 60 * 1000;

const routeSelect = document.querySelector("#routeSelect");
const timeSelect = document.querySelector("#timeSelect");
const showButton = document.querySelector("#showSchedule");
const message = document.querySelector("#formMessage");
const schedule = document.querySelector("#schedule");
const scheduleTitle = document.querySelector("#scheduleTitle");
const scheduleBody = document.querySelector("#scheduleBody");
const connectionStatus = document.querySelector("#connectionStatus");
const staleWarning = document.querySelector("#staleWarning");
const updateNotice = document.querySelector("#updateNotice");
const updateAppButton = document.querySelector("#updateAppButton");

let routes = loadCachedRoutes() ?? FALLBACK_ROUTES;
let offlineMode = true;
let syncing = false;

renderRouteOptions();
updateConnectionStatus();
syncRoutes();
setInterval(updateConnectionStatus, 60 * 1000);
window.addEventListener("online", syncRoutes);
window.addEventListener("focus", () => syncRoutes());

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) syncRoutes();
});

routeSelect.addEventListener("change", () => {
  const route = getRoute(routes, routeSelect.value);
  timeSelect.replaceChildren(new Option(route ? "Wybierz godzinę" : "Najpierw wybierz trasę", ""));
  timeSelect.disabled = !route;
  route?.times.forEach((time) => timeSelect.add(new Option(time, time)));
  schedule.hidden = true;
  message.textContent = "";
});

showButton.addEventListener("click", () => {
  const route = getRoute(routes, routeSelect.value);
  const time = timeSelect.value;
  if (!route || !time) {
    message.textContent = "Wybierz trasę i godzinę zmiany.";
    return;
  }
  const stops = getSchedule(route, time);
  scheduleTitle.textContent = `${route.name} · ${time}`;
  scheduleBody.replaceChildren(...stops.map((stop) => createStopRow(stop)));
  schedule.hidden = false;
  message.textContent = "";
  schedule.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#clearSchedule").addEventListener("click", () => routeSelect.focus());

async function syncRoutes() {
  if (syncing || !navigator.onLine) {
    offlineMode = true;
    updateConnectionStatus();
    return;
  }

  syncing = true;
  try {
    const response = await fetch(`${API_URL}?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const freshRoutes = normalizeApiRoutes(payload?.data);
    if (!isValidRoutes(freshRoutes)) throw new Error("Nieprawidłowa lub pusta baza tras");

    routes = freshRoutes;
    localStorage.setItem(DATA_KEY, JSON.stringify(routes));
    localStorage.setItem(SYNC_KEY, String(Date.now()));
    offlineMode = false;
    renderRouteOptions();
  } catch (error) {
    offlineMode = true;
    console.warn("Nie udało się odświeżyć bazy tras. Używam kopii lokalnej.", error);
  } finally {
    syncing = false;
    updateConnectionStatus();
  }
}

function normalizeApiRoutes(data) {
  if (Array.isArray(data)) return data.map(normalizeRoute).filter(Boolean);
  if (!data || typeof data !== "object") return [];

  return Object.entries(data).map(([name, value]) => normalizeRoute(value, name)).filter(Boolean);
}

function normalizeRoute(value, fallbackName = "") {
  if (!value || typeof value !== "object") return null;
  const name = String(value.name ?? value.nazwa ?? value.route ?? fallbackName).trim();
  const rawStops = value.stops ?? value.przystanki ?? [];
  if (!name || !Array.isArray(rawStops)) return null;

  const explicitTimes = Array.isArray(value.times ?? value.godziny) ? (value.times ?? value.godziny) : [];
  const times = [...new Set(explicitTimes.map(String).filter(Boolean))];
  const stops = rawStops.map((stop) => normalizeStop(stop, times)).filter(Boolean);

  if (!times.length) {
    for (const stop of stops) {
      Object.keys(stop.times).forEach((time) => {
        if (time && !times.includes(time)) times.push(time);
      });
    }
  }

  return { name, times, stops };
}

function normalizeStop(stop, routeTimes) {
  if (!stop || typeof stop !== "object") return null;
  const name = String(stop.name ?? stop.nazwa ?? stop.przystanek ?? "").trim();
  const coordinates = stop.coordinates ?? stop.lokalizacja ?? stop.coords ?? coordinatesFromLatLng(stop);
  const sourceTimes = stop.times ?? stop.godziny ?? {};
  const times = {};

  if (Array.isArray(sourceTimes)) {
    routeTimes.forEach((time, index) => { times[time] = sourceTimes[index] ?? null; });
  } else if (sourceTimes && typeof sourceTimes === "object") {
    Object.entries(sourceTimes).forEach(([time, value]) => { times[String(time)] = value ?? null; });
  }

  if (!name) return null;
  return { name, coordinates: coordinates ? String(coordinates) : "", times };
}

function coordinatesFromLatLng(stop) {
  const lat = stop.lat ?? stop.latitude ?? stop.szerokosc;
  const lng = stop.lng ?? stop.longitude ?? stop.dlugosc;
  return lat != null && lng != null ? `${lat}, ${lng}` : "";
}

function isValidRoutes(value) {
  return Array.isArray(value) && value.length > 0 && value.every((route) =>
    route?.name && Array.isArray(route.times) && Array.isArray(route.stops) && route.stops.length > 0
  );
}

function loadCachedRoutes() {
  try {
    const cached = JSON.parse(localStorage.getItem(DATA_KEY));
    return isValidRoutes(cached) ? cached : null;
  } catch {
    return null;
  }
}

function renderRouteOptions() {
  const previous = routeSelect.value;
  routeSelect.replaceChildren(new Option("Wybierz trasę", ""));
  routes.forEach((route) => routeSelect.add(new Option(route.name, route.name)));
  if (routes.some((route) => route.name === previous)) routeSelect.value = previous;
}

function updateConnectionStatus() {
  const lastSync = Number(localStorage.getItem(SYNC_KEY)) || 0;
  const age = lastSync ? Date.now() - lastSync : null;

  if (!offlineMode) {
    connectionStatus.hidden = true;
    staleWarning.hidden = true;
    return;
  }

  connectionStatus.hidden = false;
  connectionStatus.textContent = age == null ? "Offline · brak świeżej synchronizacji" : `Offline · dane sprzed ${formatAge(age)}`;
  staleWarning.hidden = !(age == null || age >= THREE_DAYS);
}

function formatAge(ms) {
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz.`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days} dni ${remainingHours} godz.` : `${days} dni`;
}

function createStopRow(stop) {
  const row = document.createElement("tr");
  const name = document.createElement("td");
  const time = document.createElement("td");
  const map = document.createElement("td");
  name.textContent = stop.name;
  time.textContent = stop.time ?? "Koniec trasy";
  const url = mapUrl(stop.coordinates);
  if (url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Otwórz";
    map.append(link);
  } else {
    map.textContent = "—";
  }
  row.append(name, time, map);
  return row;
}

if ("serviceWorker" in navigator) {
  let reloadingForUpdate = false;

  window.addEventListener("load", async () => {
    const registration = await navigator.serviceWorker.register("./sw.js");
    const showUpdateNotice = () => {
      if (registration.waiting) updateNotice.hidden = false;
    };

    showUpdateNotice();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdateNotice();
      });
    });

    updateAppButton.addEventListener("click", () => {
      registration.waiting?.postMessage({ type: "SKIP_WAITING" });
    });
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!reloadingForUpdate) {
        reloadingForUpdate = true;
        window.location.reload();
      }
    });

    window.addEventListener("focus", () => registration.update());
    window.setInterval(() => registration.update(), 15 * 60 * 1000);
  });
}
