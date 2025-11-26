import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system/next";
import { getSessions, formatSessionForCSV } from "../../utils/storage";
import { usePermissions } from "../../utils/PermissionsContext";

export default function StatisticsScreen() {
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    averageEmotion: 0,
    emotionDistribution: {},
    locationsRecorded: 0,
  });
  const [isExporting, setIsExporting] = useState(false);

  const { settings } = usePermissions();
  const isDark = settings?.theme === "dark";

  const loadData = async () => {
    const data = await getSessions();
    setSessions(data);
    calculateStatistics(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const calculateStatistics = (data) => {
    if (data.length === 0) {
      setStats({
        totalSessions: 0,
        averageEmotion: 0,
        emotionDistribution: {},
        locationsRecorded: 0,
      });
      return;
    }

    const emotionSum = data.reduce((sum, s) => sum + (s.emotionValue || 0), 0);
    const averageEmotion = emotionSum / data.length;

    const emotionDistribution = {};
    data.forEach((session) => {
      const emotion = session.emotionValue;
      emotionDistribution[emotion] = (emotionDistribution[emotion] || 0) + 1;
    });

    const locationsRecorded = data.filter((s) => s.latitude && s.longitude).length;

    setStats({
      totalSessions: data.length,
      averageEmotion: averageEmotion.toFixed(2),
      emotionDistribution,
      locationsRecorded,
    });
  };

  const exportToCSV = async () => {
    if (sessions.length === 0) {
      Alert.alert("No Data", "There are no sessions to export.");
      return;
    }

    setIsExporting(true);

    try {
      // Create CSV content
      const headers = [
        "Session ID",
        "Start Time",
        "End Time",
        "Duration (s)",
        "Emotion Value",
        "Latitude",
        "Longitude",
        "Video File Path",
      ];

      const csvRows = [headers.join(",")];

      sessions.forEach((session) => {
        const formatted = formatSessionForCSV(session);
        const row = [
          `"${formatted.session_id}"`,
          `"${formatted.start_time}"`,
          `"${formatted.end_time}"`,
          formatted.duration,
          formatted.emotion_value,
          formatted.latitude,
          formatted.longitude,
          `"${formatted.video_file_path}"`,
        ];
        csvRows.push(row.join(","));
      });

      const csvContent = csvRows.join("\n");

      // Use new expo-file-system API
      const fileName = `sessions_export_${Date.now()}.csv`;
      const file = new File(Paths.cache, fileName);
      
      // Write content to file
      await file.write(csvContent);

      // Share the file
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          dialogTitle: "Export Session Data",
          UTI: "public.comma-separated-values-text",
        });
      } else {
        Alert.alert("Export Complete", `File saved to: ${file.uri}`, [{ text: "OK" }]);
      }
    } catch (error) {
      console.error("Error exporting CSV:", error);
      Alert.alert("Export Failed", "Could not export data. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const getEmotionEmoji = (value) => {
    const emojis = ["😢", "😞", "😐", "🙂", "😊", "😄"];
    return emojis[value] || "❓";
  };

  const themedStyles = getThemedStyles(isDark);

  return (
    <ScrollView style={[styles.container, themedStyles.container]}>
      <View style={[styles.header, themedStyles.header]}>
        <Text style={[styles.title, themedStyles.text]}>Statistics</Text>
        <Text style={[styles.subtitle, themedStyles.subtitleText]}>Data insights and export</Text>
      </View>

      <View style={styles.content}>
        {/* Overall Stats */}
        <View style={[styles.section, themedStyles.section]}>
          <Text style={[styles.sectionTitle, themedStyles.text]}>Overview</Text>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, themedStyles.statCard]}>
              <Ionicons name="videocam" size={32} color="#007AFF" />
              <Text style={[styles.statValue, themedStyles.text]}>{stats.totalSessions}</Text>
              <Text style={[styles.statLabel, themedStyles.subtitleText]}>Total Sessions</Text>
            </View>

            <View style={[styles.statCard, themedStyles.statCard]}>
              <Ionicons name="happy" size={32} color="#34C759" />
              <Text style={[styles.statValue, themedStyles.text]}>{stats.averageEmotion}</Text>
              <Text style={[styles.statLabel, themedStyles.subtitleText]}>Avg Emotion</Text>
            </View>

            <View style={[styles.statCard, themedStyles.statCard]}>
              <Ionicons name="location" size={32} color="#FF9500" />
              <Text style={[styles.statValue, themedStyles.text]}>{stats.locationsRecorded}</Text>
              <Text style={[styles.statLabel, themedStyles.subtitleText]}>GPS Records</Text>
            </View>
          </View>
        </View>

        {/* Emotion Distribution */}
        <View style={[styles.section, themedStyles.section]}>
          <Text style={[styles.sectionTitle, themedStyles.text]}>Emotion Distribution</Text>

          {Object.keys(stats.emotionDistribution).length > 0 ? (
            <View style={styles.emotionList}>
              {[0, 1, 2, 3, 4, 5].map((value) => {
                const count = stats.emotionDistribution[value] || 0;
                const percentage =
                  stats.totalSessions > 0
                    ? ((count / stats.totalSessions) * 100).toFixed(1)
                    : 0;

                return (
                  <View key={value} style={styles.emotionRow}>
                    <View style={styles.emotionInfo}>
                      <Text style={styles.emotionEmoji}>{getEmotionEmoji(value)}</Text>
                      <Text style={[styles.emotionLabel, themedStyles.text]}>Level {value}</Text>
                    </View>
                    <View style={styles.emotionStats}>
                      <View style={[styles.emotionBarBg, themedStyles.barBg]}>
                        <View style={[styles.emotionBar, { width: `${percentage}%` }]} />
                      </View>
                      <Text style={[styles.emotionCount, themedStyles.subtitleText]}>
                        {count} ({percentage}%)
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.noDataText, themedStyles.subtitleText]}>
              No emotion data available yet
            </Text>
          )}
        </View>

        {/* Export Section */}
        <View style={[styles.section, themedStyles.section]}>
          <Text style={[styles.sectionTitle, themedStyles.text]}>Export Data</Text>
          <Text style={[styles.exportDescription, themedStyles.subtitleText]}>
            Export all session data as a CSV file for analysis
          </Text>

          <TouchableOpacity
            style={[
              styles.exportButton,
              (sessions.length === 0 || isExporting) && styles.exportButtonDisabled,
            ]}
            onPress={exportToCSV}
            disabled={sessions.length === 0 || isExporting}
          >
            <Ionicons name="download-outline" size={24} color="white" />
            <Text style={styles.exportButtonText}>
              {isExporting ? "Exporting..." : "Export to CSV"}
            </Text>
          </TouchableOpacity>

          {sessions.length === 0 && (
            <Text style={[styles.exportNote, themedStyles.subtitleText]}>
              No data available to export
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const getThemedStyles = (isDark) => ({
  container: { backgroundColor: isDark ? "#121212" : "#f5f5f5" },
  header: { backgroundColor: isDark ? "#1e1e1e" : "#fff", borderBottomColor: isDark ? "#333" : "#e0e0e0" },
  section: { backgroundColor: isDark ? "#1e1e1e" : "#fff" },
  statCard: { backgroundColor: isDark ? "#2a2a2a" : "#f5f5f5" },
  text: { color: isDark ? "#fff" : "#000" },
  subtitleText: { color: isDark ? "#aaa" : "#666" },
  barBg: { backgroundColor: isDark ? "#333" : "#e0e0e0" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 14 },
  content: { padding: 16 },
  section: { borderRadius: 12, padding: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  statsGrid: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  statCard: { flex: 1, borderRadius: 12, padding: 16, alignItems: "center" },
  statValue: { fontSize: 24, fontWeight: "bold", marginTop: 8 },
  statLabel: { fontSize: 12, marginTop: 4, textAlign: "center" },
  emotionList: { gap: 12 },
  emotionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  emotionInfo: { flexDirection: "row", alignItems: "center", gap: 8, width: 100 },
  emotionEmoji: { fontSize: 24 },
  emotionLabel: { fontSize: 14 },
  emotionStats: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  emotionBarBg: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  emotionBar: { height: 8, backgroundColor: "#007AFF", borderRadius: 4, minWidth: 2 },
  emotionCount: { fontSize: 12, minWidth: 70 },
  noDataText: { fontSize: 14, textAlign: "center", paddingVertical: 16 },
  exportDescription: { fontSize: 14, marginBottom: 16 },
  exportButton: { backgroundColor: "#007AFF", borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  exportButtonDisabled: { backgroundColor: "#999" },
  exportButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  exportNote: { fontSize: 12, textAlign: "center", marginTop: 8 },
});