import cors from 'cors';
import express from 'express';
import { fetchNewestPost } from './utils/db-helpers';
import { getVideoByUrl } from './routes/by-url';
import { getVideoById } from './routes/by-id';
import { getRelatedVideos } from './routes/get-video';

const app = express();
const port = 2000;

app.use(
  cors({
    origin: '*', // Allow only this origin
    methods: 'GET', // Allow these HTTP methods
    allowedHeaders: 'Content-Type,Authorization, sessiontoken', // Allow these headers
  })
);

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Welcome to the Share-Tok API!');
});

app.get('/by_url/:url', getVideoByUrl);

app.get('/by_id/:id', getVideoById);

app.get('/get_related/:url', getRelatedVideos);

app.get('/latest', async (req, res) => {
  const getLatest = await fetchNewestPost();

  res.send(getLatest);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
