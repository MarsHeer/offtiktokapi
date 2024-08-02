import fs, { watch } from 'fs';
import jsdom from 'jsdom';
import https from 'node:https';
import path from 'path';
import xbogus from 'xbogus';
import {
  createAuthor,
  createCarousel,
  createPost,
  createVideo,
  fetchPostByTiktokId,
  fetchSessionByToken,
  findAuthorByTiktokId,
  findVideoByMp4URL,
  findVideoByTiktokID,
  restorePost,
  updateVideo,
} from '../utils/db-helpers';
import { convertToHLS } from '../utils/video-processing';

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

type AnyObject = { [key: string]: any };

export const findObjectWithKey = (
  obj: AnyObject,
  key: string
): AnyObject | null => {
  if (obj.hasOwnProperty(key)) {
    return obj[key];
  }

  for (const k in obj) {
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      const result = findObjectWithKey(obj[k], key);
      if (result !== null) {
        return result;
      }
    }
  }

  return null;
};

// Ensure the directory exists before writing the file
const ensureDirectoryExistence = (filePath: string) => {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  fs.mkdirSync(dirname, { recursive: true });
  return true;
};

export const downloadThroughFetch = async (url: string) => {
  const userAgent =
    'Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.1';

  try {
    let parsedURL = new URL(url);
    const controller = new AbortController();
    const decodeURI = decodeURIComponent(url);
    console.log({
      decodeURI,
    });
    setTimeout(() => {
      controller.abort();
    }, 1000 * 5);
    let fetchContent = await fetch(decodeURI, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
      },
    });
    const fetchURL = fetchContent.url;
    console.log(fetchContent.url);
    if (
      fetchContent.status === 301 ||
      fetchContent.status === 302 ||
      fetchURL !== url
    ) {
      const redirectLocation =
        fetchContent.status === 301 || fetchContent.status === 302
          ? fetchContent.headers.get('location')
          : fetchURL;
      if (redirectLocation) {
        console.log('Redirected');
        parsedURL = new URL(redirectLocation);
        fetchContent = await fetch(redirectLocation, {
          headers: {
            'User-Agent': userAgent,
          },
        });
      }
    }
    const postId = parsedURL.pathname.split('/').at(-1);
    const findPost = await fetchPostByTiktokId(postId || '');
    if (findPost) {
      return findPost;
    }
    let cookies: string[] = [];
    for (let [key, value] of fetchContent.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        cookies.push(value);
      }
    }

    const textContent = await fetchContent.text();

    const dom = new jsdom.JSDOM(textContent);
    const rehydrationData = dom.window.document.querySelector(
      '#__UNIVERSAL_DATA_FOR_REHYDRATION__'
    )?.textContent;
    const jsonParseData = rehydrationData ? JSON.parse(rehydrationData) : null;

    if (!jsonParseData) {
      return new Error('No Data Found');
    }

    const deviceId = findObjectWithKey(jsonParseData, 'wid');
    const odinId = findObjectWithKey(jsonParseData, 'odinId');
    const webIdLastTime = findObjectWithKey(jsonParseData, 'webIdCreatedTime');
    const abTest = findObjectWithKey(jsonParseData, 'abTestVersion');
    const abTestVersions: string[] = abTest
      ? abTest.versionName.split(',')
      : [];
    const msToken = fetchContent.headers.get('x-ms-token');

    const urlWithoutBogus = `https://www.tiktok.com/api/item/detail/?WebIdLastTime=${webIdLastTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=${encodeURIComponent(
      userAgent
    )}&channel=tiktok_web&${abTestVersions.map(
      (version) => `clientABVersions${version}&`
    )}cookie_enabled=true&coverFormat=2&data_collection_enabled=true&device_id=${deviceId}&device_platform=web_pc&focus_state=true&from_page=user&history_len=1&is_fullscreen=false&is_page_visible=true&itemId=${postId}&language=en&odinId=${odinId}&os=mac&priority_region=ES&referer=&region=ES&screen_height=1117&screen_width=1728&tz_name=Europe%2FMadrid&user_is_login=true&verifyFp=verify_lws1fk3n_P0R9e85b_CSlT_4mNA_BBoR_9av0jRDDSXI0&webcast_language=en&msToken=${msToken}`;
    const xbogus_parameter = xbogus(urlWithoutBogus, userAgent);
    const formattedCookies = cookies.join('; ');

    const testFetch = await fetch(
      `${urlWithoutBogus}&X-Bogus=${xbogus_parameter}`,
      {
        headers: {
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9,es;q=0.8',
          'cache-control': 'no-cache',
          'User-Agent': userAgent,
          pragma: 'no-cache',
          priority: 'u=1, i',
          'sec-ch-ua': '"Chromium";v="127", "Not)A;Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          cookie: formattedCookies,
          Referer: parsedURL.toString(),
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        body: null,
        method: 'GET',
      }
    );
    const json = await testFetch.json();

    const itemInfo = findObjectWithKey(json, 'itemStruct');

    if (!itemInfo) {
      return new Error('No information found');
    }
    const declaredPostID = findObjectWithKey(
      itemInfo,
      'id'
    ) as unknown as string;
    const imageDetail = findObjectWithKey(itemInfo, 'imagePost');
    const videoDetail = findObjectWithKey(itemInfo, 'video');
    const authorDetails = findObjectWithKey(itemInfo, 'author');
    const authorId = authorDetails?.id;
    let findAuthor = await findAuthorByTiktokId(authorId);
    console.log({
      itemInfo,
      videoDetail,
    });
    if (authorDetails && !findAuthor) {
      const authorImagePath = `./public/authors/${authorId}.jpg`;
      const authorDirPath = path.join(process.cwd(), 'public', 'authors');

      await downloadFileHelper(
        authorDetails.avatarLarger,
        authorDirPath,
        authorImagePath
      );
      await createAuthor(
        authorId,
        authorDetails.nickname,
        authorImagePath.replace('./public', ''),
        authorDetails.uniqueId
      );
      findAuthor = await findAuthorByTiktokId(authorId);
    }

    if (imageDetail) {
      const music = findObjectWithKey(itemInfo, 'music')?.playUrl;
      const imageList: string[] = findObjectWithKey(imageDetail, 'images')
        ?.map((list: { imageURL: { urlList: string[] } }) =>
          list?.imageURL?.urlList ? list?.imageURL?.urlList[0] : null
        )
        .filter((image: string | null) => image !== null);

      const images = await Promise.all(
        imageList.map(async (url, index) => {
          const dirPath = path.join(
            process.cwd(),

            'public',
            'images',
            declaredPostID
          );
          const filePath = path.join(dirPath, `${index}.jpg`);

          // Ensure the directory exists
          if (ensureDirectoryExistence(filePath)) {
            console.log('I exist, download me');
            await downloadFileHelper(url, dirPath, filePath, formattedCookies);
            return filePath.split('/public')[1];
          } else {
            return null;
          }
        })
      );

      const audioFilePath = `./public/audio/${declaredPostID}.mp4`;
      if (music) {
        const dirPath = path.join(process.cwd(), 'public', 'audio');

        downloadFileHelper(music, dirPath, audioFilePath);
      }

      const postDesc = `${
        imageDetail.title ? `${imageDetail.title} | ` : ''
      } ${findObjectWithKey(itemInfo, 'desc')}`;

      const post = await createPost({
        authorId: findAuthor?.id || 0,
        type: 'photo',
        tiktokId: declaredPostID,
        postDesc: postDesc || undefined,
        originalURL: decodeURI,
      });

      await createCarousel({
        audio: audioFilePath.replace('./public', ''),
        images: images.filter((img) => img !== null).toString(),
        postId: post.id,
      });

      return await fetchPostByTiktokId(declaredPostID);
    } else if (videoDetail) {
      const playAddr = videoDetail.playAddr;

      if (playAddr) {
        const videoPath = `./public/videos/${declaredPostID}.mp4`;
        const videoDirPath = path.join(process.cwd(), 'public', 'videos');
        await downloadFileHelper(
          playAddr,
          videoDirPath,
          videoPath,
          formattedCookies
        );

        const coverPath = `./public/thumbnails/${declaredPostID}.jpg`;
        const coverDirPath = path.join(
          process.cwd(),

          'public',
          'thumbnails'
        );

        const cover = videoDetail.cover;
        const desc = findObjectWithKey(itemInfo, 'desc') as unknown as string;

        if (typeof cover !== 'undefined') {
          console.log('Downloading cover');
          await downloadFileHelper(cover, coverDirPath, coverPath);
        }

        const postData = await createPost({
          authorId: findAuthor?.id || 0,
          type: 'video',
          postDesc: desc,
          tiktokId: declaredPostID,
          originalURL: decodeURI,
        });

        await createVideo({
          mp4video: videoPath.replace('./public', ''),
          thumbnail: coverPath.replace('./public', ''),
          postId: postData.id,
        });

        const toHLS = {
          hlsPath: path.join(process.cwd(), 'public', 'hls', declaredPostID),
          hlsOutput: `/hls/${declaredPostID}/output.m3u8`,
          videoPath,
        };

        convertToHLS(toHLS.videoPath, toHLS.hlsPath, async (err, output) => {
          if (err) {
            console.log(err);
          } else if (output) {
            console.log('Updating');
            await updateVideo({
              hlsVideo: toHLS.hlsOutput,
              postId: postData.id,
            });
          }
        });

        const fetchData = await fetchPostByTiktokId(declaredPostID);
        return fetchData;
      }
    }
  } catch (error) {
    return error instanceof Error ? error : new Error('Something went wrong');
  }
};

export const justFetchPost = async (url: string) => {
  const userAgent =
    'Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.1';

  try {
    let parsedURL = new URL(url);
    const controller = new AbortController();
    const decodeURI = decodeURIComponent(url);
    console.log({
      decodeURI,
    });
    setTimeout(() => {
      controller.abort();
    }, 1000 * 10);
    let fetchContent = await fetch(decodeURI, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
      },
    });
    const fetchURL = fetchContent.url;
    console.log(fetchContent.url);
    if (
      fetchContent.status === 301 ||
      fetchContent.status === 302 ||
      fetchURL !== url
    ) {
      const redirectLocation =
        fetchContent.status === 301 || fetchContent.status === 302
          ? fetchContent.headers.get('location')
          : fetchURL;
      if (redirectLocation) {
        console.log('Redirected');
        parsedURL = new URL(redirectLocation);
        fetchContent = await fetch(redirectLocation, {
          headers: {
            'User-Agent': userAgent,
          },
        });
      }
    }
    const postId = parsedURL.pathname.split('/').at(-1);

    let cookies: string[] = [];
    for (let [key, value] of fetchContent.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        cookies.push(value);
      }
    }

    const textContent = await fetchContent.text();

    const dom = new jsdom.JSDOM(textContent);
    const rehydrationData = dom.window.document.querySelector(
      '#__UNIVERSAL_DATA_FOR_REHYDRATION__'
    )?.textContent;
    const jsonParseData = rehydrationData ? JSON.parse(rehydrationData) : null;

    if (!jsonParseData) {
      return new Error('No Data Found');
    }

    const deviceId = findObjectWithKey(jsonParseData, 'wid');
    const odinId = findObjectWithKey(jsonParseData, 'odinId');
    const webIdLastTime = findObjectWithKey(jsonParseData, 'webIdCreatedTime');
    const abTest = findObjectWithKey(jsonParseData, 'abTestVersion');
    const abTestVersions: string[] = abTest
      ? abTest.versionName.split(',')
      : [];
    const msToken = fetchContent.headers.get('x-ms-token');

    const urlWithoutBogus = `https://www.tiktok.com/api/item/detail/?WebIdLastTime=${webIdLastTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=${encodeURIComponent(
      userAgent
    )}&channel=tiktok_web&${abTestVersions.map(
      (version) => `clientABVersions${version}&`
    )}cookie_enabled=true&coverFormat=2&data_collection_enabled=true&device_id=${deviceId}&device_platform=web_pc&focus_state=true&from_page=user&history_len=1&is_fullscreen=false&is_page_visible=true&itemId=${postId}&language=en&odinId=${odinId}&os=mac&priority_region=ES&referer=&region=ES&screen_height=1117&screen_width=1728&tz_name=Europe%2FMadrid&user_is_login=true&verifyFp=verify_lws1fk3n_P0R9e85b_CSlT_4mNA_BBoR_9av0jRDDSXI0&webcast_language=en&msToken=${msToken}`;
    const xbogus_parameter = xbogus(urlWithoutBogus, userAgent);
    const formattedCookies = cookies.join('; ');

    const testFetch = await fetch(
      `${urlWithoutBogus}&X-Bogus=${xbogus_parameter}`,
      {
        headers: {
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9,es;q=0.8',
          'cache-control': 'no-cache',
          'User-Agent': userAgent,
          pragma: 'no-cache',
          priority: 'u=1, i',
          'sec-ch-ua': '"Chromium";v="127", "Not)A;Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          cookie: formattedCookies,
          Referer: parsedURL.toString(),
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        body: null,
        method: 'GET',
      }
    );
    const json = await testFetch.json();

    const itemInfo = findObjectWithKey(json, 'itemStruct');

    if (!itemInfo) {
      return new Error('No information found');
    }

    const declaredPostID = findObjectWithKey(
      itemInfo,
      'id'
    ) as unknown as string;
    const imageDetail = findObjectWithKey(itemInfo, 'imagePost');
    const videoDetail = findObjectWithKey(itemInfo, 'video');

    if (imageDetail) {
      console.log('Downloading images');
      const music = findObjectWithKey(itemInfo, 'music')?.playUrl;
      const imageList: string[] = findObjectWithKey(imageDetail, 'images')
        ?.map((list: { imageURL: { urlList: string[] } }) =>
          list?.imageURL?.urlList ? list?.imageURL?.urlList[0] : null
        )
        .filter((image: string | null) => image !== null);

      await Promise.all(
        imageList.map(async (url, index) => {
          const dirPath = path.join(
            process.cwd(),
            'public',
            'images',
            declaredPostID
          );
          const pathName = `./public/images/${declaredPostID}/${index}.jpg`;
          await downloadFileHelper(
            url,
            dirPath,
            path.join(dirPath, `${index}.jpg`)
          );

          return pathName.replace('./public', '');
        })
      );

      const audioFilePath = `./public/audio/${declaredPostID}.mp4`;
      if (music) {
        const dirPath = path.join(process.cwd(), 'public', 'audio');

        downloadFileHelper(music, dirPath, audioFilePath);
      }
    } else if (videoDetail) {
      const playAddr = videoDetail.playAddr;
      console.log('Downloading video');
      if (playAddr) {
        const videoPath = `./public/videos/${declaredPostID}.mp4`;
        const videoDirPath = path.join(process.cwd(), 'public', 'videos');
        await downloadFileHelper(
          playAddr,
          videoDirPath,
          videoPath,
          formattedCookies
        );

        const toHLS = {
          hlsPath: path.join(process.cwd(), 'public', 'hls', declaredPostID),
          hlsOutput: `/hls/${declaredPostID}/output.m3u8`,
          videoPath,
        };

        convertToHLS(toHLS.videoPath, toHLS.hlsPath, async (err, output) => {
          if (err) {
            console.log(err);
          } else if (output) {
            const oldVideo = await findVideoByTiktokID(declaredPostID);

            if (oldVideo && oldVideo.id) {
              console.log('Updating');
              await updateVideo({
                hlsVideo: toHLS.hlsOutput,
                postId: oldVideo.id,
              });
            }
          }
        });

        const coverPath = `./public/thumbnails/${declaredPostID}.jpg`;
        const coverDirPath = path.join(process.cwd(), 'public', 'thumbnails');

        const cover = videoDetail.cover;
        const desc = findObjectWithKey(itemInfo, 'desc') as unknown as string;

        if (typeof cover !== 'undefined') {
          await downloadFileHelper(cover, coverDirPath, coverPath);
        }
      }
    }
    const fetchData = await fetchPostByTiktokId(declaredPostID);
    if (fetchData) {
      console.log('Restoring post');
      restorePost(fetchData.id);
    }
    return fetchData;
  } catch (error) {
    console.log({
      error,
    });
    return error instanceof Error ? error : new Error('Something went wrong');
  }
};

export const getRelatedPosts = async (url: string, session?: string) => {
  const userAgent =
    'Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.1';

  try {
    let parsedURL = new URL(url);
    const controller = new AbortController();
    const decodeURI = decodeURIComponent(url);

    setTimeout(() => {
      controller.abort();
    }, 1000 * 5);
    let fetchContent = await fetch(decodeURI, {
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
      },
    });
    const fetchURL = fetchContent.url;
    console.log(fetchContent.url);
    if (
      fetchContent.status === 301 ||
      fetchContent.status === 302 ||
      fetchURL !== url
    ) {
      const redirectLocation =
        fetchContent.status === 301 || fetchContent.status === 302
          ? fetchContent.headers.get('location')
          : fetchURL;
      if (redirectLocation) {
        parsedURL = new URL(redirectLocation);
        fetchContent = await fetch(redirectLocation, {
          headers: {
            'User-Agent': userAgent,
          },
        });
      }
    }
    const postId = parsedURL.pathname.split('/').at(-1);

    let viewingSession;
    if (session) {
      viewingSession = await fetchSessionByToken(session);
    }
    const watchedIds = viewingSession?.watched.split(',') || [postId];

    let cookies: string[] = [];
    for (let [key, value] of fetchContent.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        cookies.push(value);
      }
    }

    const textContent = await fetchContent.text();

    const dom = new jsdom.JSDOM(textContent);
    const rehydrationData = dom.window.document.querySelector(
      '#__UNIVERSAL_DATA_FOR_REHYDRATION__'
    )?.textContent;
    const jsonParseData = rehydrationData ? JSON.parse(rehydrationData) : null;

    if (!jsonParseData) {
      return new Error('No Data Found');
    }

    const deviceId = findObjectWithKey(jsonParseData, 'wid');
    const odinId = findObjectWithKey(jsonParseData, 'odinId');
    const webIdLastTime = findObjectWithKey(jsonParseData, 'webIdCreatedTime');
    const abTest = findObjectWithKey(jsonParseData, 'abTestVersion');
    const abTestVersions: string[] = abTest
      ? abTest.versionName.split(',')
      : [];

    const urlWithoutBogus = `https://www.tiktok.com/api/related/item_list/?WebIdLastTime=${webIdLastTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=${encodeURIComponent(
      userAgent
    )}&channel=tiktok_web&${abTestVersions.map(
      (version) => `clientABVersions${version}&`
    )}cookie_enabled=true&count=16&coverFormat=2&cursor=0&data_collection_enabled=true&device_id=${deviceId}&device_platform=web_pc&focus_state=true&from_page=video&history_len=2&isNonPersonalized=false&is_fullscreen=false&is_page_visible=true&itemID=${postId}&language=en&odinId=${odinId}&os=mac&priority_region=ES&referer=&region=ES&screen_height=1117&screen_width=1728&tz_name=Europe%2FMadrid&user_is_login=true&verifyFp=verify_lws1fk3n_P0R9e85b_CSlT_4mNA_BBoR_9av0jRDDSXI0&webcast_language=en`;

    const xbogus_parameter = xbogus(urlWithoutBogus, userAgent);
    const formattedCookies = cookies.join('; ');

    const testFetch = await fetch(
      `${urlWithoutBogus}&X-Bogus=${xbogus_parameter}`,
      {
        headers: {
          accept: '*/*',
          'accept-language': 'en-US,en;q=0.9,es;q=0.8',
          'cache-control': 'no-cache',
          'User-Agent': userAgent,
          pragma: 'no-cache',
          priority: 'u=1, i',
          'sec-ch-ua': '"Chromium";v="127", "Not)A;Brand";v="99"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          cookie: formattedCookies,
          Referer: parsedURL.toString(),
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
        body: null,
        method: 'GET',
      }
    );
    const json = await testFetch.json();

    const itemList = findObjectWithKey(json, 'itemList');
    console.log({ itemList });
    const itemInfo =
      itemList && 'map' in itemList
        ? itemList.find((item: { id: string }) => !watchedIds.includes(item.id))
        : null;
    console.log({
      itemInfoId: itemInfo.id,
      watchedIds,
    });
    if (!itemInfo) {
      return new Error('No information found');
    }
    const declaredPostID = findObjectWithKey(
      itemInfo,
      'id'
    ) as unknown as string;
    const imageDetail = findObjectWithKey(itemInfo, 'imagePost');
    const videoDetail = findObjectWithKey(itemInfo, 'video');
    const authorDetails = findObjectWithKey(itemInfo, 'author');
    const authorId = authorDetails?.id;
    const authorUniqueId = authorDetails?.uniqueId;
    let findAuthor = await findAuthorByTiktokId(authorId);
    console.log({
      itemInfo,
      videoDetail,
    });
    if (authorDetails && !findAuthor) {
      const authorImagePath = `./public/authors/${authorId}.jpg`;
      const authorDirPath = path.join(process.cwd(), 'public', 'authors');

      await downloadFileHelper(
        authorDetails.avatarLarger,
        authorDirPath,
        authorImagePath
      );
      await createAuthor(
        authorId,
        authorDetails.nickname,
        authorImagePath.replace('./public', ''),
        authorDetails.uniqueId
      );
      findAuthor = await findAuthorByTiktokId(authorId);
    }
    const findPost = await fetchPostByTiktokId(declaredPostID);
    if (findPost) {
      return findPost;
    }
    if (imageDetail) {
      const music = findObjectWithKey(itemInfo, 'music')?.playUrl;
      const imageList: string[] = findObjectWithKey(imageDetail, 'images')
        ?.map((list: { imageURL: { urlList: string[] } }) =>
          list?.imageURL?.urlList ? list?.imageURL?.urlList[0] : null
        )
        .filter((image: string | null) => image !== null);

      const images = await Promise.all(
        imageList.map(async (url, index) => {
          const dirPath = path.join(
            process.cwd(),
            'public',
            'images',
            imageDetail.id
          );
          const filePath = path.join(dirPath, `${index}.jpg`);

          // Ensure the directory exists
          if (ensureDirectoryExistence(filePath)) {
            console.log('I exist, download me');
            await downloadFileHelper(url, dirPath, filePath, formattedCookies);
            return filePath.split('/public')[1];
          } else {
            return null;
          }
        })
      );

      const audioFilePath = `./public/audio/${declaredPostID}.mp4`;
      if (music) {
        const dirPath = path.join(process.cwd(), 'public', 'audio');

        downloadFileHelper(music, dirPath, audioFilePath);
      }

      const postDesc = `${
        imageDetail.title ? `${imageDetail.title} | ` : ''
      } ${findObjectWithKey(itemInfo, 'desc')}`;

      const post = await createPost({
        authorId: findAuthor?.id || 0,
        type: 'photo',
        tiktokId: declaredPostID,
        postDesc: postDesc || undefined,
        originalURL: `https://www.tiktok.com/@${authorUniqueId}/photo/${imageDetail.id}`,
      });

      await createCarousel({
        audio: audioFilePath.replace('./public', ''),
        images: images.filter((img) => img !== null).toString(),
        postId: post.id,
      });

      return await fetchPostByTiktokId(declaredPostID);
    } else if (videoDetail) {
      const playAddr = videoDetail.playAddr;

      if (playAddr) {
        const videoPath = `./public/videos/${videoDetail.id}.mp4`;
        const videoDirPath = path.join(process.cwd(), 'public', 'videos');
        await downloadFileHelper(
          playAddr,
          videoDirPath,
          videoPath,
          formattedCookies
        );

        const coverPath = `./public/thumbnails/${declaredPostID}.jpg`;
        const coverDirPath = path.join(
          process.cwd(),

          'public',
          'thumbnails'
        );

        const cover = videoDetail.cover;
        const desc = findObjectWithKey(itemInfo, 'desc') as unknown as string;

        if (typeof cover !== 'undefined') {
          console.log('Downloading cover');
          await downloadFileHelper(cover, coverDirPath, coverPath);
        }

        const postData = await createPost({
          authorId: findAuthor?.id || 0,
          type: 'video',
          postDesc: desc,
          tiktokId: declaredPostID,
          originalURL: `https://www.tiktok.com/@${authorUniqueId}/video/${videoDetail.id}`,
        });

        await createVideo({
          mp4video: videoPath.replace('./public', ''),
          thumbnail: coverPath.replace('./public', ''),
          postId: postData.id,
        });

        const toHLS = {
          hlsPath: path.join(process.cwd(), 'public', 'hls', declaredPostID),
          hlsOutput: `/hls/${declaredPostID}/output.m3u8`,
          videoPath,
        };

        convertToHLS(toHLS.videoPath, toHLS.hlsPath, async (err, output) => {
          if (err) {
            console.log(err);
          } else if (output) {
            console.log('Updating');
            await updateVideo({
              hlsVideo: toHLS.hlsOutput,
              postId: postData.id,
            });
          }
        });

        const fetchData = await fetchPostByTiktokId(declaredPostID);
        return fetchData;
      }
    }
  } catch (error) {
    return error instanceof Error ? error : new Error('Something went wrong');
  }
};
