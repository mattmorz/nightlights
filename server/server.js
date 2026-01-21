const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const Filter = require('bad-words');
require('dotenv').config();

const app = express();

// --- 1. SECURITY MIDDLEWARE ---
app.use(helmet()); // Secure HTTP Headers
//app.use(cors());
// Allow both Localhost (for testing) and your future Vercel URL
const allowedOrigins = [
  'http://localhost:3000', 
  'http://localhost:5173', // specific for Vite users if applicable
  process.env.FRONTEND_URL // We will set this variable in Render later
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      // If the origin isn't in the list, check if it matches the Vercel domain pattern generally
      if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
        return callback(null, true);
      }
      return callback(new Error('CORS Policy: This origin is not allowed'), false);
    }
    return callback(null, true);
  }
}));
app.use(express.json({ limit: '10kb' })); // Limit body size to prevent DOS


app.use((req, res, next) => {
  // Manually sanitize body to prevent NoSQL injection
  // We skip 'req.query' because Node 25 makes it read-only, causing the crash.
  if (req.body) {
    mongoSanitize.sanitize(req.body);
  }
  if (req.params) {
    mongoSanitize.sanitize(req.params);
  }
  next();
});

// Profanity Filter Configuration
const filter = new Filter();
// Add custom words to block if needed
// filter.addWords('badword1', 'badword2'); 

// Rate Limiter: 10 Posts per Hour per IP
const postLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, 
  max: 10, 
  message: { error: "Signal exhausted. You have reached the limit of 10 signals per hour." },
  standardHeaders: true, 
  legacyHeaders: false,
});

// --- 2. DATABASE CONNECTION ---
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/nightlights')
  .then(async () => {
    console.log('✅ Connected to MongoDB');
    // Ensure 2dsphere index exists for geospatial queries
    try {
      await mongoose.model('Thought').collection.createIndex({ location: '2dsphere' });
    } catch (e) { console.log('Index warning:', e.message); }
  })
  .catch(err => console.error('❌ DB Error:', err));

// --- 3. SCHEMA ---
const ThoughtSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true, 
    maxlength: 500 
  },
  sentiment: { type: String, enum: ['positive', 'distressed'] },
  isHealed: { type: Boolean, default: false },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] // [lng, lat]
  },
  createdAt: { type: Date, default: Date.now, expires: 86400 }, // Auto-delete after 24h
  lightCount: { type: Number, default: 0 }
});
ThoughtSchema.index({ location: '2dsphere' });

const Thought = mongoose.model('Thought', ThoughtSchema);

// --- 4. SECURE HELPER FUNCTIONS ---

// Donut Fuzzing: Pushes point AT LEAST 500m away, up to 2km.
// Prevents "trilateration" attacks better than simple random fuzzing.
const fuzzLocation = (lat, lng) => {
  const EARTH_RADIUS = 6378137; // meters
  const MIN_OFFSET = 500; // Minimum 500m away
  const MAX_OFFSET = 2000; // Maximum 2km away

  const distance = Math.random() * (MAX_OFFSET - MIN_OFFSET) + MIN_OFFSET;
  const angle = Math.random() * Math.PI * 2; // Random direction

  const dLat = distance * Math.cos(angle) / EARTH_RADIUS;
  const dLng = distance * Math.sin(angle) / (EARTH_RADIUS * Math.cos(Math.PI * lat / 180));

  return { 
    lat: lat + (dLat * 180 / Math.PI), 
    lng: lng + (dLng * 180 / Math.PI) 
  };
};

// PII Scrubber: Hides phones and emails
const scrubText = (text) => {
  const phoneRegex = /(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
  const emailRegex = /[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}/g;
  return text.replace(phoneRegex, '***-****').replace(emailRegex, '***@***.***');
};

const RADIUS_IN_RADIANS = 10 / 6378.1; // 10km Radius

// --- 5. ROUTES ---

// GET: Fetch thoughts
app.get('/thoughts', async (req, res) => {
  try {
    const thoughts = await Thought.find();
    // Calculate healing stats dynamically
    const thoughtsWithData = await Promise.all(thoughts.map(async (t) => {
      let lightCount = 0;
      if (t.sentiment === 'distressed' && !t.isHealed) {
         try {
           lightCount = await Thought.countDocuments({
             sentiment: 'positive',
             location: { $geoWithin: { $centerSphere: [ t.location.coordinates, RADIUS_IN_RADIANS ] } }
           });
         } catch (e) { lightCount = 0; }
      }
      return { ...t.toObject(), lightCount };
    }));
    res.json(thoughtsWithData);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST: Create Signal (Secured)
app.post('/thoughts', postLimiter, async (req, res) => {
  let { text, sentiment, lat, lng, trap } = req.body;

  // A. HONEYPOT CHECK (Anti-Bot)
  if (trap && trap.length > 0) {
    return res.json({ success: true, fake: true }); // Fake success to confuse bot
  }

  // B. VALIDATION
  if (!lat || !lng) return res.status(400).json({ error: "Location required" });
  if (!text || text.length > 500) return res.status(400).json({ error: "Message too long." });

  // C. PROFANITY & PII CHECK
  if (filter.isProfane(text)) {
    return res.status(400).json({ error: "Please keep the space safe. Profanity is not allowed." });
  }
  text = scrubText(text);

  // D. FUZZ LOCATION
  const fuzzed = fuzzLocation(lat, lng);
  const userLocation = { type: 'Point', coordinates: [fuzzed.lng, fuzzed.lat] };

  try {
    const newThought = new Thought({ text, sentiment, location: userLocation });
    await newThought.save();

    let healedCount = 0;
    let bornHealed = false;

    // E. RULE OF 5 LOGIC
    if (sentiment === 'positive') {
      const nearbySadThoughts = await Thought.find({
          sentiment: 'distressed', isHealed: false,
          location: { $geoWithin: { $centerSphere: [ [fuzzed.lng, fuzzed.lat], RADIUS_IN_RADIANS ] } }
      });

      for (const sadPin of nearbySadThoughts) {
         const lightCount = await Thought.countDocuments({
           sentiment: 'positive',
           location: { $geoWithin: { $centerSphere: [ sadPin.location.coordinates, RADIUS_IN_RADIANS ] } }
         });

         if (lightCount >= 5) {
           sadPin.isHealed = true;
           await sadPin.save();
           healedCount++;
         }
      }
    } else {
      const nearbyLights = await Thought.countDocuments({
        sentiment: 'positive', 
        location: { $geoWithin: { $centerSphere: [ [fuzzed.lng, fuzzed.lat], RADIUS_IN_RADIANS ] } }
      });

      if (nearbyLights >= 5) {
        newThought.isHealed = true;
        await newThought.save();
        bornHealed = true;
      }
    }

    res.json({ success: true, healedCount, bornHealed });

  } catch (err) {
    console.error("❌ Save Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(5001, () => console.log('🚀 Secure Server running on port 5001'));