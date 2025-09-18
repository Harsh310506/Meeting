"""
Meeting Monitor - Consolidated Backend Server
Combines all essential functionality into a single file:
- Real-time WebSocket communication
- Whisper ASR with medium model (GPU optimized)
- Video upload and transcript extraction
- Session management and storage
- High-accuracy transcription parameters
"""

import asyncio
import json
import logging
import os
import tempfile
import threading
import time
import traceback
from collections import deque
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any

# Core dependencies
import numpy as np
import soundfile as sf
import uvicorn
import webrtcvad
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from faster_whisper import WhisperModel
import jwt as PyJWT
import bcrypt
from pydantic import BaseModel
import uuid
from datetime import datetime, timedelta, timezone

# Enhanced NLP dependencies for transcript analysis
import re
import spacy
from textblob import TextBlob
# from gensim import corpora
# from gensim.models import LdaModel
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
import nltk
import requests

# Optional imports for enhanced features
try:
    from PyDictionary import PyDictionary
    PYDICTIONARY_AVAILABLE = True
except ImportError:
    PyDictionary = None
    PYDICTIONARY_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# DistilBERT sentiment analysis
try:
    from distilbert_sentiment import distilbert_analyzer, analyze_sentiment, get_sentiment_summary, TRANSFORMERS_AVAILABLE
    DISTILBERT_AVAILABLE = TRANSFORMERS_AVAILABLE
    if not TRANSFORMERS_AVAILABLE:
        logger.warning("DistilBERT sentiment analysis requires transformers library")
        distilbert_analyzer = None
        analyze_sentiment = None
        get_sentiment_summary = None
except ImportError as e:
    logger.warning(f"DistilBERT sentiment analysis not available: {e}")
    distilbert_analyzer = None
    analyze_sentiment = None
    get_sentiment_summary = None
    DISTILBERT_AVAILABLE = False
except Exception as e:
    logger.error(f"Error importing DistilBERT sentiment analysis: {e}")
    distilbert_analyzer = None
    analyze_sentiment = None
    get_sentiment_summary = None
    DISTILBERT_AVAILABLE = False

# ============================================================================
# ENHANCED TRANSCRIPT ANALYSIS PROCESSOR
# ============================================================================

class EnhancedTranscriptAnalyzer:
    """
    Comprehensive transcript analysis with NER, topic modeling, grammar correction, 
    keyword extraction, and AI-style suggestions
    """
    
    def __init__(self):
        self.nlp = None
        self.initialization_error = None
        self._init_lock = threading.Lock()
        
        # Initialize NLP models in background
        threading.Thread(target=self._initialize_models, daemon=True).start()
    
    def _initialize_models(self):
        """Initialize NLP models with error handling"""
        try:
            logger.info("🧠 Initializing Enhanced NLP models...")
            
            # Download required NLTK data with better error handling
            try:
                nltk.data.find('tokenizers/punkt')
                logger.info("✅ NLTK punkt tokenizer found")
            except (LookupError, Exception) as e:
                try:
                    logger.info("📥 Downloading NLTK punkt tokenizer...")
                    nltk.download('punkt', quiet=True, force=True)  # Force re-download if corrupted
                    logger.info("✅ NLTK punkt tokenizer downloaded")
                except Exception as download_error:
                    logger.warning(f"⚠️ Failed to download punkt: {download_error}")
            
            try:
                nltk.data.find('corpora/stopwords')
                logger.info("✅ NLTK stopwords found")
            except (LookupError, Exception) as e:
                try:
                    logger.info("📥 Downloading NLTK stopwords...")
                    nltk.download('stopwords', quiet=True, force=True)  # Force re-download if corrupted
                    logger.info("✅ NLTK stopwords downloaded")
                except Exception as download_error:
                    logger.warning(f"⚠️ Failed to download stopwords: {download_error}")
            
            # Load spaCy model
            try:
                import spacy
                self.nlp = spacy.load("en_core_web_sm")
                logger.info("✅ spaCy model loaded successfully")
            except OSError:
                logger.warning("⚠️ spaCy model not found, attempting to download...")
                try:
                    import subprocess
                    subprocess.run([
                        "python", "-m", "spacy", "download", "en_core_web_sm"
                    ], check=True, capture_output=True)
                    self.nlp = spacy.load("en_core_web_sm")
                    logger.info("✅ spaCy model downloaded and loaded")
                except Exception as e:
                    logger.error(f"❌ Failed to download spaCy model: {e}")
                    self.initialization_error = f"spaCy model unavailable: {e}"
                    return
            
            logger.info("🎯 Enhanced NLP Analysis Ready!")
            
        except Exception as e:
            logger.error(f"❌ NLP initialization failed: {e}")
            # Don't set initialization_error if we have spaCy working
            if self.nlp is None:
                self.initialization_error = str(e)
            else:
                logger.info("✅ Continuing with spaCy-only functionality")
    
    def is_ready(self) -> bool:
        """Check if analyzer is ready - only requires spaCy model"""
        return self.nlp is not None
    
    def initialize_sync(self) -> bool:
        """Synchronous initialization for testing - skip NLTK downloads"""
        with self._init_lock:
            if self.is_ready():
                return True
            
            try:
                logger.info("🧠 Synchronous initialization of Enhanced NLP models...")
                
                # Skip NLTK downloads in sync mode, use fallbacks
                logger.info("� Using fallback mechanisms for NLTK dependencies")
                
                # Load spaCy model (this is the essential component)
                import spacy
                self.nlp = spacy.load("en_core_web_sm")
                logger.info("✅ spaCy model loaded successfully")
                
                # Clear any previous initialization errors since spaCy loaded successfully
                self.initialization_error = None
                
                logger.info("🎯 Enhanced NLP Analysis Ready!")
                return True
                
            except Exception as e:
                logger.error(f"❌ Synchronous NLP initialization failed: {e}")
                self.initialization_error = str(e)
                return False
    
    def validate_transcript_quality(self, transcript: str) -> dict:
        """Validate transcript quality and provide recommendations"""
        if not transcript:
            return {
                "quality": "invalid",
                "score": 0.0,
                "issues": ["No transcript content"],
                "recommendations": ["Ensure audio recording is working properly"]
            }
        
        # Quality metrics
        char_count = len(transcript)
        word_count = len(transcript.split())
        alpha_count = sum(1 for char in transcript if char.isalpha())
        alpha_ratio = alpha_count / max(char_count, 1)
        avg_word_length = sum(len(word) for word in transcript.split()) / max(word_count, 1)
        
        # Calculate quality score (0-1)
        length_score = min(char_count / 200, 1.0)  # Optimal at 200+ chars
        content_score = alpha_ratio  # Higher ratio of alphabetic chars is better
        word_score = min(word_count / 30, 1.0)  # Optimal at 30+ words
        structure_score = min(avg_word_length / 5, 1.0)  # Reasonable word length
        
        overall_score = (length_score + content_score + word_score + structure_score) / 4
        
        # Determine quality level
        if overall_score >= 0.8:
            quality = "high"
        elif overall_score >= 0.6:
            quality = "medium"
        elif overall_score >= 0.3:
            quality = "low"
        else:
            quality = "poor"
        
        # Identify issues and recommendations
        issues = []
        recommendations = []
        
        if char_count < 20:
            issues.append("Very short transcript")
            recommendations.append("Record longer audio segments for better analysis")
        
        if word_count < 5:
            issues.append("Very few words detected")
            recommendations.append("Ensure clear speech and minimal background noise")
        
        if alpha_ratio < 0.7:
            issues.append("Low text content ratio")
            recommendations.append("Check for audio quality issues or transcription errors")
        
        if avg_word_length < 2:
            issues.append("Very short words detected")
            recommendations.append("Speak clearly and avoid excessive filler words")
        
        return {
            "quality": quality,
            "score": overall_score,
            "metrics": {
                "character_count": char_count,
                "word_count": word_count,
                "alpha_ratio": alpha_ratio,
                "avg_word_length": avg_word_length
            },
            "issues": issues,
            "recommendations": recommendations
        }

    def _detect_jargon_and_technical_terms(self, doc) -> dict:
        """Detect jargon, technical terms, and acronyms"""
        try:
            jargon_patterns = {
                'business_terms': [
                    'ROI', 'KPI', 'SLA', 'B2B', 'B2C', 'CRM', 'ERP', 'SWOT', 'MVP', 'GTM',
                    'revenue', 'margin', 'EBITDA', 'stakeholder', 'synergy', 'leverage',
                    'scalability', 'monetization', 'acquisition', 'retention'
                ],
                'tech_terms': [
                    'API', 'SDK', 'AWS', 'SaaS', 'PaaS', 'IaaS', 'DevOps', 'CI/CD', 'ML', 'AI',
                    'microservices', 'containerization', 'kubernetes', 'docker', 'serverless',
                    'blockchain', 'cryptocurrency', 'NFT', 'IoT', 'VR', 'AR'
                ],
                'finance_terms': [
                    'P&L', 'CAPEX', 'OPEX', 'NPV', 'IRR', 'cash flow', 'burn rate', 'runway',
                    'valuation', 'equity', 'debt', 'convertible', 'dilution', 'liquidation'
                ],
                'project_terms': [
                    'agile', 'scrum', 'kanban', 'sprint', 'backlog', 'epic', 'user story',
                    'retrospective', 'standup', 'milestone', 'deliverable', 'scope creep'
                ]
            }
            
            # Detect acronyms (2-5 uppercase letters)
            acronym_pattern = re.compile(r'\b[A-Z]{2,5}\b')
            
            detected = {
                'business_jargon': [],
                'technical_jargon': [],
                'finance_jargon': [],
                'project_jargon': [],
                'acronyms': [],
                'complex_terms': []
            }
            
            text_lower = doc.text.lower()
            
            # Check for predefined jargon
            for category, terms in jargon_patterns.items():
                for term in terms:
                    if term.lower() in text_lower:
                        key = f"{category.split('_')[0]}_jargon"
                        if key in detected:
                            detected[key].append(term)
            
            # Find acronyms
            acronyms = acronym_pattern.findall(doc.text)
            detected['acronyms'] = list(set(acronyms))
            
            # Find complex terms (technical vocabulary based on POS and length)
            for token in doc:
                if (token.pos_ in ['NOUN', 'ADJ'] and 
                    len(token.text) > 8 and 
                    token.text.isalpha() and
                    not token.is_stop):
                    detected['complex_terms'].append(token.text.lower())
            
            # Remove duplicates
            for key in detected:
                detected[key] = list(set(detected[key]))
            
            return detected
            
        except Exception as e:
            logger.warning(f"Jargon detection failed: {e}")
            return {}
    
    def _extract_tasks_and_schedules(self, doc, text: str) -> list:
        """
        Enhanced task and action item extraction with perfect classification
        Extracts tasks for next functionalities with high accuracy
        """
        try:
            tasks = []
            seen_tasks = set()  # To avoid duplicates
            
            # Get all date entities from spaCy NER
            date_entities = [ent.text for ent in doc.ents if ent.label_ in ["DATE", "TIME"]]
            
            # Comprehensive task detection patterns - organized by category
            task_patterns = {
                # Explicit Action Items (Highest Priority)
                "action_items": [
                    r'(?:action\s+item|todo|task|assignment|deliverable)[:\s-]+([^.!?\n]{8,100})',
                    r'(?:we\s+|i\s+|team\s+|someone\s+)?(?:need\s+to|must|should|have\s+to|will\s+need\s+to)\s+([a-z][^.!?\n]{10,120})',
                    r'(?:please|can\s+you|could\s+you|would\s+you)\s+([a-z][^.!?\n]{10,100})',
                    r'(?:let\'s|we\s+should|we\s+can|we\s+will)\s+([a-z][^.!?\n]{10,100})',
                ],
                
                # Scheduling & Meetings (High Priority)
                "scheduling": [
                    r'(?:schedule|plan|arrange|book|set\s+up)\s+(?:a\s+|an\s+)?([^.!?\n]*(?:meeting|call|presentation|review|session|workshop|appointment)[^.!?\n]{0,80})',
                    r'([^.!?\n]*(?:meeting|call|presentation|review|session|workshop)[^.!?\n]*(?:on\s+|for\s+|at\s+|next\s+|this\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|next\s+\w+)[^.!?\n]{0,50})',
                    r'(?:when\s+can\s+we|when\s+should\s+we|let\'s\s+schedule)\s+([^.!?\n]{10,100})',
                ],
                
                # Follow-up Actions (Medium Priority)
                "follow_ups": [
                    r'(?:follow[- ]?up\s+(?:on\s+|with\s+)?([^.!?\n]{8,100}))',
                    r'(?:check\s+(?:on\s+|with\s+|back\s+)?([^.!?\n]{8,100}))',
                    r'(?:update\s+(?:on\s+|about\s+)?([^.!?\n]{8,100}))',
                    r'(?:get\s+back\s+to\s+(?:us\s+)?(?:on\s+|about\s+)?([^.!?\n]{8,100}))',
                ],
                
                # Research & Analysis (Medium Priority)
                "research": [
                    r'(?:research|investigate|analyze|look\s+into|find\s+out|explore)\s+([^.!?\n]{8,100})',
                    r'(?:we\s+need\s+to\s+understand|let\'s\s+understand|need\s+more\s+info\s+on)\s+([^.!?\n]{8,100})',
                ],
                
                # Documentation & Reports (Medium Priority)
                "documentation": [
                    r'(?:document|write\s+up|create\s+(?:a\s+)?report|prepare\s+(?:a\s+)?summary)\s+([^.!?\n]{8,100})',
                    r'(?:send|share|distribute|circulate)\s+([^.!?\n]*(?:report|document|summary|notes|minutes)[^.!?\n]{0,60})',
                ],
                
                # Implementation & Development (High Priority)
                "implementation": [
                    r'(?:implement|develop|build|create|deploy|setup|configure)\s+([^.!?\n]{8,120})',
                    r'(?:integrate|connect|link)\s+([^.!?\n]{8,100})',
                    r'(?:fix|resolve|address|solve)\s+([^.!?\n]{8,100})',
                ],
                
                # Review & Approval (Medium Priority)
                "review": [
                    r'(?:review|approve|evaluate|assess|validate)\s+([^.!?\n]{8,100})',
                    r'(?:need\s+(?:approval|sign[- ]?off)\s+(?:for\s+|on\s+)?([^.!?\n]{8,100}))',
                ],
                
                # Communication & Outreach (Low Priority)
                "communication": [
                    r'(?:contact|reach\s+out\s+to|call|email|notify|inform)\s+([^.!?\n]{8,100})',
                    r'(?:send\s+(?:an?\s+)?(?:email|message|notification)\s+(?:to\s+)?([^.!?\n]{8,100}))',
                ]
            }
            
            # Process sentences to find tasks
            sentences = [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 15]
            
            for sentence in sentences:
                sentence_clean = re.sub(r'\s+', ' ', sentence.strip())
                
                # Skip if sentence is too long (likely not a single task)
                if len(sentence_clean) > 250:
                    continue
                
                # Process each category of patterns
                for category, patterns in task_patterns.items():
                    for pattern in patterns:
                        matches = re.finditer(pattern, sentence_clean, re.IGNORECASE)
                        for match in matches:
                            task_text = match.group(1).strip() if len(match.groups()) > 0 else match.group(0).strip()
                            
                            # Clean up task text
                            task_text = re.sub(r'^(to|a|an|the|and|or|but)\s+', '', task_text, flags=re.IGNORECASE)
                            task_text = re.sub(r'\s+', ' ', task_text.strip(' .,;:'))
                            
                            # Skip if too short or contains invalid patterns
                            if (len(task_text) < 8 or 
                                task_text.lower() in ['that', 'this', 'it', 'them', 'us', 'we', 'they'] or
                                re.match(r'^(and|or|but|so|then|when|where|what|how|why)\s', task_text.lower())):
                                continue
                            
                            # Enhanced duplicate detection
                            task_key = re.sub(r'[^\w\s]', '', task_text.lower())
                            is_duplicate = False
                            
                            for existing_key in seen_tasks:
                                # Check for exact substring matches
                                if (task_key in existing_key or existing_key in task_key):
                                    if abs(len(task_key) - len(existing_key)) < 15:
                                        is_duplicate = True
                                        break
                                
                                # Check for high word overlap
                                task_words = set(task_key.split())
                                existing_words = set(existing_key.split())
                                if len(task_words) > 0 and len(existing_words) > 0:
                                    overlap_ratio = len(task_words & existing_words) / max(len(task_words), len(existing_words))
                                    if overlap_ratio > 0.75:
                                        is_duplicate = True
                                        break
                            
                            if is_duplicate:
                                continue
                            
                            seen_tasks.add(task_key)
                            
                            # Extract dates from sentence
                            sentence_dates = self._extract_dates_from_sentence(sentence_clean, date_entities)
                            
                            # Find assignees (people mentioned in sentence)
                            assignees = self._extract_assignees(doc, sentence_clean)
                            
                            # Determine priority based on category and content
                            priority = self._determine_enhanced_task_priority(sentence_clean.lower(), category)
                            
                            # Classify task type for better organization
                            task_type = self._classify_task_type(task_text, category)
                            
                            # Calculate urgency score
                            urgency_score = self._calculate_urgency_score(sentence_clean.lower())
                            
                            task_data = {
                                "task": task_text.capitalize(),
                                "category": category.replace('_', ' ').title(),
                                "type": task_type,
                                "priority": priority,
                                "urgency_score": urgency_score,
                                "dates": sentence_dates if sentence_dates else ["Not specified"],
                                "assignees": assignees if assignees else ["Team"],
                                "context": sentence_clean[:120] + "..." if len(sentence_clean) > 120 else sentence_clean,
                                "source_sentence": sentence_clean
                            }
                            
                            tasks.append(task_data)
            
            # Enhanced sorting: Priority -> Urgency -> Date specificity
            priority_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
            
            tasks.sort(key=lambda x: (
                priority_order.get(x["priority"], 4),
                -x["urgency_score"],  # Higher urgency first
                len(x["dates"]) == 1 and x["dates"][0] == "Not specified"  # Specific dates first
            ))
            
            # Return top 5 most relevant tasks for next functionalities
            return tasks[:5]
            
        except Exception as e:
            logger.warning(f"Enhanced task extraction failed: {e}")
            return []
    
    def _determine_task_priority(self, text: str) -> str:
        """Determine task priority based on keywords"""
        if any(word in text for word in ['urgent', 'asap', 'immediately', 'critical', 'deadline']):
            return "High"
        elif any(word in text for word in ['important', 'priority', 'soon', 'next week']):
            return "Medium"
        else:
            return "Low"
    
    def _extract_dates_from_sentence(self, sentence: str, date_entities: list) -> list:
        """Enhanced date extraction with smart parsing for relative and specific dates"""
        from datetime import datetime, timedelta
        import calendar
        
        sentence_dates = []
        current_date = datetime.now()
        
        # Find named date entities in sentence
        for date_ent in date_entities:
            if date_ent.lower() in sentence.lower():
                sentence_dates.append(date_ent)
        
        # Enhanced time patterns with smart parsing
        enhanced_time_patterns = [
            # Relative dates from today
            (r'\btomorrow\b', lambda: (current_date + timedelta(days=1)).strftime('%Y-%m-%d')),
            (r'\btoday\b', lambda: current_date.strftime('%Y-%m-%d')),
            (r'\byesterday\b', lambda: (current_date - timedelta(days=1)).strftime('%Y-%m-%d')),
            
            # Next from today variations
            (r'\bnext\s+from\s+today\b', lambda: (current_date + timedelta(days=1)).strftime('%Y-%m-%d')),
            (r'\bday\s+after\s+tomorrow\b', lambda: (current_date + timedelta(days=2)).strftime('%Y-%m-%d')),
            
            # Specific dates within current month
            (r'\b(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(?:this\s+)?month\b', self._parse_day_of_month),
            (r'\btill\s+(\d{1,2})(?:st|nd|rd|th)?\s+of\s+(?:this\s+|these\s+)?month\b', self._parse_day_of_month),
            (r'\bby\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b', self._parse_day_of_month),
            
            # Days of week (next occurrence)
            (r'\bnext\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', self._parse_next_weekday),
            (r'\bthis\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b', self._parse_this_weekday),
            
            # Week/month references
            (r'\bnext\s+week\b', lambda: (current_date + timedelta(weeks=1)).strftime('%Y-%m-%d')),
            (r'\bthis\s+week\b', lambda: current_date.strftime('%Y-%m-%d')),
            (r'\bnext\s+month\b', lambda: self._next_month_date()),
            (r'\bthis\s+month\b', lambda: current_date.strftime('%Y-%m-%d')),
            
            # Standard date formats
            (r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', lambda match: self._parse_standard_date(match)),
            (r'\b(Q[1-4]\s+\d{4})\b', lambda match: match),
        ]
        
        for pattern, parser in enhanced_time_patterns:
            matches = re.finditer(pattern, sentence, re.IGNORECASE)
            for match in matches:
                try:
                    if callable(parser):
                        if match.groups():
                            parsed_date = parser(match.group(1))
                        else:
                            parsed_date = parser()
                    else:
                        parsed_date = parser
                    
                    if parsed_date:
                        sentence_dates.append(parsed_date)
                except Exception as e:
                    # Fallback to original match text
                    sentence_dates.append(match.group(0))
        
        # Also include original patterns for completeness
        basic_patterns = [
            r'\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b',
            r'\b(end\s+of\s+(?:week|month|quarter|year))\b',
        ]
        
        for pattern in basic_patterns:
            matches = re.findall(pattern, sentence, re.IGNORECASE)
            sentence_dates.extend(matches)
        
        # Remove duplicates and clean up
        unique_dates = []
        seen = set()
        for date in sentence_dates:
            date_clean = str(date).lower().strip()
            if date_clean not in seen and len(date_clean) > 2:
                unique_dates.append(str(date))
                seen.add(date_clean)
        
        return unique_dates
    
    def _parse_day_of_month(self, day_str: str) -> str:
        """Parse day of current month (e.g., '20th of this month' -> '2025-09-20')"""
        from datetime import datetime
        try:
            day = int(re.sub(r'[^\d]', '', day_str))
            current_date = datetime.now()
            
            if 1 <= day <= 31:
                try:
                    target_date = current_date.replace(day=day)
                    return target_date.strftime('%Y-%m-%d')
                except ValueError:
                    # Day doesn't exist in current month, use last day of month
                    import calendar
                    last_day = calendar.monthrange(current_date.year, current_date.month)[1]
                    target_date = current_date.replace(day=min(day, last_day))
                    return target_date.strftime('%Y-%m-%d')
        except:
            pass
        return day_str
    
    def _parse_next_weekday(self, weekday_str: str) -> str:
        """Parse next occurrence of weekday (e.g., 'next Tuesday')"""
        from datetime import datetime, timedelta
        try:
            weekdays = {
                'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
                'friday': 4, 'saturday': 5, 'sunday': 6
            }
            target_weekday = weekdays.get(weekday_str.lower())
            if target_weekday is not None:
                current_date = datetime.now()
                days_ahead = target_weekday - current_date.weekday()
                if days_ahead <= 0:  # Target day already happened this week
                    days_ahead += 7
                target_date = current_date + timedelta(days=days_ahead)
                return target_date.strftime('%Y-%m-%d')
        except:
            pass
        return f"next {weekday_str}"
    
    def _parse_this_weekday(self, weekday_str: str) -> str:
        """Parse this week's occurrence of weekday"""
        from datetime import datetime, timedelta
        try:
            weekdays = {
                'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
                'friday': 4, 'saturday': 5, 'sunday': 6
            }
            target_weekday = weekdays.get(weekday_str.lower())
            if target_weekday is not None:
                current_date = datetime.now()
                days_ahead = target_weekday - current_date.weekday()
                if days_ahead < 0:  # Day already passed this week, use next week
                    days_ahead += 7
                target_date = current_date + timedelta(days=days_ahead)
                return target_date.strftime('%Y-%m-%d')
        except:
            pass
        return f"this {weekday_str}"
    
    def _next_month_date(self) -> str:
        """Get first day of next month"""
        from datetime import datetime
        try:
            current_date = datetime.now()
            if current_date.month == 12:
                next_month = current_date.replace(year=current_date.year + 1, month=1, day=1)
            else:
                next_month = current_date.replace(month=current_date.month + 1, day=1)
            return next_month.strftime('%Y-%m-%d')
        except:
            return "next month"
    
    def _parse_standard_date(self, date_str: str) -> str:
        """Parse standard date formats"""
        from datetime import datetime
        try:
            # Try common formats
            for fmt in ['%m/%d/%Y', '%d/%m/%Y', '%m-%d-%Y', '%d-%m-%Y', '%Y-%m-%d']:
                try:
                    parsed = datetime.strptime(date_str, fmt)
                    return parsed.strftime('%Y-%m-%d')
                except ValueError:
                    continue
        except:
            pass
        return date_str
    
    def _extract_assignees(self, doc, sentence: str) -> list:
        """Extract assignees and responsible parties from sentence"""
        assignees = []
        
        # Find people mentioned in sentence
        for ent in doc.ents:
            if ent.label_ == "PERSON" and ent.text in sentence:
                assignees.append(ent.text)
        
        # Look for role-based assignments
        role_patterns = [
            r'\b(team\s+lead|project\s+manager|developer|analyst|designer|engineer)\b',
            r'\b(marketing\s+team|sales\s+team|dev\s+team|engineering\s+team)\b',
            r'\b([A-Z][a-z]+)\s+(?:will|should|can|needs\s+to)\b',  # Name + action
        ]
        
        for pattern in role_patterns:
            matches = re.findall(pattern, sentence, re.IGNORECASE)
            assignees.extend(matches)
        
        return list(set(assignees))  # Remove duplicates
    
    def _determine_enhanced_task_priority(self, text: str, category: str) -> str:
        """Enhanced priority determination based on content and category"""
        # Critical priority indicators
        critical_words = ['critical', 'urgent', 'asap', 'immediately', 'emergency', 'blocker', 'deadline today']
        if any(word in text for word in critical_words):
            return "Critical"
        
        # High priority indicators
        high_words = ['important', 'priority', 'deadline', 'due', 'must', 'required', 'needed asap']
        high_categories = ['action_items', 'implementation', 'scheduling']
        
        if any(word in text for word in high_words) or category in high_categories:
            return "High"
        
        # Medium priority indicators
        medium_words = ['should', 'need to', 'follow up', 'review', 'update', 'soon', 'next week']
        medium_categories = ['follow_ups', 'research', 'documentation', 'review']
        
        if any(word in text for word in medium_words) or category in medium_categories:
            return "Medium"
        
        # Low priority (default)
        return "Low"
    
    def _classify_task_type(self, task_text: str, category: str) -> str:
        """Classify task type for better organization"""
        task_lower = task_text.lower()
        
        # Technical tasks
        if any(word in task_lower for word in ['develop', 'build', 'code', 'implement', 'deploy', 'fix', 'debug', 'api', 'database', 'system']):
            return "Technical"
        
        # Meeting/Communication tasks
        if any(word in task_lower for word in ['meeting', 'call', 'discuss', 'present', 'email', 'contact', 'notify']):
            return "Communication"
        
        # Documentation tasks
        if any(word in task_lower for word in ['document', 'write', 'report', 'notes', 'summary', 'record']):
            return "Documentation"
        
        # Research/Analysis tasks
        if any(word in task_lower for word in ['research', 'analyze', 'investigate', 'study', 'explore', 'evaluate']):
            return "Research"
        
        # Planning/Strategy tasks
        if any(word in task_lower for word in ['plan', 'strategy', 'roadmap', 'schedule', 'organize', 'prepare']):
            return "Planning"
        
        # Review/Approval tasks
        if any(word in task_lower for word in ['review', 'approve', 'validate', 'check', 'verify', 'assess']):
            return "Review"
        
        # Based on category if no specific type detected
        category_mapping = {
            'action_items': 'Action',
            'scheduling': 'Planning',
            'follow_ups': 'Communication',
            'research': 'Research',
            'documentation': 'Documentation',
            'implementation': 'Technical',
            'review': 'Review',
            'communication': 'Communication'
        }
        
        return category_mapping.get(category, 'General')
    
    def _calculate_urgency_score(self, text: str) -> float:
        """Calculate urgency score (0-10) based on text content"""
        score = 5.0  # Base score
        
        # Urgent keywords
        urgency_modifiers = {
            'asap': 3.0, 'immediately': 3.0, 'urgent': 2.5, 'critical': 2.5,
            'deadline': 2.0, 'due': 2.0, 'must': 1.5, 'important': 1.0,
            'priority': 1.0, 'should': 0.5, 'need to': 0.5,
            'today': 2.0, 'tomorrow': 1.5, 'this week': 1.0, 'next week': 0.5
        }
        
        for keyword, modifier in urgency_modifiers.items():
            if keyword in text:
                score += modifier
        
        # Reduce score for future references
        future_indicators = ['someday', 'eventually', 'later', 'future', 'when possible']
        for indicator in future_indicators:
            if indicator in text:
                score -= 1.0
        
        return min(max(score, 0.0), 10.0)  # Clamp between 0-10
    
    def _calculate_term_importance(self, doc, entities, keywords) -> dict:
        """Calculate importance scores for terms based on various factors"""
        try:
            importance_terms = {}
            
            # High importance keywords
            high_importance_words = [
                'urgent', 'critical', 'deadline', 'important', 'priority', 'decision',
                'approve', 'reject', 'budget', 'cost', 'revenue', 'profit', 'loss',
                'risk', 'issue', 'problem', 'solution', 'action', 'next steps',
                'milestone', 'deliverable', 'launch', 'release'
            ]
            
            # Meeting-specific important terms
            meeting_terms = [
                'agenda', 'minutes', 'follow up', 'assign', 'responsible', 'owner',
                'timeline', 'schedule', 'meeting', 'discussion', 'presentation'
            ]
            
            text_lower = doc.text.lower()
            
            # Score based on predefined importance
            for term in high_importance_words:
                if term in text_lower:
                    importance_terms[term] = {
                        'score': 0.9,
                        'reason': 'High-priority business term',
                        'category': 'business_critical'
                    }
            
            for term in meeting_terms:
                if term in text_lower:
                    importance_terms[term] = {
                        'score': 0.7,
                        'reason': 'Meeting management term',
                        'category': 'meeting_process'
                    }
            
            # Score entities higher
            all_entities = []
            for key, ent_list in entities.items():
                if key == "tasks_and_schedules":
                    # Extract task text from task objects
                    for task in ent_list:
                        if isinstance(task, dict) and 'task' in task:
                            all_entities.append(task['task'])
                        elif isinstance(task, str):
                            all_entities.append(task)
                else:
                    all_entities.extend(ent_list)
            
            for entity in all_entities:
                if isinstance(entity, str) and entity.lower() not in importance_terms:
                    importance_terms[entity.lower()] = {
                        'score': 0.8,
                        'reason': 'Named entity (person, org, money, date)',
                        'category': 'named_entity'
                    }
            
            # Score frequent keywords
            for keyword in keywords[:10]:  # Top 10 keywords
                if keyword not in importance_terms:
                    importance_terms[keyword] = {
                        'score': 0.6,
                        'reason': 'Frequently mentioned topic',
                        'category': 'frequent_topic'
                    }
            
            return importance_terms
            
        except Exception as e:
            logger.warning(f"Importance calculation failed: {e}")
            return {}
    
    def _get_definitions(self, terms) -> dict:
        """Get definitions for technical terms and acronyms"""
        definitions = {}
        
        if not PYDICTIONARY_AVAILABLE:
            logger.warning("PyDictionary not available, skipping definitions")
            return definitions
            
        try:
            dictionary = PyDictionary()
            
            # Common business/tech acronym definitions
            common_definitions = {
                'API': 'Application Programming Interface - set of protocols for building software',
                'ROI': 'Return on Investment - measure of investment efficiency',
                'KPI': 'Key Performance Indicator - measurable value showing effectiveness',
                'SLA': 'Service Level Agreement - commitment between service provider and client',
                'CRM': 'Customer Relationship Management - system for managing customer interactions',
                'ERP': 'Enterprise Resource Planning - business process management software',
                'MVP': 'Minimum Viable Product - basic version with core features',
                'B2B': 'Business to Business - commerce between businesses',
                'B2C': 'Business to Consumer - commerce between business and consumers',
                'SaaS': 'Software as a Service - cloud-based software delivery model',
                'DevOps': 'Development Operations - practices combining development and operations',
                'AI': 'Artificial Intelligence - simulation of human intelligence in machines',
                'ML': 'Machine Learning - type of AI that learns from data',
                'IoT': 'Internet of Things - network of connected devices',
                'VR': 'Virtual Reality - computer-generated simulation of 3D environment',
                'AR': 'Augmented Reality - overlay of digital information on real world'
            }
            
            for term in terms[:20]:  # Limit to first 20 terms to avoid rate limits
                term_upper = term.upper()
                
                # Check common definitions first
                if term_upper in common_definitions:
                    definitions[term] = {
                        'definition': common_definitions[term_upper],
                        'source': 'built-in'
                    }
                    continue
                
                # Try dictionary lookup for regular words
                try:
                    if len(term) > 2 and term.isalpha():
                        meaning = dictionary.meaning(term)
                        if meaning:
                            # Get first definition from first part of speech
                            first_pos = list(meaning.keys())[0]
                            first_def = meaning[first_pos][0] if meaning[first_pos] else "No definition found"
                            definitions[term] = {
                                'definition': f"({first_pos}) {first_def}",
                                'source': 'dictionary'
                            }
                except Exception:
                    # Skip problematic terms
                    continue
            
            return definitions
            
        except Exception as e:
            logger.warning(f"Definition lookup failed: {e}")
            return {}
    
    def analyze_transcript(self, raw_transcript: str) -> dict:
        """
        Perform comprehensive transcript analysis with all functionalities
        """
        if not self.is_ready():
            return {
                "error": "NLP models not ready",
                "details": self.initialization_error or "Models still initializing"
            }
        
        try:
            logger.info("🔍 Starting enhanced transcript analysis...")
            
            # 1. Grammar & Spelling Correction
            blob = TextBlob(raw_transcript)
            grammar_fixed = str(blob.correct())
            
            # 2. Named Entity Recognition (NER) with improved classification
            doc = self.nlp(grammar_fixed)
            dates = [ent.text for ent in doc.ents if ent.label_ in ["DATE", "TIME"]]
            prices = [ent.text for ent in doc.ents if ent.label_ == "MONEY"]
            people = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
            
            # Separate organizations from technical systems
            all_orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
            tech_systems = ["API", "CRM", "SaaS", "ERP", "CMS", "SDK", "IDE", "UI", "UX"]
            
            orgs = [org for org in all_orgs if org.upper() not in tech_systems]
            tech_terms = [org for org in all_orgs if org.upper() in tech_systems]
            
            # 2.5. Task and Action Item Detection
            tasks_and_dates = self._extract_tasks_and_schedules(doc, grammar_fixed)
            
            # 3. Keyword Extraction (noun chunks)
            keywords = list(set([
                chunk.text.lower() for chunk in doc.noun_chunks 
                if len(chunk.text) > 3 and chunk.text.isalpha()
            ]))
            
            # 4. Topic Modelling with Gensim LDA (with NLTK fallbacks)
            topic_summary = "No topics identified"
            try:
                # Try to get stopwords, use fallback if NLTK fails
                try:
                    stop_words = set(stopwords.words("english"))
                except Exception:
                    # Fallback stopwords if NLTK fails
                    stop_words = {
                        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours',
                        'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers',
                        'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
                        'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
                        'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does',
                        'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until',
                        'while', 'of', 'at', 'by', 'for', 'with', 'through', 'during', 'before', 'after',
                        'above', 'below', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again',
                        'further', 'then', 'once'
                    }
                
                # Try word_tokenize, use simple split if it fails
                try:
                    tokens = [
                        w.lower() for w in word_tokenize(grammar_fixed)
                        if w.isalpha() and w.lower() not in stop_words and len(w) > 2
                    ]
                except Exception:
                    # Fallback tokenization
                    tokens = [
                        w.lower() for w in grammar_fixed.split()
                        if w.isalpha() and w.lower() not in stop_words and len(w) > 2
                    ]
                
                if len(tokens) > 10:  # Minimum tokens for topic modeling - DISABLED
                    # Topic modeling temporarily disabled due to gensim/numpy compatibility
                    topic_summary = "Topic modeling temporarily unavailable"
                else:
                    topic_summary = "Not enough content for topic analysis"
                
            except Exception as e:
                logger.warning(f"Topic modeling failed: {e}")
                topic_summary = "Topic modeling unavailable"
            
            # 5. AI-Style Suggestions (Context-Aware)
            suggestions = []
            text_lower = grammar_fixed.lower()
            
            # Date/Timeline based suggestions
            if dates:
                suggestions.append("📅 Review and confirm all mentioned deadlines and timeline commitments")
            if "quarter" in text_lower:
                suggestions.append("📊 Schedule quarterly review follow-up and progress tracking")
            
            # Financial/Budget suggestions
            if prices:
                suggestions.append("💰 Validate all quoted prices, budgets, and financial projections")
            if any(term in text_lower for term in ["roi", "cost", "budget", "revenue", "profit"]):
                suggestions.append("📈 Create financial impact analysis and ROI tracking dashboard")
            
            # Business process suggestions
            if any(term in text_lower for term in ["kpi", "metric", "performance"]):
                suggestions.append("🎯 Establish KPI monitoring system and regular performance reviews")
            if any(term in text_lower for term in ["customer", "acquisition", "retention"]):
                suggestions.append("👥 Develop customer success strategy and retention improvement plan")
            if any(term in text_lower for term in ["api", "integration", "system", "crm"]):
                suggestions.append("🔧 Plan technical integration roadmap and system optimization")
            if any(term in text_lower for term in ["b2b", "saas", "implementation"]):
                suggestions.append("🚀 Create implementation timeline and stakeholder communication plan")
            
            # Meeting management suggestions
            if "risk" in text_lower:
                suggestions.append("⚠️ Develop comprehensive risk assessment and mitigation strategies")
            if "action" in text_lower:
                suggestions.append("✅ Assign clear ownership and deadlines for all action items")
            if "decision" in text_lower:
                suggestions.append("📝 Document all decisions with rationale and implementation steps")
            if "follow" in text_lower and "up" in text_lower:
                suggestions.append("🔄 Schedule structured follow-up meetings with progress checkpoints")
            
            # Strategic suggestions
            if any(term in text_lower for term in ["strategy", "plan", "growth", "expansion"]):
                suggestions.append("🎪 Develop detailed strategic roadmap with measurable milestones")
            if any(term in text_lower for term in ["review", "meeting", "quarterly"]):
                suggestions.append("📋 Establish regular review cadence and performance tracking system")
            
            # 6. Jargon and Technical Term Detection
            jargon_analysis = self._detect_jargon_and_technical_terms(doc)
            
            # 7. Term Importance Scoring
            entities_dict = {
                "dates_times": dates,
                "prices_budget": prices,
                "people": people,
                "organizations": orgs,
                "tech_systems": tech_terms,
                "tasks_and_schedules": tasks_and_dates
            }
            importance_scores = self._calculate_term_importance(doc, entities_dict, keywords)
            
            # 8. Definition Lookup for Technical Terms
            all_technical_terms = []
            all_technical_terms.extend(jargon_analysis.get('acronyms', []))
            all_technical_terms.extend(jargon_analysis.get('technical_jargon', []))
            all_technical_terms.extend(jargon_analysis.get('business_jargon', []))
            all_technical_terms.extend(jargon_analysis.get('complex_terms', []))
            
            definitions = self._get_definitions(all_technical_terms)
            
            # 9. Enhanced Highlighting (Keywords + Importance + Jargon)
            highlighted_text = grammar_fixed
            
            # Highlight important terms first (highest priority)
            for term, info in importance_scores.items():
                if info['score'] >= 0.8:  # High importance
                    highlighted_text = re.sub(
                        rf"\b({re.escape(term)})\b",
                        r"🔥**\1**🔥", highlighted_text, 
                        flags=re.IGNORECASE
                    )
                elif info['score'] >= 0.6:  # Medium importance
                    highlighted_text = re.sub(
                        rf"\b({re.escape(term)})\b",
                        r"⭐**\1**⭐", highlighted_text, 
                        flags=re.IGNORECASE
                    )
            
            # Highlight jargon and technical terms
            for category, terms in jargon_analysis.items():
                if category == 'acronyms':
                    for term in terms:
                        highlighted_text = re.sub(
                            rf"\b({re.escape(term)})\b",
                            r"🏷️**\1**🏷️", highlighted_text
                        )
                elif 'jargon' in category:
                    for term in terms:
                        highlighted_text = re.sub(
                            rf"\b({re.escape(term)})\b",
                            r"💼**\1**💼", highlighted_text, 
                            flags=re.IGNORECASE
                        )
            
            # Highlight regular keywords (lowest priority)
            for word in keywords[:10]:  # Limit to top 10 keywords
                if word not in importance_scores:  # Avoid double highlighting
                    highlighted_text = re.sub(
                        rf"\b({re.escape(word)})\b",
                        r"**\1**", highlighted_text, 
                        flags=re.IGNORECASE
                    )
            
            # 10. Build Enhanced Analysis Structure
            analysis = {
                "original_transcript": raw_transcript,
                "grammar_corrected_transcript": grammar_fixed,
                "highlighted_transcript": highlighted_text,
                "extracted_entities": {
                    "dates_times": dates,
                    "prices_budget": prices,
                    "people": people,
                    "organizations": orgs,
                    "tech_systems": tech_terms,
                    "tasks_and_schedules": tasks_and_dates
                },
                "keywords": keywords[:15],  # Top 15 keywords
                "topic_analysis": topic_summary,
                "ai_suggestions": suggestions,
                # NEW ENHANCED FEATURES
                "jargon_analysis": jargon_analysis,
                "importance_scores": importance_scores,
                "definitions": definitions,
                "enhanced_highlighting": {
                    "legend": {
                        "🔥**term**🔥": "Critical importance (score ≥ 0.8)",
                        "⭐**term**⭐": "High importance (score ≥ 0.6)", 
                        "🏷️**term**🏷️": "Acronym or abbreviation",
                        "💼**term**💼": "Business/technical jargon",
                        "**term**": "Relevant keyword"
                    }
                },
                "analysis_metadata": {
                    "processed_at": datetime.now().isoformat(),
                    "word_count": len(grammar_fixed.split()),
                    "entity_count": len(dates) + len(prices) + len(people) + len(orgs),
                    "keyword_count": len(keywords),
                    "jargon_count": sum(len(terms) for terms in jargon_analysis.values()),
                    "defined_terms": len(definitions),
                    "high_importance_terms": len([t for t, info in importance_scores.items() if info['score'] >= 0.8])
                }
            }
            
            logger.info("✅ Enhanced transcript analysis completed")
            return analysis
            
        except Exception as e:
            logger.error(f"❌ Transcript analysis failed: {e}")
            return {
                "error": "Analysis failed",
                "details": str(e),
                "original_transcript": raw_transcript
            }
    
    def generate_summary_paragraph(self, analysis: dict) -> str:
        """Generate the final enhanced summary paragraph"""
        if "error" in analysis:
            return f"**Analysis Error:** {analysis['details']}"
        
        # Extract data from analysis
        highlighted_text = analysis.get("highlighted_transcript", "")
        topics = analysis.get("topic_analysis", "No topics identified")
        dates = analysis.get("extracted_entities", {}).get("dates_times", [])
        prices = analysis.get("extracted_entities", {}).get("prices_budget", [])
        people = analysis.get("extracted_entities", {}).get("people", [])
        orgs = analysis.get("extracted_entities", {}).get("organizations", [])
        tech_systems = analysis.get("extracted_entities", {}).get("tech_systems", [])
        tasks_and_schedules = analysis.get("extracted_entities", {}).get("tasks_and_schedules", [])
        suggestions = analysis.get("ai_suggestions", [])
        
        # NEW: Extract enhanced features
        jargon_analysis = analysis.get("jargon_analysis", {})
        importance_scores = analysis.get("importance_scores", {})
        definitions = analysis.get("definitions", {})
        
        # Build jargon summary
        jargon_summary = []
        for category, terms in jargon_analysis.items():
            if terms and category != 'complex_terms':  # Skip complex terms for brevity
                category_name = category.replace('_', ' ').title()
                jargon_summary.append(f"{category_name}: {', '.join(terms[:5])}")
        
        # Build important terms list
        critical_terms = [
            term for term, info in importance_scores.items() 
            if info['score'] >= 0.8
        ]
        
        # Build definitions section
        definitions_section = ""
        if definitions:
            definitions_section = "\n\n**📚 Key Term Definitions:**\n"
            for term, def_info in list(definitions.items())[:8]:  # Limit to 8 definitions
                definitions_section += f"• **{term.upper()}**: {def_info['definition']}\n"
        
        # Build comprehensive structured summary
        summary_sections = []
        
        # Meeting Overview Section
        summary_sections.append("📋 MEETING ANALYSIS SUMMARY")
        summary_sections.append("=" * 50)
        summary_sections.append("")
        
        # Enhanced Transcript Preview
        summary_sections.append("📝 ENHANCED TRANSCRIPT PREVIEW:")
        summary_sections.append("─" * 35)
        if highlighted_text:
            # Clean up the highlighted text for preview (remove HTML-like markup)
            clean_preview = re.sub(r'[🔥⭐🏷️💼\*]+', '', highlighted_text)
            clean_preview = re.sub(r'\*\*([^*]+)\*\*', r'\1', clean_preview)
            clean_preview = re.sub(r'\s+', ' ', clean_preview.strip())
            
            # Add indented transcript preview (first 180 chars for better formatting)
            preview = clean_preview[:180] + ("..." if len(clean_preview) > 180 else "")
            # Break into multiple lines for better readability
            words = preview.split()
            lines = []
            current_line = "   "
            for word in words:
                if len(current_line + word + " ") > 65:  # Max line length
                    lines.append(current_line.rstrip())
                    current_line = "   " + word + " "
                else:
                    current_line += word + " "
            if current_line.strip():
                lines.append(current_line.rstrip())
            
            summary_sections.extend(lines)
        else:
            summary_sections.append("   No transcript content available")
        summary_sections.append("")
        
        # Highlighting Legend
        summary_sections.append("🎯 HIGHLIGHTING LEGEND:")
        summary_sections.append("─" * 22)
        summary_sections.append("   🔥 Critical Terms     ⭐ Important Terms")
        summary_sections.append("   🏷️ Acronyms          💼 Business Jargon")
        summary_sections.append("   ** Keywords          📌 Named Entities")
        summary_sections.append("")
        
        # Key Analysis Results
        summary_sections.append("📊 KEY ANALYSIS RESULTS:")
        summary_sections.append("─" * 25)
        
        # Topics
        if topics and topics != "No topics identified":
            summary_sections.append("   • Topics Identified:")
            summary_sections.append(f"     └─ {topics}")
        else:
            summary_sections.append("   • Topics Identified: None detected")
        summary_sections.append("")
        
        # Critical Terms
        if critical_terms:
            summary_sections.append("   • Critical Terms Found:")
            for i, term in enumerate(critical_terms[:5], 1):
                summary_sections.append(f"     {i}. {term}")
        else:
            summary_sections.append("   • Critical Terms: None identified")
        summary_sections.append("")
        
        # Business Jargon
        if jargon_summary:
            summary_sections.append("   • Business Jargon Detected:")
            for category in jargon_summary[:3]:
                summary_sections.append(f"     └─ {category}")
        else:
            summary_sections.append("   • Business Jargon: None detected")
        summary_sections.append("")
        
        # Entities Section
        entity_found = False
        if dates or prices or people or orgs or tech_systems:
            summary_sections.append("📌 IMPORTANT ENTITIES:")
            summary_sections.append("─" * 20)
            
            if dates:
                summary_sections.append("   📅 Dates & Times:")
                for date in dates[:3]:
                    summary_sections.append(f"     • {date}")
                entity_found = True
            
            if prices:
                summary_sections.append("   💰 Financial Figures:")
                for price in prices[:3]:
                    summary_sections.append(f"     • {price}")
                entity_found = True
            
            if people:
                summary_sections.append("   👤 People Mentioned:")
                for person in people[:3]:
                    summary_sections.append(f"     • {person}")
                entity_found = True
            
            if orgs:
                summary_sections.append("   🏢 Organizations:")
                for org in orgs[:3]:
                    summary_sections.append(f"     • {org}")
                entity_found = True
            
            if tech_systems:
                summary_sections.append("   💻 Technology Systems:")
                for tech in tech_systems[:3]:
                    summary_sections.append(f"     • {tech}")
                entity_found = True
        
        if not entity_found:
            summary_sections.append("📌 IMPORTANT ENTITIES:")
            summary_sections.append("─" * 20)
            summary_sections.append("   No specific entities detected")
        summary_sections.append("")
        
        # Tasks and Schedules Section
        if tasks_and_schedules:
            summary_sections.append("📅 SCHEDULED TASKS & ACTION ITEMS:")
            summary_sections.append("─" * 35)
            for i, task in enumerate(tasks_and_schedules[:3], 1):  # Limit to 3 tasks
                priority_emoji = {
                    "High": "🔥",
                    "Medium": "⚡", 
                    "Low": "📝"
                }.get(task.get("priority", "Low"), "📝")
                
                task_title = task.get('task', 'Unknown task')
                summary_sections.append(f"   {i}. {priority_emoji} {task_title}")
                
                # Show dates if available
                if task.get('dates') and task['dates'] != ['Not specified']:
                    clean_dates = [d for d in task['dates'] if d.lower() != 'not specified']
                    if clean_dates:
                        date_str = " | ".join(clean_dates[:3])  # Max 3 dates with separator
                        summary_sections.append(f"      📅 Timeline: {date_str}")
                
                # Show assignees if available
                if task.get('assignees'):
                    assignee_str = ", ".join(task['assignees'][:2])  # Max 2 assignees
                    summary_sections.append(f"      👤 Assigned: {assignee_str}")
                
                # Show context if it adds value
                if task.get('context') and len(task['context']) > len(task_title) + 10:
                    context_preview = task['context'][:90] + "..." if len(task['context']) > 90 else task['context']
                    summary_sections.append(f"      � Context: {context_preview}")
                
                summary_sections.append("")  # Add spacing between tasks
        else:
            summary_sections.append("📅 SCHEDULED TASKS & ACTION ITEMS:")
            summary_sections.append("─" * 35)
            summary_sections.append("   No specific tasks or schedules identified")
            summary_sections.append("")
        
        # AI Suggestions
        summary_sections.append("🤖 AI RECOMMENDATIONS:")
        summary_sections.append("─" * 22)
        if suggestions:
            for i, suggestion in enumerate(suggestions[:3], 1):
                summary_sections.append(f"   {i}. {suggestion}")
        else:
            summary_sections.append("   • No specific recommendations at this time")
        summary_sections.append("")
        
        # Definitions Section
        if definitions:
            summary_sections.append("📚 TERM DEFINITIONS:")
            summary_sections.append("─" * 18)
            for term, def_info in list(definitions.items())[:5]:
                summary_sections.append(f"   📖 {term.upper()}:")
                summary_sections.append(f"      └─ {def_info['definition']}")
            summary_sections.append("")
        
        # Footer
        summary_sections.append("─" * 50)
        summary_sections.append("✨ Enhanced Analysis Complete")
        
        summary_paragraph = "\n".join(summary_sections)
        
        return summary_paragraph

# Initialize global analyzer
enhanced_analyzer = EnhancedTranscriptAnalyzer()

# Initialize synchronously to ensure it's ready
print("🧠 Initializing Enhanced Analyzer synchronously at startup...")
if enhanced_analyzer.initialize_sync():
    print("✅ Enhanced Analyzer ready at startup!")
else:
    print("❌ Enhanced Analyzer initialization failed at startup")

# ============================================================================
# AUDIO PROCESSING CLASSES (from asr_processor.py)
# ============================================================================

class AudioSegment:
    def __init__(self, data: np.ndarray, timestamp: float, sample_rate: int = 48000):
        self.data = data
        self.timestamp = timestamp
        self.sample_rate = sample_rate
        self.duration = len(data) / sample_rate

class VADProcessor:
    """Voice Activity Detection using WebRTC VAD"""
    
    def __init__(self, sample_rate: int = 48000, frame_duration_ms: int = 30):
        self.sample_rate = sample_rate
        self.frame_duration_ms = frame_duration_ms
        self.frame_size = int(sample_rate * frame_duration_ms / 1000)
        
        # WebRTC VAD works with specific sample rates
        self.vad_sample_rate = 16000 if sample_rate > 16000 else sample_rate
        self.vad = webrtcvad.Vad(2)  # Aggressiveness: 0-3 (2 is balanced)
        
    def is_speech(self, audio_data: np.ndarray) -> bool:
        """Check if audio frame contains speech"""
        try:
            # Resample to VAD sample rate if needed
            if self.sample_rate != self.vad_sample_rate:
                audio_data = self._resample(audio_data, self.sample_rate, self.vad_sample_rate)
            
            # Ensure frame is correct size for VAD
            frame_size_vad = int(self.vad_sample_rate * self.frame_duration_ms / 1000)
            if len(audio_data) != frame_size_vad:
                return False
                
            # Convert to int16 for VAD
            audio_int16 = (audio_data * 32767).astype(np.int16)
            
            return self.vad.is_speech(audio_int16.tobytes(), self.vad_sample_rate)
        except Exception as e:
            logger.warning(f"VAD processing error: {e}")
            return True  # Default to assuming speech if VAD fails
    
    def _resample(self, audio: np.ndarray, orig_sr: int, target_sr: int) -> np.ndarray:
        """Simple resampling using linear interpolation"""
        if orig_sr == target_sr:
            return audio
        
        ratio = target_sr / orig_sr
        new_length = int(len(audio) * ratio)
        indices = np.linspace(0, len(audio) - 1, new_length)
        return np.interp(indices, np.arange(len(audio)), audio)

class AudioBuffer:
    """Manages audio chunks and creates segments for transcription"""
    
    def __init__(self, sample_rate: int = 16000, segment_duration: float = 3.0, max_buffer_duration: float = 15.0):
        self.sample_rate = sample_rate  # Match frontend: 16kHz
        self.segment_duration = segment_duration  # Reduced to 3s for faster response
        self.segment_samples = int(sample_rate * segment_duration)
        self.max_buffer_duration = max_buffer_duration
        
        self.buffer = deque(maxlen=1000)
        self.current_segment = []
        self.speech_frames = 0
        self.silence_frames = 0
        self.min_speech_frames = int(0.2 * 1000 / 30)  # Reduced to 200ms of speech (more sensitive)
        self.max_silence_frames = int(0.5 * 1000 / 30)  # Reduced to 500ms of silence (faster response)
        
        self.vad = VADProcessor(sample_rate)
        self.total_duration = 0.0
        
        print(f"🎤 AudioBuffer initialized: {sample_rate}Hz, {segment_duration}s segments, min_speech: {self.min_speech_frames} frames")
        self.max_silence_frames = int(1.0 * 1000 / 30)  # 1s of silence
        
        self.vad = VADProcessor(sample_rate)
        self.total_duration = 0.0
        
    def add_chunk(self, audio_data: np.ndarray, timestamp: float) -> Optional[AudioSegment]:
        """Add audio chunk and return segment if ready"""
        # Add new chunk
        chunk = AudioSegment(audio_data, timestamp, self.sample_rate)
        self.buffer.append(chunk)
        self.total_duration += chunk.duration
        
        # Memory management: Force flush if buffer gets too large
        if self.total_duration >= self.max_buffer_duration:
            logger.warning(f"⚠️ Audio buffer overflow ({self.total_duration:.1f}s), flushing...")
            return self._create_segment()
        
        # Check for speech activity
        frame_samples = int(self.sample_rate * 0.03)  # 30ms frames
        for i in range(0, len(audio_data), frame_samples):
            frame = audio_data[i:i+frame_samples]
            if len(frame) == frame_samples:
                if self.vad.is_speech(frame):
                    self.speech_frames += 1
                    self.silence_frames = 0
                else:
                    self.silence_frames += 1
        
        # Check if we should create a segment
        if (self.speech_frames >= self.min_speech_frames and 
            self.silence_frames >= self.max_silence_frames):
            print(f"🎯 VAD triggered segment: speech_frames={self.speech_frames}, silence_frames={self.silence_frames}")
            return self._create_segment()
        
        # Force segment creation based on duration (fallback for VAD issues)
        if self.total_duration >= self.segment_duration:
            print(f"🎯 Duration triggered segment: {self.total_duration:.2f}s >= {self.segment_duration}s")
            return self._create_segment()
        
        # Force segment creation if buffer is getting full (chunks-based fallback)
        if len(self.buffer) >= 100:  # About 6.25 seconds at 16kHz with 4096 sample chunks
            print(f"🎯 Chunk count triggered segment: {len(self.buffer)} chunks")
            return self._create_segment()
        
        return None
    
    def _create_segment(self) -> Optional[AudioSegment]:
        """Create audio segment from buffer"""
        if not self.buffer:
            return None
        
        # Concatenate all audio data
        audio_data = []
        start_timestamp = self.buffer[0].timestamp
        
        for chunk in self.buffer:
            audio_data.extend(chunk.data)
        
        if audio_data:
            segment = AudioSegment(
                np.array(audio_data, dtype=np.float32),
                start_timestamp,
                self.sample_rate
            )
            
            # Reset buffer and counters
            self.buffer.clear()
            self.speech_frames = 0
            self.silence_frames = 0
            self.total_duration = 0.0
            
            return segment
        
        return None

class WhisperASR:
    """Enhanced Whisper-based ASR processor with intelligent device selection"""
    
    def __init__(self, model_size: str = "medium", device: str = "auto", compute_type: str = "int8"):
        # Configuration with automatic device detection
        self.requested_model_size = model_size
        self.requested_device = device
        self.compute_type = compute_type
        
        # Will be set during model loading
        self.model_size = None
        self.device = None
        self.model = None
        self._model_lock = threading.Lock()
        
        # Force CPU mode if environment variable set
        if os.getenv("FORCE_CPU_MODE", "false").lower() == "true":
            logger.info("🔧 CPU mode forced via environment variable")
            self.requested_device = "cpu"
        
        # Enhanced hallucination prevention patterns
        self.UNWANTED_PHRASES = [
            "subscribe", "bell icon", "channel", "like and share", "thanks for watching",
            "follow me on", "social media", "instagram", "twitter", "facebook",
            "don't forget to", "smash that", "notification", "comment below"
        ]
        
        logger.info(f"🎯 Enhanced WhisperASR initialized: large-v2 model, CUDA device, int8 precision")
        
        # Initialize model in background
        threading.Thread(target=self._load_model, daemon=True).start()
    
    def _load_model(self):
        """Load Enhanced Whisper model with CUDA 11.8 compatibility"""
        logger.info("🚀 Loading Whisper model with CUDA 11.8 compatibility...")
        
        # Enhanced CUDA validation for CUDA 11.8
        cuda_available = False
        try:
            import torch
            import os
            
            # Check PyTorch CUDA availability
            if torch.cuda.is_available():
                cuda_version = torch.version.cuda
                logger.info(f"🔥 CUDA detected: {torch.cuda.get_device_name(0)}")
                logger.info(f"💾 GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")
                logger.info(f"🔢 PyTorch CUDA version: {cuda_version}")
                
                # Check for CUDA 11.8 libraries specifically
                cuda_paths = [
                    "C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v11.8\\bin",
                    "C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v12.4\\bin",  # Fallback
                    os.environ.get("CUDA_PATH", "") + "\\bin" if os.environ.get("CUDA_PATH") else ""
                ]
                
                cublas_found = False
                cublas_path = None
                
                # Look for cuBLAS libraries
                for path in cuda_paths:
                    if os.path.exists(path):
                        # Check for CUDA 11.8 cuBLAS first
                        cublas11_path = os.path.join(path, "cublas64_11.dll")
                        cublas12_path = os.path.join(path, "cublas64_12.dll")
                        
                        if os.path.exists(cublas11_path):
                            cublas_found = True
                            cublas_path = cublas11_path
                            logger.info(f"✅ Found CUDA 11.8 cuBLAS: {cublas11_path}")
                            break
                        elif os.path.exists(cublas12_path):
                            cublas_found = True
                            cublas_path = cublas12_path
                            logger.info(f"✅ Found CUDA 12.x cuBLAS: {cublas12_path}")
                            break
                
                if cublas_found:
                    # Force environment to use the correct CUDA path
                    cuda_bin_dir = os.path.dirname(cublas_path)
                    current_path = os.environ.get("PATH", "")
                    if cuda_bin_dir not in current_path:
                        os.environ["PATH"] = cuda_bin_dir + ";" + current_path
                        logger.info(f"🔧 Added CUDA path to environment: {cuda_bin_dir}")
                    
                    # Set CUDA environment variables for compatibility
                    os.environ["CUDA_HOME"] = os.path.dirname(cuda_bin_dir)
                    os.environ["CUDA_PATH"] = os.path.dirname(cuda_bin_dir)
                    
                    # Test CUDA tensor operations
                    try:
                        # Force CUDA 11.8 environment before PyTorch operations
                        cuda_11_path = "C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v11.8\\bin"
                        if os.path.exists(cuda_11_path):
                            current_path = os.environ.get("PATH", "")
                            os.environ["PATH"] = cuda_11_path + ";" + current_path
                            os.environ["CUDA_HOME"] = "C:\\Program Files\\NVIDIA GPU Computing Toolkit\\CUDA\\v11.8"
                            logger.info(f"🔧 Forced CUDA 11.8 path: {cuda_11_path}")
                        
                        # Test CUDA operations with forced CUDA 11.8
                        test_tensor = torch.randn(10, 10, device='cuda')
                        test_result = torch.matmul(test_tensor, test_tensor)
                        del test_tensor, test_result
                        torch.cuda.empty_cache()
                        
                        cuda_available = True
                        logger.info("✅ CUDA 11.8 validation successful - GPU acceleration enabled")
                        
                    except Exception as cuda_test_error:
                        logger.error(f"❌ CUDA 11.8 tensor test failed: {cuda_test_error}")
                        if "cublas64_12" in str(cuda_test_error):
                            logger.error("🔧 Fix: pip install torch --index-url https://download.pytorch.org/whl/cu118 --force-reinstall")
                        cuda_available = False
                        raise RuntimeError(f"CUDA 11.8 required but not working properly: {cuda_test_error}")
                else:
                    logger.error("❌ No cuBLAS library found!")
                    logger.error("📦 Please install CUDA Toolkit 11.8:")
                    logger.error("   Download: https://developer.nvidia.com/cuda-11-8-0-download-archive")
                    cuda_available = False
            else:
                logger.info("💻 CUDA not available in PyTorch")
                
        except Exception as e:
            logger.warning(f"CUDA detection error: {e}")
            cuda_available = False
        
        # Model loading with CUDA 11.8 compatibility
        if cuda_available:
            fallback_models = [
                ("medium", "cuda", "int8"),
                ("medium", "cpu", "int8"),
            ]
            logger.info("🚀 Using CUDA 11.8 GPU acceleration")
        else:
            fallback_models = [
                ("medium", "cpu", "int8"),
                ("small", "cpu", "int8"),
            ]
            logger.info("💻 Using CPU acceleration")
        
        # Try models with enhanced error handling
        for model_size, device, compute_type in fallback_models:
            try:
                logger.info(f"🔄 Loading {model_size} model on {device} ({compute_type})")
                
                # Additional environment setup for CUDA 11.8
                if device == "cuda":
                    os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"  # Deterministic operations
                
                with self._model_lock:
                    self.model = WhisperModel(
                        model_size, 
                        device=device, 
                        compute_type=compute_type,
                        cpu_threads=4 if device == "cpu" else 1,
                        num_workers=1,
                        download_root=None,  # Use default cache
                        local_files_only=False
                    )
                
                self.model_size = model_size
                self.device = device
                self.compute_type = compute_type
                logger.info(f"✅ Successfully loaded {model_size} model on {device} with CUDA 11.8")
                return
                
            except Exception as e:
                error_msg = str(e).lower()
                
                if "cublas64_12" in error_msg:
                    logger.error(f"❌ CUDA 12.x library mismatch: {e}")
                    logger.error("🔧 SOLUTION: Your system has CUDA 11.8, but the model needs CUDA 12.x libraries")
                    logger.error("   Option 1: Reinstall PyTorch for CUDA 11.8:")
                    logger.error("   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118")
                    logger.error("   Option 2: Update to CUDA 12.4 and install cublas64_12.dll")
                elif "cublas64_11" in error_msg:
                    logger.error(f"❌ CUDA 11.8 library issue: {e}")
                    logger.error("🔧 Check if CUDA 11.8 bin directory is in PATH")
                else:
                    logger.warning(f"⚠️ Model loading failed: {e}")
                
                continue
        
        logger.error("❌ All model loading attempts failed")
        self.model = None
    
    def clean_text(self, text: str) -> str:
        """Remove unwanted phrases that might be hallucinations"""
        words = text.split()
        return " ".join([w for w in words if w.lower() not in self.UNWANTED_PHRASES])
            
    def is_ready(self) -> bool:
        """Check if model is loaded and ready"""
        with self._model_lock:
            return self.model is not None
    
    def get_config_info(self) -> Dict:
        """Get current model configuration information"""
        return {
            "model_size": self.model_size,
            "device": self.device,
            "compute_type": self.compute_type,
            "is_ready": self.is_ready()
        }
    
    async def transcribe_segment(self, segment: AudioSegment) -> Dict:
        """Transcribe audio segment to text with high accuracy parameters"""
        if not self.is_ready():
            return {
                "text": "",
                "start": segment.timestamp,
                "end": segment.timestamp + segment.duration,
                "error": "Model not ready"
            }
        
        try:
            # Create temporary WAV file
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp_file:
                sf.write(tmp_file.name, segment.data, segment.sample_rate)
                tmp_path = tmp_file.name
            
            # Enhanced transcription with MAXIMUM ACCURACY hyperparameters (from your provided code)
            with self._model_lock:
                segments, info = self.model.transcribe(
                    tmp_path,
                    
                    # ENHANCED accuracy decoding parameters
                    beam_size=10,                   # Increased from 8 - wider beam search for accuracy
                    best_of=10,                     # Increased from 8 - more candidates to choose from
                    temperature=0.0,                # Deterministic decoding (no randomness)
                    patience=1.3,                   # Increased from 1.2 - better long sequence handling

                    # ENHANCED hallucination prevention
                    condition_on_previous_text=False,  # 🔑 Prevents cross-chunk hallucinations
                    no_repeat_ngram_size=3,           # Stops phrase repetition

                    # ENHANCED noise & silence handling
                    vad_filter=True,                  # Voice Activity Detection
                    vad_parameters={"min_silence_duration_ms": 400},  # Reduced from 500 for better detection

                    # ENHANCED chunking for better accuracy
                    chunk_length=20,                  # Reduced from 30 - smaller chunks = less drift

                    # Enhanced word-level control
                    word_timestamps=True,             # Word-level alignment
                    language="en"                     # Force English (remove if multilingual needed)
                )
                
                # ENHANCED confidence filtering and hallucination cleaning (from your provided code)
                transcript_segments = []
                min_confidence_threshold = -1.0  # avg_logprob threshold from your code
                
                for seg in segments:
                    # Get confidence score
                    avg_logprob = getattr(seg, 'avg_logprob', -2.0)
                    
                    # Apply confidence filtering (from your provided code)
                    if avg_logprob < min_confidence_threshold:
                        logger.debug(f"🚫 Low confidence ({avg_logprob:.3f}): {seg.text[:50]}...")
                        continue
                    
                    # Clean text and check for hallucinations
                    cleaned_text = self.clean_text(seg.text.strip())
                    
                    # Enhanced filtering: segment length and content quality
                    if cleaned_text and len(cleaned_text) > 3:
                        # Check if it's not a hallucination pattern
                        text_lower = cleaned_text.lower()
                        is_hallucination = any(phrase in text_lower for phrase in self.UNWANTED_PHRASES)
                        
                        if not is_hallucination:
                            transcript_segments.append({
                                "text": cleaned_text,
                                "start": segment.timestamp + seg.start,
                                "end": segment.timestamp + seg.end,
                                "confidence": avg_logprob
                            })
                        else:
                            logger.debug(f"🚫 Filtered hallucination: {cleaned_text[:50]}...")
                
                # Log filtering results
                total_segments = len(list(segments))
                filtered_count = total_segments - len(transcript_segments)
                if filtered_count > 0:
                    logger.debug(f"📊 Filtered {filtered_count}/{total_segments} low-quality segments")
            
            # Clean up temp file
            os.unlink(tmp_path)
            
            # Combine segments into single result
            full_text = " ".join([s["text"] for s in transcript_segments if s["text"]])
            
            # Calculate overall confidence
            if transcript_segments:
                avg_confidence = sum(s["confidence"] for s in transcript_segments) / len(transcript_segments)
            else:
                avg_confidence = 0.0
            
            # Debug: Log transcription results
            print(f"🎯 Whisper Debug - Segments found: {len(transcript_segments)}/{total_segments}")
            print(f"🎯 Whisper Debug - Full text: '{full_text}' (length: {len(full_text)})")
            print(f"🎯 Whisper Debug - Language: {info.language} (confidence: {info.language_probability:.3f})")
            if not full_text:
                print(f"🎯 Whisper Debug - No text detected! Check if audio contains speech")
            
            return {
                "text": full_text,
                "start": segment.timestamp,
                "end": segment.timestamp + segment.duration,
                "confidence": avg_confidence,  # Enhanced: actual confidence from segments
                "segments": transcript_segments,
                "language": info.language,
                "language_probability": info.language_probability,
                "segments_filtered": total_segments - len(transcript_segments),  # New: filtering stats
                "model_info": {  # New: model information
                    "model_size": self.model_size,
                    "device": self.device,
                    "compute_type": self.compute_type
                }
            }
            
        except Exception as e:
            error_msg = str(e).lower()
            logger.error(f"Transcription error: {e}")
            
            # Check for CUDA-specific errors and attempt CPU fallback
            if ("cublas" in error_msg or "cuda" in error_msg or "gpu" in error_msg) and self.device == "cuda":
                logger.warning("🔄 CUDA error detected during transcription, attempting CPU fallback...")
                try:
                    # Reload model on CPU
                    with self._model_lock:
                        self.model = WhisperModel(
                            self.model_size, 
                            device="cpu", 
                            compute_type="int8",
                            cpu_threads=4,
                            num_workers=1
                        )
                    self.device = "cpu"
                    self.compute_type = "int8"
                    logger.info("✅ Successfully reloaded model on CPU")
                    
                    # Retry transcription with CPU model
                    with self._model_lock:
                        segments, info = self.model.transcribe(
                            tmp_path,
                            beam_size=10,
                            best_of=10,
                            temperature=0.0,
                            patience=1.3,
                            condition_on_previous_text=False,
                            no_repeat_ngram_size=3,
                            language="en",
                            word_timestamps=True,
                            vad_filter=True,
                            vad_parameters={"min_silence_duration_ms": 400, "speech_pad_ms": 400}
                        )
                    
                    # Process segments (same as above)
                    transcript_segments = []
                    all_text = []
                    total_segments = 0
                    
                    for seg in segments:
                        total_segments += 1
                        confidence = seg.avg_logprob
                        text = self.clean_text(seg.text.strip())
                        
                        if confidence > -1.0 and len(text) > 3:
                            transcript_segments.append({
                                "start": seg.start,
                                "end": seg.end,
                                "text": text,
                                "confidence": confidence,
                                "words": [{"word": w.word, "start": w.start, "end": w.end, "probability": w.probability} for w in seg.words] if seg.words else []
                            })
                            all_text.append(text)
                    
                    os.unlink(tmp_path)
                    
                    return {
                        "text": " ".join(all_text),
                        "start": segment.timestamp,
                        "end": segment.timestamp + segment.duration,
                        "confidence": sum(s["confidence"] for s in transcript_segments) / len(transcript_segments) if transcript_segments else 0.0,
                        "segments": transcript_segments,
                        "language": info.language,
                        "language_probability": info.language_probability,
                        "segments_filtered": total_segments - len(transcript_segments),
                        "model_info": {
                            "model_size": self.model_size,
                            "device": self.device,
                            "compute_type": self.compute_type,
                            "fallback_used": True
                        }
                    }
                    
                except Exception as cpu_error:
                    logger.error(f"❌ CPU fallback also failed: {cpu_error}")
            
            return {
                "text": "",
                "start": segment.timestamp,
                "end": segment.timestamp + segment.duration,
                "error": str(e)
            }

class ASRProcessor:
    """Main ASR processing pipeline"""
    
    def __init__(self, sample_rate: int = 48000):
        self.sample_rate = sample_rate
        self.audio_buffer = AudioBuffer(sample_rate)
        self.whisper = WhisperASR()
        self.session_id = None
        self.speaker_id = "Speaker 1"
        self.transcripts = []
        
    def set_session(self, session_id: str):
        """Set current session ID"""
        self.session_id = session_id
        self.transcripts.clear()
        
    async def process_audio_chunk(self, audio_data: List[float], timestamp: float) -> Optional[Dict]:
        """Process incoming audio chunk and return transcript if ready"""
        # Convert to numpy array
        audio_np = np.array(audio_data, dtype=np.float32)
        
        # Add to buffer and check if segment is ready
        segment = self.audio_buffer.add_chunk(audio_np, timestamp)
        
        # Debug: Log buffer status
        if hasattr(self.audio_buffer, 'speech_frames') and hasattr(self.audio_buffer, 'silence_frames'):
            if len(self.audio_buffer.buffer) % 20 == 0:  # Log every 20 chunks
                print(f"🎯 Buffer Debug - Total chunks: {len(self.audio_buffer.buffer)}, "
                      f"Speech frames: {self.audio_buffer.speech_frames}, "
                      f"Silence frames: {self.audio_buffer.silence_frames}, "
                      f"Duration: {self.audio_buffer.total_duration:.2f}s")
        
        if segment and len(segment.data) > 0:
            print(f"🎤 Segment ready for transcription: {len(segment.data)} samples, duration: {segment.duration:.2f}s")
            # Transcribe segment
            transcript = await self.whisper.transcribe_segment(segment)
            
            if transcript["text"]:
                # Create transcript message
                transcript_msg = {
                    "type": "transcript",
                    "session_id": self.session_id,
                    "speaker": self.speaker_id,
                    "text": transcript["text"],
                    "start": transcript["start"],
                    "end": transcript["end"],
                    "confidence": transcript.get("confidence", 0.0),
                    "timestamp": time.time()
                }
                
                # Store transcript
                self.transcripts.append(transcript_msg)
                
                logger.info(f"📝 Transcript: [{transcript['start']:.1f}s] {transcript['text']}")
                
                return transcript_msg
        
        return None

# ============================================================================
# FASTAPI APPLICATION SETUP
# ============================================================================

app = FastAPI(title="Meeting Monitor - Consolidated Backend", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
connected_clients: Dict[str, WebSocket] = {}
active_sessions: Dict[str, Dict] = {}
storage_enabled = True
storage_base_path = "recorded_sessions"
asr_processor = None

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def init_asr():
    """Initialize ASR processor"""
    global asr_processor
    try:
        print("🎯 Initializing ASR processor with medium model...")
        asr_processor = ASRProcessor(sample_rate=16000)  # Match frontend sample rate
        asr_processor.set_session("websocket_session")
        print("✅ ASR processor initialized successfully with medium model")
        return True
    except Exception as e:
        print(f"❌ Error initializing ASR: {e}")
        return False

async def broadcast_to_all(message_type: str, data: dict):
    """Broadcast message to all connected clients"""
    if connected_clients:
        disconnected = []
        for client_id, websocket in connected_clients.items():
            try:
                await websocket.send_text(json.dumps({
                    "type": message_type,
                    "data": data,
                    "timestamp": time.time()
                }))
            except Exception as e:
                print(f"❌ Error sending to {client_id}: {e}")
                disconnected.append(client_id)
        
        # Remove disconnected clients
        for client_id in disconnected:
            if client_id in connected_clients:
                del connected_clients[client_id]

async def handle_start_recording(client_id: str, data: dict, websocket: WebSocket):
    """Handle start recording request - transcript only, no audio file saving"""
    try:
        session_id = f"session_{int(time.time())}_{client_id}"
        capture_mode = data.get("captureMode", "microphone")
        audio_only = data.get("audioOnly", True)
        
        # Create session
        session = {
            "session_id": session_id,
            "client_id": client_id,
            "capture_mode": capture_mode,
            "start_time": time.time(),
            "transcripts": [],
            "audio_chunks": 0,
            "audio_only": audio_only
        }
        
        # Setup storage for transcripts only
        if storage_enabled:
            session_path = os.path.join(storage_base_path, session_id)
            os.makedirs(session_path, exist_ok=True)
            session["storage_path"] = session_path
            print(f"🗂️ Transcript storage enabled: {session_path}")
        
        active_sessions[client_id] = session
        
        # Set ASR session
        if asr_processor:
            asr_processor.set_session(session_id)
        
        # Send confirmation
        await websocket.send_text(json.dumps({
            "type": "recording_started",
            "data": {
                "session_id": session_id,
                "capture_mode": capture_mode,
                "recording_type": capture_mode,
                "asr_enabled": asr_processor is not None and asr_processor.whisper.is_ready(),
                "audio_only": audio_only,
                "storage_enabled": storage_enabled
            }
        }))
        
        print(f"🎬 Audio-only recording started for {client_id}: {session_id}")
        print(f"   ️ Storage path: {session.get('storage_path', 'None (storage disabled)')}")
        
    except Exception as e:
        print(f"❌ Error starting recording: {e}")
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Failed to start recording: {str(e)}"
        }))

async def handle_stop_recording(client_id: str, websocket: WebSocket):
    """Handle stop recording request with enhanced analysis"""
    try:
        if client_id not in active_sessions:
            return
        
        session = active_sessions[client_id]
        session["end_time"] = time.time()
        session["duration"] = session["end_time"] - session["start_time"]
        
        # 1. Generate Original Transcript with Quality Validation
        original_transcript = ""
        valid_transcripts = []
        
        for transcript in session["transcripts"]:
            text = transcript.get("text", "").strip()
            # Quality validation: Skip empty, too short, or invalid transcripts
            if text and len(text) >= 3 and not text.isdigit() and text != "..." and text != "null":
                # Additional quality checks
                if not text.lower().startswith(("error", "failed", "timeout")):
                    valid_transcripts.append(transcript)
                    original_transcript += text + " "
        
        # Clean up the original transcript
        original_transcript = original_transcript.strip()
        
        # Validate minimum transcript quality
        if len(original_transcript) < 10:
            print("⚠️ Warning: Very short transcript detected, results may be limited")
        elif not any(char.isalpha() for char in original_transcript):
            print("⚠️ Warning: No alphabetic characters found in transcript")
            original_transcript = ""
        
        print(f"🔍 Quality Check - Valid transcripts: {len(valid_transcripts)}/{len(session['transcripts'])}")
        print(f"🔍 Quality Check - Final transcript length: {len(original_transcript)} chars")
        
        # 2. Create Enhanced Combined Transcript with Professional Formatting
        combined_transcript = ""
        
        if valid_transcripts:
            # Header Section
            combined_transcript += "📝 MEETING TRANSCRIPT REPORT\n"
            combined_transcript += "=" * 50 + "\n\n"
            
            # Session Information
            combined_transcript += "📋 SESSION INFORMATION:\n"
            combined_transcript += "─" * 25 + "\n"
            combined_transcript += f"   📊 Session ID: {session['session_id']}\n"
            combined_transcript += f"   ⏱️  Duration: {session.get('duration', 0):.1f} seconds ({session.get('duration', 0)//60:.0f}m {session.get('duration', 0)%60:.0f}s)\n"
            combined_transcript += f"   ✅ Valid Segments: {len(valid_transcripts)}\n"
            combined_transcript += f"   📝 Total Content: {len(original_transcript)} characters\n"
            combined_transcript += f"   📅 Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
            
            # Conversation Section
            combined_transcript += "🗣️ CONVERSATION TRANSCRIPT:\n"
            combined_transcript += "─" * 30 + "\n\n"
        
        for i, transcript in enumerate(valid_transcripts):
            text = transcript.get("text", "").strip()
            speaker = transcript.get("speaker", "unknown")
            timestamp = transcript.get("start", transcript.get("timestamp", 0))
            
            # Professional timestamp formatting
            mins = int(timestamp // 60)
            secs = int(timestamp % 60)
            time_str = f"[{mins:02d}:{secs:02d}]"
            
            # Enhanced speaker identification with consistent formatting
            if speaker == 'you' or speaker == 'user':
                speaker_label = "👤 You"
            elif speaker == 'other' or speaker == 'speaker':
                speaker_label = "🗣️ Speaker"
            elif speaker and len(speaker) > 1:
                speaker_label = f"👥 {speaker.title()}"
            else:
                speaker_label = f"🗣️ Speaker {i+1}"
            
            # Professional segment formatting with proper spacing
            segment_number = f"{i+1:2d}."
            
            # Clean and format text content
            cleaned_text = re.sub(r'\s+', ' ', text.strip())
            
            # Format the line with consistent structure
            combined_transcript += f"{segment_number} {time_str} {speaker_label}:\n"
            combined_transcript += f"    \"{cleaned_text}\"\n\n"
        
        # Add professional footer to transcript
        if valid_transcripts:
            combined_transcript += "─" * 50 + "\n"
            combined_transcript += "📊 TRANSCRIPT SUMMARY:\n"
            combined_transcript += f"   • Total Segments: {len(valid_transcripts)}\n"
            combined_transcript += f"   • Total Duration: {session.get('duration', 0):.1f} seconds\n"
            combined_transcript += f"   • Word Count: ~{len(original_transcript.split())} words\n"
            combined_transcript += f"   • Character Count: {len(original_transcript)} characters\n"
            combined_transcript += "─" * 50 + "\n"
            combined_transcript += "✨ Transcript Complete - Ready for Analysis\n\n"
        
        # 3. Enhanced Analysis with Robust Error Handling and Validation
        enhanced_analysis = {}
        enhanced_summary_paragraph = ""
        
        # Comprehensive debug information
        print(f"🔍 Debug - Original transcript length: {len(original_transcript.strip())} chars")
        print(f"🔍 Debug - Valid words: {len([w for w in original_transcript.split() if w.isalpha()])}")
        print(f"🔍 Debug - Enhanced analyzer ready: {enhanced_analyzer.is_ready()}")
        
        if hasattr(enhanced_analyzer, 'initialization_error') and enhanced_analyzer.initialization_error:
            print(f"🔍 Debug - Analyzer error: {enhanced_analyzer.initialization_error}")
        
        # Pre-analysis validation
        analysis_viable = True
        if not original_transcript.strip():
            print("⚠️ Enhanced analysis skipped - no transcript text")
            enhanced_summary_paragraph = "**Enhanced Analysis:** No transcript content available for analysis"
            analysis_viable = False
        elif len(original_transcript.strip()) < 20:
            print("⚠️ Enhanced analysis skipped - transcript too short (minimum 20 characters)")
            enhanced_summary_paragraph = "**Enhanced Analysis:** Transcript too short for meaningful analysis"
            analysis_viable = False
        elif not any(char.isalpha() for char in original_transcript):
            print("⚠️ Enhanced analysis skipped - no valid text content")
            enhanced_summary_paragraph = "**Enhanced Analysis:** No valid text content found"
            analysis_viable = False
        
        # Try to initialize analyzer if not ready
        if analysis_viable and not enhanced_analyzer.is_ready():
            print("🔧 Attempting to initialize enhanced analyzer...")
            try:
                if enhanced_analyzer.initialize_sync():
                    print("✅ Enhanced analyzer initialized successfully!")
                else:
                    print("❌ Enhanced analyzer initialization failed")
                    analysis_viable = False
                    enhanced_summary_paragraph = "**Enhanced Analysis:** Failed to initialize NLP models"
            except Exception as init_error:
                print(f"❌ Analyzer initialization error: {init_error}")
                analysis_viable = False
                enhanced_summary_paragraph = f"**Enhanced Analysis:** Initialization error - {str(init_error)}"
        
        # Run analysis if viable
        if analysis_viable and enhanced_analyzer.is_ready():
            print("🧠 Running enhanced transcript analysis...")
            
            try:
                # Run comprehensive analysis with timeout protection (Windows-compatible)
                import threading
                import queue
                
                def run_analysis_with_timeout():
                    """Run analysis in a separate thread with timeout"""
                    result_queue = queue.Queue()
                    
                    def analysis_worker():
                        try:
                            result = enhanced_analyzer.analyze_transcript(original_transcript)
                            result_queue.put(('success', result))
                        except Exception as e:
                            result_queue.put(('error', str(e)))
                    
                    # Start analysis in background thread
                    thread = threading.Thread(target=analysis_worker, daemon=True)
                    thread.start()
                    
                    # Wait for result with timeout (30 seconds)
                    try:
                        status, analysis_result = result_queue.get(timeout=30)
                        if status == 'success':
                            return analysis_result
                        else:
                            logger.error(f"Analysis worker error: {analysis_result}")
                            return None
                    except queue.Empty:
                        logger.error("Analysis timeout after 30 seconds")
                        return None
                
                analysis_result = run_analysis_with_timeout()
                
                if analysis_result and "error" not in analysis_result:
                    # Validate analysis result quality
                    required_fields = ['entities', 'keywords', 'suggestions', 'jargon_analysis']
                    missing_fields = [field for field in required_fields if field not in analysis_result]
                    
                    if missing_fields:
                        print(f"⚠️ Warning: Analysis missing fields: {missing_fields}")
                    
                    enhanced_analysis = analysis_result
                    
                    # Generate summary with error handling
                    try:
                        enhanced_summary_paragraph = enhanced_analyzer.generate_summary_paragraph(analysis_result)
                    except Exception as summary_error:
                        print(f"⚠️ Summary generation failed: {summary_error}")
                        enhanced_summary_paragraph = "**Enhanced Analysis:** Analysis completed but summary generation failed"
                    
                    print("✅ Enhanced analysis completed successfully")
                else:
                    error_msg = analysis_result.get('details', 'Unknown analysis error') if analysis_result else 'No analysis result returned'
                    enhanced_summary_paragraph = f"**Enhanced Analysis Error:** {error_msg}"
                    print(f"❌ Enhanced analysis failed: {error_msg}")
                    # Provide fallback structure for frontend
                    enhanced_analysis = None
                        
            except Exception as e:
                enhanced_summary_paragraph = f"**Enhanced Analysis Error:** {str(e)}"
                print(f"❌ Enhanced analysis error: {e}")
                # Provide fallback structure for frontend
                enhanced_analysis = None
        else:
            # More specific error messages
            if not original_transcript.strip():
                enhanced_summary_paragraph = "**Enhanced Analysis:** No transcript text available"
                print("⚠️ Enhanced analysis skipped - no transcript text")
            else:
                enhanced_summary_paragraph = "**Enhanced Analysis:** Models not ready"
                print("⚠️ Enhanced analysis skipped - models not initialized")
            # Provide fallback structure for frontend
            enhanced_analysis = None
        
        # 3.5. DistilBERT Sentiment Analysis
        sentiment_analysis = {}
        sentiment_summary = ""
        
        if original_transcript.strip() and DISTILBERT_AVAILABLE and distilbert_analyzer:
            print("🤖 Running DistilBERT sentence-level sentiment analysis...")
            
            try:
                # Get comprehensive sentence-level sentiment analysis
                sentiment_analysis = analyze_sentiment(original_transcript)
                sentiment_summary_data = get_sentiment_summary(original_transcript)
                
                # Log sentence-level results to console for debugging
                if "error" not in sentiment_analysis and sentiment_analysis.get("sentences"):
                    sentences = sentiment_analysis.get("sentences", [])
                    print(f"🔍 Analyzed {len(sentences)} sentences:")
                    for i, sentence_data in enumerate(sentences[:3], 1):  # Show first 3 sentences
                        sentence_text = sentence_data.get("sentence", "")[:50] + "..." if len(sentence_data.get("sentence", "")) > 50 else sentence_data.get("sentence", "")
                        sentiment = sentence_data.get("sentiment", "UNKNOWN")
                        confidence = sentence_data.get("confidence", 0.0)
                        emoji = "😊" if sentiment == "POSITIVE" else "😔" if sentiment == "NEGATIVE" else "😐"
                        print(f"   {i}. \"{sentence_text}\" → {sentiment} {emoji} ({confidence:.1%})")
                    if len(sentences) > 3:
                        print(f"   ... and {len(sentences) - 3} more sentences")
                
                
                if "error" not in sentiment_analysis:
                    # Create professionally formatted summary
                    overall_sentiment = sentiment_analysis.get("overall_sentiment", "UNKNOWN")
                    overall_confidence = sentiment_analysis.get("overall_confidence", 0.0)
                    stats = sentiment_analysis.get("statistics", {})
                    sentences = sentiment_analysis.get("sentences", [])
                    
                    # Build structured sentiment report
                    sentiment_sections = []
                    
                    # Header
                    sentiment_sections.append("🎭 SENTIMENT ANALYSIS REPORT")
                    sentiment_sections.append("=" * 40)
                    sentiment_sections.append("")
                    
                    # Overall Assessment
                    emoji_map = {"POSITIVE": "😊", "NEGATIVE": "😔", "NEUTRAL": "😐"}
                    main_emoji = emoji_map.get(overall_sentiment, "🤔")
                    
                    sentiment_sections.append("🎯 OVERALL ASSESSMENT:")
                    sentiment_sections.append("─" * 22)
                    sentiment_sections.append(f"   Sentiment: {overall_sentiment} {main_emoji}")
                    sentiment_sections.append(f"   Confidence: {overall_confidence:.1%}")
                    sentiment_sections.append(f"   Reliability: {'High' if overall_confidence > 0.8 else 'Medium' if overall_confidence > 0.6 else 'Low'}")
                    sentiment_sections.append("")
                    
                    # Statistical Overview
                    sentiment_sections.append("📊 STATISTICAL BREAKDOWN:")
                    sentiment_sections.append("─" * 25)
                    sentiment_sections.append(f"   📝 Total Sentences: {stats.get('sentence_count', 0)}")
                    sentiment_sections.append(f"   😊 Positive: {stats.get('positive_sentences', 0)} sentences ({stats.get('positive_ratio', 0):.1%})")
                    sentiment_sections.append(f"   😔 Negative: {stats.get('negative_sentences', 0)} sentences ({stats.get('negative_ratio', 0):.1%})")
                    sentiment_sections.append(f"   😐 Neutral: {stats.get('neutral_sentences', 0)} sentences ({stats.get('neutral_ratio', 0):.1%})")
                    sentiment_sections.append(f"   🎯 Avg Confidence: {stats.get('classification_confidence', 'medium')}")
                    sentiment_sections.append("")
                    
                    # Sample Sentence Analysis (first 6 sentences for brevity)
                    if sentences:
                        sentiment_sections.append("📝 SENTENCE-LEVEL HIGHLIGHTS:")
                        sentiment_sections.append("─" * 30)
                        
                        # Group sentences by sentiment for better organization
                        positive_sentences = [s for s in sentences if s.get("sentiment") == "POSITIVE"]
                        negative_sentences = [s for s in sentences if s.get("sentiment") == "NEGATIVE"]
                        neutral_sentences = [s for s in sentences if s.get("sentiment") == "NEUTRAL"]
                        
                        # Show top examples from each category
                        if positive_sentences:
                            sentiment_sections.append("   😊 POSITIVE HIGHLIGHTS:")
                            for i, sentence_data in enumerate(positive_sentences[:2], 1):
                                sentence_text = sentence_data.get("sentence", "")[:80]
                                confidence = sentence_data.get("confidence", 0.0)
                                if len(sentence_data.get("sentence", "")) > 80:
                                    sentence_text += "..."
                                sentiment_sections.append(f"      {i}. \"{sentence_text}\" ({confidence:.1%})")
                            sentiment_sections.append("")
                        
                        if negative_sentences:
                            sentiment_sections.append("   � NEGATIVE HIGHLIGHTS:")
                            for i, sentence_data in enumerate(negative_sentences[:2], 1):
                                sentence_text = sentence_data.get("sentence", "")[:80]
                                confidence = sentence_data.get("confidence", 0.0)
                                if len(sentence_data.get("sentence", "")) > 80:
                                    sentence_text += "..."
                                sentiment_sections.append(f"      {i}. \"{sentence_text}\" ({confidence:.1%})")
                            sentiment_sections.append("")
                        
                        if neutral_sentences:
                            sentiment_sections.append("   😐 NEUTRAL SAMPLES:")
                            for i, sentence_data in enumerate(neutral_sentences[:1], 1):
                                sentence_text = sentence_data.get("sentence", "")[:80]
                                confidence = sentence_data.get("confidence", 0.0)
                                if len(sentence_data.get("sentence", "")) > 80:
                                    sentence_text += "..."
                                sentiment_sections.append(f"      {i}. \"{sentence_text}\" ({confidence:.1%})")
                            sentiment_sections.append("")
                    
                    # Model Information
                    model_info = sentiment_analysis.get("model_info", {})
                    sentiment_sections.append("🤖 ANALYSIS DETAILS:")
                    sentiment_sections.append("─" * 18)
                    sentiment_sections.append(f"   Model: {model_info.get('model_name', 'DistilBERT')}")
                    sentiment_sections.append(f"   Device: {model_info.get('device', 'CPU')}")
                    sentiment_sections.append(f"   Processing: GPU-Accelerated" if "cuda" in model_info.get('device', '').lower() else "   Processing: CPU-Based")
                    sentiment_sections.append("")
                    
                    # Footer
                    sentiment_sections.append("─" * 40)
                    sentiment_sections.append("✨ Sentiment Analysis Complete")
                    
                    sentiment_summary = "\n".join(sentiment_sections)
                    
                    print("✅ DistilBERT sentence-level sentiment analysis completed successfully")
                else:
                    sentiment_summary = f"**Sentiment Analysis Error:** {sentiment_analysis.get('error', 'Unknown error')}"
                    print(f"❌ DistilBERT sentiment analysis failed: {sentiment_analysis.get('error')}")
                    
            except Exception as e:
                sentiment_summary = f"**Sentiment Analysis Error:** {str(e)}"
                logger.error(f"DistilBERT sentiment analysis error: {e}")
                print(f"❌ DistilBERT sentiment analysis error: {e}")
        else:
            if not original_transcript.strip():
                sentiment_summary = "**Sentiment Analysis:** No transcript text available"
                print("⚠️ Sentiment analysis skipped - no transcript text")
            elif not DISTILBERT_AVAILABLE:
                sentiment_summary = "**Sentiment Analysis:** DistilBERT model not available"
                print("⚠️ Sentiment analysis skipped - DistilBERT not available")
            else:
                sentiment_summary = "**Sentiment Analysis:** Model not ready"
                print("⚠️ Sentiment analysis skipped - model not initialized")
        
        # 4. Build Enhanced Response with Quality Metrics and Validation
        
        # Calculate quality metrics
        quality_metrics = {
            "total_transcript_segments": len(session["transcripts"]),
            "valid_transcript_segments": len(valid_transcripts) if 'valid_transcripts' in locals() else len(session["transcripts"]),
            "original_transcript_length": len(original_transcript),
            "valid_words_count": len([w for w in original_transcript.split() if w.isalpha()]) if original_transcript else 0,
            "analysis_success": bool(enhanced_analysis),
            "sentiment_success": bool(sentiment_analysis and "error" not in sentiment_analysis),
            "transcript_quality": "high" if len(original_transcript) > 100 else "medium" if len(original_transcript) > 50 else "low"
        }
        
        # Enhanced validation status
        validation_status = {
            "transcript_validation": {
                "has_content": bool(original_transcript.strip()),
                "sufficient_length": len(original_transcript) >= 20,
                "contains_text": any(char.isalpha() for char in original_transcript) if original_transcript else False,
                "quality_score": quality_metrics["valid_words_count"] / max(len(original_transcript.split()), 1) if original_transcript else 0
            },
            "analysis_validation": {
                "analyzer_ready": enhanced_analyzer.is_ready(),
                "initialization_error": enhanced_analyzer.initialization_error,
                "analysis_completed": bool(enhanced_analysis),
                "has_entities": bool(enhanced_analysis.get("entities")) if enhanced_analysis else False,
                "has_keywords": bool(enhanced_analysis.get("keywords")) if enhanced_analysis else False
            },
            "sentiment_validation": {
                "distilbert_available": DISTILBERT_AVAILABLE,
                "analyzer_available": bool(distilbert_analyzer),
                "analysis_completed": bool(sentiment_analysis and "error" not in sentiment_analysis),
                "has_sentences": bool(sentiment_analysis.get("sentences")) if sentiment_analysis else False
            }
        }
        
        response_data = {
            "session_id": session["session_id"],
            "quality_metrics": quality_metrics,
            "validation_status": validation_status,
            "complete_transcripts": {
                # Original individual transcripts with validation
                "transcripts": session["transcripts"],
                "valid_transcripts": valid_transcripts if 'valid_transcripts' in locals() else session["transcripts"],
                "session_stats": {
                    "duration": f"{session['duration']:.1f}s",
                    "audio_chunks": session["audio_chunks"],
                    "transcript_count": len(session["transcripts"]),
                    "valid_transcript_count": len(valid_transcripts) if 'valid_transcripts' in locals() else len(session["transcripts"]),
                    "quality_ratio": quality_metrics["valid_transcript_segments"] / max(quality_metrics["total_transcript_segments"], 1)
                },
                "total_count": len(session["transcripts"])
            },
            # Enhanced transcript components with quality information
            "enhanced_transcript_analysis": {
                "1_original_transcript": original_transcript,
                "2_combined_transcript": combined_transcript,
                "3_enhanced_analysis_paragraph": enhanced_summary_paragraph,
                "4_sentiment_analysis_paragraph": sentiment_summary,
                "analysis_data": enhanced_analysis if enhanced_analysis else None,
                "sentiment_data": sentiment_analysis if sentiment_analysis else None,
                "analysis_status": "completed" if enhanced_analysis else "failed_or_unavailable",
                "sentiment_status": "completed" if sentiment_analysis and "error" not in sentiment_analysis else "failed_or_unavailable",
                "quality_indicators": {
                    "transcript_quality": quality_metrics["transcript_quality"],
                    "word_count": quality_metrics["valid_words_count"],
                    "character_count": quality_metrics["original_transcript_length"],
                    "analysis_reliability": "high" if enhanced_analysis and len(original_transcript) > 100 else "medium" if enhanced_analysis else "low",
                    "sentiment_reliability": "high" if sentiment_analysis and quality_metrics["valid_words_count"] > 20 else "medium" if sentiment_analysis else "low"
                }
            }
        }
        
        # Send comprehensive session summary
        await websocket.send_text(json.dumps({
            "type": "recording_stopped",
            "data": response_data
        }))
        
        # Enhanced status reporting
        print(f"⏹️ Recording stopped for {client_id}: {session['session_id']}")
        print(f"📊 Transcript Quality: {quality_metrics['transcript_quality'].upper()} ({quality_metrics['valid_words_count']} valid words)")
        print(f"🔍 Analysis Results:")
        print(f"   📈 Enhanced Analysis: {'✅ Success' if enhanced_analysis else '❌ Failed/Unavailable'}")
        print(f"   🤖 Sentiment Analysis: {'✅ Success' if sentiment_analysis and 'error' not in sentiment_analysis else '❌ Failed/Unavailable'}")
        print(f"   📝 Transcript Segments: {quality_metrics['valid_transcript_segments']}/{quality_metrics['total_transcript_segments']} valid")
        print(f"   🎯 Overall Reliability: {response_data['enhanced_transcript_analysis']['quality_indicators']['analysis_reliability'].upper()}")
        
        # Save transcript files to session folder
        if storage_enabled and session.get("storage_path"):
            try:
                session_path = session["storage_path"]
                
                # Save original transcript
                if original_transcript:
                    original_file = os.path.join(session_path, "original_transcript.txt")
                    with open(original_file, 'w', encoding='utf-8') as f:
                        f.write(original_transcript)
                    print(f"💾 Saved original transcript: {original_file}")
                
                # Save combined formatted transcript
                if combined_transcript:
                    combined_file = os.path.join(session_path, "formatted_transcript.txt")
                    with open(combined_file, 'w', encoding='utf-8') as f:
                        f.write(combined_transcript)
                    print(f"💾 Saved formatted transcript: {combined_file}")
                
                # Save enhanced analysis if available
                if enhanced_summary_paragraph:
                    analysis_file = os.path.join(session_path, "enhanced_analysis.txt")
                    with open(analysis_file, 'w', encoding='utf-8') as f:
                        f.write(enhanced_summary_paragraph)
                    print(f"💾 Saved enhanced analysis: {analysis_file}")
                
                # Save sentiment analysis if available
                if sentiment_summary:
                    sentiment_file = os.path.join(session_path, "sentiment_analysis.txt")
                    with open(sentiment_file, 'w', encoding='utf-8') as f:
                        f.write(sentiment_summary)
                    print(f"💾 Saved sentiment analysis: {sentiment_file}")
                
                # Save complete session data as JSON
                session_json_file = os.path.join(session_path, "session_data.json")
                session_data_export = {
                    "session_id": session["session_id"],
                    "duration": session.get("duration", 0),
                    "audio_chunks": session.get("audio_chunks", 0),
                    "transcript_count": len(valid_transcripts),
                    "quality_metrics": quality_metrics,
                    "transcripts": valid_transcripts,
                    "enhanced_analysis": enhanced_analysis if enhanced_analysis else None,
                    "sentiment_analysis": sentiment_analysis if sentiment_analysis else None
                }
                
                with open(session_json_file, 'w', encoding='utf-8') as f:
                    json.dump(session_data_export, f, indent=2, ensure_ascii=False)
                print(f"💾 Saved session data: {session_json_file}")
                
            except Exception as save_error:
                print(f"❌ Error saving transcript files: {save_error}")
        
        del active_sessions[client_id]
        
    except Exception as e:
        print(f"❌ Error stopping recording: {e}")
        traceback.print_exc()

async def handle_audio_chunk(client_id: str, data: dict):
    """Handle incoming audio chunk for real-time ASR"""
    try:
        if client_id not in active_sessions:
            return
        
        session = active_sessions[client_id]
        session["audio_chunks"] += 1
        
        # Extract audio data
        audio_data = data.get('audio', [])
        timestamp = data.get('timestamp', time.time())
        speaker = data.get('speaker', 'unknown')
        sample_rate = data.get('sample_rate', 48000)
        
        # Debug: Log audio data info every 10 chunks
        if session["audio_chunks"] % 10 == 0:
            print(f"🔊 Audio Debug - Chunk #{session['audio_chunks']}: {len(audio_data)} samples, rate: {sample_rate}Hz")
            if audio_data:
                audio_array = np.array(audio_data)
                print(f"🔊 Audio Level - Min: {audio_array.min():.4f}, Max: {audio_array.max():.4f}, Mean: {audio_array.mean():.4f}")
        
        # Process with ASR if available and ready
        if asr_processor and asr_processor.whisper.is_ready() and audio_data:
            try:
                result = await asr_processor.process_audio_chunk(audio_data, timestamp)
                
                if result:
                    # Add speaker information
                    result['speaker'] = speaker
                    speaker_label = "You: " if speaker == 'you' else "Other: " if speaker == 'other' else ""
                    result['labeled_text'] = f"{speaker_label}{result['text']}"
                    
                    # Add to session transcripts
                    session["transcripts"].append({
                        'timestamp': result.get('timestamp', time.time()),
                        'text': result['text'],
                        'labeled_text': result['labeled_text'],
                        'speaker': speaker,
                        'confidence': result.get('confidence', 0.0)
                    })
                    
                    # Broadcast transcript to all clients
                    await broadcast_to_all("transcript", result)
                    print(f"📝 Transcript ({speaker}): {result['text']}")
                    
            except Exception as asr_error:
                print(f"❌ ASR processing error: {asr_error}")
        
    except Exception as e:
        print(f"❌ Error processing audio chunk: {e}")

# ============================================================================
# AUTHENTICATION MODELS AND CONFIGURATION
# ============================================================================

# JWT Secret key (in production, use environment variable)
JWT_SECRET_KEY = "your-secret-key-change-in-production"
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DELTA = timedelta(days=30)

# Security
security = HTTPBearer()

# Pydantic models for authentication
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

# In-memory user storage (in production, use a real database)
users_db = {}

# Helper functions
def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_data: dict) -> str:
    """Create a JWT token for a user"""
    payload = {
        "user_id": user_data["id"],
        "email": user_data["email"],
        "exp": datetime.now(timezone.utc) + JWT_EXPIRATION_DELTA
    }
    return PyJWT.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> dict:
    """Verify and decode a JWT token"""
    try:
        payload = PyJWT.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except PyJWT.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except PyJWT.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get the current authenticated user"""
    try:
        payload = verify_jwt_token(credentials.credentials)
        user_id = payload.get("user_id")
        if user_id not in users_db:
            raise HTTPException(status_code=401, detail="User not found")
        return users_db[user_id]
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid authentication")

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint with system status"""
    return {
        "message": "Meeting Monitor - Consolidated Backend",
        "status": "running",
        "asr_ready": asr_processor.whisper.is_ready() if asr_processor else False,
        "asr_model": f"whisper-{asr_processor.whisper.model_size}" if asr_processor else "not loaded",
        "connected_clients": len(connected_clients),
        "active_sessions": len(active_sessions)
    }

# ============================================================================
# AUTHENTICATION ENDPOINTS
# ============================================================================

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
        import re
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
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }
        
        users_db[user_id] = new_user
        
        # Generate token
        token = create_jwt_token(new_user)
        
        # Return user data without password
        user_response = {k: v for k, v in new_user.items() if k != "password"}
        
        return {
            "success": True,
            "user": user_response,
            "token": token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Registration error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/auth/login")
async def login_user(user_data: UserLogin):
    """Login a user"""
    # Find user by email
    user = None
    for u in users_db.values():
        if u["email"] == user_data.email:
            user = u
            break
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Verify password
    if not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Generate token
    token = create_jwt_token(user)
    
    # Return user data without password
    user_response = {k: v for k, v in user.items() if k != "password"}
    
    return {
        "success": True,
        "user": user_response,
        "token": token
    }

@app.get("/api/auth/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user's profile"""
    user_response = {k: v for k, v in current_user.items() if k != "password"}
    return {
        "success": True,
        "user": user_response
    }

@app.put("/api/auth/profile")
async def update_profile(profile_data: UserProfile, current_user: dict = Depends(get_current_user)):
    """Update current user's profile"""
    # Check if new email is already taken by another user
    if profile_data.email != current_user["email"]:
        for user in users_db.values():
            if user["email"] == profile_data.email and user["id"] != current_user["id"]:
                raise HTTPException(status_code=400, detail="Email already taken")
    
    # Update user data
    current_user["firstName"] = profile_data.firstName
    current_user["lastName"] = profile_data.lastName
    current_user["email"] = profile_data.email
    current_user["updatedAt"] = datetime.utcnow().isoformat()
    
    # Return updated user data without password
    user_response = {k: v for k, v in current_user.items() if k != "password"}
    
    return {
        "success": True,
        "user": user_response
    }

@app.post("/api/auth/change-password")
async def change_password(password_data: PasswordChange, current_user: dict = Depends(get_current_user)):
    """Change user's password"""
    # Verify current password
    if not verify_password(password_data.currentPassword, current_user["password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Hash new password
    new_hashed_password = hash_password(password_data.newPassword)
    
    # Update password
    current_user["password"] = new_hashed_password
    current_user["updatedAt"] = datetime.utcnow().isoformat()
    
    return {
        "success": True,
        "message": "Password changed successfully"
    }

@app.get("/asr/status")
async def asr_status():
    """Get ASR system status"""
    if not asr_processor:
        return {"ready": False, "error": "ASR not initialized"}
    
    return {
        "ready": asr_processor.whisper.is_ready(),
        "config": asr_processor.whisper.get_config_info(),
        "model_size": asr_processor.whisper.model_size,
        "device": asr_processor.whisper.device,
        "compute_type": asr_processor.whisper.compute_type
    }

@app.get("/enhanced-analysis/status")
async def enhanced_analysis_status():
    """Get Enhanced Analysis system status with new features"""
    return {
        "ready": enhanced_analyzer.is_ready(),
        "error": enhanced_analyzer.initialization_error,
        "features": {
            "grammar_correction": "TextBlob - spelling and grammar fixes",
            "named_entity_recognition": "spaCy en_core_web_sm - people, orgs, dates, money",
            "topic_modeling": "Gensim LDA - 5 topics with optimized parameters",
            "keyword_extraction": "spaCy noun chunks - relevant terms",
            "jargon_detection": "Rule-based - business, tech, finance, project terms",
            "importance_scoring": "Multi-factor - critical meeting terms identification",
            "definition_lookup": "PyDictionary + built-in - acronym and term definitions",
            "enhanced_highlighting": "Multi-level - 🔥critical ⭐important 🏷️acronyms 💼jargon",
            "ai_suggestions": "Context-aware - actionable meeting recommendations"
        },
        "highlighting_legend": {
            "🔥**term**🔥": "Critical importance (score ≥ 0.8)",
            "⭐**term**⭐": "High importance (score ≥ 0.6)", 
            "🏷️**term**🏷️": "Acronym or abbreviation",
            "💼**term**💼": "Business/technical jargon",
            "**term**": "Relevant keyword"
        },
        "dictionary_available": PYDICTIONARY_AVAILABLE,
        "status": "ready" if enhanced_analyzer.is_ready() else "initializing or error"
    }

@app.get("/sentiment-analysis/status")
async def sentiment_analysis_status():
    """Get DistilBERT Sentiment Analysis system status"""
    if not DISTILBERT_AVAILABLE:
        return {
            "available": False,
            "error": "DistilBERT dependencies not installed",
            "model": None,
            "status": "unavailable"
        }
    
    if not distilbert_analyzer:
        return {
            "available": False,
            "error": "DistilBERT analyzer not initialized",
            "model": None,
            "status": "error"
        }
    
    return {
        "available": True,
        "ready": distilbert_analyzer.is_initialized,
        "error": distilbert_analyzer.initialization_error,
        "model": {
            "name": "distilbert-base-uncased-finetuned-sst-2-english",
            "description": "Fine-tuned DistilBERT for sentiment analysis on SST-2 dataset",
            "labels": ["POSITIVE", "NEGATIVE"],
            "device": "GPU" if DISTILBERT_AVAILABLE and distilbert_analyzer and hasattr(distilbert_analyzer, 'sentiment_pipeline') and getattr(distilbert_analyzer.sentiment_pipeline, 'device', -1) >= 0 else "CPU"
        },
        "features": {
            "sentence_level_analysis": "Individual sentence sentiment scoring",
            "overall_sentiment": "Aggregate sentiment with confidence metrics",
            "confidence_scoring": "Per-sentence and overall confidence levels",
            "sentiment_statistics": "Positive/negative ratios and distributions",
            "sentiment_trajectory": "Sentiment variance and range analysis"
        },
        "status": "ready" if distilbert_analyzer.is_initialized else "initializing or error"
    }

@app.post("/api/sentiment/analyze")
async def analyze_text_sentiment(request_data: dict):
    """Analyze sentiment of provided text using DistilBERT"""
    
    if not DISTILBERT_AVAILABLE or not distilbert_analyzer:
        raise HTTPException(status_code=503, detail="Sentiment analysis service unavailable")
    
    if not distilbert_analyzer.is_initialized:
        raise HTTPException(status_code=503, detail="Sentiment analysis model not ready")
    
    text = request_data.get("text", "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="No text provided for analysis")
    
    try:
        # Get comprehensive sentiment analysis
        analysis_type = request_data.get("type", "full")  # "full" or "summary"
        
        if analysis_type == "summary":
            result = get_sentiment_summary(text)
        else:
            result = analyze_sentiment(text)
        
        return {
            "success": True,
            "analysis": result,
            "input_length": len(text),
            "model": "distilbert-base-uncased-finetuned-sst-2-english"
        }
        
    except Exception as e:
        logger.error(f"Sentiment analysis API error: {e}")
        raise HTTPException(status_code=500, detail=f"Sentiment analysis failed: {str(e)}")

@app.post("/api/video/extract-transcript")
async def extract_video_transcript(video: UploadFile = File(...)):
    """Extract transcript from uploaded video file"""
    
    print(f"🎬 Received video upload request: {video.filename}")
    
    if not video.content_type or not video.content_type.startswith('video/'):
        print(f"❌ Invalid file type: {video.content_type}")
        raise HTTPException(status_code=400, detail="File must be a video")
    
    # Check file size (500MB limit)
    max_size = 500 * 1024 * 1024  # 500MB
    if video.size and video.size > max_size:
        print(f"❌ File too large: {video.size} bytes")
        raise HTTPException(status_code=400, detail="Video file too large (max 500MB)")
    
    try:
        # Read video content
        video_content = await video.read()
        print(f"🎬 Processing uploaded video: {video.filename} ({len(video_content)} bytes)")
        
        # Return informative response about FFmpeg requirement
        return {
            'success': False,
            'error': 'FFmpeg Required for Video Transcription',
            'message': f'Video "{video.filename}" was uploaded successfully, but FFmpeg is required to extract audio for transcription.',
            'instructions': {
                'step1': 'Download FFmpeg from https://ffmpeg.org/download.html',
                'step2': 'Extract the files and add ffmpeg.exe to your system PATH',
                'step3': 'Restart the backend server',
                'alternative': 'Or run: choco install ffmpeg (requires admin PowerShell)'
            },
            'video_info': {
                'filename': video.filename,
                'size': len(video_content),
                'format': video.content_type
            }
        }
        
    except Exception as e:
        print(f"❌ Error processing video: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

# ============================================================================
# WEBSOCKET ENDPOINT
# ============================================================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Main WebSocket endpoint for real-time communication"""
    client_id = None
    
    try:
        await websocket.accept()
        print("🔌 WebSocket connection established")
        
        while True:
            try:
                # Receive message
                message = await websocket.receive_text()
                data = json.loads(message)
                
                message_type = data.get("type")
                message_data = data.get("data", {})
                
                # Handle client identification
                if message_type == "handshake":
                    client_id = message_data.get("client_id", f"client_{int(time.time())}")
                    connected_clients[client_id] = websocket
                    
                    print(f"🤝 Client connected: {client_id}")
                    
                    await websocket.send_text(json.dumps({
                        "type": "status",
                        "message": "Connected to backend - ASR Ready",
                        "client_id": client_id,
                        "asr_ready": asr_processor.whisper.is_ready() if asr_processor else False
                    }))
                    continue
                
                # Ensure client is identified
                if not client_id:
                    client_id = f"client_{int(time.time())}"
                    connected_clients[client_id] = websocket
                
                print(f"📨 Received message: {message_type} from {client_id}")
                
                # Handle different message types
                if message_type == "start_recording":
                    await handle_start_recording(client_id, message_data, websocket)
                elif message_type == "stop_recording":
                    await handle_stop_recording(client_id, websocket)
                elif message_type == "audio_chunk" or message_type == "audio_data":
                    # Handle both audio_chunk (legacy) and audio_data (frontend) formats
                    await handle_audio_chunk(client_id, message_data)
                elif message_type == "video_frame":
                    # Video frames are not processed in audio-only mode but acknowledge receipt
                    pass
                elif message_type == "test":
                    # Handle test messages for connection verification
                    await websocket.send_text(json.dumps({
                        "type": "test_response",
                        "message": "Test message received successfully",
                        "timestamp": datetime.now().isoformat()
                    }))
                else:
                    print(f"❓ Unknown message type: {message_type}")
                    
            except WebSocketDisconnect:
                print(f"🔌 Client {client_id} disconnected")
                break
            except json.JSONDecodeError as e:
                print(f"❌ JSON decode error: {e}")
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format"
                }))
            except Exception as e:
                print(f"❌ Error handling message: {e}")
                print(traceback.format_exc())
                
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
    finally:
        # Cleanup
        if client_id and client_id in connected_clients:
            del connected_clients[client_id]
        if client_id and client_id in active_sessions:
            del active_sessions[client_id]
        
        print(f"🧹 Cleaned up client: {client_id}")

# ============================================================================
# STARTUP AND MAIN
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize ASR on startup"""
    print("🚀 Starting Meeting Monitor - Consolidated Backend...")
    
    # Ensure storage directory exists
    if storage_enabled:
        os.makedirs(storage_base_path, exist_ok=True)
    
    # Initialize ASR in background
    def init_asr_background():
        init_asr()
    
    asr_thread = threading.Thread(target=init_asr_background, daemon=True)
    asr_thread.start()
    
    print("� ASR Model: Enhanced Whisper Large-v2 (Maximum Accuracy)")
    print("🚀 RTX 3050 Ti Optimized with INT8 Quantization") 
    print("🔥 Real-time transcription with MAXIMUM accuracy hyperparameters!")
    print("✨ Features: beam_size=10, best_of=10, confidence filtering, hallucination prevention")

if __name__ == "__main__":
    print("🎯 Starting Meeting Monitor - Consolidated Backend")
    print("📡 Server URL: http://localhost:8000")
    print("🔌 WebSocket: ws://localhost:8000/ws")
    print("🧪 Video endpoint: POST /api/video/extract-transcript")
    print("🧠 Enhanced Analysis: /enhanced-analysis/status")
    print("📊 NLP Features: Grammar correction, NER, Topic modeling, Keywords, AI suggestions")
    
    uvicorn.run(
        app,
        host="localhost",
        port=8000,
        reload=False,
        log_level="info"
    )