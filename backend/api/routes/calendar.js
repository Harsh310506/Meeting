const express = require('express');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function to format calendar event data
const formatEvent = (event) => ({
  id: event.id.toString(),
  title: event.title,
  description: event.description,
  eventDate: event.event_date,
  startTime: event.start_time,
  endTime: event.end_time,
  location: event.location,
  category: event.category,
  priority: event.priority,
  reminderMinutes: event.reminder_minutes,
  isRecurring: event.is_recurring,
  recurrencePattern: event.recurrence_pattern,
  createdAt: event.created_at,
  updatedAt: event.updated_at
});

// GET /api/calendar - Get all calendar events
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error('Error fetching calendar events:', error);
      return res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
    
    const events = data.map(formatEvent);
    res.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// POST /api/calendar - Create new calendar event
router.post('/', async (req, res) => {
  try {
    const {
      title, description, eventDate, startTime, endTime, location,
      category, priority, reminderMinutes, isRecurring, recurrencePattern
    } = req.body;
    
    if (!title || !eventDate) {
      return res.status(400).json({ error: 'Title and event date are required' });
    }
    
    const eventData = {
      title,
      description,
      event_date: eventDate,
      start_time: startTime || null,
      end_time: endTime || null,
      location: location || null,
      category: category || 'meeting',
      priority: priority || 'medium',
      reminder_minutes: reminderMinutes || 15,
      is_recurring: isRecurring || false,
      recurrence_pattern: recurrencePattern || null
    };
    
    const { data, error } = await supabase
      .from('calendar_events')
      .insert([eventData])
      .select()
      .single();
    
    if (error) {
      console.error('Error creating calendar event:', error);
      return res.status(500).json({ error: 'Failed to create calendar event' });
    }
    
    res.status(201).json(formatEvent(data));
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// PUT /api/calendar/:id - Update calendar event
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, eventDate, startTime, endTime, location,
      category, priority, reminderMinutes, isRecurring, recurrencePattern
    } = req.body;
    
    const updateData = {
      title,
      description,
      event_date: eventDate,
      start_time: startTime || null,
      end_time: endTime || null,
      location: location || null,
      category,
      priority,
      reminder_minutes: reminderMinutes,
      is_recurring: isRecurring,
      recurrence_pattern: recurrencePattern || null,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating calendar event:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Calendar event not found' });
      }
      return res.status(500).json({ error: 'Failed to update calendar event' });
    }
    
    res.json(formatEvent(data));
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// DELETE /api/calendar/:id - Delete calendar event
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    
    if (error) {
      console.error('Error deleting calendar event:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Calendar event not found' });
      }
      return res.status(500).json({ error: 'Failed to delete calendar event' });
    }
    
    res.json({ message: 'Calendar event deleted successfully', id });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

// GET /api/calendar/month/:year/:month - Get events for specific month
router.get('/month/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endDate = `${year}-${month.padStart(2, '0')}-31`;
    
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('event_date', startDate)
      .lte('event_date', endDate)
      .order('event_date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error('Error fetching monthly events:', error);
      return res.status(500).json({ error: 'Failed to fetch monthly events' });
    }
    
    const events = data.map(formatEvent);
    res.json(events);
  } catch (error) {
    console.error('Error fetching monthly events:', error);
    res.status(500).json({ error: 'Failed to fetch monthly events' });
  }
});

module.exports = router;