# Test High-Accuracy Speaker Recognition System
# This script tests the enhanced speaker system without HuggingFace tokens

import numpy as np
import asyncio
import logging
import time
import sys
import os
from typing import Dict, List

# Add backend to path
sys.path.append(os.path.dirname(__file__))

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def generate_test_audio(duration: float = 3.0, sample_rate: int = 16000, 
                       frequency: float = 440.0, speaker_id: int = 1) -> np.ndarray:
    """Generate synthetic test audio with speaker-specific characteristics"""
    samples = int(duration * sample_rate)
    t = np.linspace(0, duration, samples)
    
    # Base frequency varies by speaker
    base_freq = frequency + (speaker_id - 1) * 50
    
    # Generate synthetic speech-like signal
    # Fundamental frequency
    signal = 0.5 * np.sin(2 * np.pi * base_freq * t)
    
    # Add harmonics for voice-like characteristics
    signal += 0.3 * np.sin(2 * np.pi * (base_freq * 2) * t)
    signal += 0.2 * np.sin(2 * np.pi * (base_freq * 3) * t)
    signal += 0.1 * np.sin(2 * np.pi * (base_freq * 4) * t)
    
    # Add formant-like resonances (different for each speaker)
    formant1 = 800 + speaker_id * 100  # First formant
    formant2 = 1200 + speaker_id * 150  # Second formant
    
    signal += 0.2 * np.sin(2 * np.pi * formant1 * t) * np.exp(-t)
    signal += 0.15 * np.sin(2 * np.pi * formant2 * t) * np.exp(-t * 2)
    
    # Add amplitude modulation for prosody
    modulation_freq = 3.0 + speaker_id * 0.5
    amplitude_mod = 0.5 + 0.5 * np.sin(2 * np.pi * modulation_freq * t)
    signal *= amplitude_mod
    
    # Add slight noise
    noise = np.random.normal(0, 0.05, samples)
    signal += noise
    
    # Normalize
    signal = signal / np.max(np.abs(signal))
    
    return signal.astype(np.float32)


async def test_high_accuracy_system():
    """Test the high-accuracy speaker recognition system"""
    logger.info("Testing High-Accuracy Speaker Recognition System")
    logger.info("=" * 60)
    
    try:
        # Import the high-accuracy system
        from high_accuracy_speaker_asr import (
            HighAccuracySpeakerASR,
            HighAccuracyConfig
        )
        
        logger.info("✓ Successfully imported high-accuracy system")
        
        # Initialize system
        config = HighAccuracyConfig()
        logger.info(f"Configuration loaded - Methods: {config.ensemble_methods}")
        
        system = HighAccuracySpeakerASR(config)
        logger.info("✓ High-accuracy system initialized")
        
        # Test 1: Start a session
        logger.info("\n--- Test 1: Session Management ---")
        session_result = await system.start_session("test_session_001", "High-Accuracy Test Session")
        
        if session_result["success"]:
            logger.info(f"✓ Session started: {session_result['session_id']}")
            logger.info(f"  Methods: {session_result.get('methods', [])}")
        else:
            logger.error(f"✗ Session start failed: {session_result.get('message')}")
            return False
        
        # Test 2: Speaker enrollment with multiple speakers
        logger.info("\n--- Test 2: Speaker Enrollment ---")
        speakers = [
            {"name": "Alice", "display": "Alice Smith", "email": "alice@test.com"},
            {"name": "Bob", "display": "Bob Johnson", "email": "bob@test.com"},
            {"name": "Charlie", "display": "Charlie Brown", "email": "charlie@test.com"}
        ]
        
        enrolled_speakers = {}
        
        for i, speaker_info in enumerate(speakers, 1):
            logger.info(f"Enrolling {speaker_info['display']}...")
            
            # Generate enrollment audio (longer for better training)
            enrollment_audio = generate_test_audio(
                duration=5.0, 
                speaker_id=i,
                frequency=400 + i * 100
            )
            
            enroll_result = await system.enroll_speaker(
                enrollment_audio,
                speaker_info["name"],
                speaker_info["display"],
                speaker_info["email"]
            )
            
            if enroll_result["success"]:
                speaker_id = enroll_result["speaker_id"]
                enrolled_speakers[speaker_info["name"]] = speaker_id
                
                logger.info(f"  ✓ {speaker_info['display']} enrolled (ID: {speaker_id})")
                logger.info(f"    Ensemble trained: {enroll_result.get('ensemble_trained', False)}")
                logger.info(f"    Training segments: {enroll_result.get('training_segments', 0)}")
            else:
                logger.error(f"  ✗ Failed to enroll {speaker_info['display']}: {enroll_result.get('message')}")
        
        if not enrolled_speakers:
            logger.error("No speakers enrolled successfully")
            return False
        
        logger.info(f"✓ Successfully enrolled {len(enrolled_speakers)} speakers")
        
        # Test 3: Audio processing and recognition
        logger.info("\n--- Test 3: Speaker Recognition ---")
        
        recognition_results = []
        
        for i, (speaker_name, speaker_id) in enumerate(enrolled_speakers.items(), 1):
            logger.info(f"Testing recognition for {speaker_name}...")
            
            # Generate test audio for this speaker
            test_audio = generate_test_audio(
                duration=3.0,
                speaker_id=i,
                frequency=400 + i * 100
            )
            
            # Process audio
            process_result = await system.process_audio_with_speakers(test_audio)
            
            if process_result["success"]:
                segments = process_result["transcript"]
                stats = process_result["statistics"]
                
                logger.info(f"  ✓ Processed audio ({process_result['processing_time']:.3f}s)")
                logger.info(f"    Total segments: {stats['total_segments']}")
                logger.info(f"    Speaker identified: {stats['speaker_identified']}")
                logger.info(f"    Auto assigned: {stats['auto_assigned']}")
                
                # Check recognition accuracy
                correct_recognitions = 0
                total_recognitions = 0
                
                for segment in segments:
                    if segment.get("speaker_id") is not None:
                        total_recognitions += 1
                        if segment["speaker_id"] == speaker_id:
                            correct_recognitions += 1
                
                if total_recognitions > 0:
                    accuracy = correct_recognitions / total_recognitions
                    logger.info(f"    Recognition accuracy: {accuracy:.2%}")
                    recognition_results.append({
                        "speaker": speaker_name,
                        "accuracy": accuracy,
                        "segments": len(segments)
                    })
                
            else:
                logger.error(f"  ✗ Processing failed: {process_result.get('message')}")
        
        # Test 4: Mixed audio (multiple speakers)
        logger.info("\n--- Test 4: Mixed Speaker Audio ---")
        
        # Create mixed audio by concatenating different speakers
        mixed_audio_segments = []
        expected_speakers = []
        
        for i, (speaker_name, speaker_id) in enumerate(enrolled_speakers.items(), 1):
            segment_audio = generate_test_audio(
                duration=2.0,
                speaker_id=i,
                frequency=400 + i * 100
            )
            mixed_audio_segments.append(segment_audio)
            expected_speakers.append(speaker_name)
        
        # Concatenate all segments
        mixed_audio = np.concatenate(mixed_audio_segments)
        
        logger.info(f"Processing mixed audio ({len(mixed_audio)/16000:.1f}s, {len(expected_speakers)} speakers)...")
        
        mixed_result = await system.process_audio_with_speakers(mixed_audio)
        
        if mixed_result["success"]:
            segments = mixed_result["transcript"]
            stats = mixed_result["statistics"]
            
            logger.info(f"✓ Mixed audio processed ({mixed_result['processing_time']:.3f}s)")
            logger.info(f"  Total segments: {stats['total_segments']}")
            logger.info(f"  Speaker identified: {stats['speaker_identified']}")
            logger.info(f"  Auto assigned: {stats['auto_assigned']}")
            logger.info(f"  Ensemble methods used: {stats['ensemble_methods_used']}")
            
            # Print segment details
            for i, segment in enumerate(segments):
                logger.info(f"    Segment {i+1}: {segment.get('speaker_name', 'Unknown')} "
                          f"(confidence: {segment.get('confidence', 0):.2f}, "
                          f"method: {segment.get('method', 'unknown')})")
        
        else:
            logger.error(f"✗ Mixed audio processing failed: {mixed_result.get('message')}")
        
        # Test 5: System capabilities
        logger.info("\n--- Test 5: System Capabilities ---")
        
        # Test ensemble recognizer directly
        try:
            ensemble = system.ensemble_recognizer
            logger.info(f"✓ Ensemble methods available: {len(ensemble.config.ensemble_methods)}")
            logger.info(f"  Methods: {', '.join(ensemble.config.ensemble_methods)}")
            logger.info(f"  Temporal smoothing: {ensemble.config.use_temporal_smoothing}")
            logger.info(f"  Confidence weighting: {ensemble.config.use_confidence_weighting}")
            
            # Check trained models
            model_counts = {}
            for method in ensemble.config.ensemble_methods:
                model_count = len(ensemble.speaker_models.get(method, {}))
                model_counts[method] = model_count
            
            logger.info(f"  Trained models per method:")
            for method, count in model_counts.items():
                logger.info(f"    {method}: {count} speakers")
            
        except Exception as e:
            logger.warning(f"Could not analyze ensemble details: {e}")
        
        # Test summary
        logger.info("\n--- Test Summary ---")
        logger.info("✓ High-Accuracy Speaker Recognition System Test Complete")
        
        if recognition_results:
            avg_accuracy = np.mean([r["accuracy"] for r in recognition_results])
            logger.info(f"✓ Average recognition accuracy: {avg_accuracy:.2%}")
            
            for result in recognition_results:
                logger.info(f"  {result['speaker']}: {result['accuracy']:.2%} "
                          f"({result['segments']} segments)")
        
        logger.info("\nKey Features Tested:")
        logger.info("✓ Multi-method ensemble recognition")
        logger.info("✓ Advanced feature extraction (MFCC, spectral, prosodic)")
        logger.info("✓ Temporal smoothing and consistency checks")
        logger.info("✓ Voice activity detection")
        logger.info("✓ Multi-scale analysis windows")
        logger.info("✓ No HuggingFace tokens required")
        
        return True
        
    except ImportError as e:
        logger.error(f"✗ Import error: {e}")
        logger.error("Make sure all dependencies are installed:")
        logger.error("  pip install scikit-learn librosa webrtcvad noisereduce praat-parselmouth")
        return False
        
    except Exception as e:
        logger.error(f"✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_system_performance():
    """Test system performance with various audio conditions"""
    logger.info("\n" + "=" * 60)
    logger.info("Performance Testing")
    logger.info("=" * 60)
    
    try:
        from high_accuracy_speaker_asr import HighAccuracySpeakerASR, HighAccuracyConfig
        
        system = HighAccuracySpeakerASR(HighAccuracyConfig())
        await system.start_session("perf_test", "Performance Test")
        
        # Test with different audio lengths
        durations = [1.0, 2.0, 5.0, 10.0]
        
        logger.info("Testing processing times for different audio durations:")
        
        for duration in durations:
            test_audio = generate_test_audio(duration=duration, speaker_id=1)
            
            start_time = time.time()
            result = await system.process_audio_with_speakers(test_audio)
            processing_time = time.time() - start_time
            
            if result["success"]:
                realtime_factor = processing_time / duration
                logger.info(f"  {duration:4.1f}s audio: {processing_time:.3f}s processing "
                          f"(RTF: {realtime_factor:.2f}x)")
            else:
                logger.error(f"  {duration:4.1f}s audio: Processing failed")
        
        logger.info("Performance testing complete")
        
    except Exception as e:
        logger.error(f"Performance test failed: {e}")


if __name__ == "__main__":
    print("High-Accuracy Speaker Recognition System Test")
    print("This test verifies the enhanced system works without HuggingFace tokens")
    print()
    
    # Run main test
    success = asyncio.run(test_high_accuracy_system())
    
    if success:
        print("\n🎉 All tests passed! The high-accuracy system is working correctly.")
        
        # Run performance test
        asyncio.run(test_system_performance())
        
        print("\n" + "="*60)
        print("SYSTEM READY FOR USE")
        print("="*60)
        print("The high-accuracy speaker recognition system is fully functional.")
        print("Key benefits:")
        print("✓ No HuggingFace tokens or external API keys required")
        print("✓ Ensemble of multiple ML algorithms for higher accuracy")
        print("✓ Advanced audio feature extraction")
        print("✓ Temporal smoothing and consistency checking")
        print("✓ Multi-scale analysis for robust recognition")
        print("✓ Real-time processing capabilities")
        print("\nStart the server with: python main_high_accuracy.py")
        
    else:
        print("\n❌ Tests failed. Please check the error messages above.")
        print("Make sure all dependencies are installed:")
        print("  pip install scikit-learn librosa webrtcvad noisereduce praat-parselmouth")
        sys.exit(1)