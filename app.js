import { ROUTES } from "./routes.js";
import { directionsUrl, getRoute, getSchedule, mapUrl } from "./schedule.js";

const routeSelect = document.querySelector("#routeSelect");
const timeSelect = document.querySelector("#timeSelect");
const showButton = document.querySelector("#showSchedule");
const message = document.querySelector("#formMessage");
const schedule = document.querySelector("#schedule");
const scheduleTitle = document.querySelector("#scheduleTitle");
const scheduleTime = document.querySelector("#scheduleTime");
const scheduleBody = document.querySelector("#scheduleBody");
const updateNotice = document.querySelector("#updateNotice");
const updateAppButton = document.querySelector("#updateAppButton");
const currentClock = document.querySelector("#currentClock");
const wakeLockButton = document.querySelector("#wakeLockButton");
const wakeLockStatus = document.querySelector("#wakeLockStatus");

let wakeLock = null;

for (const route of ROUTES) {
  routeSelect.add(new Option(route.name, route.name));
}

routeSelect.addEventListener("change", () => {
  const route = getRoute(ROUTES, routeSelect.value);
  timeSelect.replaceChildren(new Option("WYBIERZ GODZINĘ...", ""));
  timeSelect.disabled = !route;
  route?.times.forEach((time) => timeSelect.add(new Option(time, time)));
  schedule.hidden = true;
  document.body.classList.remove("scheduleOpen");
  message.textContent = "";
});

showButton.addEventListener("click", () => {
  const route = getRoute(ROUTES, routeSelect.value);
  const time = timeSelect.value;
  if (!route || !time) {
    message.textContent = "Wybierz trasę i godzinę zmiany.";
    return;
  }
  const stops = getSchedule(route, time);
  scheduleTitle.textContent = route.name;
  scheduleTime.textContent = `GODZ: ${time}`;
  scheduleBody.replaceChildren(...stops.map((stop, index) => createStopRow(stop, stops, index)));
  highlightActiveStop(stops);
  schedule.hidden = false;
  document.body.classList.add("scheduleOpen");
  message.textContent = "";
  window.scrollTo({ top: 0, behavior: "instant" });
});

document.querySelector("#clearSchedule").addEventListener("click", () => {
  schedule.hidden = true;
  document.body.classList.remove("scheduleOpen");
  routeSelect.focus();
});

function createStopRow(stop, stops, index) {
  const row = document.createElement("tr");
  const name = document.createElement("td");
  const time = document.createElement("td");
  const map = document.createElement("td");
  name.textContent = stop.name;
  time.textContent = stop.time ?? "Koniec trasy";
  const url = mapUrl(stop.coordinates);
  if (url) {
    const actions = document.createElement("span");
    actions.className = "mapActions";
    actions.append(
      createMapLink(url, "⌖", `Otwórz przystanek ${stop.name} w Mapach Google`),
      createMapLink(directionsUrl(stops, index), "↗", `Nawiguj przez pozostałe przystanki od ${stop.name}`, "route"),
    );
    map.append(actions);
  } else {
    map.className = "emptyMap";
    map.textContent = "—";
  }
  row.append(name, time, map);
  return row;
}

function createMapLink(url, text, label, className = "") {
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener";
  link.className = `mapLink ${className}`.trim();
  link.textContent = text;
  link.setAttribute("aria-label", label);
  return link;
}

function highlightActiveStop(stops) {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  let activeIndex = stops.findIndex((stop) => stop.time && stop.time >= currentTime);
  if (activeIndex < 0 && stops.length) activeIndex = stops.length - 1;
  scheduleBody.children[activeIndex]?.classList.add("isActive");
}

function updateClock() {
  currentClock.textContent = new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
}

updateClock();
window.setInterval(updateClock, 1000);

wakeLockButton.addEventListener("click", async () => {
  if (!("wakeLock" in navigator)) {
    wakeLockStatus.textContent = "N/D";
    return;
  }

  if (wakeLock) {
    await wakeLock.release();
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");
    setWakeLockState(true);
    wakeLock.addEventListener("release", () => {
      wakeLock = null;
      setWakeLockState(false);
    });
  } catch {
    setWakeLockState(false);
  }
});

function setWakeLockState(active) {
  wakeLockButton.setAttribute("aria-pressed", String(active));
  wakeLockButton.setAttribute("aria-label", active ? "Wyłącz utrzymywanie ekranu" : "Włącz utrzymywanie ekranu");
  wakeLockStatus.textContent = active ? "ON" : "OFF";
}

if ("serviceWorker" in navigator) {
  let reloadingForUpdate = false;

  window.addEventListener("load", async () => {
    let registration;
    try {
      registration = await navigator.serviceWorker.register("./sw.js");
    } catch {
      return;
    }
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
