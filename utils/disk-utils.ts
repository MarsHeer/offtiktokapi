import fs from 'fs';
import https from 'node:https';
import http from 'node:http';
import path from 'path';
import { deletePost, fetchOldestPost } from './db-helpers';
import logger from './logger';

// Ensure the directory exists before writing the file
export const ensureDirectoryExistence = (filePath: string) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
  return true;
};

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

export const downloadFileHelper = async (
  url: string,
  dirPath: string,
  filePath: string,
  cookies?: string
): Promise<void> => {
  ensureDirectoryExistence(filePath);

  // Delete any existing partial download
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  const headers = {
    'User-Agent': USER_AGENT,
    Accept: '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity', // Prevent gzip to avoid corruption
    Connection: 'keep-alive',
    Range: 'bytes=0-', // Support range requests
    Referer: 'https://www.tiktok.com/',
    ...(cookies ? { Cookie: cookies } : {}),
  };

  return new Promise((resolve, reject) => {
    const handleResponse = (response: http.IncomingMessage) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (!redirectUrl) {
          reject(new Error('Redirect location not found'));
          return;
        }
        logger.info(`Following redirect to: ${redirectUrl}`);
        const redirectReq = https.get(redirectUrl, { headers }, handleResponse);
        redirectReq.on('error', reject);
        return;
      }

      // Check content type
      const contentType = response.headers['content-type'];
      if (
        !contentType?.includes('video') &&
        !contentType?.includes('audio') &&
        !contentType?.includes('image')
      ) {
        reject(new Error(`Unexpected content type: ${contentType}`));
        return;
      }

      // Check content length
      const contentLength = parseInt(
        response.headers['content-length'] || '0',
        10
      );
      if (contentLength === 0) {
        reject(new Error('Content length is 0'));
        return;
      }

      logger.info(`Downloading file: ${filePath}`);
      logger.info(`Content-Type: ${contentType}`);
      logger.info(`Content-Length: ${contentLength} bytes`);

      const file = fs.createWriteStream(filePath);
      let downloadedBytes = 0;

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (downloadedBytes % (1024 * 1024) === 0) {
          // Log every MB
          logger.info(
            `Downloaded: ${(downloadedBytes / (1024 * 1024)).toFixed(2)}MB`
          );
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close(() => {
          // Verify file size
          const finalSize = fs.statSync(filePath).size;
          if (contentLength > 0 && finalSize !== contentLength) {
            fs.unlinkSync(filePath);
            reject(
              new Error(
                `File size mismatch. Expected: ${contentLength}, Got: ${finalSize}`
              )
            );
            return;
          }
          logger.info(`Download completed: ${filePath}`);
          logger.info(
            `Final size: ${(finalSize / (1024 * 1024)).toFixed(2)}MB`
          );
          resolve();
        });
      });

      file.on('error', (err) => {
        fs.unlink(filePath, () => {});
        reject(err);
      });
    };

    const request = https.get(url, { headers }, handleResponse);
    request.on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });

    // Set a timeout
    request.setTimeout(30000, () => {
      request.destroy();
      fs.unlink(filePath, () => {});
      reject(new Error('Download timeout'));
    });
  });
};

function getFileSize(filePath: string): number {
  const stats = fs.statSync(filePath);
  return stats.size;
}

function getFolderSize(folderPath: string): number {
  let totalSize = 0;

  function calculateFolderSize(currentPath: string) {
    const files = fs.readdirSync(currentPath);

    files.forEach((file) => {
      const filePath = path.join(currentPath, file);
      const stats = fs.statSync(filePath);

      if (stats.isDirectory()) {
        calculateFolderSize(filePath);
      } else {
        totalSize += stats.size;
      }
    });
  }

  calculateFolderSize(folderPath);
  return totalSize;
}

export async function checkAndCleanPublicFolder() {
  logger.info('Cleaning up');
  const MAX_SIZE = 25 * 1024 * 1024 * 1024; // 25GB in bytes
  const publicFolderPath = './public';

  function deleteFilesAndDirectories(
    tiktokID: string,
    type: string,
    id: number
  ) {
    if (type === 'video') {
      logger.info('Deleting video,' + tiktokID);
      const videoFilePath = path.join(
        publicFolderPath,
        'videos',
        `${tiktokID}.mp4`
      );
      const thumbnailFilePath = path.join(
        publicFolderPath,
        'thumbnails',
        `${tiktokID}.jpg`
      );

      if (fs.existsSync(videoFilePath)) {
        fs.rmSync(videoFilePath);
      }

      if (fs.existsSync(thumbnailFilePath)) {
        fs.rmSync(thumbnailFilePath);
      }
    } else if (type === 'carousel') {
      logger.info('Deleting carousel, ' + tiktokID);
      const audioFilePath = path.join(
        publicFolderPath,
        'audio',
        `${tiktokID}.mp4`
      );
      const imagesDirPath = path.join(publicFolderPath, 'images', tiktokID);

      if (fs.existsSync(audioFilePath)) {
        fs.rmSync(audioFilePath);
      }
      if (fs.existsSync(imagesDirPath)) {
        fs.rmSync(imagesDirPath, { recursive: true });
      }
    }
    deletePost(id);
  }

  async function cleanFolder() {
    const folderSize = getFolderSize(publicFolderPath);
    logger.info({
      folderSize,
      MAX_SIZE,
    });
    if (folderSize > MAX_SIZE) {
      const oldestPost = await fetchOldestPost();
      if (oldestPost) {
        deleteFilesAndDirectories(
          oldestPost.tiktokId,
          oldestPost.type,
          oldestPost.id
        );
        await cleanFolder(); // Recursively check and clean again
      }
    }
  }

  await cleanFolder();
}
