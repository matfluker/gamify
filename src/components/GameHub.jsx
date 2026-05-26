import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import Monogram from './Monogram.jsx';
import CreateGame from './CreateGame.jsx';
import JoinGame from './JoinGame.jsx';
import Loading from './Loading.jsx';

export default function GameHub({ user, onPick, onLogout }) {
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // list | create | join

  async function load() {
    setLoading(true);
    try {
      const { games } = await api.get('/api/me/games');
      setGames(games || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (view === 'create') return <CreateGame onCancel={() => setView('list')} onCreated={(g) => onPick(g.id)} />;
  if (view === 'join')   return <JoinGame   onCancel={() => setView('list')} onJoined={(g) => onPick(g.id)} />;

  return (
    <div className="hub">
      <header className="hub-header">
        <div className="brand"><div className="brand-mono">G</div><div className="brand-title">Gamify</div></div>
        <button className="btn btn-ghost" onClick={onLogout}>Log out</button>
      </header>
      <main className="hub-main">
        <h1 className="hub-greeting">Hi, {user.first_name}.</h1>
        <p className="hub-sub">Pick a game or start a new one.</p>

        <div className="hub-actions">
          <button className="btn btn-primary" onClick={() => setView('create')}>+ Create new Gamify</button>
          <button className="btn btn-secondary" onClick={() => setView('join')}>Join with code</button>
        </div>

        <div className="game-list">
          {loading ? <Loading />
            : games.length === 0
              ? <div className="empty">No games yet. Create one or join with a code.</div>
              : games.map(g => (
                <button key={g.id} className="game-card" onClick={() => onPick(g.id)}>
                  <Monogram name={g.title} size={56} />
                  <div className="game-card-text">
                    <div className="game-title">{g.title}</div>
                    <div className="game-meta">Code: {g.share_code}</div>
                  </div>
                </button>
              ))}
        </div>
      </main>
    </div>
  );
}
