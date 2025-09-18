import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../PageStyles.css';

const Password = () => {
  const { apiRequest } = useAuth();
  const [passwords, setPasswords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingPassword, setEditingPassword] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPasswords, setShowPasswords] = useState({});
  const [passwordForm, setPasswordForm] = useState({
    name: '',
    username: '',
    password: '',
    url: '',
    category: 'general',
    notes: '',
    strength: 'medium',
    tags: '',
    isFavorite: false,
    expiresAt: ''
  });

  // Categories based on StudentTasker password manager
  const categories = [
    { value: 'all', label: 'All Passwords', color: '#6b7280', icon: '🔐' },
    { value: 'general', label: 'General', color: '#6b7280', icon: '🔐' },
    { value: 'development', label: 'Development', color: '#3b82f6', icon: '💻' },
    { value: 'meetings', label: 'Meetings', color: '#10b981', icon: '🎙️' },
    { value: 'social', label: 'Social Media', color: '#f59e0b', icon: '📱' },
    { value: 'finance', label: 'Finance', color: '#ef4444', icon: '💳' },
    { value: 'work', label: 'Work', color: '#8b5cf6', icon: '💼' },
    { value: 'personal', label: 'Personal', color: '#06b6d4', icon: '👤' }
  ];

  const strengthLevels = [
    { value: 'weak', label: 'Weak', color: '#ef4444' },
    { value: 'medium', label: 'Medium', color: '#f59e0b' },
    { value: 'strong', label: 'Strong', color: '#10b981' }
  ];

  // Fetch passwords on component mount
  useEffect(() => {
    fetchPasswords();
  }, []);

  const fetchPasswords = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest('/passwords');
      setPasswords(data);
    } catch (error) {
      console.error('Error fetching passwords:', error);
      setPasswords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPassword) {
        // Update existing password
        const updatedPassword = await apiRequest(`/passwords/${editingPassword.id}`, {
          method: 'PUT',
          body: JSON.stringify(passwordForm),
        });
        setPasswords(prev => prev.map(password => 
          password.id === editingPassword.id ? updatedPassword : password
        ));
        setEditingPassword(null);
      } else {
        // Create new password
        const newPassword = await apiRequest('/passwords', {
          method: 'POST',
          body: JSON.stringify(passwordForm),
        });
        setPasswords(prev => [newPassword, ...prev]);
      }
      
      // Reset form
      setPasswordForm({
        name: '',
        username: '',
        password: '',
        url: '',
        category: 'general',
        notes: '',
        strength: 'medium',
        tags: '',
        isFavorite: false,
        expiresAt: ''
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error saving password:', error);
      alert('Failed to save password. Please try again.');
    }
  };

  const handleEdit = (password) => {
    setPasswordForm({
      name: password.name,
      username: password.username,
      password: password.password,
      url: password.url || '',
      category: password.category,
      notes: password.notes || '',
      strength: password.strength || 'medium',
      tags: password.tags || '',
      isFavorite: password.isFavorite || false,
      expiresAt: password.expiresAt || ''
    });
    setEditingPassword(password);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (passwordId) => {
    if (window.confirm('Are you sure you want to delete this password? This action cannot be undone.')) {
      try {
        await apiRequest(`/passwords/${passwordId}`, {
          method: 'DELETE',
        });
        setPasswords(prev => prev.filter(password => password.id !== passwordId));
      } catch (error) {
        console.error('Error deleting password:', error);
        alert('Failed to delete password. Please try again.');
      }
    }
  };

  const toggleFavorite = (passwordId) => {
    setPasswords(prev => prev.map(password => 
      password.id === passwordId 
        ? { ...password, isFavorite: !password.isFavorite, updatedAt: new Date().toISOString() }
        : password
    ));
  };

  const togglePasswordVisibility = (passwordId) => {
    setShowPasswords(prev => ({
      ...prev,
      [passwordId]: !prev[passwordId]
    }));
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
      console.log(`${type} copied to clipboard`);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const getCategoryData = (category) => {
    return categories.find(c => c.value === category) || categories[1];
  };

  const getStrengthColor = (strength) => {
    const level = strengthLevels.find(s => s.value === strength);
    return level ? level.color : '#f59e0b';
  };

  const generatePassword = (length = 16) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const calculateStrength = (password) => {
    if (password.length < 8) return 'weak';
    if (password.length >= 12 && /(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/.test(password)) return 'strong';
    return 'medium';
  };

  const filteredPasswords = passwords.filter(password => {
    const matchesCategory = selectedCategory === 'all' || password.category === selectedCategory;
    const matchesSearch = password.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         password.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (password.url && password.url.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (password.tags && password.tags.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const isExpiringSoon = (expiresAt) => {
    if (!expiresAt) return false;
    const expireDate = new Date(expiresAt);
    const today = new Date();
    const diffTime = expireDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 30 && diffDays > 0;
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">🔐 Password Manager</h1>
          <p className="page-subtitle">Loading your secure vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">🔐 Password Manager</h1>
        <p className="page-subtitle">Securely store and manage your passwords with advanced encryption</p>
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
          className="btn btn-primary"
          onClick={() => setIsAddDialogOpen(true)}
        >
          ➕ Add Password
        </button>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>
                {cat.icon} {cat.label}
              </option>
            ))}
          </select>
          
          <input
            type="text"
            className="form-input"
            placeholder="Search passwords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: '200px' }}
          />
        </div>
        
        <div style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.9rem' }}>
          {filteredPasswords.length} of {passwords.length} passwords
        </div>
      </div>

      {/* Security Stats */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
        gap: '16px',
        marginBottom: '20px'
      }}>
        <div className="card" style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
            {passwords.filter(p => p.strength === 'strong').length}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Strong</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
            {passwords.filter(p => p.strength === 'medium').length}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Medium</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>
            {passwords.filter(p => p.strength === 'weak').length}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Weak</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>
            {passwords.filter(p => isExpiringSoon(p.expiresAt) || isExpired(p.expiresAt)).length}
          </div>
          <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Expiring</div>
        </div>
      </div>

      {/* Passwords Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
        gap: '20px',
        marginBottom: '20px'
      }}>
        {filteredPasswords.length === 0 ? (
          <div style={{ 
            gridColumn: '1 / -1',
            textAlign: 'center', 
            padding: '60px 20px', 
            color: '#6b7280',
            background: 'white',
            borderRadius: '12px',
            border: '2px dashed #d1d5db'
          }}>
            <h3 style={{ margin: '0 0 8px 0' }}>No passwords found</h3>
            <p style={{ margin: 0 }}>
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filter criteria' 
                : 'Add your first password to secure your vault'
              }
            </p>
          </div>
        ) : (
          filteredPasswords.map(password => {
            const categoryData = getCategoryData(password.category);
            return (
              <div 
                key={password.id}
                className="card"
                style={{
                  borderLeft: `4px solid ${categoryData.color}`,
                  opacity: isExpired(password.expiresAt) ? 0.7 : 1,
                  position: 'relative'
                }}
              >
                <div className="card-content">
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{categoryData.icon}</span>
                      <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.1rem' }}>
                        {password.name}
                      </h3>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => toggleFavorite(password.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.2rem',
                          color: password.isFavorite ? '#f59e0b' : '#d1d5db'
                        }}
                        title={password.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        {password.isFavorite ? '⭐' : '☆'}
                      </button>
                    </div>
                  </div>

                  {/* Username */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>Username:</span>
                      <button
                        onClick={() => copyToClipboard(password.username, 'Username')}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: '#3b82f6',
                          fontSize: '0.8rem'
                        }}
                        title="Copy username"
                      >
                        📋
                      </button>
                    </div>
                    <div style={{ 
                      background: '#f3f4f6', 
                      padding: '8px 12px', 
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      color: '#374151'
                    }}>
                      {password.username}
                    </div>
                  </div>

                  {/* Password */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>Password:</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => togglePasswordVisibility(password.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#3b82f6',
                            fontSize: '0.8rem'
                          }}
                          title={showPasswords[password.id] ? 'Hide password' : 'Show password'}
                        >
                          {showPasswords[password.id] ? '🙈' : '👁️'}
                        </button>
                        <button
                          onClick={() => copyToClipboard(password.password, 'Password')}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#3b82f6',
                            fontSize: '0.8rem'
                          }}
                          title="Copy password"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                    <div style={{ 
                      background: '#f3f4f6', 
                      padding: '8px 12px', 
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      color: '#374151',
                      letterSpacing: '1px'
                    }}>
                      {showPasswords[password.id] ? password.password : '•'.repeat(password.password.length)}
                    </div>
                  </div>

                  {/* URL */}
                  {password.url && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>URL:</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => copyToClipboard(password.url, 'URL')}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: '#3b82f6',
                              fontSize: '0.8rem'
                            }}
                            title="Copy URL"
                          >
                            📋
                          </button>
                          <a
                            href={password.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#3b82f6',
                              fontSize: '0.8rem',
                              textDecoration: 'none'
                            }}
                            title="Open URL"
                          >
                            🔗
                          </a>
                        </div>
                      </div>
                      <div style={{ 
                        background: '#f3f4f6', 
                        padding: '8px 12px', 
                        borderRadius: '6px',
                        fontSize: '0.9rem',
                        color: '#374151',
                        wordBreak: 'break-all'
                      }}>
                        {password.url}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {password.notes && (
                    <div style={{ marginBottom: '12px' }}>
                      <span style={{ fontSize: '0.9rem', color: '#6b7280', fontWeight: '500' }}>Notes:</span>
                      <div style={{ 
                        background: '#f9fafb', 
                        padding: '8px 12px', 
                        borderRadius: '6px',
                        fontSize: '0.85rem',
                        color: '#374151',
                        marginTop: '4px',
                        maxHeight: '60px',
                        overflow: 'hidden'
                      }}>
                        {password.notes.length > 100 ? password.notes.substring(0, 100) + '...' : password.notes}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {password.tags && (
                    <div style={{ marginBottom: '12px' }}>
                      {password.tags.split(',').map((tag, index) => (
                        <span
                          key={index}
                          style={{
                            display: 'inline-block',
                            background: '#e5e7eb',
                            color: '#374151',
                            padding: '2px 6px',
                            borderRadius: '10px',
                            fontSize: '0.7rem',
                            fontWeight: '500',
                            marginRight: '6px',
                            marginBottom: '4px'
                          }}
                        >
                          #{tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metadata */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', fontSize: '0.8rem', color: '#6b7280' }}>
                      <span 
                        style={{ 
                          padding: '2px 8px', 
                          borderRadius: '12px',
                          background: categoryData.color + '20',
                          color: categoryData.color,
                          fontWeight: '500'
                        }}
                      >
                        {categoryData.label}
                      </span>
                      
                      <span 
                        style={{ 
                          padding: '2px 8px', 
                          borderRadius: '12px',
                          background: getStrengthColor(password.strength) + '20',
                          color: getStrengthColor(password.strength),
                          fontWeight: '500'
                        }}
                      >
                        {strengthLevels.find(s => s.value === password.strength)?.label}
                      </span>
                    </div>
                  </div>

                  {/* Expiration */}
                  {password.expiresAt && (
                    <div style={{ marginBottom: '12px' }}>
                      <span style={{
                        fontSize: '0.8rem',
                        color: isExpired(password.expiresAt) ? '#ef4444' : isExpiringSoon(password.expiresAt) ? '#f59e0b' : '#6b7280',
                        fontWeight: '500'
                      }}>
                        {isExpired(password.expiresAt) ? '⚠️ Expired' : isExpiringSoon(password.expiresAt) ? '⏰ Expires soon' : '📅 Expires'}: {formatDate(password.expiresAt)}
                      </span>
                    </div>
                  )}

                  {/* Timestamps */}
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '12px' }}>
                    <div>Last used: {formatDate(password.lastUsed)}</div>
                    <div>Created: {formatDate(password.createdAt)}</div>
                    {password.updatedAt !== password.createdAt && (
                      <div>Updated: {formatDate(password.updatedAt)}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => handleEdit(password)}
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      ✏️ Edit
                    </button>
                    <button 
                      className="btn btn-danger"
                      onClick={() => handleDelete(password.id)}
                      style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Password Modal */}
      {isAddDialogOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>
              {editingPassword ? 'Edit Password' : 'Add New Password'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Service Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={passwordForm.name}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="Enter service name..."
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={passwordForm.username}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, username: e.target.value }))}
                    required
                    placeholder="Enter username or email..."
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Password *</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      value={passwordForm.password}
                      onChange={(e) => {
                        const newPassword = e.target.value;
                        setPasswordForm(prev => ({ 
                          ...prev, 
                          password: newPassword,
                          strength: calculateStrength(newPassword)
                        }));
                      }}
                      required
                      placeholder="Enter password..."
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        const generated = generatePassword();
                        setPasswordForm(prev => ({ 
                          ...prev, 
                          password: generated,
                          strength: calculateStrength(generated)
                        }));
                      }}
                      style={{ fontSize: '0.8rem', padding: '8px 12px', whiteSpace: 'nowrap' }}
                    >
                      🎲 Generate
                    </button>
                  </div>
                  {passwordForm.password && (
                    <div style={{ 
                      marginTop: '4px', 
                      fontSize: '0.8rem',
                      color: getStrengthColor(passwordForm.strength),
                      fontWeight: '500'
                    }}>
                      Strength: {strengthLevels.find(s => s.value === passwordForm.strength)?.label}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">URL</label>
                <input
                  type="url"
                  className="form-input"
                  value={passwordForm.url}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, url: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={passwordForm.category}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {categories.filter(c => c.value !== 'all').map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Expires On (optional)</label>
                  <input
                    type="date"
                    className="form-input"
                    value={passwordForm.expiresAt}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={passwordForm.notes}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows="3"
                  placeholder="Additional notes about this password..."
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Tags (comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={passwordForm.tags}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="work, important, backup..."
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={passwordForm.isFavorite}
                    onChange={(e) => setPasswordForm(prev => ({ ...prev, isFavorite: e.target.checked }))}
                  />
                  <span>⭐ Add to favorites</span>
                </label>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingPassword(null);
                    setPasswordForm({
                      name: '',
                      username: '',
                      password: '',
                      url: '',
                      category: 'general',
                      notes: '',
                      strength: 'medium',
                      tags: '',
                      isFavorite: false,
                      expiresAt: ''
                    });
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingPassword ? 'Update Password' : 'Save Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Password;