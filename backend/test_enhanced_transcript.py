#!/usr/bin/env python3
"""
Test script for enhanced transcript generation
Tests various scenarios to ensure robust transcript processing
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_consolidated import EnhancedTranscriptAnalyzer

def test_transcript_quality_validation():
    """Test transcript quality validation"""
    print("🧪 Testing Transcript Quality Validation")
    print("=" * 50)
    
    analyzer = EnhancedTranscriptAnalyzer()
    
    test_cases = [
        {
            "name": "Empty transcript",
            "transcript": "",
            "expected_quality": "invalid"
        },
        {
            "name": "Very short transcript",
            "transcript": "Hi",
            "expected_quality": "poor"
        },
        {
            "name": "Short transcript",
            "transcript": "This is a short meeting discussion about budget.",
            "expected_quality": "low"
        },
        {
            "name": "Medium transcript",
            "transcript": "This is a meeting where we discussed the quarterly budget allocation for the marketing team. We need to review the ROI metrics and customer acquisition costs for the next quarter.",
            "expected_quality": "medium"
        },
        {
            "name": "High quality transcript",
            "transcript": "Good morning everyone, welcome to our quarterly business review meeting. Today we'll be discussing our performance metrics, including customer acquisition costs, retention rates, and overall ROI for the past quarter. The marketing team has done excellent work with the new campaign strategy, resulting in a 25% increase in qualified leads. However, we need to address some concerns about the budget allocation for the upcoming quarter and ensure our technology stack integration is on track.",
            "expected_quality": "high"
        },
        {
            "name": "Transcript with numbers/symbols",
            "transcript": "Sales: $50,000 2023 Q4 budget 25% ROI improvement needed!",
            "expected_quality": "low"
        }
    ]
    
    for test_case in test_cases:
        print(f"\n📝 Testing: {test_case['name']}")
        result = analyzer.validate_transcript_quality(test_case['transcript'])
        
        print(f"   Quality: {result['quality']} (Score: {result['score']:.2f})")
        print(f"   Expected: {test_case['expected_quality']}")
        
        if result['issues']:
            print(f"   Issues: {', '.join(result['issues'])}")
        if result['recommendations']:
            print(f"   Recommendations: {result['recommendations'][0]}")
        
        # Check if quality matches expectation
        status = "✅ PASS" if result['quality'] == test_case['expected_quality'] else "❌ FAIL"
        print(f"   Status: {status}")

def test_enhanced_analysis_scenarios():
    """Test enhanced analysis with various transcript scenarios"""
    print("\n\n🧪 Testing Enhanced Analysis Scenarios")
    print("=" * 50)
    
    analyzer = EnhancedTranscriptAnalyzer()
    
    # Wait for initialization
    print("🔧 Initializing analyzer...")
    if analyzer.initialize_sync():
        print("✅ Analyzer ready")
    else:
        print("❌ Analyzer failed to initialize")
        return
    
    test_transcripts = [
        {
            "name": "Business meeting",
            "transcript": "We need to improve our customer acquisition strategy and increase ROI. The marketing team should focus on B2B clients and optimize our CRM integration."
        },
        {
            "name": "Technical discussion",
            "transcript": "The API integration is complete, but we need to optimize the database queries. The microservices architecture should improve scalability for our SaaS platform."
        },
        {
            "name": "Mixed sentiment",
            "transcript": "The project deadline was met successfully. However, the budget overrun is concerning. The team performed excellently despite the challenges."
        },
        {
            "name": "Short technical note",
            "transcript": "Server deployment failed. Need to check logs."
        }
    ]
    
    for test_case in test_transcripts:
        print(f"\n📝 Testing: {test_case['name']}")
        print(f"   Input: {test_case['transcript'][:80]}...")
        
        try:
            # Validate quality first
            quality_result = analyzer.validate_transcript_quality(test_case['transcript'])
            print(f"   Quality: {quality_result['quality']} (Score: {quality_result['score']:.2f})")
            
            # Run analysis
            analysis_result = analyzer.analyze_transcript(test_case['transcript'])
            
            if "error" not in analysis_result:
                print("   ✅ Analysis completed successfully")
                
                # Check key components
                entities = analysis_result.get('entities', {})
                keywords = analysis_result.get('keywords', [])
                suggestions = analysis_result.get('suggestions', [])
                
                print(f"   📊 Found: {len(keywords)} keywords, {len(suggestions)} suggestions")
                
                if entities:
                    entity_count = sum(len(v) for v in entities.values() if isinstance(v, list))
                    print(f"   🏷️ Entities: {entity_count} detected")
                
            else:
                print(f"   ❌ Analysis failed: {analysis_result.get('details', 'Unknown error')}")
                
        except Exception as e:
            print(f"   ❌ Exception during analysis: {e}")

def main():
    """Main test function"""
    print("🚀 Enhanced Transcript Generation Test Suite")
    print("=" * 60)
    
    try:
        test_transcript_quality_validation()
        test_enhanced_analysis_scenarios()
        
        print("\n\n🎯 Test Suite Complete!")
        print("=" * 60)
        print("✅ All tests completed. Check results above for any failures.")
        
    except Exception as e:
        print(f"❌ Test suite failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()