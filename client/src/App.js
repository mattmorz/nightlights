import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl, Circle } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import 'leaflet/dist/leaflet.css';
import './App.css';

// If the app finds a compiled environment variable, use it. Otherwise, localhost.
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/thoughts';
const MAX_CHARS = 500;
const BASE_RADIUS_METERS = 5000; // Standard 5km Limit

// --- HELPER: Calculate Distance (Haversine Formula) ---
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

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

// --- MAP HANDLER (Dynamic Radius Support) ---
function MapHandler({ setZoomLevel, setTempLocation, setIsModalOpen, userLocation, showNotification, radiusLimit }) {
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

      if (distance > radiusLimit) {
        const distKm = (distance / 1000).toFixed(1);
        const limitKm = (radiusLimit / 1000).toFixed(2);
        showNotification(
          "🔭", // Icon
          "Beyond the Horizon", // Title
          `Your light cannot travel that far.\nCurrent Limit: ${limitKm}km\n(Target is ${distKm}km away)` 
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
  
  const [notification, setNotification] = useState(null); 
  const [tempLocation, setTempLocation] = useState(null);
  const [thoughtText, setThoughtText] = useState("");
  const [honeypot, setHoneypot] = useState(""); 
  
  const [zoomLevel, setZoomLevel] = useState(6);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  // --- DYNAMIC RADIUS CALCULATION (NEW LOGIC) ---
  const { currentRadius, boostPercentage, tierLevel, nearbyLightCount } = useMemo(() => {
    if (!userLocation) return { currentRadius: BASE_RADIUS_METERS, boostPercentage: 0, tierLevel: 0, nearbyLightCount: 0 };

    // 1. Count lights within base radius
    const count = pins.filter(t => 
      t.sentiment === 'positive' && 
      getDistanceMeters(userLocation.lat, userLocation.lng, t.position.lat, t.position.lng) <= BASE_RADIUS_METERS
    ).length;

    // 2. Calculate Tier (Every 10 lights = 2% boost)
    const tier = Math.floor(count / 10);
    const boost = tier * 0.02;

    return {
      nearbyLightCount: count,
      tierLevel: tier,
      boostPercentage: Math.round(boost * 100),
      currentRadius: BASE_RADIUS_METERS * (1 + boost)
    };
  }, [userLocation, pins]);

  const stats = {
    total: pins.length,
    heavy: pins.filter(p => p.sentiment === 'distressed' && !p.isHealed).length,
    healed: pins.filter(p => p.isHealed).length,
    beacons: pins.filter(p => p.sentiment === 'positive').length,
  };

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

      // Show the Server Response
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
        
        {/* Pass DYNAMIC radiusLimit to handler */}
        <MapHandler 
          setZoomLevel={setZoomLevel} 
          setTempLocation={setTempLocation} 
          setIsModalOpen={setIsModalOpen}
          userLocation={userLocation}
          showNotification={showNotification}
          radiusLimit={currentRadius} 
        />

        {userLocation && (
          <Circle 
            center={userLocation} 
            radius={currentRadius} 
            pathOptions={{ 
              // DYNAMIC COLOR: Purple (Tier 0) -> Cyan (Tier 1+) -> Gold (Tier 3+)
              color: tierLevel >= 3 ? '#ffd700' : (tierLevel >= 1 ? '#00ffff' : '#a855f7'), 
              fillColor: tierLevel >= 3 ? '#ffd700' : (tierLevel >= 1 ? '#00ffff' : '#a855f7'), 
              fillOpacity: 0.08, 
              weight: tierLevel > 0 ? 2 : 1, 
              dashArray: tierLevel > 0 ? '5, 10' : '10, 10' 
            }} 
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

      {/* RANGE BOOST BADGE */}
      {boostPercentage > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(13, 17, 23, 0.9)',
            border: `1px solid ${tierLevel >= 3 ? '#ffd700' : '#00ffff'}`,
            padding: '8px 16px',
            borderRadius: '20px',
            color: tierLevel >= 3 ? '#ffd700' : '#00ffff',
            fontSize: '0.9rem',
            fontWeight: 'bold',
            boxShadow: `0 0 15px ${tierLevel >= 3 ? 'rgba(255, 215, 0, 0.3)' : 'rgba(0, 255, 255, 0.3)'}`
          }}>
             ⚡ Range Boosted: +{boostPercentage}% ({nearbyLightCount} Lights nearby)
          </div>
      )}

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

      {/* ABOUT MODAL - INTRO & STEPS */}
      {/* ABOUT MODAL - ENGAGEMENT FOCUSED */}
      {isAboutOpen && (
        <div className="modal-overlay">
          <div className="modal-content about-content">
            <h3 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Night Lights 🌑</h3>
            <p style={{ color: '#a855f7', fontStyle: 'italic', marginBottom: '15px' }}>
              "We are all just walking each other home."
            </p>

            <p className="about-intro">
              An anonymous sanctuary. Share your hidden burdens or offer hope to those suffering in silence.
            </p>

            <div className="divider-line"></div>

            <h4 style={{textAlign: 'left', marginLeft: '5px', marginBottom: '10px', color: '#e2e8f0'}}>
              How to Guide the Light:
            </h4>

            <div className="about-grid">
              
              {/* 1. BASICS */}
              <div className="about-row">
                <div className="about-icon-container">👀</div>
                <div className="about-text">
                  <strong>1. Read the Signals</strong>
                  <p>
                    Gray pins (🌑) are <strong>Heavy Hearts</strong>. 
                    Bright pins (✨) are <strong>Beacons</strong>. 
                    Click them to read the thoughts of your neighbors.
                  </p>
                </div>
              </div>

              {/* 2. CORE ACTION */}
              <div className="about-row">
                <div className="about-icon-container">📍</div>
                <div className="about-text">
                  <strong>2. Place Your Light</strong>
                  <p>
                    Click anywhere within your radius to post. 
                    Share a worry to unburden yourself, or leave a message of hope.
                  </p>
                </div>
              </div>

              {/* 3. HEALING MECHANIC (The Goal) */}
              <div className="about-row highlight-row">
                <div className="about-icon-container">❤️‍🩹</div>
                <div className="about-text">
                  <strong>3. Heal the Darkness</strong>
                  <p>
                    If you see a Heavy Heart, place a light nearby. 
                    When <strong>5 lights</strong> gather, the shadow breaks and becomes a permanent Star.
                  </p>
                </div>
              </div>

              {/* 4. RANGE BOOST (The Community Feature) */}
              <div className="about-row" style={{ border: '1px solid #00ffff', background: 'rgba(0, 255, 255, 0.05)' }}>
                <div className="about-icon-container">⚡</div>
                <div className="about-text">
                  <strong>4. Amplify the Reach</strong>
                  <p>
                    Together we go further. For every <strong>10 lights</strong> in an area, 
                    the signal range expands by <strong>2%</strong> for everyone nearby.
                  </p>
                </div>
              </div>

            </div>

            <button onClick={() => setIsAboutOpen(false)} className="btn-submit" style={{ width: '100%', marginTop: '10px' }}>
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

      {/* UNIFIED NOTIFICATION MODAL */}
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