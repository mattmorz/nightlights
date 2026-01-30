import React from 'react';
import { Marker, Popup } from 'react-leaflet';
import { getSizedIcon } from '../../utils/helpers';

const MapMarkers = ({ pins, zoomLevel, resonatedIds, handleResonate }) => {
  return pins.filter(pin => pin !== null).map((pin) => {
    let type = pin.sentiment === 'positive' ? 'positive' : (pin.isHealed ? 'healed' : 'distressed');
    let statusText = type === 'positive' ? "✨ Light" : (type === 'healed' ? "❤️‍🩹 Healed" : "Heavy Heart");
    
    let progressDisplay = null;
    if (type === 'distressed') {
      const count = pin.lightCount || 0;
      progressDisplay = (
        <div className="healing-progress">
          <small>Healing Progress:</small>
          <div className="candle-bar">{"🕯️".repeat(count)}{"⚫".repeat(5 - count)}</div>
          <small>({count}/5 lights nearby)</small>
        </div>
      );
    }

    return (
      <Marker key={pin.id} position={pin.position} icon={getSizedIcon(type, zoomLevel, pin.resonanceCount)}>
        <Popup className="custom-popup">
          <div className="popup-inner">
            <strong>{statusText}</strong>
            <p>"{pin.text}"</p>
            {progressDisplay}
            <button 
              className={`resonate-btn ${resonatedIds.has(pin.id) ? 'active' : ''}`} 
              onClick={() => handleResonate(pin.id)} 
              disabled={resonatedIds.has(pin.id)}
            >
              💓 Resonate {pin.resonanceCount > 0 ? `(${pin.resonanceCount})` : ''}
            </button>
          </div>
        </Popup>
      </Marker>
    );
  });
};

export default MapMarkers;