import { ROUTES } from "./routes.js";
import { getRoute, getSchedule, mapUrl } from "./schedule.js";

const routeSelect = document.querySelector("#routeSelect");
const timeSelect = document.querySelector("#timeSelect");
const showButton = document.querySelector("#showSchedule");
const message = document.querySelector("#formMessage");
const schedule = document.querySelector("#schedule");
const scheduleTitle = document.querySelector("#scheduleTitle");
const scheduleBody = document.querySelector("#scheduleBody");
const updateNotice = document.querySelector("#updateNotice");
const updateAppButton = document.querySelector("#updateAppButton");

for (const route of ROUTES) {
  routeSelect.add(new Option(route.name, route.name));
}

routeSelect.addEventListener("change", () => {
  const route = getRoute(ROUTES, routeSelect.value);
  timeSelect.replaceChildren(new Option(route ? "Wybierz godzinę" : "Najpierw wybierz trasę", ""));
  timeSelect.disabled = !route;
  route?.times.forEach((time) => timeSelect.add(new Option(time, time)));
  schedule.hidden = true;
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
  scheduleTitle.textContent = `${route.name} · ${time}`;
  scheduleBody.replaceChildren(...stops.map((stop) => createStopRow(stop)));
  schedule.hidden = false;
  message.textContent = "";
  schedule.scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#clearSchedule").addEventListener("click", () => routeSelect.focus());

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
