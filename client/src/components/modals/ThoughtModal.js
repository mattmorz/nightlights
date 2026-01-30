import React, { useState, useEffect } from 'react';
import { IoSend, IoClose, IoSparklesSharp } from 'react-icons/io5'; 
import '../../ThoughtModal.css';

const MOODS = {
  neutral: '#8b5cf6', // Violet
  heavy:   '#94a3b8', // Slate Grey
  hopeful: '#f59e0b', // Amber/Gold
  intense: '#ef4444', // Red
};

const PROMPTS = [
  "Share a thought...",
  "What's happening today?",
  "Signal the community...",
  "Don't be shy..."
];

const ThoughtModal = ({ isOpen, text, setText, honeypot, setHoneypot, onClose, onSubmit, isAnalyzing, maxLength }) => {
  const [activePrompt, setActivePrompt] = useState(PROMPTS[0]);
  const [accentColor, setAccentColor] = useState(MOODS.neutral);
  const [isTransmitting, setIsTransmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActivePrompt(PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
      setAccentColor(MOODS.neutral);
      setIsTransmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const lowerText = text.toLowerCase();
    if (lowerText.match(/(hope|love|light|dream|happy|thank|glow|sun|good)/)) {
      setAccentColor(MOODS.hopeful);
    } else if (lowerText.match(/(sad|lonely|pain|tired|dark|hurt|lost|cry|rain)/)) {
      setAccentColor(MOODS.heavy);
    } else if (lowerText.match(/(angry|hate|burn|scream|mad|fire|danger)/)) {
      setAccentColor(MOODS.intense);
    } else {
      setAccentColor(MOODS.neutral);
    }
  }, [text]);

  const handleTransmit = () => {
    if (text.trim().length === 0) return;
    setIsTransmitting(true);
    setTimeout(() => {
      onSubmit();
    }, 600); 
  };

  if (!isOpen) return null;

  return (
    <div className="simple-modal-overlay" onClick={onClose}>
      <div 
        className={`simple-modal-card ${isTransmitting ? 'slide-up-out' : ''}`}
        onClick={(e) => e.stopPropagation()}
        style={{ borderTopColor: accentColor }}
      >
        
        {/* HEADER: Title + Character Count */}
        <div className="simple-modal-header">
          <span className="modal-title" style={{ color: accentColor }}>
            <IoSparklesSharp style={{ marginRight: '8px' }} />
            New Signal
          </span>
          
          <div className="char-count" style={{ color: (maxLength - text.length) < 20 ? '#ef4444' : '#666' }}>
            {maxLength - text.length} / {maxLength}
          </div>
        </div>

        {/* BODY: Text Area */}
        <div className="simple-modal-body">
          <textarea 
            className="simple-textarea"
            placeholder={activePrompt}
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            autoFocus 
            maxLength={maxLength}
          />
        </div>

        {/* FOOTER: Cancel + Post Buttons */}
        <div className="simple-modal-footer">
          <button onClick={onClose} className="simple-cancel-btn">
            <IoClose /> Cancel
          </button>

          <button 
            onClick={handleTransmit} 
            disabled={isAnalyzing || isTransmitting || text.length === 0} 
            className="simple-send-btn"
            style={{ 
              backgroundColor: text.length > 0 ? accentColor : '#333',
              color: text.length > 0 ? '#000' : '#888' 
            }}
          >
            {isTransmitting ? "Sending..." : <><IoSend /> Send</>}
          </button>
        </div>

        <input type="text" style={{ display: 'none' }} value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
    </div>
  );
};

export default ThoughtModal;