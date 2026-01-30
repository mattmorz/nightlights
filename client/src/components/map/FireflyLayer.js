// src/components/map/FireflyLayer.js
import React, { useState, useEffect } from 'react';
import { Marker } from 'react-leaflet';
import L from 'leaflet';
// Note: We need to go up two levels to find utils
import { socket } from '../../utils/api'; 

const FireflyLayer = () => {
  const [fireflies, setFireflies] = useState({});

  useEffect(() => {
    socket.on('firefly_update', (data) => {
      setFireflies(prev => ({
        ...prev,
        [data.id]: { 
          lat: data.lat, 
          lng: data.lng, 
          animationDelay: prev[data.id]?.animationDelay || Math.random() * 5 
        }
      }));
    });

    socket.on('firefly_remove', (id) => {
      setFireflies(prev => {
        const newState = { ...prev };
        delete newState[id];
        return newState;
      });
    });

    return () => {
      socket.off('firefly_update');
      socket.off('firefly_remove');
    };
  }, []);

  return Object.values(fireflies).map((f, index) => (
    <Marker 
      key={index} 
      position={[f.lat, f.lng]} 
      icon={L.divIcon({
        className: 'leaflet-div-icon',
        html: `<div class="firefly-icon" style="width: 8px; height: 8px; animation-delay: -${f.animationDelay}s;"></div>`,
        iconSize: [4, 4],
        iconAnchor: [2, 2]
      })}
    />
  ));
};

export default FireflyLayer;