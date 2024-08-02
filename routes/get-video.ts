import 'dotenv/config';
import { RequestHandler } from 'express';
import {
  createSession,
  fetchPostById,
  fetchSessionByToken,
  openDb,
  updateSession,
} from '../utils/db-helpers';
import {
  downloadThroughFetch,
  getRelatedPosts,
  justFetchPost,
} from '../legacy/old-fetching-helpers';
import { checkAndCleanPublicFolder } from '../utils/disk-utils';

const tiktoks = [
  //video
  'https://vm.tiktok.com/ZGen9qNGP/',
  //photos
  'https://vm.tiktok.com/ZGenP47o1/',
];
openDb();

export const getRelatedVideos: RequestHandler = async (req, res) => {
  try {
    const { url } = req.params;
    const { sessiontoken } = req.headers;
    let sessionParsed =
      typeof sessiontoken === 'string'
        ? sessiontoken
        : sessiontoken
        ? sessiontoken[0]
        : null;
    let userSession;
    if (typeof sessionParsed === 'string') {
      userSession = await fetchSessionByToken(sessionParsed);
      if (!userSession) {
        userSession = await createSession(sessionParsed);
      }
    }
    console.log('Running quickfetch');

    const fetchRelatedPosts = await getRelatedPosts(url, userSession?.token);
    console.log({
      fetchRelatedPosts,
    });
    if (!fetchRelatedPosts || fetchRelatedPosts instanceof Error) {
      return res.status(500).send({ error: 'Something went wrong' });
    }
    if (userSession) {
      await updateSession(userSession.token, fetchRelatedPosts.tiktokId);
    }
    res.send(fetchRelatedPosts);
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).send({
        error: error.message,
      });
    } else {
      res.status(500).send({ error: 'Something went wrong' });
    }
  } finally {
    checkAndCleanPublicFolder().catch(() => {
      console.log('Error cleaning public folder');
    });
  }
};

export const getVideo: RequestHandler = async (req, res) => {
  try {
    const { url } = req.params;
    console.log('Running quickfetch');
    const quickFetch = await downloadThroughFetch(url);
    console.log({
      quickFetch,
    });
    if (quickFetch && !(quickFetch instanceof Error)) {
      console.log('Quickfetch successful');
      console.log('Post already exists');
      console.log(quickFetch.id);
      console.log('Is deleted: ', quickFetch.deleted);
      if (quickFetch.deleted) {
        console.log("Fetching post again because it's deleted");
        const post = await justFetchPost(
          quickFetch.originalURL.length > 0 ? quickFetch.originalURL : url
        );
        console.log('Post fetched');
        console.log({
          post,
        });
      }
      res.send(quickFetch);
      return;
    } else {
      console.log('Quickfetch failed, fetching by URL');
      console.log(quickFetch);
      res.status(500).send({
        error: 'Video is unavailable',
      });
    }
    /* Comment back in to enable TikTok fetching through Puppeteer
    const postData = await parsePostURL(url);
    if (postData && !(postData instanceof Error)) {
      const { tiktokId, url } = postData;

      if (!tiktokId) {
        res.status(500).send({
          error: 'Something went wrong',
        });
        return;
      }
      const findPost = await fetchPostByTiktokId(tiktokId);

      if (findPost) {
        console.log('Post already exists');
        res.send(findPost);
        return;
      } else {
        console.log('Post does not exist, creating');
        const newPost = await getPost(url, postData);
        console.log({
          newPost,
        });
        res.send(newPost);
      }
    } else {
      res.status(500).send({
        error: 'Invalid URL',
      });
     }*/
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).send({
        error: error.message,
      });
    } else {
      res.status(500).send({ error: 'Something went wrong' });
    }
  } finally {
    checkAndCleanPublicFolder().catch(() => {
      console.log('Error cleaning public folder');
    });
  }
};

export const getVideoById: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { sessiontoken } = req.headers;
    let sessionParsed =
      typeof sessiontoken === 'string'
        ? sessiontoken
        : sessiontoken
        ? sessiontoken[0]
        : null;
    let userSession;
    if (typeof sessionParsed === 'string') {
      userSession = await fetchSessionByToken(sessionParsed);
      if (!userSession) {
        userSession = await createSession(sessionParsed);
      }
    }

    const findPost = await fetchPostById(parseInt(id));

    if (findPost) {
      console.log('Post already exists');
      console.log(findPost.id);
      console.log('Is deleted: ', findPost.deleted);
      if (findPost.deleted && findPost.originalURL) {
        await justFetchPost(findPost.originalURL);
      } else if (findPost.deleted && !findPost.originalURL.length) {
        res.status(400).send({
          error: 'File not found',
        });
        return;
      } else {
        if (sessionParsed) {
          const findSession = await fetchSessionByToken(sessionParsed);

          if (findSession) {
            await updateSession(findSession.token, findPost.tiktokId);
          } else {
            const newSession = await createSession(sessionParsed);
            await updateSession(newSession.token, findPost.tiktokId);
          }
        }
        res.send(findPost);
        return;
      }
    } else {
      console.log('Post does not exist');
      res
        .send({
          error: 'Post does not exist',
        })
        .status(404);
    }
  } catch (error) {
    if (error instanceof Error) {
      res.status(500).send({
        error: error.message,
      });
    } else {
      res.status(500).send({ error: 'Something went wrong' });
    }
  } finally {
    checkAndCleanPublicFolder().catch(() => {
      console.log('Error cleaning public folder');
    });
  }
};
