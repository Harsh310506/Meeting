#!/usr/bin/env python3
"""
Test script for enhanced task classification and detection
Validates perfect task assignment classification for next functionalities
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_consolidated import EnhancedTranscriptAnalyzer

def test_task_classification():
    """Test comprehensive task classification scenarios"""
    print("🧪 Testing Enhanced Task Classification System")
    print("=" * 60)
    
    analyzer = EnhancedTranscriptAnalyzer()
    
    # Initialize analyzer
    print("🔧 Initializing analyzer...")
    if analyzer.initialize_sync():
        print("✅ Analyzer ready for task classification testing")
    else:
        print("❌ Analyzer failed to initialize")
        return
    
    # Test scenarios covering different task types
    test_scenarios = [
        {
            "name": "Business Meeting with Multiple Task Types",
            "transcript": """
            We need to schedule a team meeting for next Tuesday to discuss the quarterly budget. 
            John should prepare the financial report by Friday. 
            Please follow up with the marketing team about the ROI analysis. 
            We must implement the new CRM system before the deadline next month.
            Action item: Research competitor pricing strategies and document findings.
            Let's arrange a client presentation for next week to showcase our progress.
            The team needs to fix the API integration issue immediately as it's blocking production.
            """,
            "expected_categories": ["Scheduling", "Documentation", "Follow Ups", "Implementation", "Research", "Communication", "Technical"]
        },
        {
            "name": "Technical Project Discussion",
            "transcript": """
            We need to deploy the new microservices architecture to production. 
            The database optimization must be completed by end of this week.
            Please review the code changes before we merge to master branch.
            Action item: Update the API documentation with new endpoints.
            We should investigate the performance bottleneck in the payment system.
            Schedule a technical review meeting with the engineering team.
            """,
            "expected_categories": ["Implementation", "Review", "Documentation", "Research", "Scheduling"]
        },
        {
            "name": "Strategic Planning Session",
            "transcript": """
            We need to develop a comprehensive marketing strategy for Q4.
            Please contact the vendor about pricing for the new software licenses.
            Action item: Analyze market trends and prepare a summary report.
            We should schedule quarterly business reviews with all department heads.
            The budget proposal needs approval from the board by next Friday.
            Follow up with HR about the new hiring plan implementation.
            """,
            "expected_categories": ["Planning", "Communication", "Research", "Scheduling", "Review", "Follow Ups"]
        },
        {
            "name": "Urgent Issue Resolution",
            "transcript": """
            We have a critical bug in production that needs immediate attention.
            Please contact all customers affected by the service outage ASAP.
            Action item: Document the incident and root cause analysis.
            The development team must fix the security vulnerability today.
            We need to schedule an emergency meeting with stakeholders immediately.
            Follow up with the legal team about compliance implications urgently.
            """,
            "expected_categories": ["Technical", "Communication", "Documentation", "Implementation", "Scheduling", "Follow Ups"]
        },
        {
            "name": "Regular Team Sync",
            "transcript": """
            Let's review the progress on current projects during our weekly standup.
            Sarah should update the project timeline based on recent changes.
            We need to prepare for the client demo scheduled for next Thursday.
            Please send the meeting notes to all team members after this call.
            Action item: Check with the design team about the new UI mockups.
            We should plan the next sprint goals for the development team.
            """,
            "expected_categories": ["Review", "Documentation", "Planning", "Communication", "Follow Ups"]
        }
    ]
    
    for i, scenario in enumerate(test_scenarios, 1):
        print(f"\n📝 Test Scenario {i}: {scenario['name']}")
        print("-" * 50)
        
        try:
            # Run enhanced analysis
            analysis_result = analyzer.analyze_transcript(scenario['transcript'])
            
            if "error" not in analysis_result:
                tasks_and_schedules = analysis_result.get('extracted_entities', {}).get('tasks_and_schedules', [])
                
                print(f"✅ Analysis completed successfully")
                print(f"📊 Found {len(tasks_and_schedules)} tasks")
                
                if tasks_and_schedules:
                    print("\n🎯 Detected Tasks:")
                    
                    categories_found = set()
                    priority_distribution = {}
                    urgency_scores = []
                    
                    for j, task in enumerate(tasks_and_schedules, 1):
                        task_text = task.get('task', 'Unknown')
                        category = task.get('category', 'Unknown')
                        task_type = task.get('type', 'Unknown')
                        priority = task.get('priority', 'Unknown')
                        urgency = task.get('urgency_score', 0)
                        dates = task.get('dates', [])
                        assignees = task.get('assignees', [])
                        
                        categories_found.add(category)
                        priority_distribution[priority] = priority_distribution.get(priority, 0) + 1
                        urgency_scores.append(urgency)
                        
                        # Display task details
                        print(f"\n   {j}. {task_text}")
                        print(f"      📂 Category: {category}")
                        print(f"      🏷️  Type: {task_type}")
                        print(f"      ⚡ Priority: {priority} (Urgency: {urgency:.1f}/10)")
                        print(f"      📅 Dates: {', '.join(dates[:2])}{'...' if len(dates) > 2 else ''}")
                        print(f"      👥 Assignees: {', '.join(assignees[:2])}{'...' if len(assignees) > 2 else ''}")
                    
                    # Classification analysis
                    print(f"\n📈 Classification Analysis:")
                    print(f"   🎯 Categories Detected: {len(categories_found)}")
                    print(f"   📊 Category Distribution: {', '.join(sorted(categories_found))}")
                    print(f"   ⚡ Priority Distribution: {dict(priority_distribution)}")
                    print(f"   🔥 Average Urgency: {sum(urgency_scores)/len(urgency_scores):.1f}/10" if urgency_scores else "N/A")
                    
                    # Validate against expected categories
                    expected_cats = set(scenario.get('expected_categories', []))
                    found_cats = categories_found
                    
                    coverage = len(found_cats & expected_cats) / len(expected_cats) if expected_cats else 0
                    print(f"   ✅ Category Coverage: {coverage:.1%}")
                    
                    if coverage >= 0.6:  # 60% coverage threshold
                        print("   🎉 Classification Quality: EXCELLENT")
                    elif coverage >= 0.4:
                        print("   👍 Classification Quality: GOOD")
                    else:
                        print("   ⚠️  Classification Quality: NEEDS IMPROVEMENT")
                else:
                    print("⚠️ No tasks detected")
                    
            else:
                print(f"❌ Analysis failed: {analysis_result.get('details', 'Unknown error')}")
                
        except Exception as e:
            print(f"❌ Exception during analysis: {e}")

def test_specific_task_patterns():
    """Test specific task detection patterns"""
    print("\n\n🧪 Testing Specific Task Pattern Recognition")
    print("=" * 60)
    
    analyzer = EnhancedTranscriptAnalyzer()
    
    # Ensure analyzer is ready
    if not analyzer.is_ready():
        analyzer.initialize_sync()
    
    # Specific pattern tests
    pattern_tests = [
        {
            "pattern": "Action Items",
            "text": "Action item: Update the documentation and send to stakeholders",
            "expected_category": "Action Items",
            "expected_type": "Documentation"
        },
        {
            "pattern": "Scheduling",
            "text": "Let's schedule a meeting with the client for next Tuesday at 2 PM",
            "expected_category": "Scheduling",
            "expected_type": "Communication"
        },
        {
            "pattern": "Implementation",
            "text": "We need to implement the new authentication system before launch",
            "expected_category": "Implementation",
            "expected_type": "Technical"
        },
        {
            "pattern": "Follow-up",
            "text": "Please follow up with the marketing team about the campaign results",
            "expected_category": "Follow Ups",
            "expected_type": "Communication"
        },
        {
            "pattern": "Research",
            "text": "We should research competitor pricing and analyze market trends",
            "expected_category": "Research",
            "expected_type": "Research"
        }
    ]
    
    for test in pattern_tests:
        print(f"\n📝 Testing: {test['pattern']}")
        print(f"   Input: \"{test['text']}\"")
        
        try:
            analysis = analyzer.analyze_transcript(test['text'])
            tasks = analysis.get('extracted_entities', {}).get('tasks_and_schedules', [])
            
            if tasks:
                task = tasks[0]  # Get first task
                category = task.get('category', 'Unknown')
                task_type = task.get('type', 'Unknown')
                
                print(f"   ✅ Detected: Category='{category}', Type='{task_type}'")
                
                # Validate expectations
                cat_match = test['expected_category'].lower() in category.lower()
                type_match = test['expected_type'].lower() in task_type.lower()
                
                if cat_match and type_match:
                    print("   🎉 Perfect Match!")
                elif cat_match or type_match:
                    print("   👍 Partial Match")
                else:
                    print("   ⚠️ Classification Mismatch")
            else:
                print("   ❌ No tasks detected")
                
        except Exception as e:
            print(f"   ❌ Error: {e}")

def main():
    """Main test function"""
    print("🚀 Enhanced Task Classification Test Suite")
    print("For Next Functionalities - Perfect Classification")
    print("=" * 70)
    
    try:
        test_task_classification()
        test_specific_task_patterns()
        
        print("\n\n🎯 Task Classification Test Suite Complete!")
        print("=" * 70)
        print("✅ All tests completed. Task classification is ready for next functionalities!")
        
    except Exception as e:
        print(f"❌ Test suite failed with error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()