import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { getSessions, deleteSession } from "../../utils/storage";
import { usePermissions } from "../../utils/PermissionsContext";

export default function HistoryScreen() {
  const [sessions, setSessions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const { settings } = usePermissions();
  const isDark = settings?.theme === "dark";

  const loadSessions = async () => {
    const data = await getSessions();
    setSessions(data);
  };

  useFocusEffect(
    useCallback(() => {
      loadSessions();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleDeleteSession = (sessionId) => {
    Alert.alert(
      "Delete Session",
      "Are you sure you want to delete this session?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSession(sessionId);
              await loadSessions();
            } catch (error) {
              console.error("Delete session error:", error);
              Alert.alert("Error", "Failed to delete session");
            }
          },
        },
      ]
    );
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString();
  };

  const getEmotionEmoji = (value) => {
    const emojis = ["😢", "😞", "😐", "🙂", "😊", "😄"];
    return emojis[value] || "❓";
  };

  const themedStyles = getThemedStyles(isDark);

  const renderSession = ({ item }) => (
    <View style={[styles.sessionCard, themedStyles.card]}>
      <View style={[styles.sessionHeader, themedStyles.cardBorder]}>
        <View style={styles.sessionInfo}>
          <Text style={[styles.sessionDate, themedStyles.text]}>{formatDate(item.startTime)}</Text>
          <Text style={[styles.sessionId, themedStyles.subtitleText]}>ID: {item.sessionId}</Text>
        </View>
        <TouchableOpacity
          onPress={() => handleDeleteSession(item.sessionId)}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>

      <View style={styles.sessionDetails}>
        <View style={styles.detailRow}>
          <Ionicons name="happy-outline" size={20} color="#007AFF" />
          <Text style={[styles.detailLabel, themedStyles.subtitleText]}>Emotion:</Text>
          <Text style={[styles.detailValue, themedStyles.text]}>
            {getEmotionEmoji(item.emotionValue)} {item.emotionValue}/5
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={20} color="#007AFF" />
          <Text style={[styles.detailLabel, themedStyles.subtitleText]}>Duration:</Text>
          <Text style={[styles.detailValue, themedStyles.text]}>{item.duration}s</Text>
        </View>

        {item.latitude && item.longitude && (
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={20} color="#007AFF" />
            <Text style={[styles.detailLabel, themedStyles.subtitleText]}>GPS:</Text>
            <Text style={[styles.detailValue, themedStyles.text]}>
              {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
            </Text>
          </View>
        )}

        {item.videoUri && (
          <View style={styles.detailRow}>
            <Ionicons name="videocam-outline" size={20} color="#007AFF" />
            <Text style={[styles.detailLabel, themedStyles.subtitleText]}>Video:</Text>
            <Text style={[styles.detailValue, themedStyles.text]} numberOfLines={1}>
              {item.videoUri.split("/").pop()}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="folder-open-outline" size={64} color={isDark ? "#555" : "#ccc"} />
      <Text style={[styles.emptyTitle, themedStyles.subtitleText]}>No Sessions Yet</Text>
      <Text style={[styles.emptySubtitle, themedStyles.subtitleText]}>
        Start recording sessions from the Home tab
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, themedStyles.container]}>
      <View style={[styles.header, themedStyles.header]}>
        <Text style={[styles.title, themedStyles.text]}>History</Text>
        <Text style={[styles.subtitle, themedStyles.subtitleText]}>{sessions.length} sessions recorded</Text>
      </View>

      <FlatList
        data={sessions}
        renderItem={renderSession}
        keyExtractor={(item) => item.sessionId || item.id}
        contentContainerStyle={[
          styles.listContent,
          sessions.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#fff" : "#007AFF"}
          />
        }
      />
    </View>
  );
}

const getThemedStyles = (isDark) => ({
  container: { backgroundColor: isDark ? "#121212" : "#f5f5f5" },
  header: { backgroundColor: isDark ? "#1e1e1e" : "#fff", borderBottomColor: isDark ? "#333" : "#e0e0e0" },
  card: { backgroundColor: isDark ? "#1e1e1e" : "#fff" },
  cardBorder: { borderBottomColor: isDark ? "#333" : "#f0f0f0" },
  text: { color: isDark ? "#fff" : "#000" },
  subtitleText: { color: isDark ? "#aaa" : "#666" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 14 },
  listContent: { padding: 16 },
  emptyListContent: { flex: 1 },
  sessionCard: { borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  sessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1 },
  sessionInfo: { flex: 1 },
  sessionDate: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  sessionId: { fontSize: 12 },
  deleteButton: { padding: 4 },
  sessionDetails: { gap: 8 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  detailLabel: { fontSize: 14, fontWeight: "500" },
  detailValue: { fontSize: 14, flex: 1 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
  emptyTitle: { fontSize: 20, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
});