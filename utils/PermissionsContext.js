import React, { createContext, useContext, useState, useEffect } from 'react';
import { Camera } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@app_settings';
const FIRST_RUN_KEY = '@first_run_complete';

const defaultSettings = {
  cameraEnabled: true,
  locationEnabled: true,
  notificationsEnabled: true,
  storageEnabled: true,
  theme: 'light',
  notificationTimes: {
    morning: { hour: 9, minute: 0 },
    midday: { hour: 14, minute: 0 },
    evening: { hour: 22, minute: 0 },
  },
};

const PermissionsContext = createContext();

export const PermissionsProvider = ({ children }) => {
  const [permissions, setPermissions] = useState({
    camera: null,
    location: null,
  });
  const [settings, setSettings] = useState(defaultSettings);
  const [isFirstRun, setIsFirstRun] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);
      const firstRunComplete = await AsyncStorage.getItem(FIRST_RUN_KEY);
      
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      }
      
      setIsFirstRun(firstRunComplete !== 'true');
      setIsLoaded(true);
    } catch (error) {
      console.error('Error loading settings:', error);
      setIsLoaded(true);
    }
  };

  const updateSettings = async (newSettings) => {
    try {
      setSettings(newSettings);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const completeFirstRun = async () => {
    try {
      await AsyncStorage.setItem(FIRST_RUN_KEY, 'true');
      setIsFirstRun(false);
    } catch (error) {
      console.error('Error setting first run:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const cameraStatus = await Camera.getCameraPermissionsAsync();
      const locationStatus = await Location.getForegroundPermissionsAsync();

      const cameraGranted = cameraStatus.status === 'granted';
      const locationGranted = locationStatus.status === 'granted';

      setPermissions({
        camera: cameraGranted,
        location: locationGranted,
      });

      return { camera: cameraGranted, location: locationGranted };
    } catch (error) {
      console.error('Error checking permissions:', error);
      return { camera: false, location: false };
    }
  };

  const requestCameraPermission = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const granted = status === 'granted';
      setPermissions((prev) => ({ ...prev, camera: granted }));
      return granted;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  };

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setPermissions((prev) => ({ ...prev, location: granted }));
      return granted;
    } catch (error) {
      console.error('Error requesting location permission:', error);
      return false;
    }
  };

  return (
    <PermissionsContext.Provider
      value={{
        permissions,
        setPermissions,
        settings,
        setSettings,
        updateSettings,
        checkPermissions,
        requestCameraPermission,
        requestLocationPermission,
        isFirstRun,
        completeFirstRun,
        isLoaded,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
};

export const usePermissions = () => {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
};