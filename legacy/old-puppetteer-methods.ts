import { randomUUID } from 'crypto';
import 'dotenv/config';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { Browser } from 'puppeteer';
import {
  createAuthor,
  createCarousel,
  createPost,
  createVideo,
  fetchPostByTiktokId,
  findAuthorByTiktokId,
} from '../utils/db-helpers';
import { getBrowser } from './puppeteer';
//import { convertToHLS, extractThumbnail } from "./video-processing";

const tiktoks = [
  //video
  'https://vm.tiktok.com/ZGenyvvC7/',
  //photos
  'https://vm.tiktok.com/ZGenP47o1/',
];

type ParsedURL = {
  isPhoto: boolean;
  isVideo: boolean;
  tiktokId: string;
  url: string;
  username: string;
};

async function downloadFile(
  url: string,
  dirPath: string,
  path: string,
  cookies?: {
    name: string;
    value: string;
  }[]
) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, {
      recursive: true,
    });
  }
  const file = fs.createWriteStream(path);

  let options = {};

  if (cookies) {
    const cookieHeader = cookies
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join('; ');

    options = {
      headers: {
        Cookie: cookieHeader,
      },
    };
  }

  if (cookies) {
    console.log(
      `curl -v ${path} -H "Cookie: ${cookies?.map(
        (cookie) => `${cookie.name}=${cookie.value}`
      )}" ${url}`
    );
  }

  return https
    .get(url, options, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          if (cookies) {
            console.log('Download completed!');
          }
        });
      });
    })
    .on('error', (err) => {
      fs.unlink(path, () => {});
      console.error(`Error downloading the file: ${err.message}`);
    });
}

async function getVideo(
  url: string,
  id: string,
  authorId: number,
  browser: Browser,
  originalURL: string
) {
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on('request', async (request) => {
    console.log('Request event triggered');
    if (request.resourceType() === 'media') {
      console.log('Media request detected');
      const requestURL = request.url();
      console.log('Request URL:', requestURL);
      const cookies = await page.cookies();
      console.log('Cookies:', cookies);
      const videoPath = `./public/videos/${id}.mp4`;
      const videoDirPath = path.join(__dirname, '..', 'public', 'videos');
      console.log('Video path:', videoPath);
      console.log('Video directory path:', videoDirPath);
      downloadFile(requestURL, videoDirPath, videoPath, cookies);
      request.abort();
    } else {
      request.continue();
    }
  });

  await page.goto(url, {
    waitUntil: 'networkidle2',
  });

  const postDesc = await page.evaluate(() => {
    return document.querySelector('[data-e2e="browse-video-desc"]')
      ?.textContent;
  });

  /* extractThumbnail(
    `./public/videos/${id}.mp4`,
    `./public/thumbnails/${id}.jpg`,
    (err, output) => {
      if (err) {
        console.log(err);
      } else {
        console.log("Thumbnail saved to:", output);
      }
    }
  );

  convertToHLS(
    `./public/videos/${id}.mp4`,
    `./public/hls/${id}`,
    (err, output) => {
      if (err) {
        console.log(err);
      } else {
        console.log("HLS saved to:", output);
      }
    }
  ); */

  const post = await createPost({
    authorId,
    type: 'video',
    tiktokId: id,
    postDesc: postDesc || undefined,
    originalURL,
  });

  const newVideo = await createVideo({
    mp4video: `/videos/${id}.mp4` /* 
    hlsVideo: `/hls/${id}/output.m3u8`,
    thumbnail: `/thumbnails/${id}.jpg`, */,
    postId: post.id,
  });

  await page.close();

  return await fetchPostByTiktokId(id);
}

async function getUserData(url: string, browser: Browser) {
  const page = await browser.newPage();
  await page.goto(url, {
    waitUntil: 'networkidle0',
  });

  const handle = new URL(url).pathname.split('/')[1].replace('@', '');

  const { profilePicture, authorAt, authorId, authorName } =
    await page.evaluate(() => {
      const profileData = JSON.parse(
        document.querySelector('#ProfilePage')?.innerHTML || '{}'
      );

      const userId = new URL(profileData.mainEntity.image).searchParams.get(
        'userId'
      );

      return {
        authorId: userId,
        authorAt: profileData.mainEntity.alternateName,
        authorName: profileData.mainEntity.name,
        profilePicture: document
          .querySelector('[data-e2e="user-avatar"]')
          ?.querySelector('img')?.src,
      };
    });

  let authorInternalID: number | undefined;

  if (authorId) {
    const author = await findAuthorByTiktokId(authorId);

    const profilePicturePath = `./public/authors/${authorId}.jpg`;
    const profilePictureDirPath = path.join(
      __dirname,
      '..',
      'public',
      'authors'
    );

    if (profilePicture) {
      await downloadFile(
        profilePicture,
        profilePictureDirPath,
        profilePicturePath
      );
    }
    if (!author && authorName && profilePicture) {
      const createdAuthor = await createAuthor(
        authorId,
        authorName,
        profilePicturePath.replace('./public', ''),
        handle
      );
      authorInternalID = createdAuthor.id;
    } else if (author) {
      authorInternalID = author.id;
    }
  }

  return { profilePicture, authorAt, authorId, authorName, authorInternalID };
}

async function getImages(
  audio: string | undefined,
  urls: string[],
  id: string,
  authorId: number,
  originalURL: string,
  postDesc?: string
) {
  const images = await Promise.all(
    urls.map(async (url, index) => {
      const dirPath = path.join(__dirname, '..', 'public', 'images', id);
      const pathName = `./public/images/${id}/${index}.jpg`;
      const fileDownload = await downloadFile(url, dirPath, pathName);
      if (fileDownload.errored) {
        console.log('Error downloading file');
        return;
      }
      return pathName.replace('./public', '');
    })
  );
  const dirPath = path.join(__dirname, '..', 'public', 'audio');
  const filePath = `./public/audio/${id}.mp4`;

  if (audio) {
    downloadFile(audio, dirPath, filePath);
    const post = await createPost({
      authorId,
      type: 'photo',
      tiktokId: id,
      postDesc: postDesc || undefined,
      originalURL,
    });

    await createCarousel({
      audio: filePath.replace('./public', ''),
      images: images.toString(),
      postId: post.id,
    });
  }

  return await fetchPostByTiktokId(id);
}

export async function parsePostURL(post: string): Promise<ParsedURL> {
  const parsePost = new URL(post);
  const browser = await getBrowser();
  if (
    !(
      parsePost.hostname.includes('.tiktok.com') ||
      parsePost.hostname.includes('tiktok.com')
    )
  ) {
    throw new Error('Invalid URL');
  }

  const page = await browser.newPage();

  await page.goto(post, {
    waitUntil: 'domcontentloaded',
  });

  const url = page.url();

  const parseURL = new URL(url);
  const splitURL = parseURL.pathname.split('/');

  const isVideo = splitURL.indexOf('video') !== -1;
  const isPhoto = splitURL.indexOf('photo') !== -1;
  const id = splitURL.at(-1) || randomUUID();
  const username = splitURL[1].replace('@', '');

  page.close();
  return {
    isPhoto,
    isVideo,
    tiktokId: id,
    url,
    username,
  };
}

export async function getPost(post: string, parsedURL: ParsedURL) {
  console.log('Getting post');
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.goto(post, {
    waitUntil: 'networkidle2',
  });

  const { isPhoto, isVideo, tiktokId, url, tiktokId: id, username } = parsedURL;
  console.log('Fetching user data');
  const userData = await getUserData(
    `https://tiktok.com/@${username}`,
    browser
  );

  console.log(userData);

  if (isVideo) {
    await page.close();
    console.log('Get video');
    return await getVideo(
      url,
      id,
      userData?.authorInternalID || 0,
      browser,
      post
    );
  } else if (isPhoto) {
    console.log('Get images');
    const { imageURLS, audioURL, postDesc } = await page.evaluate(() => {
      const imageEls = document.querySelectorAll(
        '.swiper-slide:not(.swiper-slide-duplicate) > img'
      );

      const audioEl = document.querySelector('audio');

      return {
        imageURLS: Array.from(imageEls)
          .filter((t: Element | null): t is HTMLImageElement => {
            return t instanceof HTMLImageElement;
          })
          .map((image) => image.src),
        audioURL: audioEl?.src,
        postDesc: document.querySelector('[data-e2e="browse-video-desc"]')
          ?.textContent,
      };
    });

    await page.close();
    return await getImages(
      audioURL,
      imageURLS,
      id,
      userData?.authorInternalID || 0,
      post,
      postDesc || undefined
    );
  } else {
    await page.close();

    return {
      error: 'Invalid URL',
    };
  }
}
