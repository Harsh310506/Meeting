"""
Quick test script to check DistilBERT sentiment analysis status
"""

try:
    from distilbert_sentiment import distilbert_analyzer, TRANSFORMERS_AVAILABLE, TORCH_AVAILABLE
    print(f"TRANSFORMERS_AVAILABLE: {TRANSFORMERS_AVAILABLE}")
    print(f"TORCH_AVAILABLE: {TORCH_AVAILABLE}")
    print(f"Analyzer available: {distilbert_analyzer is not None}")
    
    if distilbert_analyzer:
        print(f"Analyzer initialized: {distilbert_analyzer.is_initialized}")
        print(f"Initialization error: {distilbert_analyzer.initialization_error}")
        
        # Test basic sentiment analysis
        test_text = "This is a great meeting. We accomplished a lot today!"
        print("\nTesting sentiment analysis...")
        
        if distilbert_analyzer.is_initialized:
            result = distilbert_analyzer.analyze_transcript_sentiment(test_text)
            print(f"Test result: {result}")
        else:
            print("Cannot test - analyzer not initialized")
            print(f"Error: {distilbert_analyzer.initialization_error}")
    else:
        print("Analyzer not created - dependency issues")
        
except ImportError as e:
    print(f"Import error: {e}")
except Exception as e:
    print(f"Unexpected error: {e}")
    import traceback
    traceback.print_exc()