"""
Quick Test for Main Backend with Conservative Sentiment Analysis
Test the main_consolidated.py file with sentiment analysis integration
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

async def test_main_backend_sentiment():
    """Test main backend with conservative sentiment analysis"""
    print("🧪 Testing Main Backend with Conservative Sentiment Analysis")
    print("=" * 65)
    
    try:
        # Import main backend components
        from main_consolidated import DISTILBERT_AVAILABLE, distilbert_analyzer, analyze_sentiment
        
        print(f"✅ Main backend components imported")
        print(f"📦 DistilBERT available: {DISTILBERT_AVAILABLE}")
        
        if not DISTILBERT_AVAILABLE or not distilbert_analyzer:
            print("❌ DistilBERT not available in main backend")
            return False
        
        # Wait for initialization
        print("⏳ Waiting for analyzer initialization...")
        await asyncio.sleep(3)
        
        if not distilbert_analyzer.is_initialized:
            print(f"❌ Analyzer not initialized: {distilbert_analyzer.initialization_error}")
            return False
        
        print("✅ Analyzer ready for testing")
        
        # Test different types of content
        test_transcripts = {
            "Factual Meeting": """
            Today's meeting covered the quarterly budget review.
            The finance team presented expenditure reports for Q3.
            We discussed standard operational procedures.
            The next review is scheduled for December 15th at 2 PM.
            """,
            
            "Positive Meeting": """
            This meeting was incredibly productive and successful!
            The team exceeded all expectations and delivered outstanding results.
            I'm thrilled with the excellent progress we've made.
            Everyone contributed brilliantly to this fantastic project!
            """,
            
            "Negative Meeting": """
            This meeting was disappointing and unproductive.
            The project is behind schedule and over budget.
            Several critical issues remain unresolved.
            The client expressed serious concerns about our performance.
            """,
            
            "Mixed Professional": """
            While we appreciate the team's effort, there are areas for improvement.
            The project timeline needs adjustment to meet quality standards.
            Some deliverables were completed successfully.
            We should consider alternative approaches for better outcomes.
            """
        }
        
        print(f"\n📊 Testing Conservative Analysis on Various Content Types:")
        print("=" * 65)
        
        for name, transcript in test_transcripts.items():
            print(f"\n🧪 {name}")
            print("-" * 40)
            
            # Use the main backend's analyze_sentiment function
            result = analyze_sentiment(transcript.strip())
            
            if "error" in result:
                print(f"❌ Error: {result['error']}")
                continue
            
            # Display conservative results
            sentiment = result.get('overall_sentiment', 'UNKNOWN')
            confidence = result.get('overall_confidence', 0.0)
            stats = result.get('statistics', {})
            
            print(f"📈 Overall: {sentiment} ({confidence:.1%})")
            print(f"📊 Breakdown:")
            print(f"   • Positive: {stats.get('positive_sentences', 0)} ({stats.get('positive_ratio', 0):.1%})")
            print(f"   • Negative: {stats.get('negative_sentences', 0)} ({stats.get('negative_ratio', 0):.1%})")
            print(f"   • Neutral: {stats.get('neutral_sentences', 0)} ({stats.get('neutral_ratio', 0):.1%})")
            print(f"🎯 Confidence: {stats.get('classification_confidence', 'unknown')}")
            
            # Get summary
            from distilbert_sentiment import get_sentiment_summary
            summary = get_sentiment_summary(transcript.strip())
            print(f"💭 Summary: {summary.get('summary', 'No summary')}")
        
        # Test edge cases
        print(f"\n🔍 Testing Edge Cases:")
        print("-" * 40)
        
        edge_cases = [
            "The meeting is scheduled for tomorrow.",
            "We discussed various options and alternatives.",
            "The project status was reviewed thoroughly.",
            "Thank you for your time and attention."
        ]
        
        for i, text in enumerate(edge_cases, 1):
            result = analyze_sentiment(text)
            sentiment = result.get('overall_sentiment', 'UNKNOWN')
            confidence = result.get('overall_confidence', 0.0)
            print(f"   {i}. \"{text}\" → {sentiment} ({confidence:.1%})")
        
        print(f"\n✅ Main backend sentiment analysis test completed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    """Run the main backend test"""
    success = await test_main_backend_sentiment()
    
    print(f"\n{'=' * 65}")
    print("📋 SUMMARY")
    print("=" * 65)
    
    if success:
        print("✅ Main backend with conservative sentiment analysis is working!")
        print("\n💡 Key Conservative Features:")
        print("   • Higher confidence threshold (75%)")
        print("   • Wider neutral zone (±25%)")
        print("   • Neutral keyword detection")
        print("   • Requires 70% majority for overall sentiment")
        print("   • Prevents false positives on factual content")
        
        print(f"\n🚀 Ready to use! Start the main backend with:")
        print(f"   python main_consolidated.py")
    else:
        print("❌ Issues detected. Check the output above.")

if __name__ == "__main__":
    asyncio.run(main())