import assert from "node:assert/strict";
import test from "node:test";

import { directionsUrl, getRoute, getSchedule, mapUrl } from "./schedule.js";

const routes = [{
  name: "Testowa",
  times: ["06:00"],
  stops: [
    { name: "Pierwszy", coordinates: "51.1, 15.1", times: { "06:00": "06:00" } },
    { name: "Drugi", coordinates: "51.2, 15.2", times: { "06:00": null } },
  ],
}];

test("odczytuje wybraną trasę i harmonogram", () => {
  const route = getRoute(routes, "Testowa");
  assert.equal(route?.name, "Testowa");
  assert.deepEqual(getSchedule(route, "06:00"), [
    { name: "Pierwszy", coordinates: "51.1, 15.1", time: "06:00" },
    { name: "Drugi", coordinates: "51.2, 15.2", time: null },
  ]);
});

test("buduje odnośnik pojedynczego przystanku", () => {
  assert.equal(mapUrl("51.1, 15.1"), "https://www.google.com/maps/search/?api=1&query=51.1%2C%2015.1");
});

test("buduje nawigację przez pozostałe przystanki", () => {
  assert.equal(
    directionsUrl(routes[0].stops),
    "https://www.google.com/maps/dir/?api=1&destination=51.2%2C%2015.2&waypoints=51.1%2C%2015.1&travelmode=driving",
  );
});
