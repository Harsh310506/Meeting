"""
Test the new structured Key Insights format
"""
import sys
sys.path.append('.')

from main_consolidated import enhanced_analyzer

def test_structured_insights():
    print("🧪 Testing Enhanced Analysis with Structured Key Insights")
    print("=" * 60)
    
    # Test text with business jargon
    test_text = """
    Welcome to our quarterly business review meeting. Today we'll discuss 
    our KPIs and ROI metrics for Q4. Our customer acquisition cost has 
    improved by 25% this quarter. We need to focus on our B2B strategies 
    and SaaS implementation roadmap. The CEO mentioned that our EBITDA 
    margins are looking strong, and we should leverage our API integration 
    capabilities to enhance our CRM system.
    
    Action items from today's meeting: We need to schedule a follow-up 
    presentation on Friday to review the budget proposal. John will prepare 
    the quarterly report by next Tuesday. The team should organize a 
    customer feedback session for next week. Sarah will call the vendor 
    to discuss the contract renewal deadline on March 15th.
    """
    
    print(f"📝 Test Text:")
    print(f"   {test_text.strip()}")
    print()
    
    # Check if analyzer is ready
    if not enhanced_analyzer.is_ready():
        print("❌ Enhanced analyzer not ready")
        return
    
    print("🔄 Running enhanced analysis...")
    result = enhanced_analyzer.analyze_transcript(test_text.strip())
    
    if "error" in result:
        print(f"❌ Analysis failed: {result}")
        return
    
    print("✅ Analysis completed successfully!")
    print()
    
    # Generate and display the structured summary
    summary = enhanced_analyzer.generate_summary_paragraph(result)
    
    print("📊 STRUCTURED KEY INSIGHTS OUTPUT:")
    print("=" * 60)
    print(summary)
    print("=" * 60)
    
    # Display analysis components
    print("\n📋 ANALYSIS COMPONENTS:")
    print(f"   • Jargon detected: {len(result.get('jargon_analysis', {}).get('acronyms', []))} acronyms")
    print(f"   • Important terms: {len(result.get('importance_scores', {}))}")
    print(f"   • Definitions found: {len(result.get('definitions', {}))}")
    print(f"   • Entities identified: {len(result.get('extracted_entities', {}).get('organizations', []))}")

if __name__ == "__main__":
    test_structured_insights()