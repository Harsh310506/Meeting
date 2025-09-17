# Meeting Monitor Setup Script
# Run this script to set up the entire project

Write-Host "🚀 Setting up Meeting Monitor Project..." -ForegroundColor Green

# Backend Setup
Write-Host "`n📦 Setting up Backend..." -ForegroundColor Yellow
Set-Location backend

# Create virtual environment
Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
python -m venv venv

# Activate virtual environment
Write-Host "Activating virtual environment..." -ForegroundColor Cyan
& "venv\Scripts\Activate.ps1"

# Install Python dependencies
Write-Host "Installing Python dependencies..." -ForegroundColor Cyan
pip install -r requirements.txt

Write-Host "✅ Backend setup complete!" -ForegroundColor Green

# Return to project root
Set-Location ..

# Frontend Setup
Write-Host "`n🎨 Setting up Frontend..." -ForegroundColor Yellow
Set-Location frontend

# Install Node.js dependencies
Write-Host "Installing Node.js dependencies..." -ForegroundColor Cyan
npm install

Write-Host "✅ Frontend setup complete!" -ForegroundColor Green

# Return to project root
Set-Location ..

Write-Host "`n🎉 Setup Complete!" -ForegroundColor Green
Write-Host "`nTo start the project:" -ForegroundColor White
Write-Host "1. Start Backend: cd backend && venv\Scripts\activate && python main.py" -ForegroundColor Cyan
Write-Host "2. Start Frontend: cd frontend && npm run dev" -ForegroundColor Cyan
Write-Host "`nThen open http://localhost:3000 in your browser" -ForegroundColor White
