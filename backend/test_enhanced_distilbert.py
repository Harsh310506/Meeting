"""
Enhanced test script to check DistilBERT sentiment analysis with proper initialization wait
"""

import time
import threading

try:
    from distilbert_sentiment import distilbert_analyzer, TRANSFORMERS_AVAILABLE, TORCH_AVAILABLE
    print(f"TRANSFORMERS_AVAILABLE: {TRANSFORMERS_AVAILABLE}")
    print(f"TORCH_AVAILABLE: {TORCH_AVAILABLE}")
    print(f"Analyzer available: {distilbert_analyzer is not None}")
    
    if distilbert_analyzer:
        print(f"Analyzer initialized: {distilbert_analyzer.is_initialized}")
        print(f"Initialization error: {distilbert_analyzer.initialization_error}")
        
        # Wait for initialization to complete (up to 30 seconds)
        print("\nWaiting for DistilBERT initialization...")
        max_wait = 30
        wait_time = 0
        
        while not distilbert_analyzer.is_initialized and distilbert_analyzer.initialization_error is None and wait_time < max_wait:
            time.sleep(1)
            wait_time += 1
            if wait_time % 5 == 0:
                print(f"  Still waiting... ({wait_time}s elapsed)")
        
        print(f"Final status after {wait_time}s:")
        print(f"  Initialized: {distilbert_analyzer.is_initialized}")
        print(f"  Error: {distilbert_analyzer.initialization_error}")
        
        # Test basic sentiment analysis if initialized
        if distilbert_analyzer.is_initialized:
            test_text = "This is a great meeting. We accomplished a lot today!"
            print(f"\nTesting sentiment analysis on: '{test_text}'")
            
            try:
                result = distilbert_analyzer.analyze_transcript_sentiment(test_text)
                print("✅ Sentiment analysis successful!")
                print(f"Result: {result}")
                
                # Test the convenience functions
                from distilbert_sentiment import analyze_sentiment, get_sentiment_summary
                
                print("\nTesting convenience functions...")
                sentiment_result = analyze_sentiment(test_text)
                summary_result = get_sentiment_summary(test_text)
                
                print(f"analyze_sentiment result: {sentiment_result}")
                print(f"get_sentiment_summary result: {summary_result}")
                
            except Exception as e:
                print(f"❌ Sentiment analysis failed: {e}")
                import traceback
                traceback.print_exc()
        else:
            print("❌ Cannot test - analyzer failed to initialize")
            if distilbert_analyzer.initialization_error:
                print(f"Error details: {distilbert_analyzer.initialization_error}")
    else:
        print("❌ Analyzer not created - dependency issues")
        
except ImportError as e:
    print(f"❌ Import error: {e}")
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()