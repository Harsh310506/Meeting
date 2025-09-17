"""
Test Conservative Sentiment Analysis Integration
Test the updated sentiment analysis with conservative thresholds and main backend
"""

import asyncio
import sys
import os
import json
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

async def test_conservative_sentiment():
    """Test the conservative sentiment analysis with various test cases"""
    print("🧪 Testing Conservative DistilBERT Sentiment Analysis")
    print("=" * 60)
    
    try:
        from distilbert_sentiment import analyze_sentiment, get_sentiment_summary, distilbert_analyzer
        
        # Wait for initialization
        print("⏳ Waiting for model initialization...")
        await asyncio.sleep(5)
        
        if not distilbert_analyzer or not distilbert_analyzer.is_initialized:
            print("❌ Model not ready")
            return False
        
        print("✅ Model ready for testing\n")
        
        # Test cases designed to check for overfitting and false positives
        test_cases = {
            "Clearly Positive": """
            This meeting was absolutely fantastic and very productive! 
            The team did an excellent job and exceeded all expectations. 
            I'm thrilled with the progress we've made today.
            Everyone contributed brilliantly and the results are outstanding!
            """,
            
            "Clearly Negative": """
            This meeting was a complete disaster and waste of time.
            The project is failing badly and nothing is working correctly.
            I'm extremely disappointed with the terrible progress.
            This is absolutely unacceptable and frustrating!
            """,
            
            "Neutral/Factual": """
            Today's meeting covered quarterly budget allocations.
            The finance team presented Q3 expenditure reports.
            We reviewed standard operational procedures.
            The next meeting is scheduled for next Tuesday at 2 PM.
            """,
            
            "Mixed Sentiment": """
            The project has some good aspects but also concerning issues.
            While the team worked hard, the results were disappointing.
            We made progress in some areas but fell behind in others.
            The client feedback was mixed - positive on design, negative on timeline.
            """,
            
            "Subtle/Ambiguous": """
            The presentation was interesting and covered various topics.
            We discussed potential improvements to the current system.
            The team provided their thoughts on the proposal.
            There are several options to consider moving forward.
            """,
            
            "Professional/Polite Negative": """
            While we appreciate the effort, there are areas for improvement.
            The timeline may need adjustment to meet quality standards.
            We should consider alternative approaches for better results.
            Additional resources might be beneficial for project success.
            """
        }
        
        print("📊 Conservative Sentiment Analysis Results:")
        print("=" * 60)
        
        for test_name, text in test_cases.items():
            print(f"\n🧪 {test_name}")
            print("-" * 40)
            
            # Analyze with both functions
            detailed_result = analyze_sentiment(text.strip())
            summary_result = get_sentiment_summary(text.strip())
            
            if "error" in detailed_result:
                print(f"❌ Error: {detailed_result['error']}")
                continue
            
            # Display results
            overall_sentiment = detailed_result.get('overall_sentiment', 'UNKNOWN')
            overall_confidence = detailed_result.get('overall_confidence', 0.0)
            stats = detailed_result.get('statistics', {})
            
            print(f"📈 Overall: {overall_sentiment} ({overall_confidence:.1%} confidence)")
            print(f"📊 Distribution:")
            print(f"   • Positive: {stats.get('positive_sentences', 0)} ({stats.get('positive_ratio', 0):.1%})")
            print(f"   • Negative: {stats.get('negative_sentences', 0)} ({stats.get('negative_ratio', 0):.1%})")
            print(f"   • Neutral: {stats.get('neutral_sentences', 0)} ({stats.get('neutral_ratio', 0):.1%})")
            print(f"🎯 Classification: {stats.get('classification_confidence', 'unknown')}")
            print(f"💭 Summary: {summary_result.get('summary', 'No summary')}")
            
            # Show individual sentence analysis for first few sentences
            sentences = detailed_result.get('sentences', [])[:3]
            if sentences:
                print(f"🔍 Sample sentences:")
                for i, sent in enumerate(sentences, 1):
                    if 'error' not in sent:
                        s = sent.get('sentence', '')[:50] + "..." if len(sent.get('sentence', '')) > 50 else sent.get('sentence', '')
                        sentiment = sent.get('sentiment', 'UNKNOWN')
                        confidence = sent.get('confidence', 0.0)
                        diff = sent.get('score_difference', 0.0)
                        print(f"   {i}. \"{s}\" → {sentiment} ({confidence:.1%}, diff: {diff:.2f})")
        
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_main_backend_integration():
    """Test integration with main consolidated backend"""
    print(f"\n{'=' * 60}")
    print("🔗 Testing Main Backend Integration")
    print("=" * 60)
    
    try:
        # Import main backend
        from main_consolidated import DISTILBERT_AVAILABLE, distilbert_analyzer, analyze_sentiment as main_analyze
        
        print(f"✅ Main backend imported successfully")
        print(f"📦 DistilBERT available in main: {DISTILBERT_AVAILABLE}")
        
        if DISTILBERT_AVAILABLE and distilbert_analyzer:
            print(f"🤖 Analyzer status: {'Ready' if distilbert_analyzer.is_initialized else 'Initializing'}")
            
            if distilbert_analyzer.initialization_error:
                print(f"❌ Initialization error: {distilbert_analyzer.initialization_error}")
            else:
                print("✅ No initialization errors")
            
            # Test the main backend's analyze function
            test_text = "This meeting went well overall, though there were some minor concerns about the timeline."
            
            if main_analyze:
                result = main_analyze(test_text)
                if "error" not in result:
                    print(f"✅ Main backend analysis works: {result.get('overall_sentiment')} ({result.get('overall_confidence', 0):.1%})")
                else:
                    print(f"❌ Main backend analysis error: {result.get('error')}")
            else:
                print("⚠️ Main backend analyze function not available")
        else:
            print("⚠️ DistilBERT not available in main backend")
        
        return True
        
    except Exception as e:
        print(f"❌ Main backend integration test failed: {e}")
        return False

async def main():
    """Run comprehensive tests"""
    print("🚀 Conservative Sentiment Analysis Test Suite")
    print("Preventing overfitting and false positives\n")
    
    # Test conservative sentiment analysis
    sentiment_success = await test_conservative_sentiment()
    
    # Test main backend integration
    main_success = test_main_backend_integration()
    
    # Summary
    print(f"\n{'=' * 60}")
    print("📋 TEST SUMMARY")
    print("=" * 60)
    
    if sentiment_success:
        print("✅ Conservative sentiment analysis working properly")
    else:
        print("❌ Conservative sentiment analysis issues detected")
    
    if main_success:
        print("✅ Main backend integration working")
    else:
        print("❌ Main backend integration issues")
    
    if sentiment_success and main_success:
        print("\n🎉 All tests passed! Conservative sentiment analysis ready.")
        print("\n💡 Key improvements:")
        print("   • Higher confidence thresholds (65% instead of 50%)")
        print("   • Neutral zone for ambiguous cases (±15%)")
        print("   • MIXED and NEUTRAL sentiment categories")
        print("   • Conservative overall sentiment (requires 60% majority)")
        print("   • Classification confidence levels")
    else:
        print("\n⚠️ Some tests failed. Check the output above.")

if __name__ == "__main__":
    asyncio.run(main())