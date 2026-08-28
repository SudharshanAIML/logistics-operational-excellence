export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || 'http://localhost:8000';

export const WS_BASE_URL: string =
  (import.meta.env.VITE_WS_BASE_URL as string | undefined) || 'ws://localhost:8000';
