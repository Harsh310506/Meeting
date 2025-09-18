import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import '../PageStyles.css';

const Profile = () => {
  const { user, logout, updateProfile, changePassword, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [activityStats] = useState({
    totalMeetings: 12,
    totalHours: 8.5,
    avgMeetingLength: 42,
    tasksExtracted: 23,
    notesCreated: 15,
    passwordsSaved: 7
  });

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    
    if (user) {
      setEditForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      });
    }
  }, [user, isAuthenticated, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleEditProfile = () => {
    setIsEditing(true);
    setMessage('');
    setError('');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || ''
    });
    setMessage('');
    setError('');
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    const result = await updateProfile(editForm);
    
    if (result.success) {
      setMessage('Profile updated successfully!');
      setIsEditing(false);
    } else {
      setError(result.error);
    }
    
    setIsLoading(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match');
      setIsLoading(false);
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      setIsLoading(false);
      return;
    }

    const result = await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
    
    if (result.success) {
      setMessage('Password changed successfully!');
      setIsChangingPassword(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } else {
      setError(result.error);
    }
    
    setIsLoading(false);
  };

  const handleInputChange = (e, formType) => {
    const { name, value } = e.target;
    
    if (formType === 'profile') {
      setEditForm(prev => ({
        ...prev,
        [name]: value
      }));
    } else if (formType === 'password') {
      setPasswordForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    if (message || error) {
      setMessage('');
      setError('');
    }
  };

  if (!user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner-large">
          <div className="spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-header">
        <h1> My Profile</h1>
        <p>Manage your account settings and preferences</p>
      </div>

      {message && (
        <div className="success-message">
          <span className="success-icon"></span>
          {message}
        </div>
      )}

      {error && (
        <div className="error-message">
          <span className="error-icon"></span>
          {error}
        </div>
      )}

      <div className="profile-content">
        <div className="profile-card">
          <div className="card-header">
            <h2>Profile Information</h2>
            {!isEditing && (
              <button 
                onClick={handleEditProfile}
                className="edit-button"
              >
                 Edit Profile
              </button>
            )}
          </div>

          {!isEditing ? (
            <div className="profile-info">
              <div className="info-group">
                <label>Full Name</label>
                <p>{user.firstName} {user.lastName}</p>
              </div>
              <div className="info-group">
                <label>Email Address</label>
                <p>{user.email}</p>
              </div>
              <div className="info-group">
                <label>Account Created</label>
                <p>{new Date(user.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleProfileSubmit} className="edit-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">First Name</label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={editForm.firstName}
                    onChange={(e) => handleInputChange(e, 'profile')}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">Last Name</label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={editForm.lastName}
                    onChange={(e) => handleInputChange(e, 'profile')}
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={editForm.email}
                  onChange={(e) => handleInputChange(e, 'profile')}
                  required
                />
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="save-button"
                  disabled={isLoading}
                >
                  {isLoading ? ' Saving...' : ' Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="cancel-button"
                >
                   Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="profile-card">
          <div className="card-header">
            <h2>Security Settings</h2>
            {!isChangingPassword && (
              <button
                onClick={() => setIsChangingPassword(true)}
                className="edit-button"
              >
                 Change Password
              </button>
            )}
          </div>

          {!isChangingPassword ? (
            <div className="security-info">
              <p>Keep your account secure by using a strong password.</p>
              <p>Last password change: {new Date(user.updatedAt).toLocaleDateString()}</p>
            </div>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="edit-form">
              <div className="form-group">
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={(e) => handleInputChange(e, 'password')}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={(e) => handleInputChange(e, 'password')}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => handleInputChange(e, 'password')}
                  required
                />
              </div>
              <div className="form-actions">
                <button
                  type="submit"
                  className="save-button"
                  disabled={isLoading}
                >
                  {isLoading ? ' Updating...' : ' Update Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setPasswordForm({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  className="cancel-button"
                >
                   Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="profile-card">
          <div className="card-header">
            <h2>Account Activity</h2>
          </div>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-number">{activityStats.totalMeetings}</span>
              <span className="stat-label">Total Meetings</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{activityStats.totalHours}h</span>
              <span className="stat-label">Total Hours</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{activityStats.tasksExtracted}</span>
              <span className="stat-label">Tasks Created</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{activityStats.notesCreated}</span>
              <span className="stat-label">Notes Created</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{activityStats.passwordsSaved}</span>
              <span className="stat-label">Passwords Saved</span>
            </div>
            <div className="stat-item">
              <span className="stat-number">{activityStats.avgMeetingLength}m</span>
              <span className="stat-label">Avg Meeting</span>
            </div>
          </div>
        </div>

        <div className="profile-card logout-section">
          <div className="card-header">
            <h2>Account Actions</h2>
          </div>
          <div className="logout-content">
            <p>Ready to sign out of your account?</p>
            <button
              onClick={handleLogout}
              className="logout-button"
            >
               Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
