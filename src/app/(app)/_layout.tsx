import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { AppExperienceProvider } from '../../context/app-experience';

export default function AppLayout() {
  return (
    <AppExperienceProvider>
      <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: '#000' },
        tabBarActiveTintColor: '#e50914',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: '#090909',
          borderTopColor: '#222',
          height: 66,
          paddingBottom: 8,
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
