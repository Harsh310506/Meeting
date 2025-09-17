# Start Script for Meeting Monitor
# This script starts both frontend and backend servers

Write-Host "🚀 Starting Meeting Monitor..." -ForegroundColor Green

# Start Backend in background
Write-Host "Starting Backend Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; venv\Scripts\activate; python main.py"

# Wait a moment for backend to initialize
Start-Sleep -Seconds 3

# Start Frontend
Write-Host "Starting Frontend Server..." -ForegroundColor Yellow
Set-Location frontend
npm run dev
