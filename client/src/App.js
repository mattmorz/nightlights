import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, ZoomControl, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';
// Utilities
import { socket, api } from './utils/api';
import { getDistanceMeters, formatPin } from './utils/helpers';
// Components
import LoadingScreen from './components/LoadingScreen';
import Header from './components/Header';
import GlobalPulse from './components/GlobalPulse';
import SkyCast from './components/SkyCast';
import FloatingMenu from './components/FloatingMenu';
// Modals
import AboutModal from './components/modals/AboutModal';
import StatsModal from './components/modals/StatsModal'; 
import ThoughtModal from './components/modals/ThoughtModal';
import StoryModal from './components/modals/StoryModal';
import Notification from './components/modals/Notification';
// Map Components
import FireflyLayer from './components/map/FireflyLayer';
import MapHandler from './components/map/MapHandler';
import MapMarkers from './components/map/MapMarkers';

const BASE_RADIUS_METERS = 5000;
const MAX_CHARS = 500;

function App() {
  const [pins, setPins] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(6);
  
  const [showAbout, setShowAbout] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [showStory, setShowStory] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); 

  const [notification, setNotification] = useState(null);
  const [showInput, setShowInput] = useState(false);

  const [tempLocation, setTempLocation] = useState(null);
  const [thoughtText, setThoughtText] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);


  const [isMuted, setIsMuted] = useState(false);
  const [resonatedIds, setResonatedIds] = useState(new Set());
  
  const audioRefs = useRef({
    bgm: new Audio('/sounds/bgm.mp3'),
    positive: new Audio('/sounds/positive.mp3'),
    distressed: new Audio('/sounds/distressed.mp3'),
    healed: new Audio('/sounds/healed.mp3'),
    resonate: new Audio('/sounds/resonate.mp3')
  });

  // --- AUDIO LOGIC ---
  useEffect(() => {
    const bgm = audioRefs.current.bgm;
    bgm.loop = true; 
    bgm.volume = 0.2;
    // Auto-play might be blocked by browser, usually requires interaction
    return () => bgm.pause();
  }, []);

  // FIX 3: Unified Audio Handler (Deleted 'toggleSound')
  const toggleMute = () => {
    setIsMuted(prev => {
      const next = !prev;
      if (next) audioRefs.current.bgm.pause();
      else audioRefs.current.bgm.play().catch(() => {});
      return next;
    });
  };

  const playSound = (type) => {
    if (isMuted) return;
    const sound = audioRefs.current[type];
    if (sound) { sound.currentTime = 0; sound.volume = 0.5; sound.play().catch(() => {}); }
  };

  // --- DATA LOADING ---
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error(err)
    );

    const fetchData = async () => {
      try {
        const res = await api.get('/');
        setPins(res.data.map(formatPin));
        setTimeout(() => setIsLoading(false), 800);
      } catch (e) { setIsLoading(false); }
    };
    fetchData();

    socket.on('thought_created', (newT) => {
      const p = formatPin(newT);
      if (p) setPins(prev => [p, ...prev]);
    });

    socket.on('thought_updated', (updatedT) => {
      setPins(prev => prev.map(p => p.id === (updatedT._id || updatedT.id) ? formatPin(updatedT) : p));
    });

    return () => { socket.off('thought_created'); socket.off('thought_updated'); };
  }, []);

  // --- CALCULATIONS ---
  const { currentRadius, tierLevel } = useMemo(() => {
    if (!userLocation) return { currentRadius: BASE_RADIUS_METERS, tierLevel: 0 };
    
    // Logic: Count positive lights nearby to boost radius visually for the user
    const count = pins.filter(t => t.sentiment === 'positive' && getDistanceMeters(userLocation.lat, userLocation.lng, t.position.lat, t.position.lng) <= BASE_RADIUS_METERS).length;
    const tier = Math.floor(count / 10);
    const boost = tier * 0.10;
    
    return { 
      tierLevel: tier, 
      currentRadius: BASE_RADIUS_METERS * (1 + boost) 
    };
  }, [userLocation, pins]);

  // --- HANDLERS ---
  const handleResonate = async (pinId) => {
    if (resonatedIds.has(pinId)) return;
    setResonatedIds(prev => new Set(prev).add(pinId));
    playSound('resonate');
    
    setPins(prev => prev.map(p => p.id === pinId ? { ...p, resonanceCount: (p.resonanceCount || 0) + 1 } : p));
    
    try { await api.put(`/${pinId}/resonate`); } catch (e) { console.warn("Resonance sync failed"); }
  };

const handleSubmitThought = async () => {
    if (!thoughtText.trim()) return;
    setIsAnalyzing(true);
    
    try {
      // 1. Send data to server
      const res = await api.post('/', { 
        text: thoughtText, 
        lat: tempLocation.lat, 
        lng: tempLocation.lng, 
        trap: honeypot 
      });

      // 2. Destructure response
      // NOTE: Ensure your backend returns the new '_id' in the response!
      const { sentiment, message, bornHealed, _id } = res.data;
      
      // 3. --- FIX START: Update the map immediately ---
      const newPin = {
        id: _id || Date.now(), // Use backend ID, or a temporary timestamp if missing
        position: { lat: tempLocation.lat, lng: tempLocation.lng },
        text: thoughtText,
        sentiment: sentiment, // Uses the analyzed sentiment from server
        isHealed: bornHealed,
        lightCount: 0,
        resonanceCount: 0
      };

      setPins(prevPins => [...prevPins, newPin]); 
      // 3. --- FIX END ---

      // 4. Reset UI
      setIsModalOpen(false); 
      setThoughtText(""); 
      setHoneypot(""); 
      setTempLocation(null);
      
      // 5. Play sounds and notify
      if (bornHealed || (message && message.includes("healed"))) { 
        playSound('healed'); 
        setNotification({icon:"❤️‍🩹", title:"The Darkness Breaks", message}); 
      }
      else if (sentiment === 'positive') { 
        playSound('positive'); 
        setNotification({icon:"✨", title:"Beacon Lit", message}); 
      }
      else { 
        playSound('distressed'); 
        setNotification({icon:"🌙", title:"Signal Received", message}); 
      }

    } catch (e) { 
      console.error(e);
      setNotification({icon:"⚠️", title:"Connection Lost", message:"Transmission failed."}); 
    }
    
    setIsAnalyzing(false);
  };

  // --- HANDLE PENCIL BUTTON CLICK ---
  const handleOpenInput = () => {
    // 1. Check if we actually have the user's GPS location yet
    if (!userLocation) {
      setNotification({icon:"📡", title:"Locating...", message:"We are still aligning your coordinates. Please wait."});
      return;
    }

// --- PRIVACY FUZZING ALGORITHM ---
    // 1 degree of latitude is roughly 111km
    // 1km is roughly 0.009 degrees
    const R = 0.009; // Max radius in degrees (approx 1km)
    
    // Generate random angle (0 to 2PI)
    const angle = Math.random() * 2 * Math.PI;
    
    // Generate random distance (square root ensures uniform distribution, avoiding center clumping)
    const distance = Math.sqrt(Math.random()) * R; 

    // Calculate offsets
    const latOffset = distance * Math.cos(angle);
    // Longitude shrinks as you move north, so we adjust by cos(lat)
    const lngOffset = (distance * Math.sin(angle)) / Math.cos(userLocation.lat * (Math.PI / 180));

    const fuzzedLocation = {
      lat: userLocation.lat + latOffset,
      lng: userLocation.lng + lngOffset
    };
    // ---------------------------------

    // 2. Set this "Ghost Location" as the target
    setTempLocation(fuzzedLocation);
    setIsModalOpen(true);
  };

  return (
    <div className="app-container">
      {isLoading && <LoadingScreen />}
      
      {/* Header uses unified toggleMute */}
      <Header isMuted={isMuted} toggleMute={toggleMute} />
      
      <GlobalPulse socket={socket} />
      


      <MapContainer center={userLocation || [12.8797, 121.7740]} zoom={userLocation ? 13 : 6} minZoom={5} scrollWheelZoom={true} className="map-view" zoomControl={false}>
        <ZoomControl position="topright" />
        <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <FireflyLayer />
        
        {showInput && (
          <SkyCast 
             onClose={() => setShowInput(false)}
             onPostMessage={(data) => {
                socket.emit('add_thought', { ...data, timestamp: new Date() });
                // Note: SkyCast calls onClose() internally after animation
             }} 
          />
       )}

        <MapHandler 
          setZoomLevel={setZoomLevel} 
          setTempLocation={setTempLocation} 
          setIsModalOpen={setIsModalOpen} 
          userLocation={userLocation} 
          showNotification={(i,t,m) => setNotification({icon:i, title:t, message:m})} 
          radiusLimit={currentRadius} 
        />

        {userLocation && (
          <Circle 
            center={userLocation} 
            radius={currentRadius} 
            pathOptions={{ color: tierLevel >= 3 ? '#ffd700' : '#00ffff', fillColor: tierLevel >= 3 ? '#ffd700' : '#00ffff', fillOpacity: 0.08, weight: 1, dashArray: '10, 10' }} 
          />
        )}

        <MapMarkers 
          pins={pins} 
          zoomLevel={zoomLevel} 
          resonatedIds={resonatedIds} 
          handleResonate={handleResonate} 
        />
      </MapContainer>

       <FloatingMenu 
          onToggleSound={toggleMute}
          isMuted={isMuted}
          onOpenAbout={() => setShowAbout(true)}
          onOpenStats={() => setShowStats(true)}
          onOpenStory={() => setShowStory(true)}
          onOpenInput={handleOpenInput}
          pins={pins}             // The array of all thoughts
          userLocation={userLocation} // The user's current { lat, lng } state
       />

      
      <StatsModal 
        isOpen={showStats} 
        onClose={() => setShowStats(false)} 
        totalBeacons={pins.length} // Pass pins
        pins={pins}
      />

      
      <StoryModal 
        isOpen={showStory} 
        onClose={() => setShowStory(false)} 
      />

      <AboutModal 
        isOpen={showAbout} 
        onClose={() => setShowAbout(false)} 
        isMuted={isMuted} 
      />

      <ThoughtModal 
        isOpen={isModalOpen && !showAbout && !showStats} 
        text={thoughtText} setText={setThoughtText}
        honeypot={honeypot} setHoneypot={setHoneypot}
        onClose={() => { setIsModalOpen(false); setTempLocation(null); }}
        onSubmit={handleSubmitThought}
        isAnalyzing={isAnalyzing}
        maxLength={MAX_CHARS}
      />

      {notification && (
        <Notification 
          icon={notification.icon} 
          title={notification.title} 
          message={notification.message} 
          onClose={() => setNotification(null)} 
        />
      )}
    </div>
  );
}

export default App;