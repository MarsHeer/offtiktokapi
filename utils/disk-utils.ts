import fs from 'fs';
import https from 'node:https';
import path from 'path';
import { deletePost, fetchOldestPost } from './db-helpers';

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
  path: string,
  cookies?: string
): Promise<void> => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, {
      recursive: true,
    });
  }
  const file = fs.createWriteStream(path);

  let options = {};

  if (cookies) {
    options = {
      headers: {
        Credentials: 'same-origin',
        Cookie: cookies,
      },
    };
  }

  if (cookies) {
    console.log(`curl -v ${path} -H "Cookie: ${cookies}" "${url}"`);
  }

  return new Promise((resolve, reject) => {
    https
      .get(url, options, (response) => {
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            if (cookies) {
              console.log('Download completed!');
              console.log({ path: file.path });
            }
            resolve();
          });
        });
      })
      .on('error', (err) => {
        fs.unlink(path, () => {});
        console.error(`Error downloading the file: ${err.message}`);
        reject(err);
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
  console.log('Cleaning up');
  const MAX_SIZE = 25 * 1024 * 1024 * 1024; // 25GB in bytes
  const publicFolderPath = './public';

  function deleteFilesAndDirectories(
    tiktokID: string,
    type: string,
    id: number
  ) {
    if (type === 'video') {
      console.log('Deleting video,' + tiktokID);
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
      const hlsDirPath = path.join(publicFolderPath, 'hls', tiktokID);

      if (fs.existsSync(videoFilePath)) {
        fs.rmSync(videoFilePath);
      }

      if (fs.existsSync(thumbnailFilePath)) {
        fs.rmSync(thumbnailFilePath);
      }

      if (fs.existsSync(hlsDirPath)) {
        fs.rmSync(hlsDirPath, { recursive: true });
      }
    } else if (type === 'carousel') {
      console.log('Deleting carousel, ' + tiktokID);
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
    console.log({
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
