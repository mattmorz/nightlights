import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl, Circle } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './App.css';

// If the app finds a compiled environment variable, use it. Otherwise, localhost.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/thoughts';
const MAX_CHARS = 500;
const RADIUS_LIMIT_METERS = 5000; // 5km Limit

// --- ICON GENERATOR ---
const getSizedIcon = (type, zoomLevel) => {
  let pinSize = Math.min(Math.max(10, zoomLevel * 3), 60);
  let glowDiameter = 0;
  if (zoomLevel > 12) {
    glowDiameter = Math.min((zoomLevel - 12) * 30, 250);
  }

  let cssClass = 'beacon-core ';
  if (type === 'positive') cssClass += 'beacon-positive';
  else if (type === 'healed') cssClass += 'beacon-healed';
  else cssClass += 'beacon-distressed';

  return new L.DivIcon({
    className: 'leaflet-div-icon',
    html: `<div class="${cssClass}" style="width: ${pinSize}px; height: ${pinSize}px; --glow-diameter: ${glowDiameter}px;"></div>`,
    iconSize: [pinSize, pinSize],
    iconAnchor: [pinSize / 2, pinSize / 2]
  });
};

// --- MAP HANDLER (UPDATED with Custom Notifications) ---
function MapHandler({ setZoomLevel, setTempLocation, setIsModalOpen, userLocation, showNotification }) {
  const map = useMapEvents({
    zoomend: () => setZoomLevel(map.getZoom()),
    click(e) {
      // 1. Check if we have user location
      if (!userLocation) {
        showNotification(
          "📡", 
          "Searching for Signal...", 
          "We are still calibrating your location. Please allow GPS access to connect to the network."
        );
        return;
      }

      // 2. Calculate Distance
      const distance = e.latlng.distanceTo(userLocation);

      if (distance > RADIUS_LIMIT_METERS) {
        const distKm = (distance / 1000).toFixed(1);
        showNotification(
          "🔭", // Icon
          "Beyond the Horizon", // Title
          `Your light cannot travel that far. You can only illuminate the ground within 5km of you.\n(Target is ${distKm}km away)` // Message
        );
        return;
      }

      setTempLocation(e.latlng);
      setIsModalOpen(true);
    },
  });
  return null;
}

// --- MAIN COMPONENT ---
function App() {
  const [pins, setPins] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(true);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  
  // NEW: Notification State for custom alerts
  const [notification, setNotification] = useState(null); 

  const [tempLocation, setTempLocation] = useState(null);
  const [thoughtText, setThoughtText] = useState("");
  const [honeypot, setHoneypot] = useState(""); 
  
  const [zoomLevel, setZoomLevel] = useState(6);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const stats = {
    total: pins.length,
    heavy: pins.filter(p => p.sentiment === 'distressed' && !p.isHealed).length,
    healed: pins.filter(p => p.isHealed).length,
    beacons: pins.filter(p => p.sentiment === 'positive').length,
  };

  // Helper to trigger custom alerts
  const showNotification = (icon, title, message) => {
    setNotification({ icon, title, message });
  };

  // 1. Get Real User Location
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
      },
      (error) => console.error("Error getting location:", error)
    );
  }, []);

  // 2. Fetch Pins
  const refreshPins = async () => {
    try {
      const res = await axios.get(API_URL);
      const formattedPins = res.data.map(t => ({
        id: t._id,
        position: { lat: t.location.coordinates[1], lng: t.location.coordinates[0] },
        text: t.text,
        sentiment: t.sentiment,
        isHealed: t.isHealed,
        lightCount: t.lightCount || 0
      }));
      setPins(formattedPins);
    } catch (error) { console.error("Connection error:", error); }
  };

  useEffect(() => {
    refreshPins();
    const interval = setInterval(refreshPins, 5000);
    return () => clearInterval(interval);
  }, []);

  // 3. Handle Submit
  const handleSubmit = async () => {
    if (!thoughtText.trim()) return;
    if (thoughtText.length > MAX_CHARS) {
      showNotification("📝", "Message Overflow", "Your thought is too heavy (max 500 chars). Please condense it.");
      return;
    }

    setIsAnalyzing(true);

    try {
      const response = await axios.post(API_URL, {
        text: thoughtText,
        lat: tempLocation.lat,
        lng: tempLocation.lng,
        trap: honeypot
      });

      const { sentiment, message } = response.data;

      // Close input modal immediately
      setIsModalOpen(false);
      setThoughtText("");
      setHoneypot("");
      setTempLocation(null);

      // Show the Server Response using our new Notification System
      if (sentiment === 'distressed') {
         showNotification("🌙", "Signal Received", message);
      } else {
         showNotification("✨", "Beacon Lit", message);
      }
      
      refreshPins();
    } catch (error) {
      let errorMsg = "Transmission failed. Is the server running?";
      if (error.response && error.response.data && error.response.data.error) {
        errorMsg = error.response.data.error;
      }
      showNotification("⚠️", "Connection Lost", errorMsg);
    }
    setIsAnalyzing(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setThoughtText("");
    setHoneypot("");
    setTempLocation(null);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Night Lights 🌑</h1>
        <p>A collaborative map of hope.</p>
      </header>

      <MapContainer 
        center={userLocation || [12.8797, 121.7740]} 
        zoom={userLocation ? 13 : 6} 
        minZoom={5} 
        scrollWheelZoom={true} 
        className="map-view"
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        
        {/* Pass showNotification to handler */}
        <MapHandler 
          setZoomLevel={setZoomLevel} 
          setTempLocation={setTempLocation} 
          setIsModalOpen={setIsModalOpen}
          userLocation={userLocation}
          showNotification={showNotification} 
        />

        {userLocation && (
          <Circle 
            center={userLocation} 
            radius={RADIUS_LIMIT_METERS} 
            pathOptions={{ color: '#a855f7', fillOpacity: 0.08, dashArray: '10, 10', weight: 1 }} 
          />
        )}

        {pins.map((pin) => {
          let type = pin.sentiment === 'positive' ? 'positive' : (pin.isHealed ? 'healed' : 'distressed');
          let statusText = type === 'positive' ? "✨ Light" : (type === 'healed' ? "❤️‍🩹 Healed" : "Heavy Heart");
          let progressDisplay = null;

          if (type === 'distressed') {
            const count = pin.lightCount || 0;
            const candles = "🕯️".repeat(count);
            const empty = "⚫".repeat(5 - count);
            progressDisplay = (
              <div className="healing-progress">
                <small>Healing Progress:</small>
                <div className="candle-bar">{candles}{empty}</div>
                <small>({count}/5 lights nearby)</small>
              </div>
            );
          }
          return (
            <Marker key={pin.id} position={pin.position} icon={getSizedIcon(type, zoomLevel)}>
              <Popup className="custom-popup">
                <div className="popup-inner">
                  <strong>{statusText}</strong>
                  <p>"{pin.text}"</p>
                  {progressDisplay}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      <button className="map-overlay-btn info-btn" onClick={() => setIsAboutOpen(true)} title="About">?</button>
      <button className="map-overlay-btn stats-btn" onClick={() => setIsStatsOpen(true)} title="Statistics">📊</button>

      {/* STATS MODAL */}
      {isStatsOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Community Pulse 📊</h3>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-value text-blue">{stats.heavy}</div><div className="stat-label">Heavy Hearts</div></div>
              <div className="stat-card"><div className="stat-value text-yellow">{stats.beacons}</div><div className="stat-label">Beacons Lit</div></div>
              <div className="stat-card full-width"><div className="stat-value text-cyan">{stats.healed}</div><div className="stat-label">Souls Healed</div></div>
            </div>
            <button onClick={() => setIsStatsOpen(false)} className="btn-submit">Close</button>
          </div>
        </div>
      )}

      {/* ABOUT MODAL */}
     {/* ABOUT MODAL - IMPROVED */}
      {isAboutOpen && (
        <div className="modal-overlay">
          <div className="modal-content about-content">
            <h3 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Night Lights 🌑</h3>
            <p style={{ color: '#a855f7', fontStyle: 'italic', marginBottom: '20px' }}>
              "We are all just walking each other home."
            </p>

            <div className="about-grid">
              
              {/* Feature 1: The Core Loop */}
              <div className="about-row">
                <div className="about-icon-container">📡</div>
                <div className="about-text">
                  <strong>The Signal</strong>
                  <p>Drop a <strong>Heavy Heart</strong> (🌑) if you are lost, or place a <strong>Beacon</strong> (✨) to leave hope for others.</p>
                </div>
              </div>

              {/* Feature 2: Location Rule */}
              <div className="about-row">
                <div className="about-icon-container">📍</div>
                <div className="about-text">
                  <strong>Grounded in Reality</strong>
                  <p>This map is alive. To ensure every light is real, you can only interact with the world within <strong>5km</strong> of where you stand.</p>
                </div>
              </div>

              {/* Feature 3: The Healing Mechanic */}
              <div className="about-row highlight-row">
                <div className="about-icon-container">❤️‍🩹</div>
                <div className="about-text">
                  <strong>Collective Healing</strong>
                  <p>No shadow lasts forever. When <strong>5 Neighbors</strong> surround a sad signal with light, the darkness breaks, and the pin becomes a permanent <strong>Star</strong>.</p>
                </div>
              </div>

            </div>

            <button onClick={() => setIsAboutOpen(false)} className="btn-submit" style={{ width: '100%', marginTop: '15px' }}>
              Enter the Night
            </button>
          </div>
        </div>
      )}

      {/* INPUT MODAL */}
      {isModalOpen && !isAboutOpen && !isStatsOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Send a signal...</h3>
            <textarea 
              placeholder="Type something sad to seek help, or something happy to send light..." 
              value={thoughtText}
              onChange={(e) => setThoughtText(e.target.value)}
              autoFocus
              maxLength={MAX_CHARS}
            />
            
            <input type="text" style={{ display: 'none' }} value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />

            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: thoughtText.length >= 450 ? '#ff4444' : '#8b949e', marginBottom: '10px' }}>
              {thoughtText.length} / {MAX_CHARS}
            </div>
            <div className="modal-actions">
              <button onClick={closeModal} className="btn-cancel">Cancel</button>
              <button onClick={handleSubmit} disabled={isAnalyzing} className="btn-submit">
                {isAnalyzing ? "Transmitting..." : "Light Beacon"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW: UNIFIED NOTIFICATION MODAL (Replaces Alerts & AI Response) */}
      {notification && (
        <div className="modal-overlay">
          <div className="modal-content notification-content">
            <div className="notification-icon">{notification.icon}</div>
            <h3>{notification.title}</h3>
            <p className="notification-message">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="btn-submit">Acknowledged</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;