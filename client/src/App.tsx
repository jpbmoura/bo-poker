import { Routes, Route, Navigate } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { RequireAuth } from './components/RequireAuth';
import { RequireStarter } from './components/RequireStarter';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import LoginPage from './pages/LoginPage';
import { Toaster } from './components/ui/Toaster';

export default function App() {
  return (
    // reducedMotion="user": framer respeita prefers-reduced-motion em todo o app
    // (transforms viram instantâneos; opacidade continua).
    <MotionConfig reducedMotion="user">
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route element={<RequireStarter />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/room/:roomId" element={<RoomPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </MotionConfig>
  );
}
