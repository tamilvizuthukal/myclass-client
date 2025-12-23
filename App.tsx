import React from 'react';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { TeacherView } from './components/TeacherView';
import { FirstTimeLogin } from './components/FirstTimeLogin';
import { SessionProvider, useSession } from './context/SessionContext';
import { ToastProvider } from './context/ToastContext';
import { setupDebugKeyboardShortcuts } from './utils/navigationUtils';

const AppContent: React.FC = () => {
  const { session } = useSession();
  const currentUser = session.user;
  const [showSignup, setShowSignup] = React.useState(false);

  if (!currentUser) {
    if (showSignup) {
      return <Signup onLoginClick={() => setShowSignup(false)} />;
    }
    return <Login onSignupClick={() => setShowSignup(true)} />;
  }

  if (currentUser.isFirstLogin) {
    return <FirstTimeLogin />;
  }

  // All users see TeacherView with published content only
  return <TeacherView />;
};

const App: React.FC = () => {
  // Setup debug keyboard shortcuts for navigation debugging
  React.useEffect(() => {
    const cleanup = setupDebugKeyboardShortcuts();
    return cleanup;
  }, []);

  return (
    <SessionProvider>
      <ToastProvider> {/* Wrap AppContent with ToastProvider */}
        <AppContent />
      </ToastProvider>
    </SessionProvider>
  );
};

export default App;