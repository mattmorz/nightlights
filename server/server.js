require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Sentiment = require('sentiment');
const rateLimit = require('express-rate-limit'); // NEW: Limits repeated requests
const Filter = require('bad-words'); // NEW: Filters profanity

// --- CONFIGURATION ---
const app = express();
const PORT = process.env.PORT || 5001;
const sentimentAnalyzer = new Sentiment();
const filter = new Filter(); // Initialize profanity filter

// Middleware
app.use(cors());
app.use(express.json());
// Trust proxy is required if you deploy behind a reverse proxy (like Heroku, Vercel, Nginx)
app.set('trust proxy', 1); 

// --- DATABASE CONNECTION ---
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://<user>:<pass>@cluster.mongodb.net/nightlights?retryWrites=true&w=majority';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- SCHEMA & MODEL ---
const ThoughtSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 500 },
  sentiment: { 
    type: String, 
    enum: ['positive', 'distressed'], 
    required: true 
  },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: { type: [Number], required: true } 
  },
  isHealed: { type: Boolean, default: false },
  lightCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 86400 } 
});

ThoughtSchema.index({ location: '2dsphere' });
const Thought = mongoose.model('Thought', ThoughtSchema);

// --- SECURITY & MODERATION TOOLS ---

// 1. RATE LIMITER: Allow only 10 posts per hour per IP
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Hour
  max: 10, // Limit each IP to 10 requests per windowMs
  message: { error: "You are sending too many signals. Please rest for a while and try again later." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// 2. CONTENT VALIDATION FUNCTION
const containsSensitiveInfo = (text) => {
  // Regex for Email
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  // Regex for Phone Numbers (Generic 7-15 digits, allows spaces/dashes)
  const phoneRegex = /(\+?\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/;
  
  if (emailRegex.test(text)) return "Privacy Alert: Please do not post email addresses.";
  if (phoneRegex.test(text)) return "Privacy Alert: Please do not post phone numbers.";
  return null;
};

// --- ROUTES ---

// GET: Fetch all thoughts
app.get('/thoughts', async (req, res) => {
  try {
    const thoughts = await Thought.find().sort({ createdAt: -1 }).limit(500);
    res.json(thoughts);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch thoughts" });
  }
});

// POST: Create a new thought (Applied Rate Limiter here)
app.post('/thoughts', postLimiter, async (req, res) => {
  try {
    const { text, trap } = req.body;

    // 1. FORCE NUMBERS
    const lat = Number(req.body.lat);
    const lng = Number(req.body.lng);

    // 2. HONEYPOT & BASIC VALIDATION
    if (trap && trap.length > 0) return res.json({ success: true }); // Silent fail for bots
    if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "Invalid Location Data" });
    }
    if (!text || text.length > 500) return res.status(400).json({ error: "Message too long." });

    // 3. PROFANITY CHECK
    if (filter.isProfane(text)) {
      return res.status(400).json({ error: "Your message contains words that are not allowed in this safe space." });
    }

    // 4. PRIVACY CHECK (Emails & Phones)
    const privacyError = containsSensitiveInfo(text);
    if (privacyError) {
      return res.status(400).json({ error: privacyError });
    }

    // 5. SERVER-SIDE SENTIMENT ANALYSIS
    const analysis = sentimentAnalyzer.analyze(text);
    const sentimentType = analysis.score < 0 ? 'distressed' : 'positive';
    
    console.log(`📝 New Thought: "${text}" | Score: ${analysis.score} | Type: ${sentimentType}`);

    // 6. PREPARE DATA
    const userLocation = { type: 'Point', coordinates: [lng, lat] }; 
    const RADIUS_RADIANS = 5 / 6378.1; // 5km radius

    const newThought = new Thought({
      text,
      sentiment: sentimentType,
      location: userLocation,
      isHealed: sentimentType === 'positive', 
      lightCount: 0
    });

    let message = "";
    let bornHealed = false;

    // 7. HEALING LOGIC
    if (sentimentType === 'positive') {
      // --- CASE A: User placed a BEACON (Light) ---
      await newThought.save();

      const nearbyDistressed = await Thought.find({
        sentiment: 'distressed',
        isHealed: false,
        location: { $geoWithin: { $centerSphere: [ [lng, lat], RADIUS_RADIANS ] } }
      });
      
      let actuallyHealedSomeone = false;

      for (const sadPin of nearbyDistressed) {
        const lightsAroundPin = await Thought.countDocuments({
          sentiment: 'positive',
          location: { $geoWithin: { $centerSphere: [ sadPin.location.coordinates, RADIUS_RADIANS ] } }
        });
        
        sadPin.lightCount = lightsAroundPin;
        
        if (sadPin.lightCount >= 5) {
          sadPin.isHealed = true;
          actuallyHealedSomeone = true;
        }
        await sadPin.save();
      }

      if (actuallyHealedSomeone) {
        message = "Your radiance broke the darkness. You have healed a neighbor.";
      } else {
        message = "Your light has been placed. It shines for those nearby.";
      }

    } else {
      // --- CASE B: User placed a HEAVY HEART (Distressed) ---
      const nearbyLights = await Thought.countDocuments({
        sentiment: 'positive',
        location: { $geoWithin: { $centerSphere: [ [lng, lat], RADIUS_RADIANS ] } }
      });
      
      newThought.lightCount = nearbyLights;

      if (nearbyLights >= 5) {
        newThought.isHealed = true;
        bornHealed = true;
        message = "You are not alone here. You are standing in the circle of care.";
      } else {
        message = "We hear you. Your light is now visible to the world.";
      }

      await newThought.save();
    }

    // 8. RESPOND
    res.json({ success: true, sentiment: sentimentType, message, bornHealed });

  } catch (err) {
    console.error("❌ Server Error:", err);
    res.status(500).json({ error: "Server error processing your signal." });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});