import { Stack } from "expo-router";
import { useColorScheme } from "react-native";
import { PermissionsProvider } from "../utils/PermissionsContext";

function RootStack() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <PermissionsProvider>
      <RootStack />
    </PermissionsProvider>
  );
}