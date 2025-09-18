import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navigation.css';

const Navigation = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  
  const navItems = [
    { path: '/', label: 'Home', icon: '🏠' },
    { path: '/meeting-monitor', label: 'Meeting Monitor', icon: '🎙️' },
    { path: '/tasks', label: 'Tasks', icon: '✅' },
    { path: '/calendar', label: 'Calendar', icon: '📅' },
    { path: '/notes', label: 'Notes', icon: '📝' },
    { path: '/password', label: 'Password', icon: '🔐' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
    { path: '/profile', label: 'Profile', icon: '👤' }
  ];

  // Don't show navigation on landing page or auth pages
  if (location.pathname === '/' || location.pathname === '/login' || location.pathname === '/signup') {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (user && user.firstName && user.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    return 'U';
  };

  return (
    <nav className="navigation">
      <div className="nav-container">
        <div className="nav-brand">
          <Link to="/" className="brand-link">
            <span className="brand-icon">🎙️</span>
            <span className="brand-text">Meeting Monitor</span>
          </Link>
        </div>
        
        <div className="nav-links">
          {navItems.slice(1).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </Link>
          ))}
        </div>
        
        <div className="nav-user">
          {isAuthenticated() ? (
            <div className="user-menu">
              <Link to="/profile" className={`user-link ${location.pathname === '/profile' ? 'active' : ''}`}>
                <div className="user-avatar">
                  <span className="avatar-text">{getUserInitials()}</span>
                </div>
                <div className="user-info">
                  <span className="user-name">{user?.firstName} {user?.lastName}</span>
                  <span className="user-role">User</span>
                </div>
              </Link>
              <button onClick={handleLogout} className="logout-btn" title="Sign Out">
                🚪
              </button>
            </div>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="auth-link login-link">
                Sign In
              </Link>
              <Link to="/signup" className="auth-link signup-link">
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navigation;