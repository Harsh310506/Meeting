# 🔐 Permission Guide for Meeting Monitor

## 📋 **Step-by-Step Permission Setup**

### **1. When you click "Start Screen Capture":**

Chrome will show a dialog with **3 tabs at the top**:
```
[ Entire Screen ] [ Window ] [ Chrome Tab ]
```

### **2. Choose what to share:**
- **Entire Screen** ✅ (Recommended for meeting apps)
- **Window** ✅ (Select specific meeting window) 
- **Chrome Tab** ❌ (Won't capture other apps)

### **3. CRITICAL: Check "Share system audio"**
At the bottom of the dialog, you'll see:
```
☑️ Share system audio
```
**YOU MUST CHECK THIS BOX** - otherwise audio will be 0!

### **4. Click "Share"**

---

## 🔍 **How to Check if Permissions are Working**

### **Method 1: Browser Address Bar**
Look at your browser's address bar - you should see:
```
🎥 🔴 Recording    [Stop sharing]
```

### **Method 2: Browser Settings**
1. Click the **🔒 lock icon** in address bar
2. Should show:
   ```
   🎥 Camera: Allow
   🔊 Microphone: Allow
   ```

### **Method 3: Chrome Settings Page**
1. Go to `chrome://settings/content/camera`
2. Check if `localhost:5173` is in "Allow" list
3. Go to `chrome://settings/content/microphone` 
4. Check if `localhost:5173` is in "Allow" list

### **Method 4: In Your App**
Watch the data counters in your app:
- **Audio: 0** = No audio permission
- **Audio: 1, 2, 3...** = Audio working! ✅
- **Video: 0** = No video permission  
- **Video: 1, 2, 3...** = Video working! ✅

---

## 🚨 **Common Permission Problems**

### **Problem 1: "Audio: 0" never changes**
**Solution:** You didn't check "Share system audio"
- Click "Stop Capture" 
- Click "Start Screen Capture" again
- **MAKE SURE** to check ☑️ "Share system audio"

### **Problem 2: "Permission denied" error**
**Solution:** Click "Allow" in the permission dialog
- Don't click "Block" or close the dialog
- If you accidentally blocked, reset permissions (see Method 3 above)

### **Problem 3: No permission dialog appears**
**Solution:** Permissions were previously blocked
1. Click 🔒 lock icon in address bar
2. Click "Reset permissions"
3. Refresh page and try again

### **Problem 4: "Video: 0" never changes**
**Solution:** No screen content selected
- Make sure you selected "Entire Screen" or a specific window
- Video should start counting within 1-2 seconds

---

## ✅ **What Success Looks Like**

### **Browser Address Bar:**
```
🎥 🔴 Recording localhost:5173   [Stop sharing]
```

### **App Status:**
```
Backend: ✅ Connected
Storage: ✅ Enabled  
Screen Capture: ✅ Active
Audio: 15 | Video: 8  ← These numbers should be growing!
```

### **Browser Console (F12):**
```
✅ Video track active: 1920x1080
✅ Audio track active: 48000Hz
```

---

## 🛠️ **Reset All Permissions (If Stuck)**

1. **Chrome Settings Method:**
   - Go to `chrome://settings/content/camera`
   - Find `localhost:5173` and click "Remove"
   - Go to `chrome://settings/content/microphone`  
   - Find `localhost:5173` and click "Remove"
   - Refresh your app page

2. **Address Bar Method:**
   - Click 🔒 lock icon
   - Click "Reset permissions"
   - Refresh page

3. **Developer Tools Method:**
   - Press F12 → Console tab
   - Type: `location.reload()`
   - Grant permissions again when prompted

---

## 🎯 **Quick Test Checklist**

Before recording, verify:
- [ ] ✅ Browser shows 🎥 🔴 Recording in address bar
- [ ] ✅ "Share system audio" was checked
- [ ] ✅ Audio counter is growing: Audio: 5, 6, 7...
- [ ] ✅ Video counter is growing: Video: 2, 3, 4...
- [ ] ✅ You can see your screen in the video preview
- [ ] ✅ Backend shows "Connected"

If ALL boxes are checked ✅, your recording will work perfectly!
