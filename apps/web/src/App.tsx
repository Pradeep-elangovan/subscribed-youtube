import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import {
  ChannelPage,
  ChannelsPage,
  FeedPage,
  LoginPage,
  SettingsPage,
  WatchLaterPage,
  WatchPage,
} from './pages';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <p className="note">Loading…</p>;
  if (!user) return <LoginPage />;

  return (
    <div className="shell">
      <nav className="nav">
        <NavLink to="/" end>
          Feed
        </NavLink>
        <NavLink to="/channels">Channels</NavLink>
        <NavLink to="/watch-later">Watch later</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<FeedPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/channel/:id" element={<ChannelPage />} />
        <Route path="/watch/:id" element={<WatchPage />} />
        <Route path="/watch-later" element={<WatchLaterPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
