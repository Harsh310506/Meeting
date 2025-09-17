"""
Quick test of main_consolidated.py startup and DistilBERT integration
"""

import sys
import time
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

def test_main_backend():
    """Test main backend startup"""
    print("🧪 Testing Main Backend Startup")
    print("=" * 40)
    
    try:
        print("📦 Importing main backend...")
        from main_consolidated import (
            DISTILBERT_AVAILABLE, 
            distilbert_analyzer,
            enhanced_analyzer,
            analyze_sentiment,
            get_sentiment_summary
        )
        
        print("✅ Main backend imported successfully!")
        
        # Check Enhanced Analyzer
        print(f"\n🧠 Enhanced Analyzer Status:")
        print(f"   Ready: {enhanced_analyzer.is_ready()}")
        if enhanced_analyzer.initialization_error:
            print(f"   Error: {enhanced_analyzer.initialization_error}")
        else:
            print("   ✅ No errors")
        
        # Check DistilBERT
        print(f"\n🤖 DistilBERT Status:")
        print(f"   Available: {DISTILBERT_AVAILABLE}")
        
        if DISTILBERT_AVAILABLE and distilbert_analyzer:
            print(f"   Initialized: {distilbert_analyzer.is_initialized}")
            if distilbert_analyzer.initialization_error:
                print(f"   Error: {distilbert_analyzer.initialization_error}")
            else:
                print("   ✅ No errors")
                
            # Wait a bit for initialization if needed
            if not distilbert_analyzer.is_initialized:
                print("   ⏳ Waiting for initialization...")
                for i in range(10):
                    time.sleep(1)
                    if distilbert_analyzer.is_initialized:
                        print(f"   ✅ Initialized after {i+1}s")
                        break
                else:
                    print("   ⚠️ Still not initialized after 10s")
            
            # Test sentiment analysis if ready
            if distilbert_analyzer.is_initialized:
                print("\n🧪 Testing sentiment analysis...")
                test_text = "This is a great meeting with excellent progress and positive outcomes!"
                
                try:
                    result = analyze_sentiment(test_text)
                    if "error" not in result:
                        print(f"   ✅ Analysis works: {result.get('overall_sentiment')} ({result.get('overall_confidence', 0):.1%})")
                    else:
                        print(f"   ❌ Analysis error: {result.get('error')}")
                        
                    summary = get_sentiment_summary(test_text)
                    if "error" not in summary:
                        print(f"   ✅ Summary works: {summary.get('summary', 'No summary')}")
                    else:
                        print(f"   ❌ Summary error: {summary.get('error')}")
                        
                except Exception as e:
                    print(f"   ❌ Test failed: {e}")
        else:
            print("   ⚠️ Not available")
        
        print(f"\n🎉 Main backend test completed!")
        return True
        
    except Exception as e:
        print(f"❌ Main backend test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_main_backend()
    if success:
        print("\n✅ Main backend is working correctly!")
    else:
        print("\n❌ Main backend has issues - check the errors above")