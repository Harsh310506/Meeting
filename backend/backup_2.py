"""
DistilBERT Sentiment Analysis Module
Real-time sentiment analysis for meeting transcripts using fine-tuned DistilBERT model
"""

import spacy
import logging
import asyncio
from typing import List, Dict, Any, Optional
from collections import defaultdict
import statistics

# Handle transformers import with better error handling
try:
    from transformers import DistilBertTokenizerFast, DistilBertForSequenceClassification, pipeline
    TRANSFORMERS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Transformers library not available: {e}")
    TRANSFORMERS_AVAILABLE = False
    # Create dummy classes to prevent import errors
    DistilBertTokenizerFast = None
    DistilBertForSequenceClassification = None
    pipeline = None

# Handle torch import
try:
    import torch
    TORCH_AVAILABLE = True
except ImportError as e:
    print(f"Warning: PyTorch not available: {e}")
    TORCH_AVAILABLE = False
    torch = None

# Handle numpy import
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    np = None

# Configure logging
logger = logging.getLogger(__name__)

class DistilBertSentimentAnalyzer:
    """
    Advanced sentiment analysis using DistilBERT model fine-tuned on SST-2 dataset
    Provides sentence-level and overall sentiment scoring with confidence metrics
    """
    
    def __init__(self):
        self.model_name = "distilbert-base-uncased-finetuned-sst-2-english"
        self.tokenizer = None
        self.model = None
        self.sentiment_pipeline = None
        self.nlp = None
        self.is_initialized = False
        self.initialization_error = None
        
        # Check if required dependencies are available
        if not TRANSFORMERS_AVAILABLE:
            self.initialization_error = "Transformers library not available. Install with: pip install transformers"
            return
        
        if not TORCH_AVAILABLE:
            self.initialization_error = "PyTorch not available. Install with: pip install torch"
            return
        
        # Check if CUDA is available for potential GPU acceleration
        cuda_available = torch and torch.cuda.is_available()
        
        # Note: TrainingArguments removed as we only need inference, not training
        
        # Initialize models in a thread to avoid blocking
        import threading
        threading.Thread(target=self._initialize_models_sync, daemon=True).start()
    
    def _initialize_models_sync(self):
        """Initialize DistilBERT and SpaCy models synchronously"""
        # Skip initialization if dependencies not available
        if self.initialization_error:
            logger.error(f"Skipping initialization: {self.initialization_error}")
            return
            
        try:
            logger.info("🤖 Initializing DistilBERT sentiment analysis models...")
            
            # Load DistilBERT model and tokenizer
            logger.info(f"📥 Loading model: {self.model_name}")
            self.tokenizer = DistilBertTokenizerFast.from_pretrained(self.model_name)
            self.model = DistilBertForSequenceClassification.from_pretrained(self.model_name)
            
            # Create sentiment analysis pipeline with GPU support if available
            device = 0 if torch.cuda.is_available() else -1
            if device == 0:
                logger.info("🚀 Using GPU acceleration for sentiment analysis")
            else:
                logger.info("💻 Using CPU for sentiment analysis")
                
            self.sentiment_pipeline = pipeline(
                "sentiment-analysis", 
                model=self.model, 
                tokenizer=self.tokenizer,
                device=device,
                top_k=None  # Updated from deprecated return_all_scores=True
            )
            
            # Load SpaCy for sentence splitting
            try:
                self.nlp = spacy.load("en_core_web_sm")
                logger.info("✅ SpaCy model loaded successfully")
            except OSError:
                logger.warning("⚠️ SpaCy en_core_web_sm not found, using basic sentence splitting")
                self.nlp = None
            
            self.is_initialized = True
            logger.info("✅ DistilBERT sentiment analysis initialized successfully")
            
        except Exception as e:
            self.initialization_error = str(e)
            logger.error(f"❌ Failed to initialize DistilBERT sentiment analysis: {e}")
    
    def split_into_sentences(self, text: str) -> List[str]:
        """
        Split text into sentences using SpaCy or fallback method
        
        Args:
            text: Input text to split
            
        Returns:
            List of sentences
        """
        if self.nlp:
            doc = self.nlp(text)
            return [sent.text.strip() for sent in doc.sents if sent.text.strip()]
        else:
            # Fallback: simple sentence splitting
            import re
            sentences = re.split(r'[.!?]+', text)
            return [sent.strip() for sent in sentences if sent.strip()]
    
    def analyze_sentence_sentiment(self, sentence: str) -> Dict[str, Any]:
        """
        Analyze sentiment of a single sentence with conservative thresholds
        
        Args:
            sentence: Text to analyze
            
        Returns:
            Dict with sentiment label, confidence, and raw scores
        """
        if not self.is_initialized:
            return {
                "sentence": sentence,
                "sentiment": "UNKNOWN",
                "confidence": 0.0,
                "positive_score": 0.0,
                "negative_score": 0.0,
                "error": self.initialization_error or "Model not initialized"
            }
        
        try:
            # Get predictions with all scores
            results = self.sentiment_pipeline(sentence)
            
            # Extract scores for both labels
            scores = {result['label']: result['score'] for result in results[0]}
            positive_score = scores.get('POSITIVE', 0.0)
            negative_score = scores.get('NEGATIVE', 0.0)
            
            # Very conservative thresholds to prevent overfitting and false positives
            confidence_threshold = 0.75  # Much higher threshold (was 0.65)
            neutral_zone = 0.25  # Wider neutral zone (was 0.15)
            strong_sentiment_threshold = 0.85  # For very confident classifications
            
            score_diff = abs(positive_score - negative_score)
            max_score = max(positive_score, negative_score)
            
            # Additional checks for neutral content patterns
            neutral_keywords = ['meeting', 'discussed', 'reviewed', 'presented', 'scheduled', 
                              'covered', 'reported', 'standard', 'procedure', 'operational',
                              'quarterly', 'budget', 'allocation', 'expenditure', 'team']
            
            sentence_lower = sentence.lower()
            neutral_keyword_count = sum(1 for keyword in neutral_keywords if keyword in sentence_lower)
            has_neutral_pattern = neutral_keyword_count >= 2
            
            # Determine sentiment with very conservative approach
            if (score_diff < neutral_zone or 
                max_score < confidence_threshold or 
                has_neutral_pattern):
                # Scores too close, confidence too low, or neutral pattern detected
                sentiment = "NEUTRAL"
                confidence = max_score
            elif max_score >= strong_sentiment_threshold and score_diff > 0.4:
                # Only classify as positive/negative if very confident and clear difference
                if positive_score > negative_score:
                    sentiment = "POSITIVE"
                    confidence = positive_score
                else:
                    sentiment = "NEGATIVE" 
                    confidence = negative_score
            else:
                # Medium confidence - be conservative
                sentiment = "NEUTRAL"
                confidence = max_score
            
            return {
                "sentence": sentence,
                "sentiment": sentiment,
                "confidence": confidence,
                "positive_score": positive_score,
                "negative_score": negative_score,
                "score_difference": score_diff,
                "length": len(sentence.split())
            }
            
        except Exception as e:
            logger.error(f"Error analyzing sentence sentiment: {e}")
            return {
                "sentence": sentence,
                "sentiment": "ERROR",
                "confidence": 0.0,
                "positive_score": 0.0,
                "negative_score": 0.0,
                "error": str(e)
            }
    
    def analyze_transcript_sentiment(self, transcript: str) -> Dict[str, Any]:
        """
        Comprehensive sentiment analysis of entire transcript
        
        Args:
            transcript: Full transcript text
            
        Returns:
            Dict with overall sentiment, sentence-level analysis, and statistics
        """
        if not self.is_initialized:
            return {
                "overall_sentiment": "UNKNOWN",
                "overall_confidence": 0.0,
                "error": self.initialization_error or "Model not initialized"
            }
        
        try:
            # Split into sentences
            sentences = self.split_into_sentences(transcript)
            
            if not sentences:
                return {
                    "overall_sentiment": "NEUTRAL",
                    "overall_confidence": 0.0,
                    "sentence_count": 0,
                    "sentences": [],
                    "statistics": {}
                }
            
            # Analyze each sentence
            sentence_results = []
            positive_scores = []
            negative_scores = []
            confidences = []
            
            for sentence in sentences:
                if len(sentence.strip()) < 3:  # Skip very short sentences
                    continue
                    
                result = self.analyze_sentence_sentiment(sentence)
                sentence_results.append(result)
                
                if "error" not in result:
                    positive_scores.append(result['positive_score'])
                    negative_scores.append(result['negative_score'])
                    confidences.append(result['confidence'])
            
            # Calculate overall statistics
            if positive_scores and negative_scores:
                avg_positive = statistics.mean(positive_scores)
                avg_negative = statistics.mean(negative_scores)
                avg_confidence = statistics.mean(confidences)
                
                # Calculate sentiment distribution including neutral
                positive_count = sum(1 for r in sentence_results if r.get('sentiment') == 'POSITIVE')
                negative_count = sum(1 for r in sentence_results if r.get('sentiment') == 'NEGATIVE')
                neutral_count = sum(1 for r in sentence_results if r.get('sentiment') == 'NEUTRAL')
                total_sentences = len(sentence_results)
                
                # Conservative overall sentiment determination
                positive_ratio = positive_count / total_sentences if total_sentences > 0 else 0
                negative_ratio = negative_count / total_sentences if total_sentences > 0 else 0
                neutral_ratio = neutral_count / total_sentences if total_sentences > 0 else 0
                
                # Require strong majority for overall sentiment (70%+ threshold)
                majority_threshold = 0.7
                
                if positive_ratio >= majority_threshold:
                    overall_sentiment = "POSITIVE"
                    overall_confidence = avg_positive
                elif negative_ratio >= majority_threshold:
                    overall_sentiment = "NEGATIVE"
                    overall_confidence = avg_negative
                else:
                    # Mixed or neutral overall sentiment
                    overall_sentiment = "MIXED" if neutral_ratio < 0.5 else "NEUTRAL"
                    overall_confidence = avg_confidence
                
                # Sentiment trajectory (how sentiment changes over time)
                sentiment_trajectory = [
                    r.get('positive_score', 0) - r.get('negative_score', 0) 
                    for r in sentence_results if 'error' not in r
                ]
                
                statistics_data = {
                    "sentence_count": total_sentences,
                    "positive_sentences": positive_count,
                    "negative_sentences": negative_count,
                    "neutral_sentences": neutral_count,
                    "positive_ratio": positive_ratio,
                    "negative_ratio": negative_ratio,
                    "neutral_ratio": neutral_ratio,
                    "average_positive_score": avg_positive,
                    "average_negative_score": avg_negative,
                    "average_confidence": avg_confidence,
                    "sentiment_variance": statistics.variance(sentiment_trajectory) if len(sentiment_trajectory) > 1 else 0,
                    "sentiment_range": max(sentiment_trajectory) - min(sentiment_trajectory) if sentiment_trajectory else 0,
                    "classification_confidence": "high" if avg_confidence > 0.8 else "medium" if avg_confidence > 0.65 else "low"
                }
                
            else:
                overall_sentiment = "NEUTRAL"
                overall_confidence = 0.0
                statistics_data = {
                    "error": "No valid sentences to analyze",
                    "sentence_count": len(sentence_results),
                    "classification_confidence": "none"
                }
            
            return {
                "overall_sentiment": overall_sentiment,
                "overall_confidence": overall_confidence,
                "sentences": sentence_results,
                "statistics": statistics_data,
                "model_info": {
                    "model_name": self.model_name,
                    "device": "GPU" if torch.cuda.is_available() else "CPU"
                }
            }
            
        except Exception as e:
            logger.error(f"Error in transcript sentiment analysis: {e}")
            return {
                "overall_sentiment": "ERROR",
                "overall_confidence": 0.0,
                "error": str(e),
                "sentences": []
            }
    
    def get_sentiment_summary(self, transcript: str) -> Dict[str, Any]:
        """
        Get a concise sentiment summary for quick insights
        
        Args:
            transcript: Text to analyze
            
        Returns:
            Simplified sentiment summary
        """
        full_analysis = self.analyze_transcript_sentiment(transcript)
        
        if "error" in full_analysis:
            return {
                "sentiment": "UNKNOWN",
                "confidence": 0.0,
                "summary": "Unable to analyze sentiment",
                "error": full_analysis["error"]
            }
        
        stats = full_analysis.get("statistics", {})
        
        return {
            "sentiment": full_analysis["overall_sentiment"],
            "confidence": round(full_analysis["overall_confidence"], 3),
            "positive_ratio": round(stats.get("positive_ratio", 0), 3),
            "negative_ratio": round(stats.get("negative_ratio", 0), 3),
            "sentence_count": stats.get("sentence_count", 0),
            "summary": self._generate_summary_text(full_analysis)
        }
    
    def _generate_summary_text(self, analysis: Dict[str, Any]) -> str:
        """Generate human-readable summary text with conservative interpretation"""
        if "error" in analysis:
            return "Sentiment analysis unavailable"
        
        sentiment = analysis["overall_sentiment"]
        confidence = analysis["overall_confidence"]
        stats = analysis.get("statistics", {})
        
        pos_ratio = stats.get("positive_ratio", 0)
        neg_ratio = stats.get("negative_ratio", 0)
        neutral_ratio = stats.get("neutral_ratio", 0)
        classification_confidence = stats.get("classification_confidence", "medium")
        
                # Very conservative interpretation based on confidence levels
        if classification_confidence == "low":
            return f"Uncertain sentiment analysis - confidence too low ({confidence:.1%})"
        elif sentiment == "MIXED":
            return f"Mixed sentiment detected - {pos_ratio:.1%} positive, {neg_ratio:.1%} negative, {neutral_ratio:.1%} neutral"
        elif sentiment == "NEUTRAL":
            return f"Predominantly neutral/factual content ({neutral_ratio:.1%} neutral statements)"
        elif sentiment == "POSITIVE":
            if pos_ratio >= 0.8 and classification_confidence == "high":
                return f"Clearly positive sentiment ({pos_ratio:.1%} positive sentences)"
            elif pos_ratio >= 0.7:
                return f"Generally positive sentiment with some neutral content"
            else:
                return f"Moderately positive sentiment - mixed with neutral content"
        elif sentiment == "NEGATIVE":
            if neg_ratio >= 0.8 and classification_confidence == "high":
                return f"Clearly negative sentiment ({neg_ratio:.1%} negative sentences)"
            elif neg_ratio >= 0.7:
                return f"Generally negative sentiment with some neutral content"
            else:
                return f"Moderately negative sentiment - mixed with neutral content"
        else:
            return f"Sentiment classification inconclusive - predominantly neutral"# Global instance (only create if dependencies available)
if TRANSFORMERS_AVAILABLE and TORCH_AVAILABLE:
    distilbert_analyzer = DistilBertSentimentAnalyzer()
else:
    distilbert_analyzer = None

def analyze_sentiment(transcript: str) -> Dict[str, Any]:
    """
    Convenience function for sentiment analysis
    
    Args:
        transcript: Text to analyze
        
    Returns:
        Sentiment analysis results
    """
    if not distilbert_analyzer:
        return {"error": "DistilBERT analyzer not available. Check dependencies."}
    return distilbert_analyzer.analyze_transcript_sentiment(transcript)

def get_sentiment_summary(transcript: str) -> Dict[str, Any]:
    """
    Convenience function for sentiment summary
    
    Args:
        transcript: Text to analyze
        
    Returns:
        Simplified sentiment summary
    """
    if not distilbert_analyzer:
        return {"error": "DistilBERT analyzer not available. Check dependencies."}
    return distilbert_analyzer.get_sentiment_summary(transcript)