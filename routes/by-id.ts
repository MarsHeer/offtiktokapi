import { RequestHandler } from 'express';
import {
  createSession,
  fetchPostById,
  fetchSessionByToken,
} from '../utils/db-helpers';
import { downloadPostByUrl } from '../utils/tiktok-api-wrappers';

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

    const postData = await fetchPostById(parseInt(id));

    if (postData && !(postData instanceof Error)) {
      if (postData.deleted && postData.originalURL.length > 0) {
        // We delete post files for storage reasons, if a post is deleted, we re-fetch it.
        await downloadPostByUrl(postData.originalURL, postData.id);
      }
      res.send(postData);
      return;
    } else {
      console.log(postData);
      res.status(500).send({
        error: 'Video is unavailable',
      });
      return;
    }
  } catch (error) {
    return res.status(500).send({ error: 'Something went wrong' });
  }
};
