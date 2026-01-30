import { useMapEvents } from 'react-leaflet';
import { socket } from '../../utils/api';

const MapHandler = ({ setZoomLevel, setTempLocation, setIsModalOpen, userLocation, showNotification, radiusLimit }) => {
  const map = useMapEvents({
    zoomend: () => setZoomLevel(map.getZoom()),
    moveend: () => {
      const center = map.getCenter();
      socket.emit('update_location', { lat: center.lat, lng: center.lng });
    },
    click(e) {
      if (!userLocation) {
        showNotification("📡", "Searching for Signal...", "We are still calibrating your location.");
        return;
      }
      const distance = e.latlng.distanceTo(userLocation);
      if (distance > radiusLimit) {
        const distKm = (distance / 1000).toFixed(1);
        showNotification("🔭", "Out of Reach", `That soul is waiting ${distKm}km away.`);
        return;
      }
      setTempLocation(e.latlng);
      setIsModalOpen(true);
    }
  });
  return null;
};

export default MapHandler;