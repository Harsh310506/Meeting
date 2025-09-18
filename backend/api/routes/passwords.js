const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Helper function to calculate password strength
const calculatePasswordStrength = (password) => {
  let score = 0;
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 25;
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 15;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  return Math.min(score, 100);
};

// Helper function to format password data
const formatPassword = (passwordEntry) => ({
  id: passwordEntry.id.toString(),
  title: passwordEntry.title,
  description: passwordEntry.description,
  strengthScore: passwordEntry.strength_score,
  lastChanged: passwordEntry.last_changed,
  createdAt: passwordEntry.created_at,
  updatedAt: passwordEntry.updated_at
});

// GET /api/passwords - Get all passwords for authenticated user (encrypted)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('passwords')
      .select('id, title, description, strength_score, last_changed, created_at, updated_at')
      .eq('user_id', req.user.id)
      .order('title', { ascending: true });
    
    if (error) {
      console.error('Error fetching passwords:', error);
      return res.status(500).json({ error: 'Failed to fetch passwords' });
    }
    
    const passwords = data.map(formatPassword);
    res.json(passwords);
  } catch (error) {
    console.error('Error fetching passwords:', error);
    res.status(500).json({ error: 'Failed to fetch passwords' });
  }
});

// POST /api/passwords - Create new password entry
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title, description, password
    } = req.body;
    
    if (!title || !password) {
      return res.status(400).json({ error: 'Title and password are required' });
    }
    
    // Encrypt password
    const saltRounds = 12;
    const encryptedPassword = await bcrypt.hash(password, saltRounds);
    
    // Calculate strength
    const strengthScore = calculatePasswordStrength(password);
    
    const passwordData = {
      title,
      description: description || null,
      encrypted_password: encryptedPassword,
      strength_score: strengthScore,
      last_changed: new Date().toISOString(),
      user_id: req.user.id
    };
    
    const { data, error } = await supabase
      .from('passwords')
      .insert([passwordData])
      .select('id, title, description, strength_score, last_changed, created_at, updated_at')
      .single();
    
    if (error) {
      console.error('Error creating password:', error);
      return res.status(500).json({ error: 'Failed to create password' });
    }
    
    res.status(201).json(formatPassword(data));
  } catch (error) {
    console.error('Error creating password:', error);
    res.status(500).json({ error: 'Failed to create password' });
  }
});

// PUT /api/passwords/:id - Update password entry
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title, description, password
    } = req.body;
    
    let updateData = {
      title,
      description: description || null,
      updated_at: new Date().toISOString()
    };
    
    // If password is being updated
    if (password) {
      const saltRounds = 12;
      const encryptedPassword = await bcrypt.hash(password, saltRounds);
      const strengthScore = calculatePasswordStrength(password);
      
      updateData.encrypted_password = encryptedPassword;
      updateData.strength_score = strengthScore;
      updateData.last_changed = new Date().toISOString();
    }
    
    const { data, error } = await supabase
      .from('passwords')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id, title, description, strength_score, last_changed, created_at, updated_at')
      .single();
    
    if (error) {
      console.error('Error updating password:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Password entry not found' });
      }
      return res.status(500).json({ error: 'Failed to update password' });
    }
    
    res.json(formatPassword(data));
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// DELETE /api/passwords/:id - Delete password entry
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('passwords')
      .delete()
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id')
      .single();
    
    if (error) {
      console.error('Error deleting password:', error);
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Password entry not found' });
      }
      return res.status(500).json({ error: 'Failed to delete password' });
    }
    
    res.json({ message: 'Password entry deleted successfully', id });
  } catch (error) {
    console.error('Error deleting password:', error);
    res.status(500).json({ error: 'Failed to delete password' });
  }
});

// POST /api/passwords/:id/verify - Verify password (for viewing)
router.post('/:id/verify', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    
    const { data, error } = await supabase
      .from('passwords')
      .select('encrypted_password')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Password entry not found' });
      }
      return res.status(500).json({ error: 'Failed to fetch password' });
    }
    
    const isValid = await bcrypt.compare(password, data.encrypted_password);
    
    res.json({ isValid, password: isValid ? password : null });
  } catch (error) {
    console.error('Error verifying password:', error);
    res.status(500).json({ error: 'Failed to verify password' });
  }
});

// GET /api/passwords/analytics - Get password analytics for authenticated user
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('passwords')
      .select('strength_score, last_changed')
      .eq('user_id', req.user.id);
    
    if (error) {
      console.error('Error fetching password analytics:', error);
      return res.status(500).json({ error: 'Failed to fetch password analytics' });
    }
    
    const totalPasswords = data.length;
    const averageStrength = totalPasswords > 0 
      ? Math.round(data.reduce((sum, p) => sum + p.strength_score, 0) / totalPasswords)
      : 0;
    
    const weakPasswords = data.filter(p => p.strength_score < 50).length;
    const mediumPasswords = data.filter(p => p.strength_score >= 50 && p.strength_score < 80).length;
    const strongPasswords = data.filter(p => p.strength_score >= 80).length;
    
    // Check for passwords older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const oldPasswords = data.filter(p => new Date(p.last_changed) < ninetyDaysAgo).length;
    
    res.json({
      totalPasswords,
      averageStrength,
      weakPasswords,
      mediumPasswords,
      strongPasswords,
      oldPasswords
    });
  } catch (error) {
    console.error('Error fetching password analytics:', error);
    res.status(500).json({ error: 'Failed to fetch password analytics' });
  }
});

module.exports = router;