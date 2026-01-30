import React, { useState, useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import '../SkyCast.css';

const SignalIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

// Rounded Sun
const SunIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"></circle>
    <line x1="12" y1="1" x2="12" y2="3"></line>
    <line x1="12" y1="21" x2="12" y2="23"></line>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
    <line x1="1" y1="12" x2="3" y2="12"></line>
    <line x1="21" y1="12" x2="23" y2="12"></line>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
  </svg>
);

// Simple Cloud
const CloudIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>
  </svg>
);

const SkyCast = ({ onPostMessage, onClose }) => {
  const map = useMap();
  const [message, setMessage] = useState("");
  const [sentiment, setSentiment] = useState("positive");
  const [beam, setBeam] = useState(null); 
  const [beacon, setBeacon] = useState(null); 
  const containerRef = useRef(null);

  // Prevent map interaction when clicking inside the input bar
  useEffect(() => {
    if (containerRef.current) {
      L.DomEvent.disableClickPropagation(containerRef.current);
      L.DomEvent.disableScrollPropagation(containerRef.current);
    }
  }, []);

  const handleCast = () => {
    if (!message.trim()) return;
    
    // Fallback logic if geolocation is denied/unavailable
    const startCast = (lat, lng) => {
      const SHIFT_FACTOR = 0.025; 
      const randomLat = lat + (Math.random() - 0.5) * SHIFT_FACTOR;
      const randomLng = lng + (Math.random() - 0.5) * SHIFT_FACTOR;
      const targetLatLng = [randomLat, randomLng];

      map.flyTo(targetLatLng, map.getZoom(), { duration: 1.0 });

      setTimeout(() => {
          const targetPoint = map.latLngToContainerPoint(targetLatLng);
          triggerSequence(targetPoint, targetLatLng);
      }, 1000);
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => startCast(pos.coords.latitude, pos.coords.longitude),
        () => {
           // Error callback: use map center
           const center = map.getCenter();
           startCast(center.lat, center.lng);
        }
      );
    } else {
       const center = map.getCenter();
       startCast(center.lat, center.lng);
    }
  };

  const triggerSequence = (targetPoint, latLng) => {
    const color = sentiment === 'positive' ? '#ffd700' : '#b0b0b0'; 

    setBeam({ x: targetPoint.x, dropHeight: targetPoint.y, color: color });

    setTimeout(() => {
      setBeam(null); 
      setBeacon({ x: targetPoint.x, y: targetPoint.y, color: color });

      setTimeout(() => {
         setBeacon(null);
         
         // Send Data
         onPostMessage({
          message: message,
          position: latLng,
          sentiment: sentiment,
          region: "Mobile User"
        });
        
        setMessage("");
        
        // CLOSE MODAL AUTOMATICALLY
        if(onClose) onClose();

      }, 1200); 
    }, 600); 
  };

  return (
    <>
      <div className="skycast-container" ref={containerRef}>
        
        {/* Toggle Mood */}
        <button 
          className="skycast-icon-btn"
          onClick={() => setSentiment(s => s === 'positive' ? 'negative' : 'positive')}
          style={{ color: sentiment === 'positive' ? '#ffd700' : '#aaa' }}
          title="Toggle Mood"
        >
          {sentiment === 'positive' ? <SunIcon /> : <CloudIcon />}
        </button>
        
        {/* Input Field */}
        <input
          className="skycast-input"
          placeholder="Broadcast to the world..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCast()}
          autoFocus
        />
        
        {/* Send Button */}
        <button className="send-signal-btn" onClick={handleCast}>
          <SignalIcon />
        </button>

      </div>

      {/* Animation Layers */}
      {beam && (
        <div className="falling-beam"
          style={{ left: `${beam.x}px`, color: beam.color, '--fall-distance': `${beam.dropHeight}px` }}
        />
      )}

      {beacon && (
        <div className="beacon-impact"
           style={{ left: `${beacon.x}px`, top: `${beacon.y}px`, color: beacon.color }}
        />
      )}
    </>
  );
};

export default SkyCast;