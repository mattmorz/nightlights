import L from 'leaflet';

export const getDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export const formatPin = (t) => {
  let lat, lng;
  if (t.location && Array.isArray(t.location.coordinates)) {
    lng = t.location.coordinates[0];
    lat = t.location.coordinates[1];
  } else if (t.position) {
    lat = t.position.lat;
    lng = t.position.lng;
  } else if (typeof t.lat === 'number') {
    lat = t.lat; lng = t.lng;
  } else { return null; }

  if (isNaN(lat) || isNaN(lng)) return null;

  return {
    id: t._id || t.id || Math.random(),
    position: { lat, lng },
    text: t.text || "...",
    sentiment: t.sentiment || 'neutral',
    isHealed: !!t.isHealed,
    lightCount: t.lightCount || 0,
    resonanceCount: t.resonanceCount || 0
  };
};

export const getSizedIcon = (type, zoomLevel, resonanceCount = 0) => {
  let pinSize = Math.min(Math.max(10, zoomLevel * 3), 60);
  let glowDiameter = zoomLevel > 12 ? Math.min((zoomLevel - 12) * 30, 250) : 0;
  const isPulsing = resonanceCount >= 3;
  
  let cssClass = 'beacon-core ';
  if (type === 'positive') cssClass += 'beacon-positive';
  else if (type === 'healed') cssClass += 'beacon-healed';
  else cssClass += 'beacon-distressed';

  return new L.DivIcon({
    className: 'leaflet-div-icon',
    html: `<div class="${cssClass} ${isPulsing ? 'pulse-active' : ''}" style="width: ${pinSize}px; height: ${pinSize}px; --glow-diameter: ${glowDiameter}px;"></div>`,
    iconSize: [pinSize, pinSize],
    iconAnchor: [pinSize / 2, pinSize / 2]
  });
};