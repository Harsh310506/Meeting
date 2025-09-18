import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../PageStyles.css';

const Notes = () => {
  const { apiRequest } = useAuth();
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [noteForm, setNoteForm] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: '',
    isBookmarked: false,
    expiresAt: '',
    priority: 'medium'
  });

  // Categories based on StudentTasker notes manager
  const categories = [
    { value: 'all', label: 'All Notes', color: '#6b7280' },
    { value: 'general', label: 'General', color: '#6b7280' },
    { value: 'meeting', label: 'Meeting Notes', color: '#3b82f6' },
    { value: 'research', label: 'Research', color: '#10b981' },
    { value: 'ideas', label: 'Ideas', color: '#8b5cf6' },
    { value: 'todo', label: 'To-Do', color: '#f59e0b' },
    { value: 'personal', label: 'Personal', color: '#ef4444' },
    { value: 'project', label: 'Project', color: '#06b6d4' }
  ];

  const priorities = [
    { value: 'low', label: 'Low', color: '#10b981' },
    { value: 'medium', label: 'Medium', color: '#f59e0b' },
    { value: 'high', label: 'High', color: '#ef4444' }
  ];

  // Fetch notes on component mount
  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest('/notes');
      setNotes(data);
    } catch (error) {
      console.error('Error fetching notes:', error);
      setNotes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingNote) {
        // Update existing note
        const updatedNote = await apiRequest(`/notes/${editingNote.id}`, {
          method: 'PUT',
          body: JSON.stringify(noteForm),
        });
        setNotes(prev => prev.map(note => 
          note.id === editingNote.id ? updatedNote : note
        ));
        setEditingNote(null);
      } else {
        // Create new note
        const newNote = await apiRequest('/notes', {
          method: 'POST',
          body: JSON.stringify(noteForm),
        });
        setNotes(prev => [newNote, ...prev]);
      }
      
      // Reset form
      setNoteForm({
        title: '',
        content: '',
        category: 'general',
        tags: '',
        isBookmarked: false,
        expiresAt: '',
        priority: 'medium'
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error saving note:', error);
      alert('Failed to save note. Please try again.');
    }
  };

  const handleEdit = (note) => {
    setNoteForm({
      title: note.title,
      content: note.content,
      category: note.category,
      tags: note.tags || '',
      isBookmarked: note.isBookmarked || false,
      expiresAt: note.expiresAt || '',
      priority: note.priority || 'medium'
    });
    setEditingNote(note);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (noteId) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await apiRequest(`/notes/${noteId}`, {
          method: 'DELETE',
        });
        setNotes(prev => prev.filter(note => note.id !== noteId));
      } catch (error) {
        console.error('Error deleting note:', error);
        alert('Failed to delete note. Please try again.');
      }
    }
  };

  const toggleBookmark = (noteId) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId 
        ? { ...note, isBookmarked: !note.isBookmarked, updatedAt: new Date().toISOString() }
        : note
    ));
  };

  const getCategoryColor = (category) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.color : '#6b7280';
  };

  const getPriorityColor = (priority) => {
    const prio = priorities.find(p => p.value === priority);
    return prio ? prio.color : '#f59e0b';
  };

  const filteredNotes = notes.filter(note => {
    const matchesCategory = selectedCategory === 'all' || note.category === selectedCategory;
    const matchesSearch = note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (note.tags && note.tags.toLowerCase().includes(searchTerm.toLowerCase()));
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
    return diffDays <= 7 && diffDays > 0;
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">📝 Notes</h1>
          <p className="page-subtitle">Loading your notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">📝 Notes</h1>
        <p className="page-subtitle">Organize your thoughts, ideas, and meeting notes efficiently</p>
      </div>

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
          className="btn btn-primary"
          onClick={() => setIsAddDialogOpen(true)}
        >
          ➕ New Note
        </button>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ minWidth: '150px' }}
          >
            {categories.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>
          
          <input
            type="text"
            className="form-input"
            placeholder="Search notes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ minWidth: '200px' }}
          />
        </div>
        
        <div style={{ marginLeft: 'auto', color: '#6b7280', fontSize: '0.9rem' }}>
          {filteredNotes.length} of {notes.length} notes
        </div>
      </div>

      {/* Notes Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
        gap: '20px',
        marginBottom: '20px'
      }}>
        {filteredNotes.length === 0 ? (
          <div style={{ 
            gridColumn: '1 / -1',
            textAlign: 'center', 
            padding: '60px 20px', 
            color: '#6b7280',
            background: 'white',
            borderRadius: '12px',
            border: '2px dashed #d1d5db'
          }}>
            <h3 style={{ margin: '0 0 8px 0' }}>No notes found</h3>
            <p style={{ margin: 0 }}>
              {searchTerm || selectedCategory !== 'all' 
                ? 'Try adjusting your search or filter criteria' 
                : 'Create your first note to get started'
              }
            </p>
          </div>
        ) : (
          filteredNotes.map(note => (
            <div 
              key={note.id}
              className="card"
              style={{
                borderLeft: `4px solid ${getCategoryColor(note.category)}`,
                opacity: isExpired(note.expiresAt) ? 0.6 : 1,
                position: 'relative'
              }}
            >
              <div className="card-content">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.1rem', lineHeight: '1.4' }}>
                    {note.title}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <button
                      onClick={() => toggleBookmark(note.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: note.isBookmarked ? '#f59e0b' : '#d1d5db'
                      }}
                      title={note.isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
                    >
                      {note.isBookmarked ? '⭐' : '☆'}
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div style={{
                  background: '#f9fafb',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '12px',
                  maxHeight: '120px',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <pre style={{
                    margin: 0,
                    fontFamily: 'inherit',
                    fontSize: '0.9rem',
                    lineHeight: '1.5',
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {note.content.length > 200 ? note.content.substring(0, 200) + '...' : note.content}
                  </pre>
                  {note.content.length > 200 && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '20px',
                      background: 'linear-gradient(transparent, #f9fafb)'
                    }} />
                  )}
                </div>

                {/* Tags */}
                {note.tags && (
                  <div style={{ marginBottom: '12px' }}>
                    {note.tags.split(',').map((tag, index) => (
                      <span
                        key={index}
                        style={{
                          display: 'inline-block',
                          background: '#e5e7eb',
                          color: '#374151',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
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
                        background: getCategoryColor(note.category) + '20',
                        color: getCategoryColor(note.category),
                        fontWeight: '500'
                      }}
                    >
                      {categories.find(c => c.value === note.category)?.label}
                    </span>
                    
                    <span 
                      style={{ 
                        padding: '2px 8px', 
                        borderRadius: '12px',
                        background: getPriorityColor(note.priority) + '20',
                        color: getPriorityColor(note.priority),
                        fontWeight: '500'
                      }}
                    >
                      {note.priority}
                    </span>
                  </div>
                </div>

                {/* Expiration */}
                {note.expiresAt && (
                  <div style={{ marginBottom: '12px' }}>
                    <span style={{
                      fontSize: '0.8rem',
                      color: isExpired(note.expiresAt) ? '#ef4444' : isExpiringSoon(note.expiresAt) ? '#f59e0b' : '#6b7280',
                      fontWeight: '500'
                    }}>
                      {isExpired(note.expiresAt) ? '⚠️ Expired' : isExpiringSoon(note.expiresAt) ? '⏰ Expires soon' : '📅 Expires'}: {formatDate(note.expiresAt)}
                    </span>
                  </div>
                )}

                {/* Timestamps */}
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '12px' }}>
                  <div>Created: {formatDate(note.createdAt)}</div>
                  {note.updatedAt !== note.createdAt && (
                    <div>Updated: {formatDate(note.updatedAt)}</div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleEdit(note)}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    className="btn btn-danger"
                    onClick={() => handleDelete(note.id)}
                    style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add/Edit Note Modal */}
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
              {editingNote ? 'Edit Note' : 'Create New Note'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={noteForm.title}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                  placeholder="Enter note title..."
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Content *</label>
                <textarea
                  className="form-textarea"
                  value={noteForm.content}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, content: e.target.value }))}
                  required
                  rows="8"
                  placeholder="Write your note content here..."
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={noteForm.category}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {categories.filter(c => c.value !== 'all').map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={noteForm.priority}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, priority: e.target.value }))}
                  >
                    {priorities.map(prio => (
                      <option key={prio.value} value={prio.value}>{prio.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="form-group">
                <label className="form-label">Tags (comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={noteForm.tags}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="meeting, ideas, research..."
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Expires On (optional)</label>
                <input
                  type="date"
                  className="form-input"
                  value={noteForm.expiresAt}
                  onChange={(e) => setNoteForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={noteForm.isBookmarked}
                    onChange={(e) => setNoteForm(prev => ({ ...prev, isBookmarked: e.target.checked }))}
                  />
                  <span>⭐ Bookmark this note</span>
                </label>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingNote(null);
                    setNoteForm({
                      title: '',
                      content: '',
                      category: 'general',
                      tags: '',
                      isBookmarked: false,
                      expiresAt: '',
                      priority: 'medium'
                    });
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingNote ? 'Update Note' : 'Create Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notes;