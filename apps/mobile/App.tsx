import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/auth';
import type { RootStackParamList, TabParamList } from './src/navigation';
import { ChannelScreen } from './src/screens/ChannelScreen';
import { ChannelsScreen } from './src/screens/ChannelsScreen';
import { FeedScreen } from './src/screens/FeedScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { WatchLaterScreen } from './src/screens/WatchLaterScreen';
import { WatchScreen } from './src/screens/WatchScreen';
import { useTheme } from './src/theme';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarLabelStyle: { fontSize: 12 }, tabBarIconStyle: { display: 'none' } }}>
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'Subscribed' , tabBarLabel: 'Feed' }} />
      <Tab.Screen name="Channels" component={ChannelsScreen} />
      <Tab.Screen name="WatchLater" component={WatchLaterScreen} options={{ title: 'Watch later' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function Root() {
  const t = useTheme();
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.bg }}>
        <ActivityIndicator color={t.muted} />
      </View>
    );
  }
  if (!user) return <LoginScreen />;

  return (
    <Stack.Navigator>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="Watch" component={WatchScreen} options={{ title: '' }} />
      <Stack.Screen name="Channel" component={ChannelScreen} options={({ route }) => ({ title: route.params.title ?? 'Channel' })} />
    </Stack.Navigator>
  );
}

export default function App() {
  const t = useTheme();
  const base = t.bg === '#0f0f10' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: t.bg, card: t.surface, text: t.text, border: t.border, primary: t.accent },
  };

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={navTheme}>
          <Root />
          <StatusBar style="auto" />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
