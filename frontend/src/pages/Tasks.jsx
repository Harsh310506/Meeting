import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../PageStyles.css';

const Tasks = () => {
  const { apiRequest } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '',
    priority: 'medium',
    category: 'assignment',
    completionStatus: 'pending',
    isOverallTask: false,
    emailReminder: false,
    pushReminder: false
  });

  // Fetch tasks on component mount
  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest('/tasks');
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingTask) {
        // Update existing task
        const updatedTask = await apiRequest(`/tasks/${editingTask.id}`, {
          method: 'PUT',
          body: JSON.stringify(taskForm),
        });
        setTasks(prev => prev.map(task => 
          task.id === editingTask.id ? updatedTask : task
        ));
        setEditingTask(null);
      } else {
        // Create new task
        const newTask = await apiRequest('/tasks', {
          method: 'POST',
          body: JSON.stringify(taskForm),
        });
        setTasks(prev => [newTask, ...prev]);
      }
      
      // Reset form
      setTaskForm({
        title: '',
        description: '',
        dueDate: '',
        dueTime: '',
        priority: 'medium',
        category: 'assignment',
        completionStatus: 'pending',
        isOverallTask: false,
        emailReminder: false,
        pushReminder: false
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error('Error saving task:', error);
      alert('Failed to save task. Please try again.');
    }
  };

  const handleEdit = (task) => {
    setTaskForm(task);
    setEditingTask(task);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await apiRequest(`/tasks/${taskId}`, {
          method: 'DELETE',
        });
        setTasks(prev => prev.filter(task => task.id !== taskId));
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task. Please try again.');
      }
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const updatedTask = await apiRequest(`/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({ completionStatus: newStatus }),
      });
      setTasks(prev => prev.map(task => 
        task.id === taskId ? updatedTask : task
      ));
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status. Please try again.');
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'complete': return '#10b981';
      case 'half': return '#f59e0b';
      case 'partial': return '#3b82f6';
      case 'pending': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const isOverdue = (dueDate) => {
    if (!dueDate) return false;
    const today = new Date();
    const due = new Date(dueDate);
    return due < today;
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">📋 Tasks</h1>
          <p className="page-subtitle">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  const addTask = () => {
    if (taskForm.title.trim()) {
      setTasks([...tasks, {
        id: Date.now(),
        title: taskForm.title,
        priority: taskForm.priority,
        completed: false,
        dueDate: taskForm.dueDate
      }]);
      setTaskForm({ ...taskForm, title: '', dueDate: '' });
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">✅ Tasks</h1>
        <p className="page-subtitle">Manage your action items and to-do lists efficiently</p>
        <button 
          onClick={() => setIsAddDialogOpen(true)}
          className="btn btn-primary"
          style={{ marginTop: '15px' }}
        >
          + Add New Task
        </button>
      </div>

      <div className="tasks-content">
        {/* Add New Task */}
        <div className="add-task-section">
          <h3>Add New Task</h3>
          <div className="add-task-form">
            <input
              type="text"
              placeholder="Enter task title..."
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              className="task-input"
            />
            <select
              value={taskForm.priority}
              onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
              className="priority-select"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
            <input
              type="date"
              value={taskForm.dueDate}
              onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
              className="date-input"
            />
            <button onClick={addTask} className="add-task-btn">
              Add Task
            </button>
          </div>
        </div>

        {/* Tasks List */}
        <div className="tasks-list">
          <h3>Your Tasks ({tasks.filter(t => t.completionStatus !== 'complete').length} pending)</h3>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <p>No tasks yet. Add your first task above!</p>
            </div>
          ) : (
            <div className="tasks-grid">
              {tasks.map(task => (
                <div 
                  key={task.id} 
                  className={`task-card ${task.completionStatus === 'complete' ? 'completed' : ''}`}
                >
                  <div className="task-header">
                    <div className="task-checkbox">
                      <input
                        type="checkbox"
                        checked={task.completionStatus === 'complete'}
                        onChange={() => handleStatusChange(task.id, task.completionStatus === 'complete' ? 'pending' : 'complete')}
                      />
                    </div>
                    <h4 className="task-title">{task.title}</h4>
                    <button 
                      onClick={() => handleDelete(task.id)}
                      className="delete-btn"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {task.description && (
                    <div className="task-description">{task.description}</div>
                  )}
                  
                  <div className="task-meta">
                    <div className={`priority-indicator priority-${task.priority}`}>
                      {task.priority}
                    </div>
                    {task.dueDate && (
                      <div className={`task-date ${isOverdue(task.dueDate) ? 'overdue' : ''}`}>
                        📅 {formatDate(task.dueDate)}
                      </div>
                    )}
                  </div>
                  
                  <div className="task-actions">
                    <select
                      className="status-select"
                      value={task.completionStatus}
                      onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    >
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                      <option value="half">Half</option>
                      <option value="complete">Complete</option>
                    </select>
                    <button 
                      onClick={() => handleEdit(task)}
                      className="edit-btn"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Task Statistics */}
        <div className="tasks-stats">
          <div className="stat-card">
            <div className="stat-number">{tasks.length}</div>
            <div className="stat-label">Total Tasks</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{tasks.filter(t => t.completionStatus !== 'complete').length}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{tasks.filter(t => t.completionStatus === 'complete').length}</div>
            <div className="stat-label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{tasks.filter(t => t.priority === 'high' && t.completionStatus !== 'complete').length}</div>
            <div className="stat-label">High Priority</div>
          </div>
        </div>
      </div>

      {/* Add/Edit Task Modal */}
      {isAddDialogOpen && (
        <div className="modal-overlay" onClick={() => {
          setIsAddDialogOpen(false);
          setEditingTask(null);
          setTaskForm({
            title: '',
            description: '',
            dueDate: '',
            dueTime: '',
            priority: 'medium',
            category: 'assignment',
            completionStatus: 'pending',
            isOverallTask: false,
            emailReminder: false,
            pushReminder: false
          });
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingTask ? 'Edit Task' : 'Add New Task'}</h2>
            </div>
            <div className="modal-body">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Enter task title..."
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    value={taskForm.description}
                    onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                    placeholder="Enter task description..."
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={taskForm.dueDate}
                    onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Due Time</label>
                  <input
                    type="time"
                    className="form-input"
                    value={taskForm.dueTime}
                    onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={taskForm.category}
                    onChange={(e) => setTaskForm({ ...taskForm, category: e.target.value })}
                  >
                    <option value="assignment">Assignment</option>
                    <option value="project">Project</option>
                    <option value="meeting">Meeting</option>
                    <option value="personal">Personal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={taskForm.completionStatus}
                    onChange={(e) => setTaskForm({ ...taskForm, completionStatus: e.target.value })}
                  >
                    <option value="pending">Pending</option>
                    <option value="partial">Partial</option>
                    <option value="half">Half</option>
                    <option value="complete">Complete</option>
                  </select>
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="emailReminder"
                    checked={taskForm.emailReminder}
                    onChange={(e) => setTaskForm({ ...taskForm, emailReminder: e.target.checked })}
                  />
                  <label htmlFor="emailReminder">Email Reminder</label>
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="pushReminder"
                    checked={taskForm.pushReminder}
                    onChange={(e) => setTaskForm({ ...taskForm, pushReminder: e.target.checked })}
                  />
                  <label htmlFor="pushReminder">Push Notification</label>
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="isOverallTask"
                    checked={taskForm.isOverallTask}
                    onChange={(e) => setTaskForm({ ...taskForm, isOverallTask: e.target.checked })}
                  />
                  <label htmlFor="isOverallTask">Overall Task</label>
                </div>
              </form>
            </div>
            <div className="modal-actions">
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setIsAddDialogOpen(false);
                  setEditingTask(null);
                  setTaskForm({
                    title: '',
                    description: '',
                    dueDate: '',
                    dueTime: '',
                    priority: 'medium',
                    category: 'assignment',
                    completionStatus: 'pending',
                    isOverallTask: false,
                    emailReminder: false,
                    pushReminder: false
                  });
                }}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
              >
                {editingTask ? 'Update Task' : 'Add Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;