import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FeedList } from '../components';
import type { RootStackParamList } from '../navigation';
import { useTheme } from '../theme';

export function ChannelScreen({ route }: NativeStackScreenProps<RootStackParamList, 'Channel'>) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <FeedList params={{ tab: 'videos', channel: route.params.id }} empty="No videos from this channel yet." />
    </View>
  );
}
