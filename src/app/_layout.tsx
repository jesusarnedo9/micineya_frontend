import { Stack } from 'expo-router';

export default function RootLayout() {
  // Al no declarar los nombres, Expo detecta todas tus carpetas automáticamente
  return <Stack screenOptions={{ headerShown: false }} />;
}