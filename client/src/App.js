import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './App.css';

// If the app finds a compiled environment variable, use it. Otherwise, localhost.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/thoughts';
const MAX_CHARS = 500;

// GEOGRAPHY: PHILIPPINES
const PH_CENTER = [12.8797, 121.7740];
const PH_BOUNDS = [ [4.5, 116.0], [21.5, 127.5] ];

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

// --- MOCK AI ---
const mockAIService = async (text) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const lowerText = text.toLowerCase();
      const sadKeywords = ['sad', 'lonely', 'dark', 'pain', 'fail', 'tired', 'help', 'lost', 'grief'];
      const isSad = sadKeywords.some(word => lowerText.includes(word));
      resolve({
        sentiment: isSad ? 'distressed' : 'positive',
        reply: isSad ? "I hear your pain. It is valid. You have placed a signal in the dark; wait for the light." : null
      });
    }, 1000);
  });
};

// --- MAP HANDLER ---
function MapHandler({ setZoomLevel, setTempLocation, setIsModalOpen }) {
  const map = useMapEvents({
    zoomend: () => setZoomLevel(map.getZoom()),
    click(e) {
      const { lat, lng } = e.latlng;
      const isInsidePH = lat >= 4.5 && lat <= 21.5 && lng >= 116.0 && lng <= 127.5;
      if (!isInsidePH) {
        alert("Signal out of range. Please place your signal within the Philippines.");
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
  
  const [tempLocation, setTempLocation] = useState(null);
  const [thoughtText, setThoughtText] = useState("");
  const [honeypot, setHoneypot] = useState(""); // HONEYPOT STATE
  
  const [zoomLevel, setZoomLevel] = useState(6);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);

  const stats = {
    total: pins.length,
    heavy: pins.filter(p => p.sentiment === 'distressed' && !p.isHealed).length,
    healed: pins.filter(p => p.isHealed).length,
    beacons: pins.filter(p => p.sentiment === 'positive').length,
  };

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

  const handleSubmit = async () => {
    if (!thoughtText.trim()) return;
    if (thoughtText.length > MAX_CHARS) {
      alert("Message too long.");
      return;
    }

    setIsAnalyzing(true);
    const aiResult = await mockAIService(thoughtText);

    try {
      const response = await axios.post(API_URL, {
        text: thoughtText,
        sentiment: aiResult.sentiment,
        lat: tempLocation.lat,
        lng: tempLocation.lng,
        trap: honeypot // Send honeypot value
      });

      if (aiResult.sentiment === 'distressed') {
        if (response.data.bornHealed) {
          setAiResponse("You are in a safe zone. The community light has already caught you.");
        } else {
          setAiResponse(aiResult.reply);
        }
      } else {
        closeModal();
      }
      refreshPins();
    } catch (error) {
      if (error.response) {
         // Display Backend Error (Profanity, Rate Limit, etc)
         alert(`⚠️ Transmission Failed: ${error.response.data.error}`);
      } else {
         alert("Transmission failed. Is the server running?");
      }
    }
    setIsAnalyzing(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setThoughtText("");
    setHoneypot("");
    setAiResponse(null);
    setTempLocation(null);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Night Lights 🌑</h1>
        <p>A collaborative map of hope.</p>
      </header>

      <MapContainer 
        center={PH_CENTER} 
        zoom={6} 
        minZoom={5} 
        maxBounds={PH_BOUNDS} 
        maxBoundsViscosity={1.0} 
        scrollWheelZoom={true} 
        className="map-view"
        zoomControl={false}
      >
        <ZoomControl position="bottomright" />
        <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <MapHandler setZoomLevel={setZoomLevel} setTempLocation={setTempLocation} setIsModalOpen={setIsModalOpen} />

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
            <p className="stat-footer">Total signals: <strong>{stats.total}</strong></p>
            <button onClick={() => setIsStatsOpen(false)} className="btn-submit">Close</button>
          </div>
        </div>
      )}

      {/* ABOUT MODAL */}
      {isAboutOpen && (
        <div className="modal-overlay">
          <div className="modal-content about-content">
            <h3>Welcome to Night Lights 🌑</h3>
            <div className="about-section"><p>A shared canvas where we can signal our pain or offer our light to others.</p></div>
            <div className="about-section">
              <h4>🔒 Privacy & Safety</h4>
              <p style={{fontSize: '0.9rem', color: '#8b949e'}}><strong>Anonymous.</strong> No names, no IP tracking. Locations are <strong>randomized (fuzzed)</strong> by up to 2km to protect your physical location.</p>
            </div>
            <div className="about-section">
              <h4>🤝 How to Heal</h4>
              <p style={{fontSize: '0.9rem', color: '#8b949e'}}>When <strong>5 Beacons</strong> surround a Heavy Heart, the darkness breaks, and the signal transforms into a radiant Star.</p>
            </div>
            <button onClick={() => setIsAboutOpen(false)} className="btn-submit" style={{width: '100%'}}>Enter the Night</button>
          </div>
        </div>
      )}

      {/* INPUT MODAL */}
      {isModalOpen && !aiResponse && !isAboutOpen && !isStatsOpen && (
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
            
            {/* --- HONEYPOT FIELD (Hidden from humans) --- */}
            <input 
              type="text" 
              name="website_url" 
              style={{ display: 'none', visibility: 'hidden' }} 
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              autoComplete="off"
            />

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

      {/* AI RESPONSE */}
      {aiResponse && (
        <div className="modal-overlay">
          <div className="modal-content comfort-mode">
            <h3>Signal Received</h3>
            <p className="ai-message">{aiResponse}</p>
            <button onClick={closeModal} className="btn-cancel">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;