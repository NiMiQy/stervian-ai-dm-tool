const sessionKey = 'stervian_mock_session';
const demoAccount = { username: 'admin', password: '123' };

export function signIn(username, password) {
  if (username !== demoAccount.username || password !== demoAccount.password) return false;
  localStorage.setItem(sessionKey, demoAccount.username);
  return true;
}

export function isSignedIn() { return localStorage.getItem(sessionKey) === demoAccount.username; }
export function signOut() { localStorage.removeItem(sessionKey); }
