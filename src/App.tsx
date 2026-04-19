import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { useAuth } from './features/auth/hooks/useAuth';
import { usePermissionSubscription } from './hooks/usePermissionSubscription';

function App() {
  // Initialize auth listener
  useAuth();
  // Initialize feature-permission subscriptions (writes resolved permissions into permissionsStore)
  usePermissionSubscription();

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
