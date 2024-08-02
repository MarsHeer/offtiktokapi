import { RequestHandler } from 'express';
import {
  createSession,
  fetchSessionByToken,
  updateSession,
} from '../utils/db-helpers';
import {
  downloadPostByUrl,
  fetchPostByUrlAndMode,
  URL_SANS_BOGUS,
} from '../utils/tiktok-api-wrappers';
import { checkAndCleanPublicFolder } from '../utils/disk-utils';

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
    const postData = await fetchPostByUrlAndMode(
      url,
      URL_SANS_BOGUS.RELATED_POSTS,
      userSession?.token
    );

    if (!postData || postData instanceof Error) {
      return res.status(500).send({ error: 'Something went wrong' });
    }

    if (userSession) {
      await updateSession(userSession.token, postData.tiktokId);
    }

    if (postData && !(postData instanceof Error)) {
      if (postData.deleted) {
        // We delete post files for storage reasons, if a post is deleted, we re-fetch it.
        const post = await downloadPostByUrl(
          postData.originalURL.length > 0 ? postData.originalURL : url,
          postData.id
        );
      }
      res.send(postData);
      return;
    } else {
      res.status(500).send({
        error: 'Video is unavailable',
      });
    }
    res.send(postData);
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
