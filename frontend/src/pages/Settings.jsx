import React, { useState } from 'react';
import '../PageStyles.css';

const Settings = () => {
  const [settings, setSettings] = useState({
    // General Settings
    theme: 'light',
    language: 'en',
    notifications: true,
    autoSave: true,
    
    // Meeting Monitor Settings
    asrModel: 'medium',
    sentimentAnalysis: true,
    taskExtraction: true,
    storageEnabled: false,
    audioQuality: 'high',
    videoQuality: 'medium',
    
    // Privacy Settings
    dataRetention: '30',
    shareAnalytics: false,
    encryptStorage: true,
    
    // Performance Settings
    gpuAcceleration: true,
    lowLatencyMode: false,
    maxConcurrentSessions: 5
  });

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const resetToDefaults = () => {
    setSettings({
      theme: 'light',
      language: 'en',
      notifications: true,
      autoSave: true,
      asrModel: 'medium',
      sentimentAnalysis: true,
      taskExtraction: true,
      storageEnabled: false,
      audioQuality: 'high',
      videoQuality: 'medium',
      dataRetention: '30',
      shareAnalytics: false,
      encryptStorage: true,
      gpuAcceleration: true,
      lowLatencyMode: false,
      maxConcurrentSessions: 5
    });
  };

  const exportSettings = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'meeting-monitor-settings.json';
    link.click();
  };

  const importSettings = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedSettings = JSON.parse(e.target.result);
          setSettings(importedSettings);
        } catch (error) {
          console.error('Error importing settings:', error);
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>⚙️ Settings</h1>
        <p>Configure your preferences and application settings</p>
        <div className="header-actions">
          <button onClick={exportSettings} className="secondary-btn">
            📤 Export Settings
          </button>
          <label className="file-input-label secondary-btn">
            📥 Import Settings
            <input 
              type="file" 
              accept=".json" 
              onChange={importSettings}
              style={{ display: 'none' }}
            />
          </label>
          <button onClick={resetToDefaults} className="danger-btn">
            🔄 Reset to Defaults
          </button>
        </div>
      </div>

      <div className="settings-content">
        {/* General Settings */}
        <div className="settings-section">
          <h3>🎨 General Settings</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Theme</label>
              <select 
                value={settings.theme}
                onChange={(e) => updateSetting('theme', e.target.value)}
                className="setting-select"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto (System)</option>
              </select>
            </div>
            
            <div className="setting-item">
              <label>Language</label>
              <select 
                value={settings.language}
                onChange={(e) => updateSetting('language', e.target.value)}
                className="setting-select"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
            
            <div className="setting-item">
              <label>Enable Notifications</label>
              <div className="toggle-switch">
                <input 
                  type="checkbox"
                  checked={settings.notifications}
                  onChange={(e) => updateSetting('notifications', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
            
            <div className="setting-item">
              <label>Auto-save Data</label>
              <div className="toggle-switch">
                <input 
                  type="checkbox"
                  checked={settings.autoSave}
                  onChange={(e) => updateSetting('autoSave', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Meeting Monitor Settings */}
        <div className="settings-section">
          <h3>🎙️ Meeting Monitor Settings</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label>ASR Model Quality</label>
              <select 
                value={settings.asrModel}
                onChange={(e) => updateSetting('asrModel', e.target.value)}
                className="setting-select"
              >
                <option value="tiny">Tiny (Fastest)</option>
                <option value="base">Base (Balanced)</option>
                <option value="small">Small (Good)</option>
                <option value="medium">Medium (Better)</option>
                <option value="large">Large (Best)</option>
              </select>
            </div>
            
            <div className="setting-item">
              <label>Sentiment Analysis</label>
              <div className="toggle-switch">
                <input 
                  type="checkbox"
                  checked={settings.sentimentAnalysis}
                  onChange={(e) => updateSetting('sentimentAnalysis', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
            
            <div className="setting-item">
              <label>Task Extraction</label>
              <div className="toggle-switch">
                <input 
                  type="checkbox"
                  checked={settings.taskExtraction}
                  onChange={(e) => updateSetting('taskExtraction', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
            
            <div className="setting-item">
              <label>Storage Enabled</label>
              <div className="toggle-switch">
                <input 
                  type="checkbox"
                  checked={settings.storageEnabled}
                  onChange={(e) => updateSetting('storageEnabled', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
            
            <div className="setting-item">
              <label>Audio Quality</label>
              <select 
                value={settings.audioQuality}
                onChange={(e) => updateSetting('audioQuality', e.target.value)}
                className="setting-select"
              >
                <option value="low">Low (8kHz)</option>
                <option value="medium">Medium (16kHz)</option>
                <option value="high">High (44.1kHz)</option>
              </select>
            </div>
            
            <div className="setting-item">
              <label>Video Quality</label>
              <select 
                value={settings.videoQuality}
                onChange={(e) => updateSetting('videoQuality', e.target.value)}
                className="setting-select"
              >
                <option value="low">Low (480p)</option>
                <option value="medium">Medium (720p)</option>
                <option value="high">High (1080p)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Privacy Settings */}
        <div className="settings-section">
          <h3>🔒 Privacy & Security</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Data Retention (days)</label>
              <select 
                value={settings.dataRetention}
                onChange={(e) => updateSetting('dataRetention', e.target.value)}
                className="setting-select"
              >
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
                <option value="365">1 year</option>
                <option value="never">Never delete</option>
              </select>
            </div>
            
            <div className="setting-item">
              <label>Share Analytics</label>
              <div className="toggle-switch">
                <input 
                  type="checkbox"
                  checked={settings.shareAnalytics}
                  onChange={(e) => updateSetting('shareAnalytics', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
            
            <div className="setting-item">
              <label>Encrypt Local Storage</label>
              <div className="toggle-switch">
                <input 
                  type="checkbox"
                  checked={settings.encryptStorage}
                  onChange={(e) => updateSetting('encryptStorage', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Settings */}
        <div className="settings-section">
          <h3>⚡ Performance</h3>
          <div className="settings-grid">
            <div className="setting-item">
              <label>GPU Acceleration</label>
              <div className="toggle-switch">
                <input 
                  type="checkbox"
                  checked={settings.gpuAcceleration}
                  onChange={(e) => updateSetting('gpuAcceleration', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
            
            <div className="setting-item">
              <label>Low Latency Mode</label>
              <div className="toggle-switch">
                <input 
                  type="checkbox"
                  checked={settings.lowLatencyMode}
                  onChange={(e) => updateSetting('lowLatencyMode', e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </div>
            </div>
            
            <div className="setting-item">
              <label>Max Concurrent Sessions</label>
              <select 
                value={settings.maxConcurrentSessions}
                onChange={(e) => updateSetting('maxConcurrentSessions', parseInt(e.target.value))}
                className="setting-select"
              >
                <option value={1}>1 session</option>
                <option value={3}>3 sessions</option>
                <option value={5}>5 sessions</option>
                <option value={10}>10 sessions</option>
              </select>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="settings-section">
          <h3>💻 System Information</h3>
          <div className="system-info">
            <div className="info-item">
              <label>Version:</label>
              <span>Meeting Monitor v2.0.0</span>
            </div>
            <div className="info-item">
              <label>Backend Status:</label>
              <span className="status-indicator connected">Connected</span>
            </div>
            <div className="info-item">
              <label>GPU Support:</label>
              <span>CUDA 11.8 Available</span>
            </div>
            <div className="info-item">
              <label>Memory Usage:</label>
              <span>1.2 GB / 8 GB</span>
            </div>
            <div className="info-item">
              <label>Storage Used:</label>
              <span>45 MB / 1 GB</span>
            </div>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="settings-section">
          <h3>🔧 Advanced Options</h3>
          <div className="advanced-actions">
            <button className="secondary-btn">
              🧹 Clear Cache
            </button>
            <button className="secondary-btn">
              📊 View Logs
            </button>
            <button className="secondary-btn">
              🔄 Restart Backend
            </button>
            <button className="danger-btn">
              🗑️ Reset All Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;