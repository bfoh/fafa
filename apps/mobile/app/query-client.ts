import { QueryClient } from '@tanstack/react-query';

/**
 * Ghana-tuned QueryClient: offline-first, gentle backoff, long cache retention so
 * a cold launch with no signal still renders the last menu/order from disk.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'offlineFirst', // serve cache first, fetch when reachable
      staleTime: 60_000, // menu fresh 1 min → fewer requests on metered data
      gcTime: 1000 * 60 * 60 * 24 * 7, // keep 7 days for offline cold start
      refetchOnReconnect: true, // silent refresh when signal returns
      refetchOnWindowFocus: false, // avoid refetch storms on app resume
      retry: 4,
      retryDelay: (n) => Math.min(1000 * 2 ** n, 15_000), // backoff, cap 15s for 2G
    },
    mutations: {
      networkMode: 'offlineFirst',
    },
  },
});
