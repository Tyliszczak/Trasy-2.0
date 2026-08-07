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
