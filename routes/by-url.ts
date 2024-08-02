import { RequestHandler } from 'express';
import {
  downloadPostByUrl,
  fetchPostByUrlAndMode,
  URL_SANS_BOGUS,
} from '../utils/tiktok-api-wrappers';
import { checkAndCleanPublicFolder } from '../utils/disk-utils';

export const getVideoByUrl: RequestHandler = async (req, res) => {
  try {
    const { url } = req.params;
    const postData = await fetchPostByUrlAndMode(
      url,
      URL_SANS_BOGUS.FETCH_POST
    );

    if (postData && !(postData instanceof Error)) {
      if (postData.deleted) {
        // We delete post files for storage reasons, if a post is deleted, we re-fetch it.
        await downloadPostByUrl(
          postData.originalURL.length > 0 ? postData.originalURL : url,
          postData.id
        );
      }
      res.send(postData);
      return;
    } else {
      console.log(postData);
      res.status(500).send({
        error: 'Video is unavailable',
      });
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
