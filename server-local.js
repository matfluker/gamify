// Local-only entry: binds the Express app to a port. Vercel never runs this;
// it imports api/index.js directly as a serverless function.
import 'dotenv/config';
import app from './api/_app.js';

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`[gamify] API listening on http://localhost:${port}`);
});
