const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { initDatabase } = require('./config/init');
const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const calendarRoutes = require('./routes/calendar');
const notesRoutes = require('./routes/notes');
const passwordsRoutes = require('./routes/passwords');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/passwords', passwordsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Meeting Monitor API is running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
const startServer = async () => {
  try {
    console.log('🔧 Starting server initialization...');
    
    // Add process event listeners for debugging
    process.on('exit', (code) => {
      console.log(`Process exited with code ${code}`);
    });
    
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });
    
    // Try to initialize database, but don't fail if it doesn't work
    try {
      await initDatabase();
      console.log('✅ Database initialization completed');
    } catch (dbError) {
      console.error('⚠️ Database initialization failed, but server will continue:', dbError.message);
    }
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 Meeting Monitor API server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔗 Frontend should connect to: http://localhost:${PORT}/api`);
      console.log(`⚡ FastAPI (AI models) should be running on port 8000`);
      console.log('✅ Server is now ready to accept connections');
    });
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Please stop other servers or use a different port.`);
        process.exit(1);
      } else {
        console.error('Server error:', error);
      }
    });
    
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error details:', error.stack);
  }
};

startServer();