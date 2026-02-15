import Cookies from 'js-cookie';

// Secure cookie options
const COOKIE_OPTIONS: Cookies.CookieAttributes = {
  expires: 1, // 1 day
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  sameSite: 'strict', // Prevent CSRF attacks
  path: '/', // Cookie available throughout the app
};

// Token cookie name - centralized for consistency
const TOKEN_COOKIE_NAME = 'token';

export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') {
    return false; // Server-side: assume not authenticated
  }
  return !!Cookies.get(TOKEN_COOKIE_NAME);
};

export const setToken = (token: string): void => {
  if (!token) {
    console.error('Invalid token provided');
    return;
  }
  Cookies.set(TOKEN_COOKIE_NAME, token, COOKIE_OPTIONS);
};

export const removeToken = (): void => {
  Cookies.remove(TOKEN_COOKIE_NAME, { path: '/' });
};

export const getToken = (): string | undefined => {
  if (typeof window === 'undefined') {
    return undefined; // Server-side: no token
  }
  return Cookies.get(TOKEN_COOKIE_NAME);
};

