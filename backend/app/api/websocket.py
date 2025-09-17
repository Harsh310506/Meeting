from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict
import json
import logging
import asyncio
import os
import time
import wave
from app.services.transcription_service import transcription_service

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Client {client_id} connected")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Client {client_id} disconnected")
    
    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send message to {client_id}: {e}")
                self.disconnect(client_id)

manager = ConnectionManager()

def save_audio_chunk(data: bytes, client_id: str) -> str:
    """Save audio data to file"""
    try:
        # Create session directory
        session_dir = os.path.join("recorded_sessions", f"session_{int(time.time())}_{client_id}")
        os.makedirs(session_dir, exist_ok=True)
        
        # Save audio file
        audio_path = os.path.join(session_dir, f"audio_{int(time.time())}.wav")
        
        # Simple WAV file creation (you might need to adjust based on your audio format)
        with open(audio_path, 'wb') as f:
            f.write(data)
        
        return audio_path
    except Exception as e:
        logger.error(f"Failed to save audio chunk: {e}")
        return None

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await manager.connect(websocket, client_id)
    
    try:
        while True:
            # Receive audio data
            data = await websocket.receive_bytes()
            
            # Save audio chunk
            audio_path = save_audio_chunk(data, client_id)
            
            # Transcribe using improved service
            if audio_path and os.path.exists(audio_path) and os.path.getsize(audio_path) > 1000:
                try:
                    session_dir = os.path.dirname(audio_path)
                    complete_transcript_path = transcription_service.transcribe_and_save(
                        audio_path, 
                        client_id, 
                        session_dir
                    )
                    
                    # Send transcription result back to client
                    with open(complete_transcript_path, 'r', encoding='utf-8') as f:
                        transcript_data = json.load(f)
                    
                    await manager.send_personal_message({
                        "type": "transcription",
                        "data": transcript_data
                    }, client_id)
                    
                except Exception as e:
                    logger.error(f"Transcription error: {e}")
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"Transcription failed: {str(e)}"
                    }, client_id)
                    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}")
        manager.disconnect(client_id)

@router.get("/health")
async def websocket_health():
    return {"status": "WebSocket service is running", "active_connections": len(manager.active_connections)}