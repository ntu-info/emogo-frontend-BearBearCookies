import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSIONS_KEY = 'sessions';

// Generate a unique session ID
export const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Get all sessions from storage
export const getSessions = async () => {
  try {
    const sessionsJson = await AsyncStorage.getItem(SESSIONS_KEY);
    if (sessionsJson) {
      const sessions = JSON.parse(sessionsJson);
      // Sort by startTime descending (newest first)
      return sessions.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    }
    return [];
  } catch (error) {
    console.error('Error getting sessions:', error);
    return [];
  }
};

// Alias for getSessions
export const getAllSessions = getSessions;

// Save a session to storage
export const saveSession = async (sessionData) => {
  try {
    const sessions = await getSessions();
    const newSession = {
      ...sessionData,
      sessionId: sessionData.sessionId || generateSessionId(),
      timestamp: Date.now(),
    };
    
    // Add to beginning of array (newest first)
    sessions.unshift(newSession);
    
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    console.log('Session saved:', newSession.sessionId);
    return newSession; // Return the saved session (truthy value for success check)
  } catch (error) {
    console.error('Error saving session:', error);
    return null; // Return null on failure
  }
};

// Get a specific session by ID
export const getSession = async (sessionId) => {
  try {
    const sessions = await getSessions();
    return sessions.find(session => 
      session.sessionId === sessionId || session.id === sessionId
    );
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
};

// Delete a session by ID
export const deleteSession = async (sessionId) => {
  try {
    const sessions = await getSessions();
    // Filter out the session - check both sessionId and id fields for compatibility
    const filteredSessions = sessions.filter(
      session => session.sessionId !== sessionId && session.id !== sessionId
    );
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(filteredSessions));
    console.log('Session deleted:', sessionId);
    return true;
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
};

// Clear all sessions
export const clearAllSessions = async () => {
  try {
    await AsyncStorage.removeItem(SESSIONS_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing sessions:', error);
    throw error;
  }
};

// Format session data for CSV export
export const formatSessionForCSV = (session) => {
  const startTime = session.startTime 
    ? new Date(session.startTime).toISOString() 
    : 'N/A';
  const endTime = session.endTime 
    ? new Date(session.endTime).toISOString() 
    : 'N/A';

  return {
    session_id: session.sessionId || session.id || 'N/A',
    start_time: startTime,
    end_time: endTime,
    duration: session.duration || 0,
    emotion_value: session.emotionValue !== undefined ? session.emotionValue : 'N/A',
    latitude: session.latitude || 'N/A',
    longitude: session.longitude || 'N/A',
    video_file_path: session.videoUri || 'N/A',
  };
};

// ⚠️ 重要：請換成你 Render 部署後的真正網址，例如 https://emogo-backend.onrender.com
const API_URL = "https://emogo-backend-bearbearcookies.onrender.com"; 

export const uploadSessionToBackend = async (session) => {
  try {
    const formData = new FormData();

    // 1. 填入資料 (Key 必須對應 Backend 的 main.py)
    formData.append('sessionId', session.sessionId);
    formData.append('startTime', session.startTime);
    formData.append('emotionValue', String(session.emotionValue)); // 轉成字串比較保險
    formData.append('duration', String(session.duration));
    
    if (session.latitude) formData.append('latitude', String(session.latitude));
    if (session.longitude) formData.append('longitude', String(session.longitude));

    // 2. 處理影片檔案
    // React Native 的 FormData 處理檔案需要特殊的格式
    const filename = session.videoUri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `video/${match[1]}` : `video/mp4`;

    formData.append('file', {
      uri: session.videoUri,
      name: filename,
      type: type,
    });

    // 3. 發送請求
    const response = await fetch(`${API_URL}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    const result = await response.json();
    console.log('Upload success:', result);
    return true;

  } catch (error) {
    console.error('Upload failed:', error);
    return false;
  }
};