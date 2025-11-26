# 📱 Emotion & Video Logging App (Expo Router + Expo Go)

A mobile application built with **Expo** and **Expo Router**, designed for **collecting short video diaries**, **emotion self-reports**, **basic GPS metadata**, and **daily reminder notifications**.

This app is intended for **behavioral science**, **affective computing**, or **human-subject research**, enabling participants to submit three emotion-logging sessions per day.

---
## 🔗 Demo

If you want to preview a deployed build:

https://expo.dev/accounts/bearbearcookies/projects/expo-router-mwe/builds/783657af-19a8-40b9-86c4-4c56ab391b88
---
## ✨ Features Overview

### 🎥 1. Video Recording With Guided Flow
- Start a recording session from the Home screen  
- 3-second countdown before recording begins  
- Real-time timer with **red warning after 60 seconds** (recording continues until user presses Stop)  
- Optional **Pause/Resume** timer  
- Switch between front/back cameras  
- Exported video is saved locally within session data  
- Emotion questionnaire shown after each recording

---

### 😊 2. Emotion Questionnaire
After each video, the user selects one of five emotions (emoji-based UI).  
Collected data is shown in **History** and **Statistics**.

---

### 🕒 3. Daily Notifications (Morning / Midday / Evening)
- First-time users configure **three daily reminder times**
- Default times: **09:00**, **14:00**, **22:00**
- Schedule can be customized inside **Settings → Notifications**
- Uses **local scheduled notifications** (`expo-notifications`)
  - ⚠ Expo Go supports *local notifications only*, not push notifications

---

### 📍 4. Metadata Storage
Each session stores:
- Session ID  
- Start & end timestamps  
- True duration  
- Selected emotion  
- GPS coordinates (if enabled)  
- Video file URI  
- Time-of-day label (morning / midday / evening)

Saved using AsyncStorage.

---

### 📊 5. History & Statistics

#### **History Screen**
- Displays all recorded sessions
- Shows timestamp, duration, and emotion
- Supports deletion of individual sessions

#### **Statistics Screen**
- Summaries of total sessions  
- Emotion distribution  
- Time-of-day breakdown  
- **Export all sessions to CSV**

CSV export uses `expo-file-system/legacy` for consistent Expo Go compatibility.

---

### ⚙️ 6. Settings Page
Includes:
- Theme switching (Light / Dark)
- Notification scheduling (3 times/day)
- Permission toggles:
  - Camera & Microphone
  - Location
  - Local storage
- Terms & Conditions
- Open-source licenses
- Clear all local data

---

## 🧩 App Architecture
```bash
app/
├── _layout.js ← Root Stack layout
├── index.js ← Redirect to (tabs)
├── (tabs)/
│ ├── _layout.js ← Bottom Tabs layout
│ ├── index.js ← Home screen (recording)
│ ├── history.js ← Session list & deletion
│ ├── statistics.js ← Stats & CSV export
│ └── settings.js ← Notifications, permissions, theme
utils/
├── PermissionsContext.js ← Centralized permission management
└── storage.js ← Save/load/delete session data
```

Built with:

- `expo-router`
- `expo-camera`
- `expo-notifications`
- `expo-location`
- `expo-file-system`
- `@react-native-async-storage/async-storage`

---

## 🧭 User Flow

1. **Home → Start Recording**
2. Countdown (3…2…1)
3. Recording screen (pause, timer, switch camera)
4. User presses Stop
5. Emotion selection modal
6. If first-time user → Notification setup modal
7. Session saved into History and Statistics
8. Daily reminders prompt the user to record 3 times per day

---

## 🚀 How to Run Locally

### 1. Install dependencies
```bash
npm install
# or
yarn install
```

### 2. Start the Expo dev server
```bash
npx expo start --tunnel
```
### 3. Open on a real device

- Use Expo Go to scan the terminal QR code.

- Note for Android / Expo Go (SDK 53+):

- Local scheduled notifications = ✔ Supported

- Remote push notifications = ❌ Not supported

- All camera, file system, and location features function normally

---

## 📦 CSV Export Format

Example fields:

sessionId|	startTime|	endTime|	duration|	emotion|	latitude|	longitude|	videoUri|

---

## 🛠 Development Notes
### CameraView Overlays

CameraView cannot contain children in SDK 53+, therefore all UI elements
(timer, countdown, controls) are positioned absolutely over the camera view.

### Notifications in Expo Go

Only local notifications are supported in Expo Go

Push notifications require a development build with EAS

### Camera Switching

Switching between front/back cameras during recording may interrupt recording
on some devices (Expo Camera limitation).
So during recording, the switch button can be disabled for reliability. 


## 📄 License

MIT License.
You are responsible for complying with local ethics guidelines when collecting human data.
