#!/usr/bin/env python3
"""
Simple Authentication Server - Lightweight version for testing
This server only handles authentication without heavy AI models
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import jwt
import bcrypt
import uuid
from datetime import datetime, timedelta
import uvicorn
import re

# Initialize FastAPI app
app = FastAPI(title="Authentication Server", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://127.0.0.1:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple in-memory database
users_db = {}

# JWT Configuration
JWT_SECRET_KEY = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DELTA = timedelta(days=30)

# Security
security = HTTPBearer()

# Pydantic models
class UserRegistration(BaseModel):
    firstName: str
    lastName: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserProfile(BaseModel):
    firstName: str
    lastName: str
    email: str

class PasswordChange(BaseModel):
    currentPassword: str
    newPassword: str

# Helper functions
def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_data: dict) -> str:
    """Create a JWT token for the user"""
    payload = {
        "user_id": user_data["id"],
        "email": user_data["email"],
        "exp": datetime.utcnow() + JWT_EXPIRATION_DELTA
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> dict:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get the current authenticated user"""
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user_id = payload.get("user_id")
    
    if user_id not in users_db:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    user = users_db[user_id]
    return {k: v for k, v in user.items() if k != "password"}

# Authentication endpoints
@app.post("/api/auth/register")
async def register_user(user_data: UserRegistration):
    """Register a new user"""
    try:
        # Validate input data
        if not user_data.email or not user_data.email.strip():
            raise HTTPException(status_code=400, detail="Email is required")
        if not user_data.password or len(user_data.password.strip()) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        if not user_data.firstName or not user_data.firstName.strip():
            raise HTTPException(status_code=400, detail="First name is required")
        if not user_data.lastName or not user_data.lastName.strip():
            raise HTTPException(status_code=400, detail="Last name is required")
        
        # Validate email format
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, user_data.email.strip()):
            raise HTTPException(status_code=400, detail="Invalid email format")
        
        # Check if user already exists
        for user in users_db.values():
            if user["email"].lower() == user_data.email.lower().strip():
                raise HTTPException(status_code=400, detail="Email already registered")
        
        # Create new user
        user_id = str(uuid.uuid4())
        hashed_password = hash_password(user_data.password.strip())
        
        new_user = {
            "id": user_id,
            "firstName": user_data.firstName.strip(),
            "lastName": user_data.lastName.strip(),
            "email": user_data.email.lower().strip(),
            "password": hashed_password,
            "createdAt": datetime.utcnow().isoformat(),
            "updatedAt": datetime.utcnow().isoformat()
        }
        
        users_db[user_id] = new_user
        
        # Generate token
        token = create_jwt_token(new_user)
        
        # Return user data without password
        user_response = {k: v for k, v in new_user.items() if k != "password"}
        
        print(f"✅ User registered successfully: {user_data.email}")
        
        return {
            "success": True,
            "user": user_response,
            "token": token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/auth/login")
async def login_user(user_data: UserLogin):
    """Login a user"""
    try:
        # Find user by email
        user_found = None
        for user in users_db.values():
            if user["email"].lower() == user_data.email.lower().strip():
                user_found = user
                break
        
        if not user_found:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Verify password
        if not verify_password(user_data.password, user_found["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")
        
        # Generate token
        token = create_jwt_token(user_found)
        
        # Return user data without password
        user_response = {k: v for k, v in user_found.items() if k != "password"}
        
        print(f"✅ User logged in successfully: {user_data.email}")
        
        return {
            "success": True,
            "user": user_response,
            "token": token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/auth/profile")
async def get_profile(current_user = Depends(get_current_user)):
    """Get current user profile"""
    return {
        "success": True,
        "user": current_user
    }

@app.put("/api/auth/profile")
async def update_profile(profile_data: UserProfile, current_user = Depends(get_current_user)):
    """Update user profile"""
    try:
        user_id = current_user["id"]
        
        # Update user data
        users_db[user_id].update({
            "firstName": profile_data.firstName.strip(),
            "lastName": profile_data.lastName.strip(),
            "email": profile_data.email.lower().strip(),
            "updatedAt": datetime.utcnow().isoformat()
        })
        
        # Return updated user data without password
        updated_user = {k: v for k, v in users_db[user_id].items() if k != "password"}
        
        return {
            "success": True,
            "user": updated_user
        }
        
    except Exception as e:
        print(f"❌ Profile update error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/auth/change-password")
async def change_password(password_data: PasswordChange, current_user = Depends(get_current_user)):
    """Change user password"""
    try:
        user_id = current_user["id"]
        user = users_db[user_id]
        
        # Verify current password
        if not verify_password(password_data.currentPassword, user["password"]):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        # Hash new password
        new_hashed_password = hash_password(password_data.newPassword)
        
        # Update password
        users_db[user_id]["password"] = new_hashed_password
        users_db[user_id]["updatedAt"] = datetime.utcnow().isoformat()
        
        return {
            "success": True,
            "message": "Password changed successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Password change error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "message": "Authentication server is running",
        "users_count": len(users_db)
    }

if __name__ == "__main__":
    print("🚀 Starting Simple Authentication Server...")
    print("📡 Server URL: http://localhost:8000")
    print("🔐 Authentication endpoints available:")
    print("   POST /api/auth/register")
    print("   POST /api/auth/login")
    print("   GET  /api/auth/profile")
    print("   PUT  /api/auth/profile")
    print("   POST /api/auth/change-password")
    print("   GET  /health")
    
    uvicorn.run(app, host="localhost", port=8000, log_level="info")