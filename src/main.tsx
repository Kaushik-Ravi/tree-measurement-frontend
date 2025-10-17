// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import { Loader2, TreePine } from 'lucide-react';

const LoginPrompt = () => {
    const { signInWithGoogle } = useAuth();
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center text-center bg-gray-50 p-6">
        <TreePine className="w-16 h-16 text-green-600 mb-4" />
        <h1 className="text-3xl font-bold text-gray-800">Welcome to the Tree Measurement Tool</h1>
        <p className="mt-2 max-w-md text-gray-600">
          Sign in to begin measuring trees, identifying species, and tracking your results in a persistent measurement history.
        </p>
        <button 
          onClick={signInWithGoogle}
          className="mt-8 flex items-center gap-3 px-6 py-3 bg-green-700 text-white rounded-lg font-medium hover:bg-green-800 transition-transform active:scale-95 shadow-lg"
        >
          <svg className="w-5 h-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 381.5 512 244 512 110.3 512 0 398.8 0 256S110.3 0 244 0c69.8 0 130.8 28.5 173.4 74.5l-68.2 66.3C314.5 112.5 282.2 96 244 96c-83.2 0-151.2 67.2-151.2 150.2s68 150.2 151.2 150.2c97.7 0 128.8-72.2 132.3-108.9H244v-85.3h238.9c2.3 12.7 3.6 26.4 3.6 40.5z"></path></svg>
          Sign In with Google
        </button>
      </div>
    );
};

const AppGate = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPrompt />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  </StrictMode>
);