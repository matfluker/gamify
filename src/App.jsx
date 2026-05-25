import React, { useEffect, useState } from 'react';
import {
  getCurrentUser, setCurrentUser, getCurrentGameId, setCurrentGameId, onAuthChange, logout,
} from './auth.js';
import LoginScreen from './components/LoginScreen.jsx';
import CompleteProfile from './components/CompleteProfile.jsx';
import GameHub from './components/GameHub.jsx';
import GameShell from './components/GameShell.jsx';
import InviteJoin from './components/InviteJoin.jsx';

function readInviteCodeFromUrl() {
  if (typeof window === 'undefined') return null;
  try {
    const u = new URL(window.location.href);
    const code = (u.searchParams.get('invite') || '').trim().toUpperCase();
    return code || null;
  } catch { return null; }
}

function clearInviteFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const u = new URL(window.location.href);
    u.searchParams.delete('invite');
    window.history.replaceState({}, '', u.toString());
  } catch {}
}

export default function App() {
  const [user, setUser] = useState(getCurrentUser());
  const [gameId, setGameId] = useState(getCurrentGameId());
  const [inviteCode, setInviteCode] = useState(readInviteCodeFromUrl());
  const [, force] = useState(0);

  useEffect(() => onAuthChange(() => {
    setUser(getCurrentUser());
    setGameId(getCurrentGameId());
    force(x => x + 1);
  }), []);

  // Magic invite link short-circuits both the login screen and the code-entry
  // step. The invite component handles login-or-create + enroll in one shot.
  if (inviteCode) {
    return (
      <InviteJoin
        shareCode={inviteCode}
        onJoined={(u, game) => {
          setCurrentUser(u);
          setCurrentGameId(game.id);
          clearInviteFromUrl();
          setInviteCode(null);
        }} />
    );
  }

  if (!user) {
    return <LoginScreen onSignedIn={(u) => { setCurrentUser(u); }} />;
  }
  if (!user.first_name || !user.last_name) {
    return <CompleteProfile user={user} onDone={(u) => setCurrentUser(u)} />;
  }
  if (!gameId) {
    return <GameHub user={user} onPick={(id) => setCurrentGameId(id)} onLogout={logout} />;
  }
  return (
    <GameShell
      user={user}
      gameId={gameId}
      onSwitchGame={() => setCurrentGameId(null)}
      onLogout={logout}
    />
  );
}
