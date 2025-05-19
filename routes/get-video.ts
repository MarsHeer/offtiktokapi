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
import logger from '../utils/logger';

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
    logger.info('Running quickfetch');

    const fetchRelatedPosts = await getRelatedPosts(url, userSession?.token);
    logger.info({
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
      logger.info('Error cleaning public folder');
    });
  }
};

export const getVideo: RequestHandler = async (req, res) => {
  try {
    const { url } = req.params;
    logger.info('Running quickfetch');
    const quickFetch = await downloadThroughFetch(url);
    logger.info({
      quickFetch,
    });
    if (quickFetch && !(quickFetch instanceof Error)) {
      logger.info('Quickfetch successful');
      logger.info('Post already exists');
      logger.info(quickFetch.id);
      logger.info('Is deleted: ', quickFetch.deleted);
      if (quickFetch.deleted) {
        logger.info("Fetching post again because it's deleted");
        const post = await justFetchPost(
          quickFetch.originalURL.length > 0 ? quickFetch.originalURL : url
        );
        logger.info('Post fetched');
        logger.info({
          post,
        });
      }
      res.send(quickFetch);
      return;
    } else {
      logger.info('Quickfetch failed, fetching by URL');
      logger.info(quickFetch);
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
        logger.info('Post already exists');
        res.send(findPost);
        return;
      } else {
        logger.info('Post does not exist, creating');
        const newPost = await getPost(url, postData);
        logger.info({
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
      logger.info('Error cleaning public folder');
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
      logger.info('Post already exists');
      logger.info(findPost.id);
      logger.info('Is deleted: ', findPost.deleted);
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
      logger.info('Post does not exist');
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
      logger.info('Error cleaning public folder');
    });
  }
};
