#!/usr/bin/env python3
"""
Enhanced Task Classification Test with User-Specific Examples
Tests the improved date parsing and task assignment functionality
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_consolidated import EnhancedTranscriptAnalyzer
from datetime import datetime, timedelta
import json

def test_user_specific_examples():
    """Test the specific examples provided by the user"""
    print("🧪 Testing User-Specific Task Assignment Examples")
    print("=" * 60)
    
    # Initialize analyzer
    analyzer = EnhancedTranscriptAnalyzer()
    if not analyzer.is_ready():
        analyzer.initialize_sync()
    
    # User's specific test cases
    user_examples = [
        {
            "name": "Tomorrow Assignment",
            "transcript": "Tomorrow the assignment should be completed",
            "expected_date_type": "tomorrow",
            "expected_task": "assignment completion"
        },
        {
            "name": "Next From Today Assignment", 
            "transcript": "These task should be assigned on date next from today",
            "expected_date_type": "next from today",
            "expected_task": "task assignment"
        },
        {
            "name": "20th of Month Assignment",
            "transcript": "Till 20th of these month the assignment 2 should be completed",
            "expected_date_type": "20th of current month",
            "expected_task": "assignment 2 completion"
        },
        {
            "name": "Multiple Task Scenario",
            "transcript": """
            Tomorrow the assignment should be completed by the development team.
            These task should be assigned on date next from today for the project manager.
            Till 20th of these month the assignment 2 should be completed by Sarah.
            We need to schedule a review meeting for next Tuesday.
            """,
            "expected_tasks": 4,
            "expected_dates": ["tomorrow", "next from today", "20th", "Tuesday"]
        }
    ]
    
    current_date = datetime.now()
    print(f"📅 Current Date: {current_date.strftime('%Y-%m-%d %A')}")
    print(f"📅 Tomorrow: {(current_date + timedelta(days=1)).strftime('%Y-%m-%d %A')}")
    print(f"📅 20th of this month: {current_date.replace(day=20).strftime('%Y-%m-%d %A')}")
    print()
    
    for i, example in enumerate(user_examples, 1):
        print(f"📝 Test {i}: {example['name']}")
        print("-" * 40)
        print(f"Input: '{example['transcript']}'")
        
        try:
            # Run analysis
            analysis_result = analyzer.analyze_transcript(example['transcript'])
            
            if "error" not in analysis_result:
                tasks = analysis_result.get('extracted_entities', {}).get('tasks_and_schedules', [])
                
                print(f"✅ Analysis completed")
                print(f"📊 Found {len(tasks)} task(s)")
                
                if tasks:
                    print("\n🎯 Detected Tasks:")
                    for j, task in enumerate(tasks, 1):
                        print(f"\n   {j}. {task.get('task', 'Unknown')}")
                        print(f"      📂 Category: {task.get('category', 'Unknown')}")
                        print(f"      🏷️  Type: {task.get('type', 'Unknown')}")
                        print(f"      ⚡ Priority: {task.get('priority', 'Unknown')}")
                        print(f"      📅 Dates: {', '.join(task.get('dates', ['Not specified']))}")
                        print(f"      👥 Assignees: {', '.join(task.get('assignees', ['Team']))}")
                        
                        # Validate dates for specific examples
                        dates = task.get('dates', [])
                        if example['name'] == "Tomorrow Assignment":
                            tomorrow_found = any('2025-09-18' in str(date) or 'tomorrow' in str(date).lower() for date in dates)
                            print(f"      ✅ Tomorrow date detected: {tomorrow_found}")
                        
                        elif example['name'] == "Next From Today Assignment":
                            next_day_found = any('2025-09-18' in str(date) or 'next from today' in str(date).lower() for date in dates)
                            print(f"      ✅ Next from today detected: {next_day_found}")
                        
                        elif example['name'] == "20th of Month Assignment":
                            day_20_found = any('2025-09-20' in str(date) or '20' in str(date) for date in dates)
                            print(f"      ✅ 20th of month detected: {day_20_found}")
                
                # Validation for multiple task scenario
                if example['name'] == "Multiple Task Scenario":
                    expected_count = example.get('expected_tasks', 0)
                    actual_count = len(tasks)
                    print(f"\n📈 Task Count Validation:")
                    print(f"   Expected: {expected_count} tasks")
                    print(f"   Actual: {actual_count} tasks")
                    print(f"   Status: {'✅ PASS' if actual_count >= expected_count else '❌ FAIL'}")
                    
                    # Check for specific date patterns
                    all_dates = []
                    for task in tasks:
                        all_dates.extend(task.get('dates', []))
                    
                    print(f"\n📅 Date Detection Analysis:")
                    date_checks = {
                        'tomorrow': any('2025-09-18' in str(date) or 'tomorrow' in str(date).lower() for date in all_dates),
                        '20th': any('2025-09-20' in str(date) or '20' in str(date) for date in all_dates),
                        'tuesday': any('tuesday' in str(date).lower() for date in all_dates)
                    }
                    
                    for date_type, found in date_checks.items():
                        print(f"   {date_type.title()}: {'✅ Detected' if found else '❌ Not found'}")
                
                else:
                    print(f"\n✅ Test {i} completed successfully")
                    
            else:
                print(f"❌ Analysis failed: {analysis_result.get('error', 'Unknown error')}")
                
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
        
        print("\n" + "="*60 + "\n")

def test_enhanced_date_parsing():
    """Test the enhanced date parsing functionality directly"""
    print("🔧 Testing Enhanced Date Parsing Functions")
    print("=" * 60)
    
    analyzer = EnhancedTranscriptAnalyzer()
    if not analyzer.is_ready():
        analyzer.initialize_sync()
    
    # Test date parsing examples
    date_test_cases = [
        "tomorrow the assignment should be completed",
        "next from today we need to finish this",
        "till 20th of this month everything should be done", 
        "by the 15th we need to deliver",
        "next Tuesday we have a meeting",
        "this Friday is the deadline",
        "end of this week we should review"
    ]
    
    print("Testing date extraction from sentences:")
    for i, sentence in enumerate(date_test_cases, 1):
        print(f"\n{i}. Sentence: '{sentence}'")
        try:
            # Create a spaCy doc for testing
            doc = analyzer.nlp(sentence)
            date_entities = [ent.text for ent in doc.ents if ent.label_ in ["DATE", "TIME"]]
            extracted_dates = analyzer._extract_dates_from_sentence(sentence, date_entities)
            print(f"   📅 Extracted dates: {extracted_dates}")
        except Exception as e:
            print(f"   ❌ Error: {e}")

if __name__ == "__main__":
    print("🚀 Enhanced Task Classification System Test")
    print("Testing improved date parsing and task assignment")
    print("=" * 60)
    
    # Run user-specific tests
    test_user_specific_examples()
    
    # Run date parsing tests
    test_enhanced_date_parsing()
    
    print("🎯 Enhanced Task Classification Test Complete!")