import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navigation from './components/Navigation';
import LandingPage from './components/LandingPage';
import Login from './components/Login';
import Signup from './components/Signup';
import ProtectedRoute from './components/ProtectedRoute';
import MeetingMonitor from './pages/MeetingMonitor';
import Tasks from './pages/Tasks';
import Calendar from './pages/Calendar';
import Notes from './pages/Notes';
import Password from './pages/Password';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import './Beautiful.css';

function AppContent() {
  const location = useLocation();
  const isMeetingMonitor = location.pathname === '/meeting-monitor';
  const isAuthPage = ['/login', '/signup'].includes(location.pathname);
  
  return (
    <div className="app-container">
      {!isAuthPage && <Navigation />}
      <main className={isMeetingMonitor ? 'main-content-meeting' : (isAuthPage ? 'auth-main' : 'main-content')}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Protected Routes */}
          <Route path="/meeting-monitor" element={
            <ProtectedRoute>
              <MeetingMonitor />
            </ProtectedRoute>
          } />
          <Route path="/tasks" element={
            <ProtectedRoute>
              <Tasks />
            </ProtectedRoute>
          } />
          <Route path="/calendar" element={
            <ProtectedRoute>
              <Calendar />
            </ProtectedRoute>
          } />
          <Route path="/notes" element={
            <ProtectedRoute>
              <Notes />
            </ProtectedRoute>
          } />
          <Route path="/password" element={
            <ProtectedRoute>
              <Password />
            </ProtectedRoute>
          } />
          <Route path="/settings" element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;