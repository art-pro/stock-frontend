import Cookies from 'js-cookie';

export const isAuthenticated = (): boolean => {
  return !!Cookies.get('token');
};

export const setToken = (token: string): void => {
  Cookies.set('token', token, { expires: 1 }); // 1 day
};

export const removeToken = (): void => {
  Cookies.remove('token');
};

export const getToken = (): string | undefined => {
  return Cookies.get('token');
};

