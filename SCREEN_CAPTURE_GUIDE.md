# 🎯 Screen Capture & System Audio Setup Guide

## Overview
Your Meeting Monitor can now capture audio and video from meeting applications like Google Meet, Zoom, Microsoft Teams, and more! This guide explains how to set up and use each capture mode.

## 📋 Capture Modes

### 1. **Camera + Microphone** (Default)
- **What it captures**: Your direct camera feed and microphone input
- **Use case**: When you want to monitor your own expressions and speech during meetings
- **AI Analysis**: Facial expressions, user engagement, speech sentiment

### 2. **Screen Share + System Audio** ⭐ (New!)
- **What it captures**: Your entire screen AND audio from applications
- **Use case**: Monitor meetings happening in Google Meet, Zoom, Teams, etc.
- **AI Analysis**: Meeting participants, shared content, multiple speakers, meeting platform detection

### 3. **System Audio Only**
- **What it captures**: Only audio from your system/applications
- **Use case**: Audio-only analysis of meetings or calls
- **AI Analysis**: Multi-speaker detection, transcription, audio sentiment

## 🚀 How to Use Screen Capture

### Step 1: Start the Application
1. Open your Meeting Monitor at `http://localhost:3000`
2. Ensure backend is connected (green dot should show "Connected")

### Step 2: Select Screen Capture Mode
1. In the **Capture Mode** dropdown, select **"Screen Share + System Audio"**
2. Click **"Start Screen Capture"**

### Step 3: Browser Permissions
Your browser will ask for screen sharing permissions:

#### Chrome/Edge Instructions:
1. **Choose what to share** dialog will appear
2. Select the **"Entire Screen"** tab
3. **IMPORTANT**: Check the **"Share system audio"** checkbox ✅
4. Click **"Share"**

#### Firefox Instructions:
1. Select **"Screen"** in the sharing dialog
2. Choose your monitor
3. Firefox may require additional setup for system audio

### Step 4: Start Your Meeting
1. Open Google Meet, Zoom, Teams, or any meeting app
2. Join your meeting as normal
3. The Meeting Monitor will now capture:
   - All video from your screen (including meeting participants)
   - All audio from the meeting (multiple speakers)
   - Screen content (presentations, shared screens)

## 🔧 Browser Compatibility

### ✅ **Fully Supported**
- **Chrome 105+**: Screen + System Audio
- **Edge 105+**: Screen + System Audio
- **Chrome/Edge Mobile**: Limited support

### ⚠️ **Partial Support**
- **Firefox**: Screen capture works, system audio may need setup
- **Safari**: Screen capture only, no system audio

### ❌ **Not Supported**
- Internet Explorer
- Older browser versions

## 🎯 Real-World Usage Examples

### Example 1: Google Meet Monitoring
1. Set capture mode to **"Screen Share + System Audio"**
2. Start screen capture
3. Open Google Meet and join your meeting
4. Monitor dashboard shows:
   - Live transcription of all speakers
   - Meeting platform detection: "Google Meet"
   - Participant count and emotions
   - Shared screen content analysis

### Example 2: Zoom Webinar Analysis
1. Use **"Screen Share + System Audio"** mode
2. Join Zoom webinar
3. AI analyzes:
   - Presenter engagement
   - Audience questions
   - Slide content (OCR)
   - Meeting sentiment trends

### Example 3: Teams Background Monitoring
1. Perfect for hybrid work scenarios
2. Monitor meetings running in background
3. Get alerts for important keywords or decisions
4. Automatic meeting summaries

## ⚙️ Technical Details

### What Gets Captured:
- **Video**: Everything visible on your screen at 5 FPS
- **Audio**: All system audio at 44.1kHz
- **Metadata**: Capture source, timestamp, quality metrics

### Data Processing:
- **Real-time streaming** to AI backend
- **No local storage** of sensitive meeting data
- **Modular AI pipeline** ready for Whisper, DistilBERT, BART

### Performance:
- **Low CPU usage**: Optimized frame rates and compression
- **Bandwidth efficient**: Smart quality adjustments
- **Background operation**: Runs while you use other apps

## 🔒 Privacy & Security

### Data Handling:
- Audio/video processed in real-time
- No permanent storage of meeting content
- Only insights and summaries retained
- Compliant with meeting recording policies

### User Control:
- Easy start/stop controls
- Clear status indicators
- Immediate data purging when stopped
- Transparent processing logs

## 🛠 Troubleshooting

### "Screen sharing not working"
1. **Check browser permissions**: Ensure camera/screen access allowed
2. **Update browser**: Use Chrome 105+ or Edge 105+
3. **Check system settings**: Some antivirus may block screen capture

### "No system audio captured"
1. **Verify checkbox**: Ensure "Share system audio" was checked
2. **Browser limitation**: Try Chrome/Edge instead of Firefox
3. **System audio settings**: Check Windows audio mixer

### "Poor audio quality"
1. **Meeting app audio**: Ensure good audio in the original meeting
2. **System volume**: Increase application volume
3. **Network issues**: Check backend connection status

### "High CPU usage"
1. **Lower quality**: Screen capture automatically adjusts
2. **Close unused apps**: Free up system resources
3. **Update drivers**: Ensure graphics drivers are current

## 🎓 Best Practices

### For Best Results:
1. **Use wired internet** for stable streaming
2. **Close unnecessary browser tabs** to save resources
3. **Position meeting window prominently** for better video analysis
4. **Ensure good lighting** for participant analysis
5. **Use headphones** to prevent audio feedback

### Meeting Etiquette:
1. **Inform participants** about monitoring (if required)
2. **Respect privacy policies** of your organization
3. **Use insights responsibly** for meeting improvement
4. **Follow data retention policies** for your company

## 📈 What's Next?

Once your screen capture is working, the system is ready for:
- **Whisper integration** for accurate transcription
- **DistilBERT** for sentiment analysis
- **Facial recognition** for engagement tracking
- **BART summarization** for meeting summaries
- **Custom AI models** for your specific needs

## 💡 Pro Tips

1. **Test before important meetings**: Run a quick test capture first
2. **Monitor the status indicators**: Green dots = everything working
3. **Check backend logs**: See what data is being processed
4. **Use multiple modes**: Switch between camera and screen as needed
5. **Bookmark the dashboard**: Quick access during meetings

---

**Ready to capture your first meeting?** Select "Screen Share + System Audio" and click "Start Screen Capture"! 🚀
