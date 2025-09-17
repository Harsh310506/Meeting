#!/usr/bin/env python3
"""
Test Enhanced Transcript Analysis Functionality
Tests the comprehensive analysis features including NER, topic modeling, etc.
"""

import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_consolidated import EnhancedTranscriptAnalyzer

def test_enhanced_analysis():
    """Test the enhanced transcript analysis with sample meeting data"""
    
    # Sample meeting transcript for testing (enhanced with jargon and technical terms)
    sample_transcript = """
    Good morning everyone. Today we're discussing the Q4 budget proposal for our marketing campaign. 
    John Smith from the finance team mentioned we have allocated $50,000 for digital advertising ROI analysis.
    Sarah Johnson suggested we should focus on B2B and B2C social media platforms like Instagram and Facebook.
    Our CRM system shows great engagement metrics. The API integration with our ERP system is critical for success.
    The deadline for this project is December 15th, 2024. We need to review all action items by next Friday.
    There are some risks involved with this approach, including potential budget overruns and scope creep.
    Microsoft and Google have been our key partners in previous campaigns. Their SaaS solutions are essential.
    We should schedule a follow-up meeting to discuss the MVP development and implementation timeline.
    The KPIs for this project include customer acquisition costs and LTV metrics. Our DevOps team will handle CI/CD.
    """
    
    print("🧪 Testing Enhanced Transcript Analysis")
    print("=" * 50)
    
    # Initialize analyzer
    analyzer = EnhancedTranscriptAnalyzer()
    
    # Use synchronous initialization for testing
    print("⏳ Initializing models synchronously...")
    
    if not analyzer.initialize_sync():
        print("❌ Analyzer initialization failed.")
        print("Error:", analyzer.initialization_error)
        print("This might be due to:")
        print("1. spaCy model 'en_core_web_sm' not installed")
        print("2. Missing dependencies (PyDictionary, etc.)")
        print("3. Network issues downloading NLTK data")
        print("\nTry running: python -m spacy download en_core_web_sm")
        return
    
    print("✅ Analyzer ready! Running analysis...")
    
    # Run analysis
    analysis = analyzer.analyze_transcript(sample_transcript)
    
    if "error" in analysis:
        print(f"❌ Analysis failed: {analysis['error']}")
        print(f"Details: {analysis['details']}")
        return
    
    # Display results
    print("\n📊 ANALYSIS RESULTS:")
    print("=" * 50)
    
    print(f"\n🔤 Original Transcript:")
    print(f"Word count: {analysis['analysis_metadata']['word_count']}")
    print(f"First 100 chars: {analysis['original_transcript'][:100]}...")
    
    print(f"\n✏️ Grammar Corrected:")
    print(f"First 100 chars: {analysis['grammar_corrected_transcript'][:100]}...")
    
    print(f"\n🏷️ Named Entities:")
    entities = analysis['extracted_entities']
    print(f"Dates/Times: {entities['dates_times']}")
    print(f"Prices/Budget: {entities['prices_budget']}")
    print(f"People: {entities['people']}")
    print(f"Organizations: {entities['organizations']}")
    
    print(f"\n🔑 Keywords (top 10):")
    keywords = analysis['keywords'][:10]
    print(f"{', '.join(keywords)}")
    
    print(f"\n📈 Topic Analysis:")
    print(f"{analysis['topic_analysis']}")
    
    print(f"\n💡 AI Suggestions:")
    for suggestion in analysis['ai_suggestions']:
        print(f"• {suggestion}")
    
    # NEW: Display enhanced features
    print(f"\n🏷️ Jargon Analysis:")
    jargon = analysis.get('jargon_analysis', {})
    for category, terms in jargon.items():
        if terms:
            print(f"  {category.replace('_', ' ').title()}: {', '.join(terms[:5])}")
    
    print(f"\n🎯 Importance Scores (Top 10):")
    importance = analysis.get('importance_scores', {})
    sorted_importance = sorted(importance.items(), key=lambda x: x[1]['score'], reverse=True)
    for term, info in sorted_importance[:10]:
        print(f"  {term}: {info['score']:.2f} ({info['reason']})")
    
    print(f"\n📚 Definitions Found:")
    definitions = analysis.get('definitions', {})
    for term, def_info in list(definitions.items())[:5]:
        print(f"  {term.upper()}: {def_info['definition'][:80]}...")
    
    print(f"\n📝 Enhanced Summary Paragraph:")
    print("=" * 50)
    summary = analyzer.generate_summary_paragraph(analysis)
    print(summary)
    
    print("\n✅ Test completed successfully!")

if __name__ == "__main__":
    test_enhanced_analysis()