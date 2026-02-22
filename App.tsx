import React from 'react';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { InstallPWABanner } from './components/InstallPWABanner';
import { TeacherView } from './components/TeacherView';
import { FirstTimeLogin } from './components/FirstTimeLogin';
import { SessionProvider, useSession } from './context/SessionContext';
import { ToastProvider } from './context/ToastContext';

const AppContent: React.FC = () => {
  const { session } = useSession();
  const currentUser = session.user;
  const [showSignup, setShowSignup] = React.useState(false);

  if (!currentUser) {
    if (showSignup) {
      return (
        <>
          <Signup onLoginClick={() => setShowSignup(false)} />
          <InstallPWABanner />
        </>
      );
    }
    return (
      <>
        <Login onSignupClick={() => setShowSignup(true)} />
        <InstallPWABanner />
      </>
    );
  }

  if (currentUser.isFirstLogin) {
    return <FirstTimeLogin />;
  }

  // All users see TeacherView with published content only
  return (
    <>
      <TeacherView />
      <InstallPWABanner />
    </>
  );
};

const App: React.FC = () => {
  return (
    <SessionProvider>
      <ToastProvider> {/* Wrap AppContent with ToastProvider */}
        <AppContent />
      </ToastProvider>
    </SessionProvider>
  );
};

export default App;