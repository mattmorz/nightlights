import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl, Circle } from 'react-leaflet';
import L from 'leaflet';
import axios from 'axios';
import io from 'socket.io-client'; // --- NEW IMPORT ---
import 'leaflet/dist/leaflet.css';
import './App.css';
import StoryModal from './StoryModal';


// --- CONFIGURATION ---
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/thoughts';
// Socket usually connects to the base URL, not the specific route
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5001'; 

const MAX_CHARS = 500;
const BASE_RADIUS_METERS = 5000;

// --- INITIALIZE SOCKET ---
// We do this outside the component so it doesn't reconnect on every render
const socket = io(SOCKET_URL);

// --- CONSTANTS ---
const LOADING_MESSAGES = [
  "Aligning constellations...",
  "Listening for whispers...",
  "Connecting to the night...",
  "Gathering lost lights...",
  "Entering the sanctuary..."
];

// --- COMPONENT: LOADING SCREEN ---
const LoadingScreen = () => {
  const [textIndex, setTextIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 1200); 
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="loading-screen">
      <div className="loading-icon">🌑</div>
      <div className="loading-text">{LOADING_MESSAGES[textIndex]}</div>
    </div>
  );
};

// --- HELPER: Calculate Distance (Haversine Formula) ---
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// --- ICON GENERATOR ---
const getSizedIcon = (type, zoomLevel, resonanceCount = 0) => {
  let pinSize = Math.min(Math.max(10, zoomLevel * 3), 60);
  let glowDiameter = 0;
  const isPulsing = resonanceCount >= 3;
  const pulseClass = isPulsing ? 'pulse-active' : '';

  if (zoomLevel > 12) glowDiameter = Math.min((zoomLevel - 12) * 30, 250);

  let cssClass = 'beacon-core ';
  if (type === 'positive') cssClass += 'beacon-positive';
  else if (type === 'healed') cssClass += 'beacon-healed';
  else cssClass += 'beacon-distressed';

  return new L.DivIcon({
    className: 'leaflet-div-icon',
    html: `<div class="${cssClass} ${pulseClass}" style="width: ${pinSize}px; height: ${pinSize}px; --glow-diameter: ${glowDiameter}px;"></div>`,
    iconSize: [pinSize, pinSize],
    iconAnchor: [pinSize / 2, pinSize / 2]
  });
};

// --- COMPONENT: REAL-TIME FIREFLY LAYER (SOCKET.IO) ---
const FireflyLayer = () => {
  // We use an object instead of an array for easier updates by ID (O(1) lookup)
  const [fireflies, setFireflies] = useState({}); 

  useEffect(() => {
    // 1. Listen for updates from other users
    socket.on('firefly_update', (data) => {
      setFireflies(prev => ({
        ...prev,
        [data.id]: { 
          lat: data.lat, 
          lng: data.lng, 
          // We assign a random delay only once when they first appear
          animationDelay: prev[data.id]?.animationDelay || Math.random() * 5 
        }
      }));
    });

    // 2. Remove users who disconnect
    socket.on('firefly_remove', (id) => {
      setFireflies(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    });

    // Cleanup listeners when component unmounts
    return () => {
      socket.off('firefly_update');
      socket.off('firefly_remove');
    };
  }, []);

  return (
    <>
      {Object.values(fireflies).map((f, index) => (
        <Marker 
          key={index} // Ideally use data.id, but index is safe here
          position={[f.lat, f.lng]} 
          icon={L.divIcon({
            className: 'leaflet-div-icon',
            // Random animation delay makes them twinkle naturally
            html: `<div class="firefly-icon" style="width: 8px; height: 8px; animation-delay: -${f.animationDelay}s;"></div>`,
            iconSize: [4, 4],
            iconAnchor: [2, 2]
          })}
        />
      ))}
    </>
  );
};

// --- MAP HANDLER (UPDATED TO EMIT LOCATION) ---
function MapHandler({ setZoomLevel, setTempLocation, setIsModalOpen, userLocation, showNotification, radiusLimit }) {
  const map = useMapEvents({
    zoomend: () => setZoomLevel(map.getZoom()),
    
    // --- NEW: Broadcast location when dragging stops ---
    moveend: () => {
      const center = map.getCenter();
      // Emit "where I am looking" to the server
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
        showNotification("🔭", "Beyond the Horizon", `Target is ${distKm}km away. Range limited.`);
        return;
      }
      setTempLocation(e.latlng);
      setIsModalOpen(true);
    }
  });
  return null;
}

// --- MAIN COMPONENT ---
function App() {
  const [pins, setPins] = useState([]);
  const [showStory, setShowStory] = useState(false); // Or true if you want it to open on load
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(true);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [resonatedIds, setResonatedIds] = useState(new Set()); 
  const [notification, setNotification] = useState(null); 
  const [tempLocation, setTempLocation] = useState(null);
  const [thoughtText, setThoughtText] = useState("");
  const [honeypot, setHoneypot] = useState(""); 
  const [zoomLevel, setZoomLevel] = useState(6);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const audioRefs = useRef({
    bgm: new Audio('/sounds/bgm.mp3'),
    positive: new Audio('/sounds/positive.mp3'),
    distressed: new Audio('/sounds/distressed.mp3'),
    healed: new Audio('/sounds/healed.mp3'),
    resonate: new Audio('/sounds/resonate.mp3') 
  });

  useEffect(() => {
    const bgm = audioRefs.current.bgm;
    bgm.loop = true;
    bgm.volume = 0.2;
    return () => { bgm.pause(); };
  }, []);

  const toggleMute = () => {
    setIsMuted(prev => {
      const nextState = !prev;
      if (nextState) audioRefs.current.bgm.pause();
      else audioRefs.current.bgm.play().catch(e => console.log("Interaction needed first"));
      return nextState;
    });
  };

  const playSound = (type) => {
    if (isMuted) return;
    const sound = audioRefs.current[type];
    if (sound) {
      sound.currentTime = 0;
      sound.volume = 0.5;
      sound.play().catch(e => console.error("Audio play error:", e));
    } else if (type === 'resonate') {
        const alt = audioRefs.current.positive;
        if(alt) { alt.currentTime = 0; alt.volume = 0.2; alt.play().catch(() => {}); }
    }
  };

  const handleResonate = async (pinId) => {
    if (resonatedIds.has(pinId)) return; 
    setPins(prevPins => prevPins.map(pin => {
      if (pin.id === pinId) return { ...pin, resonanceCount: (pin.resonanceCount || 0) + 1 };
      return pin;
    }));
    setResonatedIds(prev => new Set(prev).add(pinId));
    playSound('resonate');
    try { await axios.put(`${API_URL}/${pinId}/resonate`); } catch (error) { console.warn("Resonance sync failed."); }
  };

  const { currentRadius, boostPercentage, tierLevel, nearbyLightCount } = useMemo(() => {
    if (!userLocation) return { currentRadius: BASE_RADIUS_METERS, boostPercentage: 0, tierLevel: 0, nearbyLightCount: 0 };
    const count = pins.filter(t => t.sentiment === 'positive' && getDistanceMeters(userLocation.lat, userLocation.lng, t.position.lat, t.position.lng) <= BASE_RADIUS_METERS).length;
    const tier = Math.floor(count / 10);
    const boost = tier * 0.02;
    return { nearbyLightCount: count, tierLevel: tier, boostPercentage: Math.round(boost * 100), currentRadius: BASE_RADIUS_METERS * (1 + boost) };
  }, [userLocation, pins]);

  const stats = {
    total: pins.length,
    heavy: pins.filter(p => p.sentiment === 'distressed' && !p.isHealed).length,
    healed: pins.filter(p => p.isHealed).length,
    beacons: pins.filter(p => p.sentiment === 'positive').length,
  };

  const showNotification = (icon, title, message) => setNotification({ icon, title, message });

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => console.error("Error getting location:", error)
    );
  }, []);

  const refreshPins = async (isFirstLoad = false) => {
    try {
      const res = await axios.get(API_URL);
      const formattedPins = res.data.map(t => ({
        id: t._id,
        position: { lat: t.location.coordinates[1], lng: t.location.coordinates[0] },
        text: t.text,
        sentiment: t.sentiment,
        isHealed: t.isHealed,
        lightCount: t.lightCount || 0,
        resonanceCount: t.resonanceCount || 0 
      }));
      setPins(formattedPins);
      if (isFirstLoad) setTimeout(() => setIsLoading(false), 800);
    } catch (error) { 
      console.error("Connection error:", error);
      if (isFirstLoad) setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshPins(true); 
    const interval = setInterval(() => refreshPins(false), 5000); 
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!thoughtText.trim()) return;
    if (thoughtText.length > MAX_CHARS) return showNotification("📝", "Message Overflow", "Your thought is too heavy.");
    setIsAnalyzing(true);
    try {
      const response = await axios.post(API_URL, { text: thoughtText, lat: tempLocation.lat, lng: tempLocation.lng, trap: honeypot });
      const { sentiment, message, bornHealed } = response.data;
      setIsModalOpen(false); setThoughtText(""); setHoneypot(""); setTempLocation(null);
      if (bornHealed || (message && message.includes("healed"))) { playSound('healed'); showNotification("❤️‍🩹", "The Darkness Breaks", message); }
      else if (sentiment === 'positive') { playSound('positive'); showNotification("✨", "Beacon Lit", message); }
      else { playSound('distressed'); showNotification("🌙", "Signal Received", message); }
      refreshPins();
    } catch (error) { showNotification("⚠️", "Connection Lost", "Transmission failed."); }
    setIsAnalyzing(false);
  };

  const closeModal = () => { setIsModalOpen(false); setThoughtText(""); setHoneypot(""); setTempLocation(null); };
  const handleEnterNight = () => { setIsAboutOpen(false); if (!isMuted) audioRefs.current.bgm.play().catch(e => console.log("Audio waiting...")); };

  return (
    <div className="app-container">
      {isLoading && <LoadingScreen />}
      <header className="app-header"><h1>Night Lights 🌑</h1><p>A collaborative map of hope.</p></header>
      <button onClick={toggleMute} className="mute-btn" style={{ position: 'absolute', top: '20px', right: '20px', zIndex: 1100, background: 'rgba(0,0,0,0.6)', border: '1px solid #444', color: '#fff', borderRadius: '50%', width: '40px', height: '40px', cursor: 'pointer', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isMuted ? "🔇" : "🔊"}</button>

      <MapContainer center={userLocation || [12.8797, 121.7740]} zoom={userLocation ? 13 : 6} minZoom={5} scrollWheelZoom={true} className="map-view" zoomControl={false}>
        <ZoomControl position="bottomright" />
        <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        
        {/* --- REAL TIME FIREFLIES --- */}
        <FireflyLayer />

        <MapHandler setZoomLevel={setZoomLevel} setTempLocation={setTempLocation} setIsModalOpen={setIsModalOpen} userLocation={userLocation} showNotification={showNotification} radiusLimit={currentRadius} />

        {userLocation && <Circle center={userLocation} radius={currentRadius} pathOptions={{ color: tierLevel >= 3 ? '#ffd700' : '#00ffff', fillColor: tierLevel >= 3 ? '#ffd700' : '#00ffff', fillOpacity: 0.08, weight: 1, dashArray: '10, 10' }} />}

        {pins.map((pin) => {
          let type = pin.sentiment === 'positive' ? 'positive' : (pin.isHealed ? 'healed' : 'distressed');
          let statusText = type === 'positive' ? "✨ Light" : (type === 'healed' ? "❤️‍🩹 Healed" : "Heavy Heart");
          let progressDisplay = null;
          if (type === 'distressed') {
            const count = pin.lightCount || 0;
            progressDisplay = <div className="healing-progress"><small>Healing Progress:</small><div className="candle-bar">{"🕯️".repeat(count)}{"⚫".repeat(5 - count)}</div><small>({count}/5 lights nearby)</small></div>;
          }
          return (
            <Marker key={pin.id} position={pin.position} icon={getSizedIcon(type, zoomLevel, pin.resonanceCount)}>
              <Popup className="custom-popup">
                <div className="popup-inner">
                  <strong>{statusText}</strong><p>"{pin.text}"</p>{progressDisplay}
                  <button className={`resonate-btn ${resonatedIds.has(pin.id) ? 'active' : ''}`} onClick={() => handleResonate(pin.id)} disabled={resonatedIds.has(pin.id)}>💓 Resonate {pin.resonanceCount > 0 ? `(${pin.resonanceCount})` : ''}</button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {boostPercentage > 0 && <div className="boost-badge" style={{ position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'rgba(13, 17, 23, 0.9)', border: `1px solid ${tierLevel >= 3 ? '#ffd700' : '#00ffff'}`, padding: '8px 16px', borderRadius: '20px', color: tierLevel >= 3 ? '#ffd700' : '#00ffff', fontWeight: 'bold' }}>⚡ Range Boosted: +{boostPercentage}% ({nearbyLightCount} Lights nearby)</div>}
      <button className="map-overlay-btn info-btn" onClick={() => setIsAboutOpen(true)} title="About">?</button>
      <button className="map-overlay-btn stats-btn" onClick={() => setIsStatsOpen(true)} title="Statistics">📊</button>
      {/* Inside your map-view container */}
      <button 
        className="map-overlay-btn story-btn" 
        onClick={() => setShowStory(true)} 
        title="Read the Story"
      >
        📖
      </button>

      {isStatsOpen && <div className="modal-overlay"><div className="modal-content"><h3>Community Pulse 📊</h3><div className="stats-grid"><div className="stat-card"><div className="stat-value text-blue">{stats.heavy}</div><div className="stat-label">Heavy Hearts</div></div><div className="stat-card"><div className="stat-value text-yellow">{stats.beacons}</div><div className="stat-label">Beacons Lit</div></div><div className="stat-card full-width"><div className="stat-value text-cyan">{stats.healed}</div><div className="stat-label">Souls Healed</div></div></div><button onClick={() => setIsStatsOpen(false)} className="btn-submit">Close</button></div></div>}
      {showStory && <StoryModal onClose={() => setShowStory(false)} />}
      {isAboutOpen && (
        <div className="modal-overlay">
          <div className="modal-content about-content">
            <h3 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Night Lights 🌑</h3>
            <p style={{ color: '#a855f7', fontStyle: 'italic', marginBottom: '15px' }}>"We are all just walking each other home."</p>
            <p className="about-intro">An anonymous sanctuary. Share your hidden burdens or offer hope to those suffering in silence.</p>
            <div className="divider-line"></div>
            <h4 style={{textAlign: 'left', marginLeft: '5px', marginBottom: '10px', color: '#e2e8f0'}}>How to Guide the Light:</h4>
            <div className="about-grid">
              <div className="about-row"><div className="about-icon-container">👀</div><div className="about-text"><strong>1. Read the Signals</strong><p>Gray pins (🌑) are <strong>Heavy Hearts</strong>. Bright pins (✨) are <strong>Beacons</strong>.</p></div></div>
              <div className="about-row"><div className="about-icon-container">💓</div><div className="about-text"><strong>2. Resonate</strong><p>Click the <strong>Resonate</strong> button inside a popup to silently tell someone "I feel this too."</p></div></div>
              <div className="about-row highlight-row"><div className="about-icon-container">❤️‍🩹</div><div className="about-text"><strong>3. Heal the Darkness</strong><p>Place a light near a Heavy Heart. When <strong>5 lights</strong> gather, the shadow breaks.</p></div></div>
              <div className="about-row" style={{ border: '1px solid #00ffff', background: 'rgba(0, 255, 255, 0.05)' }}><div className="about-icon-container">⚡</div><div className="about-text"><strong>4. Amplify the Reach</strong><p>Together we go further. Every <strong>10 lights</strong> expands the signal range by <strong>2%.</strong></p></div></div>
            </div>
            <button onClick={handleEnterNight} className="btn-submit" style={{ width: '100%', marginTop: '10px' }}>Enter the Night {isMuted ? "🔇" : "🔊"}</button>
          </div>
        </div>
      )}

      {isModalOpen && !isAboutOpen && !isStatsOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Send a signal...</h3>
            <textarea placeholder="Release a burden into the night, or ignite a spark to guide others..." value={thoughtText} onChange={(e) => setThoughtText(e.target.value)} autoFocus maxLength={MAX_CHARS} />
            <input type="text" style={{ display: 'none' }} value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
            <div style={{ textAlign: 'right', fontSize: '0.8rem', color: thoughtText.length >= 450 ? '#ff4444' : '#8b949e', marginBottom: '10px' }}>{thoughtText.length} / {MAX_CHARS}</div>
            <div className="modal-actions"><button onClick={closeModal} className="btn-cancel">Cancel</button><button onClick={handleSubmit} disabled={isAnalyzing} className="btn-submit">{isAnalyzing ? "Transmitting..." : "Light Beacon"}</button></div>
          </div>
        </div>
      )}

      {notification && <div className="modal-overlay"><div className="modal-content notification-content"><div className="notification-icon">{notification.icon}</div><h3>{notification.title}</h3><p className="notification-message">{notification.message}</p><button onClick={() => setNotification(null)} className="btn-submit">Acknowledged</button></div></div>}
    </div>
  );
}

export default App;