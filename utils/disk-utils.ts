import fs from 'fs';
import https from 'node:https';
import path from 'path';
import { deletePost, fetchOldestPost } from './db-helpers';
import logger from './logger';
import { spawn } from 'child_process';

// Ensure the directory exists before writing the file
export const ensureDirectoryExistence = (filePath: string) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
  return true;
};

export const downloadFileHelper = async (
  url: string,
  dirPath: string,
  filePath: string,
  cookies?: string
): Promise<void> => {
  ensureDirectoryExistence(filePath);

  return new Promise((resolve, reject) => {
    const args = [
      url,
      '-o',
      filePath,
      '--no-part', // Avoid .part files for atomicity
      '--no-mtime', // Don't preserve mtime
    ];
    // Uncomment below to use cookies (yt-dlp expects a cookies.txt file)
    // if (cookies) {
    //   const cookiesFile = path.join(dirPath, 'cookies.txt');
    //   fs.writeFileSync(cookiesFile, cookies, 'utf8');
    //   args.push('--cookies', cookiesFile);
    // }
    logger.info(`[yt-dlp] Command: yt-dlp ${args.map(a => JSON.stringify(a)).join(' ')}`);
    const ytDlp = spawn('yt-dlp', args);

    ytDlp.stdout.on('data', (data) => {
      logger.info(`[yt-dlp stdout] ${data}`);
    });
    ytDlp.stderr.on('data', (data) => {
      logger.info(`[yt-dlp stderr] ${data}`);
    });
    ytDlp.on('error', (err) => {
      logger.error(`yt-dlp process error: ${err.message}`);
      reject(err);
    });
    ytDlp.on('close', (code, signal) => {
      logger.info(`[yt-dlp] exited with code ${code}, signal ${signal}`);
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`yt-dlp exited with code ${code}, signal ${signal}`));
      }
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
