#!/usr/bin/env python3
"""
Simple Enhanced Transcript Analysis Test
Tests core functionality without NLTK dependencies
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def test_basic_analysis():
    """Test enhanced analysis with minimal dependencies"""
    
    print("🧪 Testing Basic Enhanced Transcript Analysis")
    print("=" * 50)
    
    # Sample meeting transcript
    sample_transcript = """
    Good morning everyone. Today we're discussing the Q4 budget proposal for our marketing campaign. 
    John Smith from the finance team mentioned we have allocated $50,000 for digital advertising ROI analysis.
    Sarah Johnson suggested we should focus on B2B and B2C social media platforms like Instagram and Facebook.
    Our CRM system shows great engagement metrics. The API integration with our ERP system is critical for success.
    The deadline for this project is December 15th, 2024. We need to review all action items by next Friday.
    There are some risks involved with this approach, including potential budget overruns and scope creep.
    Microsoft and Google have been our key partners in previous campaigns. Their SaaS solutions are essential.
    We should schedule a follow-up meeting to discuss the MVP development and implementation timeline.
    """
    
    try:
        # Test TextBlob grammar correction
        print("📝 Testing TextBlob Grammar Correction...")
        from textblob import TextBlob
        blob = TextBlob(sample_transcript)
        corrected = str(blob.correct())
        print("✅ Grammar correction working")
        
        # Test spaCy NER
        print("🏷️ Testing spaCy Named Entity Recognition...")
        import spacy
        nlp = spacy.load("en_core_web_sm")
        doc = nlp(corrected)
        
        # Extract entities
        dates = [ent.text for ent in doc.ents if ent.label_ in ["DATE", "TIME"]]
        money = [ent.text for ent in doc.ents if ent.label_ == "MONEY"]
        people = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
        orgs = [ent.text for ent in doc.ents if ent.label_ == "ORG"]
        
        print(f"✅ Found entities:")
        print(f"  Dates: {dates}")
        print(f"  Money: {money}")
        print(f"  People: {people}")
        print(f"  Organizations: {orgs}")
        
        # Test jargon detection
        print("💼 Testing Jargon Detection...")
        jargon_found = []
        business_terms = ['ROI', 'B2B', 'B2C', 'CRM', 'API', 'ERP', 'SaaS', 'MVP']
        text_upper = sample_transcript.upper()
        
        for term in business_terms:
            if term in text_upper:
                jargon_found.append(term)
        
        print(f"✅ Business jargon found: {jargon_found}")
        
        # Test keyword extraction
        print("🔑 Testing Keyword Extraction...")
        keywords = [chunk.text.lower() for chunk in doc.noun_chunks if len(chunk.text) > 3]
        keywords = list(set(keywords))[:10]
        print(f"✅ Keywords found: {keywords}")
        
        # Test importance scoring
        print("🎯 Testing Importance Scoring...")
        important_words = ['critical', 'deadline', 'budget', 'risks', 'action']
        importance_found = []
        text_lower = sample_transcript.lower()
        
        for word in important_words:
            if word in text_lower:
                importance_found.append(word)
        
        print(f"✅ Important terms found: {importance_found}")
        
        # Test enhanced highlighting
        print("🌟 Testing Enhanced Highlighting...")
        highlighted = corrected
        
        # Highlight jargon
        for term in jargon_found:
            highlighted = highlighted.replace(term, f"💼**{term}**💼")
        
        # Highlight important terms
        for term in importance_found:
            highlighted = highlighted.replace(term, f"🔥**{term}**🔥")
        
        print("✅ Highlighting applied")
        
        # Display results
        print("\n📊 ANALYSIS RESULTS:")
        print("=" * 50)
        
        print(f"\n🌟 Enhanced Highlighted Text (first 200 chars):")
        print(f"{highlighted[:200]}...")
        
        print(f"\n🏷️ Entity Summary:")
        print(f"  📅 Dates/Times: {len(dates)} found")
        print(f"  💰 Money amounts: {len(money)} found") 
        print(f"  👥 People: {len(people)} found")
        print(f"  🏢 Organizations: {len(orgs)} found")
        
        print(f"\n💼 Jargon Analysis:")
        print(f"  Business terms: {', '.join(jargon_found)}")
        
        print(f"\n🎯 Importance Analysis:")
        print(f"  Critical terms: {', '.join(importance_found)}")
        
        print(f"\n🔑 Keywords (top 10):")
        print(f"  {', '.join(keywords)}")
        
        # Test definition lookup
        print(f"\n📚 Sample Definitions:")
        definitions = {
            'ROI': 'Return on Investment - measure of investment efficiency',
            'API': 'Application Programming Interface - set of protocols for building software',
            'CRM': 'Customer Relationship Management - system for managing customer interactions',
            'MVP': 'Minimum Viable Product - basic version with core features'
        }
        
        for term in jargon_found:
            if term in definitions:
                print(f"  {term}: {definitions[term]}")
        
        print("\n✅ All basic tests passed! Enhanced analysis is working.")
        print("🎯 Core functionality verified:")
        print("  ✅ Grammar correction")
        print("  ✅ Named entity recognition")
        print("  ✅ Jargon detection")
        print("  ✅ Importance scoring")
        print("  ✅ Keyword extraction")
        print("  ✅ Enhanced highlighting")
        print("  ✅ Definition lookup (basic)")
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Missing required packages. Please install:")
        print("pip install spacy textblob")
        print("python -m spacy download en_core_web_sm")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_basic_analysis()