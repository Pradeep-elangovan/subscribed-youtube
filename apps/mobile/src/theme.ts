import { useColorScheme } from 'react-native';

const light = {
  bg: '#fafafa',
  surface: '#ffffff',
  text: '#111113',
  muted: '#6b6b73',
  border: '#e4e4e8',
  accent: '#e5392f',
};

const dark: typeof light = {
  bg: '#0f0f10',
  surface: '#1a1a1d',
  text: '#f2f2f4',
  muted: '#9a9aa3',
  border: '#2b2b30',
  accent: '#ff5a50',
};

export type Theme = typeof light;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
