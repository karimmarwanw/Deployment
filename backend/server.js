const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { Server } = require('socket.io');
const { initializeSocket } = require('./socket');

dotenv.config();

const app = express();

// CORS Configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? false : 'http://localhost:3000'),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/communities', require('./routes/communities'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/comments', require('./routes/comments'));
app.use('/api/search', require('./routes/search'));
app.use('/api/topics', require('./routes/topics'));
app.use('/api/chats', require('./routes/chats'));
app.use('/api/notifications', require('./routes/notifications').router);

// Serve static files from React app in production
if (process.env.NODE_ENV === 'production') {
  const frontendBuildPath = path.join(__dirname, '../frontend/build');
  app.use(express.static(frontendBuildPath));
  
  // Serve React app for all non-API routes
  app.get('*', (req, res) => {
    // Don't serve React app for API routes
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ message: 'API route not found' });
    }
    res.sendFile(path.join(frontendBuildPath, 'index.html'));
  });
}

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ message: 'API route not found' });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
// Allow localhost:3000 in development, or use FRONTEND_URL if set
let socketCorsOrigin;
if (process.env.FRONTEND_URL) {
  socketCorsOrigin = process.env.FRONTEND_URL;
} else if (process.env.NODE_ENV === 'production') {
  // In production, require FRONTEND_URL to be set
  console.warn('WARNING: FRONTEND_URL not set in production. Socket.io CORS may fail.');
  socketCorsOrigin = false;
} else {
  // Development: allow localhost:3000 (React default port)
  socketCorsOrigin = 'http://localhost:3000';
}

const io = new Server(server, {
  cors: {
    origin: socketCorsOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type']
  },
  // Allow connection attempts even if CORS fails initially (Socket.io will handle it)
  allowEIO3: true,
  // Add connection state recovery
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true
  }
});

// Handle connection errors at the engine level
io.engine.on('connection_error', (err) => {
  console.error('Socket.io engine connection error:', err.req?.headers, err.message);
});

// Log Socket.io CORS configuration
console.log(`Socket.io CORS origin: ${socketCorsOrigin || 'disabled'}`);

// Initialize socket handlers
initializeSocket(io);

// Make io available to routes
app.set('io', io);

// Connect to MongoDB
// Note: useNewUrlParser and useUnifiedTopology are deprecated in Mongoose 8.x and have no effect
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/reddit-clone')
  .then(() => {
    console.log('MongoDB Connected');
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    // Exit process if MongoDB connection fails in production
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});
