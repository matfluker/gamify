import React from 'react';
import QuizOrTest from './QuizOrTest.jsx';
import { QUIZ_LENGTH } from '../config.js';

export default function QuizzesTab({ game, pairs, onGoToLeaderboard }) {
  return <QuizOrTest game={game} pairs={pairs} kind="quiz" length={QUIZ_LENGTH} onGoToLeaderboard={onGoToLeaderboard} />;
}
