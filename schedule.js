export function getRoute(routes, routeName) {
  return routes.find((route) => route.name === routeName) ?? null;
}

export function getSchedule(route, time) {
  if (!route || !route.times.includes(time)) return [];
  return route.stops.map((stop) => ({
    name: stop.name,
    time: stop.times[time] ?? null,
    coordinates: stop.coordinates,
  }));
}

export function mapUrl(coordinates) {
  if (!coordinates) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coordinates)}`;
}

export function directionsUrl(stops, startIndex = 0) {
  const coordinates = stops.slice(startIndex).map((stop) => stop.coordinates).filter(Boolean);
  if (!coordinates.length) return null;
  const destination = encodeURIComponent(coordinates.at(-1));
  const waypoints = coordinates.slice(0, -1).map(encodeURIComponent).join("|");
  const waypointQuery = waypoints ? `&waypoints=${waypoints}` : "";
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}${waypointQuery}&travelmode=driving`;
}
