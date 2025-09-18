const express = require('express');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// Helper function to format task data
const formatTask = (task) => ({
  id: task.id,
  title: task.title,
  description: task.description,
  dueDate: task.due_date,
  dueTime: task.due_time,
  priority: task.priority,
  category: task.category,
  completionStatus: task.completion_status,
  isOverallTask: task.is_overall_task,
  emailReminder: task.email_reminder,
  pushReminder: task.push_reminder,
  createdAt: task.created_at,
  updatedAt: task.updated_at
});

// GET /api/tasks - Get all tasks for authenticated user
router.get('/', async (req, res) => {
  try {
    console.log('📋 Fetching tasks for user:', req.user.id);
    
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('❌ Error fetching tasks:', error);
      return res.status(500).json({ error: 'Failed to fetch tasks' });
    }
    
    console.log('✅ Raw tasks from database:', data);
    const tasks = data.map(formatTask);
    console.log('✅ Formatted tasks:', tasks);
    
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks - Create new task
router.post('/', async (req, res) => {
  try {
    console.log('📝 Creating new task for user:', req.user.id);
    console.log('📝 Request body:', req.body);
    
    const {
      title, description, dueDate, dueTime, priority, category,
      completionStatus, isOverallTask, emailReminder, pushReminder
    } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    const taskData = {
      user_id: req.user.id,
      title,
      description,
      due_date: dueDate || null,
      due_time: dueTime || null,
      priority: priority || 'medium',
      category: category || 'assignment',
      completion_status: completionStatus || 'pending',
      is_overall_task: isOverallTask || false,
      email_reminder: emailReminder || false,
      push_reminder: pushReminder || false
    };
    
    console.log('📝 Task data to insert:', taskData);
    
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single();
    
    if (error) {
      console.error('❌ Error creating task:', error);
      return res.status(500).json({ error: 'Failed to create task' });
    }
    
    console.log('✅ Task created successfully:', data);
    const formattedTask = formatTask(data);
    console.log('✅ Formatted task:', formattedTask);
    
    res.status(201).json(formattedTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id - Update task
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, dueDate, dueTime, priority, category,
      completionStatus, isOverallTask, emailReminder, pushReminder
    } = req.body;
    
    const updateData = {
      title,
      description,
      due_date: dueDate || null,
      due_time: dueTime || null,
      priority,
      category,
      completion_status: completionStatus,
      is_overall_task: isOverallTask,
      email_reminder: emailReminder,
      push_reminder: pushReminder,
      updated_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('tasks')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.id) // Ensure user can only update their own tasks
      .select()
      .single();
    
    if (error) {
      console.error('Error updating task:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(500).json({ error: 'Failed to update task' });
    }
    
    res.json(formatTask(data));
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id) // Ensure user can only delete their own tasks
      .select('id')
      .single();
    
    if (error) {
      console.error('Error deleting task:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(500).json({ error: 'Failed to delete task' });
    }
    
    res.json({ message: 'Task deleted successfully', id });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// PATCH /api/tasks/:id/status - Update task status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { completionStatus } = req.body;
    
    const { data, error } = await supabase
      .from('tasks')
      .update({ 
        completion_status: completionStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', req.user.id) // Ensure user can only update their own tasks
      .select('id, completion_status, updated_at')
      .single();
    
    if (error) {
      console.error('Error updating task status:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Task not found' });
      }
      return res.status(500).json({ error: 'Failed to update task status' });
    }
    
    res.json({
      id: data.id,
      completionStatus: data.completion_status,
      updatedAt: data.updated_at
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

module.exports = router;