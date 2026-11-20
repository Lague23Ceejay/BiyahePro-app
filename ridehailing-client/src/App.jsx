// ridehailing-client/src/App.jsx
import { useEffect, useState } from 'react';
import AdminPage from './pages/admin/AdminPage';
import PassengerHome from './pages/passenger/PassengerHome';

export default function App() {
  const [isAdmin, setIsAdmin] = useState(() => window.location.hash === '#admin');

  useEffect(() => {
    const handleHashChange = () => setIsAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    let robots = document.head.querySelector('meta[name="robots"]');
    if (isAdmin) {
      document.title = 'BiyahePro Admin';
      if (!robots) {
        robots = document.createElement('meta');
        robots.name = 'robots';
        document.head.appendChild(robots);
      }
      robots.content = 'noindex, nofollow';
    } else {
      robots?.remove();
    }
  }, [isAdmin]);

  return isAdmin ? <AdminPage /> : <PassengerHome />;
}