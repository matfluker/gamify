import React, { useState } from 'react';

// Build the magic invite link. The route `/?invite=CODE` is read by App.jsx on
// load and short-circuits the friend straight into the name+phone screen.
export function buildInviteLink(shareCode) {
  if (typeof window === 'undefined') return `/?invite=${shareCode}`;
  const u = new URL(window.location.origin);
  u.searchParams.set('invite', shareCode);
  return u.toString();
}

export default function InviteFriends({ game, compact = false }) {
  const [copied, setCopied] = useState(false);
  const link = buildInviteLink(game.share_code);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Fallback: select the input and let the user copy manually.
    }
  }

  function share() {
    if (navigator.share) {
      navigator.share({
        title: `Join ${game.title} on Gamify`,
        text: `Join my Gamify game "${game.title}".`,
        url: link,
      }).catch(() => {});
    } else {
      copy();
    }
  }

  return (
    <div className={`invite-card ${compact ? 'compact' : ''}`}>
      <h3 className="invite-title">Invite friends</h3>
      <div className="invite-link-row">
        <input className="text-input invite-link-input" readOnly value={link}
          onFocus={(e) => e.target.select()} />
        <button className="btn btn-primary" onClick={copy}>{copied ? 'Copied!' : 'Copy link'}</button>
      </div>
      {typeof navigator !== 'undefined' && navigator.share ? (
        <button className="btn btn-secondary invite-share" onClick={share}>Share…</button>
      ) : null}
      <div className="invite-code-line">
        Or share the code: <b>{game.share_code}</b>
      </div>
    </div>
  );
}
