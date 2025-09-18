import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../styles/auth.css';

const Profile = () => {
  const { user, logout, updateProfile, changePassword } = useAuth();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    bio: '',
    phone: '',
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        bio: user.bio || '',
        phone: user.phone || '',
      });
    }
  }, [user]);
  
  const handleProfileChange = (e) => {
    setProfileData({
      ...profileData,
      [e.target.name]: e.target.value
    });
  };
  
  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };
  
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setIsLoading(true);
    
    try {
      await updateProfile(profileData);
      setProfileSuccess('Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error) {
      setProfileError(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    
    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    // Validate password strength
    if (passwordData.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long');
      return;
    }
    
    setIsLoading(true);
    
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordSuccess('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setIsChangingPassword(false);
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (error) {
      setPasswordError(error.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>Please log in to view your profile</h2>
          <button 
            onClick={() => navigate('/login')}
            className="auth-button"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h2>User Profile</h2>
          <div className="profile-actions">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="auth-button secondary"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
            <button
              onClick={handleLogout}
              className="auth-button danger"
            >
              Logout
            </button>
          </div>
        </div>
        
        {/* Profile Information */}
        <div className="profile-section">
          <h3>Profile Information</h3>
          
          {profileSuccess && (
            <div className="auth-success">
              {profileSuccess}
            </div>
          )}
          
          {profileError && (
            <div className="auth-error">
              {profileError}
            </div>
          )}
          
          {isEditing ? (
            <form onSubmit={handleProfileSubmit} className="auth-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={profileData.firstName}
                    onChange={handleProfileChange}
                    className="auth-input"
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={profileData.lastName}
                    onChange={handleProfileChange}
                    className="auth-input"
                    required
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={profileData.email}
                  onChange={handleProfileChange}
                  className="auth-input"
                  required
                  disabled
                />
                <small className="form-hint">Email cannot be changed</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={profileData.phone}
                  onChange={handleProfileChange}
                  className="auth-input"
                  placeholder="Enter your phone number"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="bio">Bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={profileData.bio}
                  onChange={handleProfileChange}
                  className="auth-input"
                  rows="4"
                  placeholder="Tell us about yourself..."
                />
              </div>
              
              <div className="form-actions">
                <button
                  type="submit"
                  className="auth-button"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Updating...
                    </>
                  ) : (
                    'Update Profile'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="auth-button secondary"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-display">
              <div className="profile-field">
                <label>Name:</label>
                <span>{user.firstName} {user.lastName}</span>
              </div>
              
              <div className="profile-field">
                <label>Email:</label>
                <span>{user.email}</span>
              </div>
              
              <div className="profile-field">
                <label>Phone:</label>
                <span>{user.phone || 'Not provided'}</span>
              </div>
              
              <div className="profile-field">
                <label>Bio:</label>
                <span>{user.bio || 'No bio provided'}</span>
              </div>
              
              <div className="profile-field">
                <label>Member Since:</label>
                <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Password Change Section */}
        <div className="profile-section">
          <div className="section-header">
            <h3>Password & Security</h3>
            <button
              onClick={() => setIsChangingPassword(!isChangingPassword)}
              className="auth-button secondary small"
            >
              {isChangingPassword ? 'Cancel' : 'Change Password'}
            </button>
          </div>
          
          {passwordSuccess && (
            <div className="auth-success">
              {passwordSuccess}
            </div>
          )}
          
          {passwordError && (
            <div className="auth-error">
              {passwordError}
            </div>
          )}
          
          {isChangingPassword && (
            <form onSubmit={handlePasswordSubmit} className="auth-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className="auth-input"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className="auth-input"
                  required
                  minLength="6"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className="auth-input"
                  required
                  minLength="6"
                />
              </div>
              
              <div className="form-actions">
                <button
                  type="submit"
                  className="auth-button"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="loading-spinner"></span>
                      Changing...
                    </>
                  ) : (
                    'Change Password'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* Account Statistics */}
        <div className="profile-section">
          <h3>Account Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Account Status</span>
              <span className="stat-value active">Active</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Last Login</span>
              <span className="stat-value">{user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'N/A'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Sessions</span>
              <span className="stat-value">{user.sessionCount || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;