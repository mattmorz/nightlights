import React, { useMemo } from 'react';
import '../../App.css'; 

// 1. Add 'isOpen' to props
const StatsModal = ({ isOpen, pins, onClose }) => {
  


  // Calculate the numbers whenever 'pins' changes
  // (Moved this BELOW the check so we don't calculate if modal is closed)
  const stats = useMemo(() => {
    return {
      heavy: pins.filter(p => p.sentiment === 'distressed' && !p.isHealed).length,
      healed: pins.filter(p => p.isHealed).length,
      beacons: pins.filter(p => p.sentiment === 'positive').length,
    };
  }, [pins]);
    // 2. The Fix: If not open, render absolutely nothing
  if (!isOpen) return null;
  return (
    // 3. Add onClick={onClose} to background
    <div className="modal-overlay" onClick={onClose}>
      
      {/* 4. Add stopPropagation so clicking the card doesn't close it */}
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>Community Pulse 📊</h3>
        
        <div className="stats-grid">
          {/* Card 1: Heavy Hearts */}
          <div className="stat-card">
            <div className="stat-value text-blue">
              {stats.heavy}
            </div>
            <div className="stat-label">Heavy Hearts</div>
          </div>

          {/* Card 2: Beacons Lit */}
          <div className="stat-card">
            <div className="stat-value text-yellow">
              {stats.beacons}
            </div>
            <div className="stat-label">Beacons Lit</div>
          </div>

          {/* Card 3: Souls Healed (Full Width) */}
          <div className="stat-card full-width">
            <div className="stat-value text-cyan">
              {stats.healed}
            </div>
            <div className="stat-label">Souls Healed</div>
          </div>
        </div>

        <button onClick={onClose} className="btn-submit">
          Close
        </button>
      </div>
    </div>
  );
};

export default StatsModal;