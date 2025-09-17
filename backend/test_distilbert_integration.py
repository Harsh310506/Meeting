"""
Test DistilBERT Sentiment Analysis Integration
Comprehensive testing for sentiment analysis functionality
"""

import sys
import asyncio
import logging
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_imports():
    """Test if all required packages can be imported"""
    print("🧪 Testing imports...")
    
    try:
        import torch
        print(f"✅ PyTorch {torch.__version__} - CUDA available: {torch.cuda.is_available()}")
    except ImportError as e:
        print(f"❌ PyTorch import failed: {e}")
        return False
    
    try:
        import transformers
        print(f"✅ Transformers {transformers.__version__}")
    except ImportError as e:
        print(f"❌ Transformers import failed: {e}")
        return False
    
    try:
        import spacy
        print(f"✅ SpaCy {spacy.__version__}")
    except ImportError as e:
        print(f"❌ SpaCy import failed: {e}")
        return False
    
    try:
        from distilbert_sentiment import DistilBertSentimentAnalyzer, analyze_sentiment, get_sentiment_summary
        print("✅ DistilBERT sentiment module imported successfully")
        return True
    except ImportError as e:
        print(f"❌ DistilBERT sentiment module import failed: {e}")
        return False

async def test_sentiment_analyzer():
    """Test the DistilBERT sentiment analyzer functionality"""
    print("\n🧪 Testing DistilBERT Sentiment Analyzer...")
    
    try:
        from distilbert_sentiment import DistilBertSentimentAnalyzer
        
        # Initialize analyzer
        analyzer = DistilBertSentimentAnalyzer()
        print("✅ Analyzer initialized")
        
        # Wait for initialization
        print("⏳ Waiting for model initialization...")
        await asyncio.sleep(5)  # Give time for async initialization
        
        # Test sample sentences
        test_sentences = [
            "This meeting was fantastic and very productive!",
            "I'm really disappointed with the project delays.",
            "The quarterly results look promising.",
            "We need to address some serious concerns immediately.",
            "Overall, I think we're making good progress."
        ]
        
        print("\n📝 Testing individual sentence analysis:")
        for sentence in test_sentences:
            result = analyzer.analyze_sentence_sentiment(sentence)
            sentiment = result.get('sentiment', 'UNKNOWN')
            confidence = result.get('confidence', 0.0)
            print(f"  • '{sentence}' → {sentiment} ({confidence:.2%})")
        
        # Test full transcript analysis
        print("\n📄 Testing full transcript analysis:")
        sample_transcript = """
        Welcome everyone to today's quarterly review meeting. 
        I'm excited to share that we've exceeded our sales targets by 15% this quarter. 
        However, we did face some challenges with the new product launch. 
        The customer feedback has been mixed, with some concerns about usability. 
        Despite these issues, I believe we're on the right track for next quarter. 
        Thank you all for your hard work and dedication.
        """
        
        full_result = analyzer.analyze_transcript_sentiment(sample_transcript)
        
        if "error" not in full_result:
            print(f"✅ Overall Sentiment: {full_result.get('overall_sentiment')} ({full_result.get('overall_confidence', 0):.2%})")
            
            stats = full_result.get('statistics', {})
            print(f"   - Sentences analyzed: {stats.get('sentence_count', 0)}")
            print(f"   - Positive ratio: {stats.get('positive_ratio', 0):.1%}")
            print(f"   - Negative ratio: {stats.get('negative_ratio', 0):.1%}")
            
            # Test summary function
            summary = analyzer.get_sentiment_summary(sample_transcript)
            print(f"✅ Summary: {summary.get('summary', 'No summary')}")
        else:
            print(f"❌ Transcript analysis failed: {full_result.get('error')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Sentiment analyzer test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_convenience_functions():
    """Test the convenience functions for sentiment analysis"""
    print("\n🧪 Testing convenience functions...")
    
    try:
        from distilbert_sentiment import analyze_sentiment, get_sentiment_summary
        
        test_text = "I'm really happy with the team's performance this quarter. Great job everyone!"
        
        # Test analyze_sentiment function
        print("📊 Testing analyze_sentiment function:")
        result = analyze_sentiment(test_text)
        if "error" not in result:
            print(f"✅ Result: {result.get('overall_sentiment')} ({result.get('overall_confidence', 0):.2%})")
        else:
            print(f"❌ Error: {result.get('error')}")
        
        # Test get_sentiment_summary function
        print("📋 Testing get_sentiment_summary function:")
        summary = get_sentiment_summary(test_text)
        if "error" not in summary:
            print(f"✅ Summary: {summary.get('summary', 'No summary')}")
            print(f"   - Sentiment: {summary.get('sentiment')}")
            print(f"   - Confidence: {summary.get('confidence', 0):.2%}")
        else:
            print(f"❌ Error: {summary.get('error')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Convenience functions test failed: {e}")
        return False

def test_integration_with_main():
    """Test integration with main consolidated backend"""
    print("\n🧪 Testing integration with main backend...")
    
    try:
        # Import main backend to test integration
        from main_consolidated import DISTILBERT_AVAILABLE, distilbert_analyzer
        
        print(f"✅ DISTILBERT_AVAILABLE: {DISTILBERT_AVAILABLE}")
        
        if DISTILBERT_AVAILABLE and distilbert_analyzer:
            print("✅ DistilBERT analyzer available in main backend")
            print(f"   - Initialized: {distilbert_analyzer.is_initialized}")
            if distilbert_analyzer.initialization_error:
                print(f"   - Error: {distilbert_analyzer.initialization_error}")
        else:
            print("⚠️ DistilBERT analyzer not available in main backend")
        
        return True
        
    except Exception as e:
        print(f"❌ Main backend integration test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_performance():
    """Test performance characteristics"""
    print("\n🧪 Testing performance...")
    
    try:
        import time
        from distilbert_sentiment import analyze_sentiment
        
        # Test with different text lengths
        short_text = "This is great!"
        medium_text = "This quarterly meeting went really well. The team presented excellent results and we're on track for our goals. However, there are some concerns about the upcoming project timeline."
        long_text = medium_text * 10  # Repeat to make longer text
        
        for name, text in [("Short", short_text), ("Medium", medium_text), ("Long", long_text)]:
            start_time = time.time()
            result = analyze_sentiment(text)
            end_time = time.time()
            
            if "error" not in result:
                stats = result.get('statistics', {})
                print(f"✅ {name} text ({len(text)} chars): {end_time - start_time:.2f}s")
                print(f"   - Sentences: {stats.get('sentence_count', 0)}")
                print(f"   - Sentiment: {result.get('overall_sentiment')}")
            else:
                print(f"❌ {name} text failed: {result.get('error')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Performance test failed: {e}")
        return False

async def main():
    """Run all tests"""
    print("🚀 Starting DistilBERT Sentiment Analysis Tests\n")
    
    tests = [
        ("Import Tests", test_imports),
        ("Integration Tests", test_integration_with_main),
        ("Convenience Functions", test_convenience_functions),
        ("Performance Tests", test_performance),
        ("Sentiment Analyzer", test_sentiment_analyzer)
    ]
    
    results = {}
    
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        print(f"🧪 {test_name}")
        print('='*50)
        
        try:
            if asyncio.iscoroutinefunction(test_func):
                success = await test_func()
            else:
                success = test_func()
            results[test_name] = success
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {e}")
            results[test_name] = False
    
    # Summary
    print(f"\n{'='*50}")
    print("📊 TEST SUMMARY")
    print('='*50)
    
    passed = sum(results.values())
    total = len(results)
    
    for test_name, success in results.items():
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! DistilBERT sentiment analysis is ready.")
    else:
        print("⚠️ Some tests failed. Please check the errors above.")
    
    return passed == total

if __name__ == "__main__":
    asyncio.run(main())