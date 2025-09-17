"""
Test DistilBERT Sentiment Analysis Integration
Test script to verify the DistilBERT sentiment analysis module works correctly
"""

import asyncio
import sys
import os
import json

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_import():
    """Test if the sentiment analysis module can be imported"""
    try:
        from distilbert_sentiment import DistilBertSentimentAnalyzer, analyze_sentiment, get_sentiment_summary
        print("✅ Successfully imported DistilBERT sentiment analysis module")
        return True
    except ImportError as e:
        print(f"❌ Failed to import DistilBERT sentiment analysis module: {e}")
        return False

def test_dependencies():
    """Test if required dependencies are available"""
    missing_deps = []
    
    try:
        import transformers
        print(f"✅ transformers version: {transformers.__version__}")
    except ImportError:
        missing_deps.append("transformers")
    
    try:
        import torch
        print(f"✅ torch version: {torch.__version__}")
        print(f"✅ CUDA available: {torch.cuda.is_available()}")
    except ImportError:
        missing_deps.append("torch")
    
    try:
        import spacy
        print(f"✅ spacy version: {spacy.__version__}")
    except ImportError:
        missing_deps.append("spacy")
    
    if missing_deps:
        print(f"❌ Missing dependencies: {missing_deps}")
        return False
    
    return True

async def test_sentiment_analyzer():
    """Test the DistilBERT sentiment analyzer"""
    try:
        from distilbert_sentiment import DistilBertSentimentAnalyzer
        
        # Create analyzer instance
        analyzer = DistilBertSentimentAnalyzer()
        print("✅ Created DistilBertSentimentAnalyzer instance")
        
        # Wait for initialization (with timeout)
        print("⏳ Waiting for model initialization...")
        max_wait = 60  # 60 seconds timeout
        wait_time = 0
        
        while not analyzer.is_initialized and wait_time < max_wait:
            await asyncio.sleep(1)
            wait_time += 1
            if wait_time % 10 == 0:
                print(f"⏳ Still waiting... ({wait_time}s)")
        
        if not analyzer.is_initialized:
            print(f"❌ Model failed to initialize within {max_wait} seconds")
            if analyzer.initialization_error:
                print(f"   Error: {analyzer.initialization_error}")
            return False
        
        print("✅ Model initialized successfully")
        return analyzer
        
    except Exception as e:
        print(f"❌ Error creating analyzer: {e}")
        return False

async def test_sentence_analysis(analyzer):
    """Test sentence-level sentiment analysis"""
    test_sentences = [
        "We are very satisfied with the collaboration so far.",
        "However, the delivery delay created some frustration in our team.",
        "Overall, we see a lot of potential in this partnership.",
        "This is a terrible mistake and needs to be fixed immediately.",
        "I'm absolutely delighted with the progress we've made today."
    ]
    
    print("\n🧪 Testing sentence-level sentiment analysis:")
    
    for sentence in test_sentences:
        result = analyzer.analyze_sentence_sentiment(sentence)
        
        if "error" in result:
            print(f"❌ Error analyzing: '{sentence[:50]}...'")
            print(f"   Error: {result['error']}")
        else:
            sentiment = result['sentiment']
            confidence = result['confidence']
            print(f"✅ '{sentence[:50]}...' → {sentiment} ({confidence:.3f})")
    
    return True

async def test_transcript_analysis(analyzer):
    """Test full transcript sentiment analysis"""
    test_transcript = """
    We are very satisfied with the collaboration so far. 
    However, the delivery delay created some frustration in our team. 
    Overall, we see a lot of potential in this partnership.
    The new features look fantastic and the user feedback has been overwhelmingly positive.
    Unfortunately, we encountered some technical issues during the deployment.
    But our team worked hard to resolve them quickly.
    I'm confident we can meet the project deadline successfully.
    """
    
    print("\n🧪 Testing full transcript sentiment analysis:")
    
    result = analyzer.analyze_transcript_sentiment(test_transcript)
    
    if "error" in result:
        print(f"❌ Error analyzing transcript: {result['error']}")
        return False
    
    print(f"✅ Overall sentiment: {result['overall_sentiment']}")
    print(f"✅ Overall confidence: {result['overall_confidence']:.3f}")
    
    stats = result.get('statistics', {})
    if stats:
        print(f"✅ Sentence count: {stats.get('sentence_count', 0)}")
        print(f"✅ Positive sentences: {stats.get('positive_sentences', 0)}")
        print(f"✅ Negative sentences: {stats.get('negative_sentences', 0)}")
        print(f"✅ Positive ratio: {stats.get('positive_ratio', 0):.3f}")
        print(f"✅ Negative ratio: {stats.get('negative_ratio', 0):.3f}")
    
    # Test sentence breakdown
    sentences = result.get('sentences', [])
    print(f"\n📝 Sentence-by-sentence breakdown ({len(sentences)} sentences):")
    for i, sent_result in enumerate(sentences[:3], 1):  # Show first 3 sentences
        if "error" not in sent_result:
            sentence = sent_result['sentence'][:60] + "..." if len(sent_result['sentence']) > 60 else sent_result['sentence']
            print(f"   {i}. {sentence}")
            print(f"      → {sent_result['sentiment']} ({sent_result['confidence']:.3f})")
    
    if len(sentences) > 3:
        print(f"   ... and {len(sentences) - 3} more sentences")
    
    return True

async def test_convenience_functions():
    """Test convenience functions"""
    print("\n🧪 Testing convenience functions:")
    
    test_text = """
    This meeting was incredibly productive! We made significant progress on all fronts.
    However, there are still some concerns about the budget constraints.
    Overall, the team morale is high and we're optimistic about the future.
    """
    
    try:
        from distilbert_sentiment import analyze_sentiment, get_sentiment_summary
        
        # Test full analysis function
        full_result = analyze_sentiment(test_text)
        if "error" not in full_result:
            print(f"✅ analyze_sentiment() - Overall: {full_result['overall_sentiment']} ({full_result['overall_confidence']:.3f})")
        else:
            print(f"❌ analyze_sentiment() error: {full_result['error']}")
        
        # Test summary function
        summary_result = get_sentiment_summary(test_text)
        if "error" not in summary_result:
            print(f"✅ get_sentiment_summary() - {summary_result['sentiment']} ({summary_result['confidence']:.3f})")
            print(f"   Summary: {summary_result['summary']}")
        else:
            print(f"❌ get_sentiment_summary() error: {summary_result['error']}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error testing convenience functions: {e}")
        return False

async def main():
    """Main test function"""
    print("🧪 DistilBERT Sentiment Analysis Integration Test")
    print("=" * 55)
    
    # Test 1: Import
    print("\n1. Testing module import...")
    if not test_import():
        return
    
    # Test 2: Dependencies
    print("\n2. Testing dependencies...")
    if not test_dependencies():
        print("❌ Please install missing dependencies:")
        print("   pip install transformers torch datasets spacy")
        return
    
    # Test 3: Model initialization
    print("\n3. Testing model initialization...")
    analyzer = await test_sentiment_analyzer()
    if not analyzer:
        return
    
    # Test 4: Sentence analysis
    print("\n4. Testing sentence analysis...")
    if not await test_sentence_analysis(analyzer):
        return
    
    # Test 5: Transcript analysis
    print("\n5. Testing transcript analysis...")
    if not await test_transcript_analysis(analyzer):
        return
    
    # Test 6: Convenience functions
    print("\n6. Testing convenience functions...")
    if not await test_convenience_functions():
        return
    
    print("\n🎉 All tests completed successfully!")
    print("\n💡 Integration tips:")
    print("   - The analyzer initializes asynchronously")
    print("   - Check analyzer.is_initialized before use")
    print("   - Handle initialization errors gracefully")
    print("   - Use GPU if available for better performance")

if __name__ == "__main__":
    asyncio.run(main())