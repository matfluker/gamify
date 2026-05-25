import React from 'react';
import QuizOrTest from './QuizOrTest.jsx';
import { TEST_LENGTH } from '../config.js';

export default function TestsTab({ game, pairs, onGoToLeaderboard }) {
  return <QuizOrTest game={game} pairs={pairs} kind="test" length={TEST_LENGTH} onGoToLeaderboard={onGoToLeaderboard} />;
}
