import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import './index.css';

// Create a client with production-optimised defaults.
// - staleTime: 2 min  — data is considered fresh for 2 minutes after fetch.
//   Real-time hooks (useRealtimeTable / useRealtimeQuery) call
//   queryClient.invalidateQueries() the moment the DB changes, so
//   window-focus refetches are 100% redundant.
// - gcTime: 10 min    — inactive cache entries held for 10 minutes so
//   navigating back to a page is instant.
// - refetchOnWindowFocus: false — prevented here; real-time handles it.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,   // 2 minutes
      gcTime:    10 * 60 * 1000,  // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
      {/* {import.meta.env.DEV && (
        // <ReactQueryDevtools initialIsOpen={false} buttonPosition="top-left" />
      )} */}
    </QueryClientProvider>
  </StrictMode>
);