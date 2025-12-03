import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { Ionicons } from "@expo/vector-icons";
import { usePermissions } from "../../utils/PermissionsContext";
import { saveSession, generateSessionId,uploadSessionToBackend } from "../../utils/storage";

const RECORDING_DURATION = 60;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 30];

export default function HomeScreen() {
  const [facing, setFacing] = useState("front");
  const [isCameraVisible, setIsCameraVisible] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [timer, setTimer] = useState(0);
  const [showEmotionModal, setShowEmotionModal] = useState(false);
  const [sessionData, setSessionData] = useState(null);
  const [isPaused, setIsPaused] = useState(false);

  // First-time notification setup
  const [showNotificationSetup, setShowNotificationSetup] = useState(false);
  const [tempNotificationTimes, setTempNotificationTimes] = useState({
    morning: { hour: 9, minute: 0 },
    midday: { hour: 14, minute: 0 },
    evening: { hour: 22, minute: 0 },
  });
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerKey, setPickerKey] = useState('morning');
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMinute, setPickerMinute] = useState(0);

  const isPausedRef = useRef(false);
  const elapsedRef = useRef(0);
  const cameraRef = useRef(null);
  const timerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const recordingCompleteRef = useRef(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const { settings, updateSettings, isFirstRun, completeFirstRun } = usePermissions();

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      clearInterval(countdownTimerRef.current);
    };
  }, []);

  const startSession = async () => {
    if (!settings.cameraEnabled) {
      Alert.alert("Camera Disabled", "Please enable camera in settings.");
      return;
    }

    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Camera permission is required.");
        return;
      }
    }

    if (!micPermission?.granted) {
      const result = await requestMicPermission();
      if (!result.granted) {
        Alert.alert("Permission Required", "Microphone permission is required.");
        return;
      }
    }

    let location = null;
    if (settings.locationEnabled) {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({});
          location = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
        }
      } catch (error) {
        console.error("Error getting location:", error);
      }
    }

    const sessionId = generateSessionId();
    const startTime = new Date().toISOString();

    setSessionData({
      sessionId,
      startTime,
      latitude: location?.latitude,
      longitude: location?.longitude,
    });

    setTimer(0);
    setIsPaused(false);
    isPausedRef.current = false;
    elapsedRef.current = 0;
    recordingCompleteRef.current = false;

    setIsCameraVisible(true);
    runCountdown();
  };

  const runCountdown = () => {
    let count = 3;
    setCountdown(count);

    countdownTimerRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else if (count === 0) {
        setCountdown("Start!");
      } else {
        clearInterval(countdownTimerRef.current);
        setCountdown(null);
        startActualRecording();
      }
    }, 1000);
  };

  const startActualRecording = async () => {
    if (!cameraRef.current) return;

    try {
      setIsRecording(true);
      recordingCompleteRef.current = false;

      // Start the timer interval
      timerRef.current = setInterval(() => {
        // Only increment time if NOT paused
        if (isPausedRef.current) return;

        setTimer((prev) => {
          const newTimer = prev + 1;
          elapsedRef.current = newTimer;

          if (newTimer >= RECORDING_DURATION) {
            clearInterval(timerRef.current);
            finishRecording(); // Auto-stop at 60s
          }
          return newTimer;
        });
      }, 1000);

      const video = await cameraRef.current.recordAsync({
        maxDuration: RECORDING_DURATION,
      });

      // This block runs when recording stops (either manually or auto)
      if (video && video.uri && !recordingCompleteRef.current) {
        recordingCompleteRef.current = true;
        handleRecordingComplete(video.uri);
      }
    } catch (error) {
      console.error("Recording error:", error);
      Alert.alert("Error", "Failed to record video.");
      fullReset();
    }
  };

  const togglePause = async () => {
    if (!cameraRef.current || !isRecording) return;

    if (isPaused) {
      // Resume
      if (cameraRef.current.resumeRecording) await cameraRef.current.resumeRecording();
      setIsPaused(false);
      isPausedRef.current = false;
    } else {
      // Pause
      if (cameraRef.current.pauseRecording) await cameraRef.current.pauseRecording();
      setIsPaused(true);
      isPausedRef.current = true;
    }
  };

  const finishRecording = () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  const handleRecordingComplete = (videoUri) => {
    clearInterval(timerRef.current);
    // Use the actual elapsed time, not the hardcoded duration
    const durationSeconds = elapsedRef.current || 0;

    setSessionData((prev) => ({
      ...prev,
      videoUri: videoUri,
      endTime: new Date().toISOString(),
      duration: durationSeconds,
    }));

    setIsRecording(false);
    setIsCameraVisible(false);
    setShowEmotionModal(true);
  };

  const stopRecording = () => {
    // If in countdown, just cancel
    if (countdown !== null) {
      clearInterval(countdownTimerRef.current);
      setCountdown(null);
      fullReset();
      return;
    }

    // If recording, stop it manually
    if (cameraRef.current && isRecording) {
      clearInterval(timerRef.current);
      recordingCompleteRef.current = true;
      cameraRef.current.stopRecording();
    }
  };

  const fullReset = () => {
    setSessionData(null);
    setTimer(0);
    setIsRecording(false);
    setIsCameraVisible(false);
    setCountdown(null);
    setIsPaused(false);
    isPausedRef.current = false;
    elapsedRef.current = 0;
    recordingCompleteRef.current = false;
    clearInterval(timerRef.current);
    clearInterval(countdownTimerRef.current);
  };

  const handleEmotionSelect = async (emotionValue) => {
    const finalSessionData = {
      ...sessionData,
      emotionValue,
    };

    setShowEmotionModal(false);

    if (settings.storageEnabled) {
      try {
        // 1. 先存到手機本地
        const saved = await saveSession(finalSessionData);
        
        if (saved) {
          console.log("Session saved locally");
          
          // 👇👇👇 [新增] 這裡就是缺少的關鍵步驟！開始上傳到 Render 👇👇👇
          console.log("🚀 Starting upload to Backend...");
          // 不用加 await，讓它在背景慢慢傳就好，不要卡住使用者的介面
          uploadSessionToBackend(saved); 
          // 👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆👆
        }
      } catch (error) {
        console.error("Save error:", error);
        Alert.alert("Error", "Failed to save session.");
      }
    }

    // 後面保持原本的邏輯 (First Run 設定)
    if (isFirstRun) {
      setTempNotificationTimes({
        morning: { hour: 9, minute: 0 },
        midday: { hour: 14, minute: 0 },
        evening: { hour: 22, minute: 0 },
      });
      setShowNotificationSetup(true);
    } else {
      Alert.alert("Success", "Session saved (and uploading)!");
      fullReset();
    }
  };

  const openTimePicker = (key) => {
    const time = tempNotificationTimes[key];
    setPickerKey(key);
    setPickerHour(time.hour);
    setPickerMinute(time.minute);
    setPickerVisible(true);
  };

  const saveTimePicker = () => {
    setTempNotificationTimes((prev) => ({
      ...prev,
      [pickerKey]: { hour: pickerHour, minute: pickerMinute },
    }));
    setPickerVisible(false);
  };

  const handleNotificationSetupComplete = async () => {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        await Notifications.cancelAllScheduledNotificationsAsync();

        const entries = [
          ["Morning reminder", tempNotificationTimes.morning],
          ["Midday reminder", tempNotificationTimes.midday],
          ["Evening reminder", tempNotificationTimes.evening],
        ];

        for (const [label, t] of entries) {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: label,
              body: "Please complete today's emotion recording.",
            },
            trigger: {
              hour: t.hour,
              minute: t.minute,
              repeats: true,
            },
          });
        }
      }

      await updateSettings({
        ...settings,
        notificationsEnabled: true,
        notificationTimes: tempNotificationTimes,
      });

      await completeFirstRun();
      setShowNotificationSetup(false);

      Alert.alert(
        "Setup Complete",
        "Notifications have been set! You can change these settings anytime in the Settings tab.",
        [{ text: "OK", onPress: () => fullReset() }]
      );
    } catch (error) {
      console.error("Notification setup error:", error);
      setShowNotificationSetup(false);
      fullReset();
    }
  };

  const skipNotificationSetup = async () => {
    await completeFirstRun();
    setShowNotificationSetup(false);
    Alert.alert("Success", "Session saved! You can set up notifications later in Settings.");
    fullReset();
  };

  const toggleCameraFacing = () => {
    setFacing((current) => (current === "back" ? "front" : "back"));
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formatTimeDisplay = ({ hour, minute }) => {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  };

  const getTimeLabel = (key) => {
    const labels = { morning: "Morning", midday: "Midday", evening: "Evening" };
    return labels[key] || key;
  };

  if (!permission || !micPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.subtitle}>Loading permissions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {isCameraVisible ? (
        <View style={styles.cameraContainer}>
          {/* Important: CameraView is now self-closing. No children inside. */}
          <CameraView
            style={styles.camera}
            facing={facing}
            ref={cameraRef}
            mode="video"
          />

          {/* Overlays are now siblings using absolute positioning */}
          
          {/* Timer */}
          {isRecording && (
            <View style={styles.timerContainer}>
              <Text
                style={[
                  styles.timerText,
                  timer >= RECORDING_DURATION && styles.timerTextRed,
                ]}
              >
                {formatTime(timer)}
              </Text>
              <Text style={styles.timerLabel}>
                {isPaused ? "Paused" : timer >= RECORDING_DURATION ? "Processing..." : "Recording..."}
              </Text>
            </View>
          )}

          {/* Countdown */}
          {countdown !== null && (
            <View style={styles.countdownOverlay}>
              <Text style={styles.countdownText}>{countdown}</Text>
            </View>
          )}

          {/* Camera Controls Area */}
          <View style={styles.cameraControls}>
            
            {/* Recording Controls (Pause & Stop) */}
            <View style={styles.recordingControlRow}>
              {isRecording && (
                <TouchableOpacity style={styles.controlButton} onPress={togglePause}>
                  <Ionicons 
                    name={isPaused ? "play-circle" : "pause-circle"} 
                    size={64} 
                    color="white" 
                  />
                  <Text style={styles.controlLabel}>{isPaused ? "Resume" : "Pause"}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.controlButton} onPress={stopRecording}>
                <View style={styles.stopButtonOuter}>
                  <View style={styles.stopButtonInner} />
                </View>
                <Text style={styles.controlLabel}>Stop</Text>
              </TouchableOpacity>
            </View>

            {/* Switch Camera - Only show if NOT recording */}
            {!isRecording && (
              <TouchableOpacity 
                style={styles.switchCameraContainer} 
                onPress={toggleCameraFacing}
              >
                <Ionicons name="camera-reverse" size={28} color="white" />
                <Text style={styles.switchCameraText}>
                  {facing === "front" ? "Front" : "Back"}
                </Text>
              </TouchableOpacity>
            )}

          </View>
        </View>
      ) : (
        // Initial Screen
        <View style={styles.content}>
          <Text style={styles.title}>Data Collection</Text>
          <View style={styles.numberedList}>
            {["Press Start", "Countdown 3-2-1", "Please record for 60s"].map(
              (item, idx) => (
                <View style={styles.listRow} key={idx}>
                  <Text style={styles.listNumber}>{idx + 1}.</Text>
                  <Text style={styles.listText}>{item}</Text>
                </View>
              )
            )}
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#007AFF" />
            <Text style={styles.infoText}>
              Camera defaults to Front-facing. {"\n"}You can switch cameras
              before recording starts.
            </Text>
          </View>

          <TouchableOpacity style={styles.startButton} onPress={startSession}>
            <Ionicons name="videocam" size={32} color="white" />
            <Text style={styles.startButtonText}>Start Recording</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.homeToggle}
            onPress={toggleCameraFacing}
          >
            <Text style={styles.homeToggleText}>
              Current Default: {facing === "front" ? "Front Camera" : "Back Camera"}
            </Text>
            <Ionicons name="camera-reverse" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* Emotion Modal */}
      <Modal visible={showEmotionModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>How are you feeling?</Text>
            <View style={styles.emotionGrid}>
              {[
                { value: 0, emoji: "😢", label: "Very Bad" },
                { value: 1, emoji: "😞", label: "Bad" },
                { value: 2, emoji: "😐", label: "Neutral" },
                { value: 3, emoji: "🙂", label: "Good" },
                { value: 4, emoji: "😊", label: "Very Good" },
                { value: 5, emoji: "😄", label: "Excellent" },
              ].map((emotion) => (
                <Pressable
                  key={emotion.value}
                  style={styles.emotionButton}
                  onPress={() => handleEmotionSelect(emotion.value)}
                >
                  <Text style={styles.emotionEmoji}>{emotion.emoji}</Text>
                  <Text style={styles.emotionLabel}>{emotion.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* First-time Notification Setup Modal */}
      <Modal visible={showNotificationSetup} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.notificationModalContent}>
            <Text style={styles.modalTitle}>Set Up Daily Reminders</Text>
            <Text style={styles.notificationSubtitle}>
              We'll remind you to record your emotions at these times:
            </Text>

            {['morning', 'midday', 'evening'].map((key) => (
              <TouchableOpacity
                key={key}
                style={styles.timeRow}
                onPress={() => openTimePicker(key)}
              >
                <Text style={styles.timeLabel}>{getTimeLabel(key)}</Text>
                <Text style={styles.timeValue}>
                  {formatTimeDisplay(tempNotificationTimes[key])}
                </Text>
                <Ionicons name="chevron-forward" size={20} color="#999" />
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.primaryButton} onPress={handleNotificationSetupComplete}>
              <Text style={styles.primaryButtonText}>Save & Enable Notifications</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={skipNotificationSetup}>
              <Text style={styles.secondaryButtonText}>Skip for now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={pickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select {getTimeLabel(pickerKey)} Time</Text>
            
            <View style={styles.pickerColumns}>
              <View style={styles.pickerColumn}>
                <Text style={styles.pickerColumnTitle}>Hour</Text>
                <ScrollView style={styles.pickerScroll}>
                  {HOURS.map((h) => (
                    <Pressable
                      key={h}
                      style={[styles.pickerItem, pickerHour === h && styles.pickerItemSelected]}
                      onPress={() => setPickerHour(h)}
                    >
                      <Text style={[styles.pickerItemText, pickerHour === h && styles.pickerItemTextSelected]}>
                        {h.toString().padStart(2, "0")}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.pickerColumn}>
                <Text style={styles.pickerColumnTitle}>Minute</Text>
                <ScrollView style={styles.pickerScroll}>
                  {MINUTES.map((m) => (
                    <Pressable
                      key={m}
                      style={[styles.pickerItem, pickerMinute === m && styles.pickerItemSelected]}
                      onPress={() => setPickerMinute(m)}
                    >
                      <Text style={[styles.pickerItemText, pickerMinute === m && styles.pickerItemTextSelected]}>
                        {m.toString().padStart(2, "0")}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>

            <View style={styles.pickerButtons}>
              <TouchableOpacity style={styles.pickerCancelButton} onPress={() => setPickerVisible(false)}>
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerSaveButton} onPress={saveTimePicker}>
                <Text style={styles.pickerSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  content: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "bold", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: "center", color: "#666", marginBottom: 32, lineHeight: 24 },
  numberedList: { marginBottom: 32, alignItems: "center" },
  listRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8, width: "75%" },
  listNumber: { width: 28, textAlign: "right", color: "#666", fontSize: 16, marginRight: 8 },
  listText: { flex: 1, fontSize: 16, color: "#666", lineHeight: 24 },
  infoCard: { backgroundColor: "#E3F2FD", borderRadius: 12, padding: 16, marginBottom: 32, flexDirection: "row", alignItems: "center" },
  infoText: { flex: 1, marginLeft: 12, fontSize: 14, color: "#333" },
  startButton: { backgroundColor: "#007AFF", borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 24, elevation: 4 },
  startButtonText: { color: "white", fontSize: 20, fontWeight: "bold", marginLeft: 12 },
  homeToggle: { flexDirection: "row", justifyContent: "center", alignItems: "center", padding: 10 },
  homeToggleText: { color: "#666", marginRight: 8 },
  
  // Camera & Overlay Styles
  cameraContainer: { flex: 1, backgroundColor: "black" },
  camera: { ...StyleSheet.absoluteFillObject }, 
  
  countdownOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.3)", zIndex: 10 },
  countdownText: { fontSize: 80, fontWeight: "bold", color: "white", textShadowColor: "rgba(0,0,0,0.75)", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
  
  timerContainer: { position: "absolute", top: 60, alignSelf: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)", paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20 },
  timerText: { color: "white", fontSize: 32, fontWeight: "bold", fontFamily: "monospace" },
  timerTextRed: { color: "#FF4444" },
  timerLabel: { color: "#ddd", fontSize: 12 },
  
  // Updated Controls
  cameraControls: { 
    position: "absolute", 
    bottom: 40, 
    left: 0, 
    right: 0, 
    alignItems: "center", 
    flexDirection: "column", 
    gap: 20 
  },
  recordingControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    marginBottom: 10,
  },
  controlButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  stopButtonOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    elevation: 5,
  },
  stopButtonInner: { width: 32, height: 32, backgroundColor: "#FF3B30", borderRadius: 4 },
  
  switchCameraContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "rgba(0,0,0,0.6)", 
    paddingVertical: 8, 
    paddingHorizontal: 16, 
    borderRadius: 20 
  },
  switchCameraText: { color: "white", marginLeft: 6, fontSize: 14, fontWeight: "600" },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  modalContent: { backgroundColor: "white", borderRadius: 24, padding: 24, width: "100%", maxWidth: 340 },
  modalTitle: { fontSize: 20, fontWeight: "bold", textAlign: "center", marginBottom: 20 },
  emotionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  emotionButton: { width: "30%", aspectRatio: 1, backgroundColor: "#f8f9fa", borderRadius: 16, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  emotionEmoji: { fontSize: 32, marginBottom: 4 },
  emotionLabel: { fontSize: 12, color: "#666" },
  notificationModalContent: { backgroundColor: "white", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 },
  notificationSubtitle: { fontSize: 14, color: "#666", textAlign: "center", marginBottom: 20 },
  timeRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  timeLabel: { flex: 1, fontSize: 16, fontWeight: "500", color: "#000" },
  timeValue: { fontSize: 16, color: "#007AFF", marginRight: 8 },
  primaryButton: { backgroundColor: "#007AFF", borderRadius: 12, padding: 16, alignItems: "center", marginTop: 20 },
  primaryButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  secondaryButton: { padding: 16, alignItems: "center" },
  secondaryButtonText: { color: "#666", fontSize: 14 },
  pickerContainer: { backgroundColor: "white", borderRadius: 16, padding: 20, width: "90%", maxWidth: 320 },
  pickerTitle: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 16 },
  pickerColumns: { flexDirection: "row", justifyContent: "space-around" },
  pickerColumn: { alignItems: "center", width: "40%" },
  pickerColumnTitle: { fontSize: 14, color: "#666", marginBottom: 8 },
  pickerScroll: { height: 180 },
  pickerItem: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 8, marginVertical: 2 },
  pickerItemSelected: { backgroundColor: "#007AFF" },
  pickerItemText: { fontSize: 18, color: "#000", textAlign: "center" },
  pickerItemTextSelected: { color: "white", fontWeight: "600" },
  pickerButtons: { flexDirection: "row", justifyContent: "space-between", marginTop: 20 },
  pickerCancelButton: { flex: 1, padding: 12, marginRight: 8, borderRadius: 8, backgroundColor: "#f0f0f0", alignItems: "center" },
  pickerCancelText: { color: "#666", fontSize: 16 },
  pickerSaveButton: { flex: 1, padding: 12, marginLeft: 8, borderRadius: 8, backgroundColor: "#007AFF", alignItems: "center" },
  pickerSaveText: { color: "white", fontSize: 16, fontWeight: "600" },
});