#!/usr/bin/env python3
"""
Debug task detection - identify why tasks aren't being found
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_consolidated import EnhancedTranscriptAnalyzer
import spacy

def debug_task_extraction():
    """Debug task extraction step by step"""
    print("🔍 Debug Task Extraction")
    print("=" * 40)
    
    analyzer = EnhancedTranscriptAnalyzer()
    analyzer.initialize_sync()
    
    test_text = "Action item: Update the documentation and send to stakeholders"
    print(f"Test text: {test_text}")
    
    # Process with spaCy
    doc = analyzer.nlp(test_text)
    
    print(f"\nSpaCy processing:")
    print(f"Sentences: {[sent.text.strip() for sent in doc.sents]}")
    print(f"Entities: {[(ent.text, ent.label_) for ent in doc.ents]}")
    
    # Test our enhanced task extraction
    print(f"\nTesting _extract_tasks_and_schedules directly:")
    tasks = analyzer._extract_tasks_and_schedules(doc, test_text)
    print(f"Tasks found: {len(tasks)}")
    for i, task in enumerate(tasks):
        print(f"  {i+1}: {task}")
    
    # Test different patterns
    test_cases = [
        "We need to implement the new system",
        "Please schedule a meeting for tomorrow", 
        "Follow up with the team about progress",
        "Research competitor pricing strategies",
        "Let's review the documentation"
    ]
    
    print(f"\nTesting multiple patterns:")
    for test_case in test_cases:
        doc = analyzer.nlp(test_case)
        tasks = analyzer._extract_tasks_and_schedules(doc, test_case)
        print(f"'{test_case}' -> {len(tasks)} tasks")

if __name__ == "__main__":
    debug_task_extraction()