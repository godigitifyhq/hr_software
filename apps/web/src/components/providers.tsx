"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider, ToastViewport } from "@/components/ui/Toast";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,        // data fresh for 1 minute — no refetch on navigation
        gcTime: 5 * 60 * 1000,       // keep unused data in cache for 5 minutes
        retry: 1,                     // one retry on failure, not the default 3
        refetchOnWindowFocus: false,  // don't refetch when user alt-tabs back
        refetchOnReconnect: true,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
        <ToastViewport />
      </ToastProvider>
    </QueryClientProvider>
  );
}
