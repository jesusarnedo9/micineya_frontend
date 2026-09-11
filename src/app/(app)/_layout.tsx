import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppExperienceProvider } from '../../context/app-experience';

export default function AppLayout() {
  const insets = useSafeAreaInsets();
  const bottomSpace = Math.max(insets.bottom, 8);
  return (
    <AppExperienceProvider>
      <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#000' },
        tabBarActiveTintColor: '#e50914',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarLabelPosition: 'below-icon',
        tabBarStyle: {
          backgroundColor: '#090909',
          borderTopColor: '#222',
          // Reservar espacio fuera de los botones para gestos o navegación de tres botones.
          height: 58 + bottomSpace,
          paddingBottom: bottomSpace,
          paddingTop: 7,
        },
      }}
      >
        <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="sparkles" size={size} />
          ),
          title: 'Para vos',
        }}
        />
        <Tabs.Screen
        name="roulette"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="shuffle" size={size} />
          ),
          title: 'Ruleta',
        }}
        />
        <Tabs.Screen
        name="reels"
        options={{
          href: null,
        }}
        />
        <Tabs.Screen name="search" options={{ href: null }} />
        <Tabs.Screen
          name="community"
          options={{
            title: 'Comunidad',
            tabBarIcon: ({ color, size }) => <Ionicons color={color} name="people-outline" size={size} />,
          }}
        />
        <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons color={color} name="person-circle" size={size} />
          ),
          title: 'Mi perfil',
        }}
        />
      </Tabs>
    </AppExperienceProvider>
  );
}
