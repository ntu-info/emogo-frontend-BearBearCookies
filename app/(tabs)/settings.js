import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Alert,
  ScrollView,
  TouchableOpacity,
  Modal,
  Pressable,
} from "react-native";
import { usePermissions } from "../../utils/PermissionsContext";
import * as Notifications from "expo-notifications";

const DEFAULT_TIMES = {
  morning: { hour: 9, minute: 0 },
  midday: { hour: 14, minute: 0 },
  evening: { hour: 22, minute: 0 },
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 30];

function formatTime({ hour, minute }) {
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

export default function SettingsScreen() {
  const {
    settings,
    updateSettings,
    permissions,
    requestCameraPermission,
    requestLocationPermission,
    checkPermissions,
  } = usePermissions();

  const [notificationsEnabled, setNotificationsEnabled] = useState(
    settings?.notificationsEnabled ?? true
  );
  const [notificationTimes, setNotificationTimes] = useState(
    settings?.notificationTimes || DEFAULT_TIMES
  );

  // Time picker state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerKey, setPickerKey] = useState("morning");
  const [pickerHour, setPickerHour] = useState(9);
  const [pickerMinute, setPickerMinute] = useState(0);

  const isDark = settings?.theme === "dark";

  useEffect(() => {
    if (checkPermissions) {
      checkPermissions();
    }
  }, []);

  useEffect(() => {
    if (settings) {
      setNotificationsEnabled(settings.notificationsEnabled ?? true);
      setNotificationTimes(settings.notificationTimes || DEFAULT_TIMES);
    }
  }, [settings]);

  const handleCameraToggle = async (value) => {
    if (value) {
      const granted = await requestCameraPermission();
      if (granted) {
        updateSettings({ ...settings, cameraEnabled: true });
      } else {
        Alert.alert("Permission Denied", "Camera permission is required.");
      }
    } else {
      updateSettings({ ...settings, cameraEnabled: false });
    }
  };

  const handleLocationToggle = async (value) => {
    if (value) {
      const granted = await requestLocationPermission();
      if (granted) {
        updateSettings({ ...settings, locationEnabled: true });
      } else {
        Alert.alert("Permission Denied", "Location permission is required.");
      }
    } else {
      updateSettings({ ...settings, locationEnabled: false });
    }
  };

  const handleStorageToggle = (value) => {
    updateSettings({ ...settings, storageEnabled: value });
  };

  const toggleTheme = () => {
    const newTheme = isDark ? "light" : "dark";
    updateSettings({ ...settings, theme: newTheme });
  };

  const rescheduleNotifications = async (times, enabled) => {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();

      if (!enabled) return;

      const entries = [
        ["Morning reminder", times.morning],
        ["Midday reminder", times.midday],
        ["Evening reminder", times.evening],
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
    } catch (e) {
      console.log("Notification schedule error", e);
    }
  };

  const handleNotificationsToggle = async (value) => {
    setNotificationsEnabled(value);
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        setNotificationsEnabled(false);
        Alert.alert("Permission required", "Notification permission is needed.");
        return;
      }
    }
    await rescheduleNotifications(notificationTimes, value);
    updateSettings({ ...settings, notificationsEnabled: value });
  };

  const openTimePicker = (key) => {
    const time = notificationTimes[key] || DEFAULT_TIMES[key];
    setPickerKey(key);
    setPickerHour(time.hour);
    setPickerMinute(time.minute);
    setPickerVisible(true);
  };

  const savePicker = async () => {
    const updated = {
      ...notificationTimes,
      [pickerKey]: { hour: pickerHour, minute: pickerMinute },
    };
    setNotificationTimes(updated);
    setPickerVisible(false);
    await rescheduleNotifications(updated, notificationsEnabled);
    updateSettings({ ...settings, notificationTimes: updated });
    Alert.alert("Saved", "Notification time updated.");
  };

  const openTerms = () => {
    Alert.alert("Terms & Conditions", "Study consent / terms content here.");
  };

  const openLicenses = () => {
    Alert.alert("Open-source licenses", "expo, expo-camera, expo-notifications, expo-location, etc.");
  };

  const getTimeLabel = (key) => {
    const labels = { morning: "Morning", midday: "Midday", evening: "Evening" };
    return labels[key] || key;
  };

  const themedStyles = getThemedStyles(isDark);

  return (
    <ScrollView style={[styles.container, themedStyles.container]}>
      <View style={styles.content}>
        <Text style={[styles.title, themedStyles.text]}>Settings</Text>
        <Text style={[styles.subtitle, themedStyles.subtitleText]}>
          Configure appearance, reminders, and permissions
        </Text>

        {/* Appearance */}
        <View style={[styles.section, themedStyles.section]}>
          <Text style={[styles.sectionTitle, themedStyles.text]}>Appearance</Text>
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>Dark Mode</Text>
              <Text style={[styles.settingDescription, themedStyles.subtitleText]}>
                {isDark ? "Dark theme enabled" : "Light theme enabled"}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={isDark ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* Notifications */}
        <View style={[styles.section, themedStyles.section]}>
          <Text style={[styles.sectionTitle, themedStyles.text]}>Notifications</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>Daily reminders</Text>
              <Text style={[styles.settingDescription, themedStyles.subtitleText]}>
                Remind you to collect emotion data three times a day.
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={notificationsEnabled ? "#007AFF" : "#f4f3f4"}
            />
          </View>

          {notificationsEnabled && (
            <>
              {["morning", "midday", "evening"].map((key) => (
                <TouchableOpacity
                  key={key}
                  style={styles.timeRow}
                  onPress={() => openTimePicker(key)}
                >
                  <Text style={[styles.settingLabel, themedStyles.text]}>{getTimeLabel(key)}</Text>
                  <Text style={styles.timeValue}>{formatTime(notificationTimes[key])}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.helperText}>Tap to change time</Text>
            </>
          )}
        </View>

        {/* Permissions */}
        <View style={[styles.section, themedStyles.section]}>
          <Text style={[styles.sectionTitle, themedStyles.text]}>Permissions</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>Camera & Microphone</Text>
              <Text style={[styles.settingDescription, themedStyles.subtitleText]}>Required for video recording</Text>
              {permissions.camera !== null && (
                <Text style={[styles.permissionStatus, permissions.camera ? styles.granted : styles.denied]}>
                  {permissions.camera ? "✓ Granted" : "✗ Not Granted"}
                </Text>
              )}
            </View>
            <Switch
              value={settings.cameraEnabled}
              onValueChange={handleCameraToggle}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={settings.cameraEnabled ? "#007AFF" : "#f4f3f4"}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>Location</Text>
              <Text style={[styles.settingDescription, themedStyles.subtitleText]}>Required for GPS coordinate capture</Text>
              {permissions.location !== null && (
                <Text style={[styles.permissionStatus, permissions.location ? styles.granted : styles.denied]}>
                  {permissions.location ? "✓ Granted" : "✗ Not Granted"}
                </Text>
              )}
            </View>
            <Switch
              value={settings.locationEnabled}
              onValueChange={handleLocationToggle}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={settings.locationEnabled ? "#007AFF" : "#f4f3f4"}
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, themedStyles.text]}>Storage</Text>
              <Text style={[styles.settingDescription, themedStyles.subtitleText]}>Save session data locally</Text>
            </View>
            <Switch
              value={settings.storageEnabled}
              onValueChange={handleStorageToggle}
              trackColor={{ false: "#767577", true: "#81b0ff" }}
              thumbColor={settings.storageEnabled ? "#007AFF" : "#f4f3f4"}
            />
          </View>
        </View>

        {/* About */}
        <View style={[styles.infoSection, themedStyles.section]}>
          <Text style={[styles.infoTitle, themedStyles.text]}>About & Legal</Text>
          <TouchableOpacity style={styles.linkRow} onPress={openTerms}>
            <Text style={styles.linkText}>Terms & Conditions</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={openLicenses}>
            <Text style={styles.linkText}>Open-source licenses</Text>
          </TouchableOpacity>
          <Text style={[styles.infoText, themedStyles.subtitleText]}>
            This app collects three types of data:{"\n\n"}
            • Video recordings (≈ 1 minute each){"\n"}
            • Emotion ratings{"\n"}
            • GPS coordinates (once per session){"\n\n"}
            All data is stored locally on your device and can be exported as CSV.
          </Text>
        </View>
      </View>

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
              <TouchableOpacity style={styles.pickerSaveButton} onPress={savePicker}>
                <Text style={styles.pickerSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const getThemedStyles = (isDark) => ({
  container: { backgroundColor: isDark ? "#121212" : "#f5f5f5" },
  section: { backgroundColor: isDark ? "#1e1e1e" : "#fff" },
  text: { color: isDark ? "#fff" : "#000" },
  subtitleText: { color: isDark ? "#aaa" : "#666" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 16, marginBottom: 24 },
  section: { borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  settingItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  settingInfo: { flex: 1, marginRight: 16 },
  settingLabel: { fontSize: 16, fontWeight: "500", marginBottom: 4 },
  settingDescription: { fontSize: 14 },
  permissionStatus: { fontSize: 12, marginTop: 4, fontWeight: "600" },
  granted: { color: "#34C759" },
  denied: { color: "#FF3B30" },
  infoSection: { borderRadius: 12, padding: 16, marginBottom: 32 },
  infoTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  infoText: { fontSize: 14, lineHeight: 20 },
  timeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  timeValue: { fontSize: 16, fontWeight: "500", color: "#007AFF" },
  helperText: { fontSize: 12, color: "#999", marginTop: 8 },
  linkRow: { paddingVertical: 8 },
  linkText: { fontSize: 15, color: "#007AFF", fontWeight: "500" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  pickerContainer: { backgroundColor: "white", borderRadius: 16, padding: 20, width: "90%", maxWidth: 320 },
  pickerTitle: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 16, color: "#000" },
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