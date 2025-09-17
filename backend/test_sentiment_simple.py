#!/usr/bin/env python3
"""
Simple sentiment analysis test script
"""

import time
from distilbert_sentiment import DistilBertSentimentAnalyzer

def test_sentiment():
    print("🤖 Initializing sentiment analyzer...")
    analyzer = DistilBertSentimentAnalyzer()
    
    print("⏳ Waiting for model to initialize...")
    # Wait for initialization
    for i in range(30):  # Wait up to 30 seconds
        if analyzer.is_initialized:
            break
        print(f"   Waiting... {i+1}/30 seconds")
        time.sleep(1)
    
    if not analyzer.is_initialized:
        print("❌ Model failed to initialize")
        if analyzer.initialization_error:
            print(f"Error: {analyzer.initialization_error}")
        return
    
    print("✅ Model initialized successfully!")
    
    # Test sentences
    test_sentences = [
        "I am very happy today!",
        "This meeting is going great.",
        "I'm feeling sad about this decision.",
        "The project is neutral, nothing special.",
        "Wow, this is absolutely amazing work!"
    ]
    
    print("\n📝 Testing sentiment analysis:")
    for sentence in test_sentences:
        try:
            result = analyzer.analyze_transcript_sentiment(sentence)
            print(f"   '{sentence}'")
            print(f"   → Sentiment: {result.get('overall_sentiment', 'Unknown')}")
            print(f"   → Confidence: {result.get('overall_confidence', 0):.2f}")
            if 'sentences' in result and result['sentences']:
                for sent in result['sentences']:
                    print(f"     - '{sent['text']}': {sent['sentiment']} ({sent['confidence']:.2f})")
            print()
        except Exception as e:
            print(f"   Error analyzing '{sentence}': {e}")

if __name__ == "__main__":
    test_sentiment()