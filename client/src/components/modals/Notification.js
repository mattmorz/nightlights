import React, { useEffect } from 'react';
import '../../App.css'; 

const Notification = ({ icon, title, message, onClose }) => {
  
  // Auto-dismiss after 5 seconds (optional)
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="modal-overlay">
      <div className="modal-content notification-content">
        <div className="notification-icon">{icon}</div>
        <h3>{title}</h3>
        <p className="notification-message">{message}</p>
        <button onClick={onClose} className="btn-submit">
          Acknowledged
        </button>
      </div>
    </div>
  );
};

export default Notification;