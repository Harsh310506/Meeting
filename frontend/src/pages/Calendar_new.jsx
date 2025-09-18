import React, { useState, useEffect } from 'react';
import '../PageStyles.css';

const Calendar = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    date: '',
    startTime: '',
    endTime: '',
    type: 'meeting',
    location: '',
    reminder: false,
    allDay: false
  });

  // Fetch events on component mount
  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      // Mock events data based on calendar/task functionality
      const mockEvents = [
        {
          id: '1',
          title: 'Team Standup',
          description: 'Daily team synchronization meeting',
          date: '2025-09-18',
          startTime: '09:00',
          endTime: '09:30',
          type: 'meeting',
          location: 'Conference Room A',
          reminder: true,
          allDay: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '2',
          title: 'Project Review',
          description: 'Quarterly project review with stakeholders',
          date: '2025-09-19',
          startTime: '14:00',
          endTime: '15:30',
          type: 'meeting',
          location: 'Main Conference Room',
          reminder: true,
          allDay: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '3',
          title: 'Client Presentation',
          description: 'Present Meeting Monitor demo to client',
          date: '2025-09-20',
          startTime: '10:30',
          endTime: '12:00',
          type: 'presentation',
          location: 'Client Office',
          reminder: true,
          allDay: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: '4',
          title: 'Company Holiday',
          description: 'National Holiday - Office Closed',
          date: '2025-09-21',
          startTime: '',
          endTime: '',
          type: 'holiday',
          location: '',
          reminder: false,
          allDay: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      setEvents(mockEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        // Update existing event
        const updatedEvent = {
          ...eventForm,
          id: editingEvent.id,
          updatedAt: new Date().toISOString()
        };
        
        setEvents(prev => prev.map(event => 
          event.id === editingEvent.id ? updatedEvent : event
        ));
        setEditingEvent(null);
      } else {
        // Create new event
        const newEvent = {
          ...eventForm,
          id: Date.now().toString(),
          date: selectedDate || eventForm.date,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        setEvents(prev => [...prev, newEvent]);
      }
      
      // Reset form
      setEventForm({
        title: '',
        description: '',
        date: '',
        startTime: '',
        endTime: '',
        type: 'meeting',
        location: '',
        reminder: false,
        allDay: false
      });
      setIsAddDialogOpen(false);
      setSelectedDate(null);
    } catch (error) {
      console.error('Error saving event:', error);
    }
  };

  const handleEdit = (event) => {
    setEventForm(event);
    setEditingEvent(event);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      try {
        setEvents(prev => prev.filter(event => event.id !== eventId));
      } catch (error) {
        console.error('Error deleting event:', error);
      }
    }
  };

  const handleDateClick = (date) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), date);
    const formattedDate = clickedDate.toISOString().split('T')[0];
    setSelectedDate(formattedDate);
    setEventForm(prev => ({ ...prev, date: formattedDate }));
    setIsAddDialogOpen(true);
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getTypeColor = (type) => {
    switch (type) {
      case 'meeting': return '#3b82f6';
      case 'presentation': return '#8b5cf6';
      case 'deadline': return '#ef4444';
      case 'holiday': return '#10b981';
      case 'personal': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const getEventsForDate = (date) => {
    const dateString = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateString);
  };

  const formatTime = (time) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">📅 Calendar</h1>
          <p className="page-subtitle">Loading your calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">📅 Calendar</h1>
        <p className="page-subtitle">Schedule meetings and keep track of your important events</p>
      </div>

      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#374151' }}>
            {events.length} events this month
          </span>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setIsAddDialogOpen(true)}
        >
          ➕ Add New Event
        </button>
      </div>

      {/* Calendar Grid */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => navigateMonth(-1)}
              style={{ fontSize: '1.2rem', padding: '8px 16px' }}
            >
              ‹
            </button>
            <h3 className="card-title">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <button 
              className="btn btn-secondary"
              onClick={() => navigateMonth(1)}
              style={{ fontSize: '1.2rem', padding: '8px 16px' }}
            >
              ›
            </button>
          </div>
        </div>
        
        <div className="card-content">
          {/* Days of week header */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '1px',
            marginBottom: '10px',
            background: '#e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div 
                key={day} 
                style={{ 
                  padding: '12px 8px', 
                  background: '#f3f4f6',
                  textAlign: 'center',
                  fontWeight: '600',
                  color: '#374151'
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(7, 1fr)', 
            gap: '1px',
            background: '#e5e7eb',
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {getDaysInMonth(currentDate).map((date, index) => {
              const dayEvents = getEventsForDate(date);
              const isCurrentMonthDay = isCurrentMonth(date);
              const isTodayDate = isToday(date);
              
              return (
                <div 
                  key={index}
                  onClick={() => isCurrentMonthDay && handleDateClick(date.getDate())}
                  style={{
                    minHeight: '80px',
                    background: isCurrentMonthDay ? 'white' : '#f9fafb',
                    padding: '8px',
                    cursor: isCurrentMonthDay ? 'pointer' : 'default',
                    opacity: isCurrentMonthDay ? 1 : 0.5,
                    border: isTodayDate ? '2px solid #3b82f6' : 'none',
                    position: 'relative'
                  }}
                >
                  <div style={{ 
                    fontWeight: isTodayDate ? 'bold' : 'normal',
                    color: isTodayDate ? '#3b82f6' : '#374151',
                    marginBottom: '4px'
                  }}>
                    {date.getDate()}
                  </div>
                  
                  {dayEvents.slice(0, 2).map(event => (
                    <div 
                      key={event.id}
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 4px',
                        margin: '1px 0',
                        borderRadius: '3px',
                        background: getTypeColor(event.type) + '20',
                        color: getTypeColor(event.type),
                        fontWeight: '500',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                      title={`${event.title} - ${formatTime(event.startTime)}`}
                    >
                      {event.allDay ? event.title : `${formatTime(event.startTime)} ${event.title}`}
                    </div>
                  ))}
                  
                  {dayEvents.length > 2 && (
                    <div style={{ 
                      fontSize: '0.7rem', 
                      color: '#6b7280',
                      fontWeight: '500'
                    }}>
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Upcoming Events</h3>
        </div>
        <div className="card-content">
          {events.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
              <p>No events scheduled</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {events
                .sort((a, b) => new Date(a.date + ' ' + (a.startTime || '00:00')) - new Date(b.date + ' ' + (b.startTime || '00:00')))
                .map(event => (
                  <div 
                    key={event.id}
                    style={{
                      padding: '16px',
                      border: `2px solid ${getTypeColor(event.type)}20`,
                      borderLeft: `4px solid ${getTypeColor(event.type)}`,
                      borderRadius: '8px',
                      background: 'white'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <h4 style={{ margin: 0, color: '#1f2937' }}>{event.title}</h4>
                        <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '0.9rem' }}>
                          {new Date(event.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                          })}
                          {!event.allDay && event.startTime && (
                            <span> • {formatTime(event.startTime)} 
                              {event.endTime && ` - ${formatTime(event.endTime)}`}
                            </span>
                          )}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => handleEdit(event)}
                          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                        >
                          ✏️ Edit
                        </button>
                        <button 
                          className="btn btn-danger"
                          onClick={() => handleDelete(event.id)}
                          style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    
                    {event.description && (
                      <p style={{ margin: '8px 0', color: '#374151', fontSize: '0.9rem' }}>
                        {event.description}
                      </p>
                    )}
                    
                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#6b7280', marginTop: '8px' }}>
                      <span 
                        style={{ 
                          padding: '2px 8px', 
                          borderRadius: '12px',
                          background: getTypeColor(event.type) + '20',
                          color: getTypeColor(event.type),
                          fontWeight: '500'
                        }}
                      >
                        {event.type}
                      </span>
                      
                      {event.location && (
                        <span>📍 {event.location}</span>
                      )}
                      
                      {event.reminder && (
                        <span>🔔 Reminder set</span>
                      )}
                      
                      {event.allDay && (
                        <span>🌅 All day</span>
                      )}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Event Modal */}
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
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginBottom: '20px', color: '#1f2937' }}>
              {editingEvent ? 'Edit Event' : 'Add New Event'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  className="form-input"
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                  rows="3"
                />
              </div>
              
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={eventForm.date}
                  onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={eventForm.allDay}
                    onChange={(e) => setEventForm(prev => ({ ...prev, allDay: e.target.checked }))}
                  />
                  <span>All Day Event</span>
                </label>
              </div>
              
              {!eventForm.allDay && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={eventForm.startTime}
                      onChange={(e) => setEventForm(prev => ({ ...prev, startTime: e.target.value }))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input
                      type="time"
                      className="form-input"
                      value={eventForm.endTime}
                      onChange={(e) => setEventForm(prev => ({ ...prev, endTime: e.target.value }))}
                    />
                  </div>
                </div>
              )}
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={eventForm.type}
                    onChange={(e) => setEventForm(prev => ({ ...prev, type: e.target.value }))}
                  >
                    <option value="meeting">Meeting</option>
                    <option value="presentation">Presentation</option>
                    <option value="deadline">Deadline</option>
                    <option value="holiday">Holiday</option>
                    <option value="personal">Personal</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-input"
                    value={eventForm.location}
                    onChange={(e) => setEventForm(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="Conference Room, Address..."
                  />
                </div>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={eventForm.reminder}
                    onChange={(e) => setEventForm(prev => ({ ...prev, reminder: e.target.checked }))}
                  />
                  <span>🔔 Set Reminder</span>
                </label>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setIsAddDialogOpen(false);
                    setEditingEvent(null);
                    setSelectedDate(null);
                    setEventForm({
                      title: '',
                      description: '',
                      date: '',
                      startTime: '',
                      endTime: '',
                      type: 'meeting',
                      location: '',
                      reminder: false,
                      allDay: false
                    });
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEvent ? 'Update Event' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;