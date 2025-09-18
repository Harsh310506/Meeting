import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './LandingPage.css';

const LandingPage = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const features = [
    {
      icon: '🎙️',
      title: 'Meeting Monitor',
      description: 'Real-time AI-powered meeting analysis with live transcription and sentiment tracking',
      path: '/meeting-monitor',
      color: 'from-blue-500 to-purple-600'
    },
    {
      icon: '✅',
      title: 'Tasks',
      description: 'Manage and track your action items and to-do lists efficiently',
      path: '/tasks',
      color: 'from-green-500 to-teal-600'
    },
    {
      icon: '📅',
      title: 'Calendar',
      description: 'Schedule meetings and keep track of your important events',
      path: '/calendar',
      color: 'from-orange-500 to-red-600'
    },
    {
      icon: '📝',
      title: 'Notes',
      description: 'Capture ideas and important information from your meetings',
      path: '/notes',
      color: 'from-yellow-500 to-orange-600'
    },
    {
      icon: '🔐',
      title: 'Password',
      description: 'Secure password management and authentication settings',
      path: '/password',
      color: 'from-indigo-500 to-blue-600'
    },
    {
      icon: '⚙️',
      title: 'Settings',
      description: 'Configure your preferences and application settings',
      path: '/settings',
      color: 'from-gray-500 to-gray-700'
    },
    {
      icon: '👤',
      title: 'Profile',
      description: 'Manage your personal information and account details',
      path: '/profile',
      color: 'from-pink-500 to-rose-600'
    }
  ];

  return (
    <div className="landing-page">
      {/* Header */}
      <header className="landing-header">
        <div className="container">
          <div className="header-content">
            <div className="logo-section">
              <h1 className="logo">Meeting Monitor Suite</h1>
              <p className="tagline">AI-Powered Meeting Intelligence Platform</p>
            </div>
            <nav className="nav-links">
              <a href="#features" className="nav-link">Features</a>
              <a href="#about" className="nav-link">About</a>
              <a href="#contact" className="nav-link">Contact</a>
              {isAuthenticated() ? (
                <div className="auth-nav">
                  <span className="welcome-text">Welcome, {user?.firstName}!</span>
                  <Link to="/meeting-monitor" className="nav-cta-button">
                    Go to Dashboard
                  </Link>
                </div>
              ) : (
                <div className="auth-nav">
                  <Link to="/login" className="nav-link login-nav">Sign In</Link>
                  <Link to="/signup" className="nav-cta-button">Get Started</Link>
                </div>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h2 className="hero-title">
              Transform Your Meeting Experience with 
              <span className="gradient-text"> AI Intelligence</span>
            </h2>
            <p className="hero-description">
              Real-time transcription, sentiment analysis, task extraction, and comprehensive meeting insights 
              all in one powerful platform.
            </p>
            <div className="hero-stats">
              <div className="stat">
                <span className="stat-number">99%</span>
                <span className="stat-label">Accuracy</span>
              </div>
              <div className="stat">
                <span className="stat-number">Real-time</span>
                <span className="stat-label">Processing</span>
              </div>
              <div className="stat">
                <span className="stat-number">GPU</span>
                <span className="stat-label">Optimized</span>
              </div>
            </div>
            
            {!isAuthenticated() && (
              <div className="hero-actions">
                <Link to="/signup" className="cta-primary">
                  Get Started Free
                </Link>
                <Link to="/login" className="cta-secondary">
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="features-section">
        <div className="container">
          <h3 className="section-title">Choose Your Tool</h3>
          <p className="section-subtitle">
            Access powerful features designed to enhance your productivity and meeting experience
          </p>
          
          <div className="features-grid">
            {features.map((feature, index) => (
              <Link 
                key={index} 
                to={feature.path} 
                className="feature-card"
                style={{ '--delay': `${index * 0.1}s` }}
              >
                <div className={`feature-icon bg-gradient-to-br ${feature.color}`}>
                  <span>{feature.icon}</span>
                </div>
                <div className="feature-content">
                  <h4 className="feature-title">{feature.title}</h4>
                  <p className="feature-description">{feature.description}</p>
                </div>
                <div className="feature-arrow">
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path 
                      d="M7.5 15L12.5 10L7.5 5" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Stats Section */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🎯</div>
              <div className="stat-info">
                <h4>High Accuracy</h4>
                <p>Whisper medium model with GPU optimization</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⚡</div>
              <div className="stat-info">
                <h4>Real-time Processing</h4>
                <p>WebSocket streaming with low latency</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🧠</div>
              <div className="stat-info">
                <h4>AI-Powered Insights</h4>
                <p>DistilBERT sentiment analysis and NLP</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🔒</div>
              <div className="stat-info">
                <h4>Privacy First</h4>
                <p>No permanent storage by default</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h5>Meeting Monitor Suite</h5>
              <p>AI-powered meeting intelligence platform for modern teams.</p>
            </div>
            <div className="footer-section">
              <h6>Features</h6>
              <ul>
                <li>Real-time Transcription</li>
                <li>Sentiment Analysis</li>
                <li>Task Extraction</li>
                <li>Multi-speaker Support</li>
              </ul>
            </div>
            <div className="footer-section">
              <h6>Technology</h6>
              <ul>
                <li>Whisper ASR</li>
                <li>DistilBERT</li>
                <li>React & FastAPI</li>
                <li>CUDA Optimization</li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2025 Meeting Monitor Suite. Built with ❤️ for productive meetings.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;