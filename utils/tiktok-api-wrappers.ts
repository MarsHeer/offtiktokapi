import jsdom from 'jsdom';
import { findObjectWithKey } from './objects';
import {
  createAuthor,
  createCarousel,
  createPost,
  createVideo,
  fetchPostByTiktokId,
  fetchSessionByToken,
  findAuthorByTiktokId,
  restorePost,
} from './db-helpers';
import xbogus from 'xbogus';
import path from 'path';
import { downloadFileHelper, ensureDirectoryExistence } from './disk-utils';
import { parsedVideoData } from './zod';
import logger from './logger';

export const userAgent =
  'Mozilla/5.0 (X11; Linux x86_64; rv:91.0) Gecko/20100101 Firefox/91.1';

export const URL_SANS_BOGUS = {
  FETCH_POST: 'FETCH_POST',
  RELATED_POSTS: 'RELATED_POSTS',
} as const;

export const tiktokFetchOptions = ({
  formattedCookies,
  stringURL,
}: {
  formattedCookies: string;
  stringURL: string;
}) => ({
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
    Referer: stringURL,
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  },
  body: null,
  method: 'GET',
});

export const parseTikTokData = async (res: Response) => {
  try {
    if (!res.ok) {
      throw new Error(`HTTP Response not OK: ${res.status}`);
    }

    let cookies: string[] = [];
    for (let [key, value] of res.headers.entries()) {
      if (key.toLowerCase() === 'set-cookie') {
        cookies.push(value);
      }
    }

    const textContent = await res.text();
    if (!textContent) {
      throw new Error('Empty response content');
    }

    logger.info('Response content length:', textContent.length);

    const dom = new jsdom.JSDOM(textContent);
    const rehydrationElement = dom.window.document.querySelector(
      '#__UNIVERSAL_DATA_FOR_REHYDRATION__'
    );

    if (!rehydrationElement) {
      logger.info('Rehydration element not found in DOM');
      // Try fallback data extraction
      const scriptElements = dom.window.document.querySelectorAll('script');
      for (const script of scriptElements) {
        const content = script.textContent || '';
        if (content.includes('SIGI_STATE')) {
          const match = content.match(/SIGI_STATE["]?\s*=\s*({.+?});/);
          if (match && match[1]) {
            const jsonParseData = JSON.parse(match[1]);
            return extractDataFromJson(jsonParseData, cookies);
          }
        }
      }
      throw new Error('Could not find TikTok data in page');
    }

    const rehydrationData = rehydrationElement.textContent;
    if (!rehydrationData) {
      throw new Error('Rehydration data is empty');
    }

    let jsonParseData;
    try {
      jsonParseData = JSON.parse(rehydrationData);
    } catch (e) {
      console.error('JSON parse error:', e);
      throw new Error('Failed to parse rehydration data');
    }

    return extractDataFromJson(jsonParseData, cookies);
  } catch (error) {
    console.error('Parse TikTok Data Error:', error);
    throw error;
  }
};

// Helper function to extract data from JSON
const extractDataFromJson = (jsonData: any, cookies: string[]) => {
  const deviceId = findObjectWithKey(jsonData, 'wid');
  const odinId = findObjectWithKey(jsonData, 'odinId');
  const webIdLastTime = findObjectWithKey(jsonData, 'webIdCreatedTime');
  const abTest = findObjectWithKey(jsonData, 'abTestVersion');
  const abTestVersions: string[] = abTest ? abTest.versionName?.split(',') : [];
  const msToken = findObjectWithKey(jsonData, 'msToken');

  if (!deviceId || !odinId) {
    console.error('Missing required fields:', { deviceId, odinId });
    throw new Error('Missing required TikTok data fields');
  }

  return {
    deviceId,
    odinId,
    webIdLastTime,
    abTestVersions,
    msToken,
    cookies,
    joinedCookies: cookies.join(';'),
  };
};

export const fetchAndFollowURL = async (url: string) => {
  const controller = new AbortController();
  const decodeURI = decodeURIComponent(url);
  let parsedURL = new URL(url);
  setTimeout(() => {
    controller.abort();
  }, 1000 * 50);
  let fetchContent = await fetch(decodeURI, {
    signal: controller.signal,
    headers: {
      'User-Agent': userAgent,
    },
  });
  const fetchURL = fetchContent.url;
  logger.info(fetchContent.url);
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
      logger.info(`Redirected from ${url} to ${redirectLocation}`);
      parsedURL = new URL(redirectLocation);
      fetchContent = await fetch(redirectLocation, {
        headers: {
          'User-Agent': userAgent,
        },
      });
    }
  }

  return {
    response: fetchContent,
    url: parsedURL,
  };
};

export const pullVideoData = async (
  jsonContent: any,
  mode: (typeof URL_SANS_BOGUS)[keyof typeof URL_SANS_BOGUS],
  watchedIds?: string[]
) => {
  const itemList = URL_SANS_BOGUS.RELATED_POSTS
    ? findObjectWithKey(jsonContent, 'itemList')
    : null;
  const item =
    mode === URL_SANS_BOGUS.FETCH_POST
      ? findObjectWithKey(jsonContent, 'itemStruct')
      : itemList && 'map' in itemList
      ? itemList.find((item: { id: string }) => !watchedIds?.includes(item.id))
      : null;

  if (!item) {
    return new Error('No itemStruct found');
  }

  const id = findObjectWithKey(item, 'id');
  const imageDetail = findObjectWithKey(item, 'imagePost');
  const videoDetail = findObjectWithKey(item, 'video');
  const authorDetails = findObjectWithKey(item, 'author');
  const musicDetails = findObjectWithKey(item, 'music');
  const imageList = imageDetail
    ? findObjectWithKey(imageDetail, 'images')
        ?.map((list: { imageURL: { urlList: string[] } }) =>
          list?.imageURL?.urlList ? list?.imageURL?.urlList[0] : null
        )
        .filter((image: string | null) => image !== null)
    : null;
  const postDescription = `${
    imageDetail?.title ? `${imageDetail.title} |` : ''
  } ${findObjectWithKey(item, 'desc')}`;
  const videoURL = videoDetail ? videoDetail.playAddr : null;

  const dataObject = {
    id,
    description: postDescription,
    image: imageDetail
      ? {
          list: imageList,
        }
      : null,
    video: videoDetail
      ? {
          url: videoURL,
          cover: videoDetail.cover,
        }
      : null,
    author: authorDetails
      ? {
          id: authorDetails.id,
          name: authorDetails.nickname,
          image: authorDetails.avatarLarger,
          handle: authorDetails.uniqueId,
        }
      : null,
    music: musicDetails
      ? {
          url: musicDetails.playUrl,
        }
      : null,
  };

  const parsedData = parsedVideoData.safeParse(dataObject);

  if (parsedData.success) {
    return parsedData.data;
  } else {
    logger.info(dataObject);
    return new Error('Data hold unexpected format');
  }
};

export const fetchPostByUrlAndMode = async (
  url: string,
  mode: (typeof URL_SANS_BOGUS)[keyof typeof URL_SANS_BOGUS],
  sessionToken?: string
) => {
  try {
    // Validate URL first
    if (!url) {
      throw new Error('Invalid URL provided');
    }

    const { response, url: finalURL } = await fetchAndFollowURL(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const postId = finalURL.pathname.split('/').at(-1);
    if (!postId) {
      throw new Error('Video ID not found in URL');
    }

    const findPost = await fetchPostByTiktokId(postId);
    if (findPost) {
      return findPost;
    }

    const parseData = await parseTikTokData(response);
    if (!parseData || parseData instanceof Error) {
      throw new Error('Failed to parse TikTok data');
    }

    const {
      deviceId,
      odinId,
      webIdLastTime,
      abTestVersions,
      msToken,
      joinedCookies,
    } = parseData;

    const URLSansBogus =
      mode === URL_SANS_BOGUS.FETCH_POST
        ? `https://www.tiktok.com/api/item/detail/?WebIdLastTime=${webIdLastTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=${encodeURIComponent(
            userAgent
          )}&channel=tiktok_web&${abTestVersions.map(
            (version) => `clientABVersions${version}&`
          )}cookie_enabled=true&coverFormat=2&data_collection_enabled=true&device_id=${deviceId}&device_platform=web_pc&focus_state=true&from_page=user&history_len=1&is_fullscreen=false&is_page_visible=true&itemId=${postId}&language=en&odinId=${odinId}&os=mac&priority_region=ES&referer=&region=ES&screen_height=1117&screen_width=1728&tz_name=Europe%2FMadrid&user_is_login=true&verifyFp=verify_lws1fk3n_P0R9e85b_CSlT_4mNA_BBoR_9av0jRDDSXI0&webcast_language=en&msToken=${msToken}`
        : mode === URL_SANS_BOGUS.RELATED_POSTS
        ? `https://www.tiktok.com/api/related/item_list/?WebIdLastTime=${webIdLastTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=${encodeURIComponent(
            userAgent
          )}&channel=tiktok_web&${abTestVersions.map(
            (version) => `clientABVersions${version}&`
          )}cookie_enabled=true&count=16&coverFormat=2&cursor=0&data_collection_enabled=true&device_id=${deviceId}&device_platform=web_pc&focus_state=true&from_page=video&history_len=2&isNonPersonalized=false&is_fullscreen=false&is_page_visible=true&itemID=${postId}&language=en&odinId=${odinId}&os=mac&priority_region=ES&referer=&region=ES&screen_height=1117&screen_width=1728&tz_name=Europe%2FMadrid&user_is_login=true&verifyFp=verify_lws1fk3n_P0R9e85b_CSlT_4mNA_BBoR_9av0jRDDSXI0&webcast_language=en`
        : '';
    const xbogus_parameter = xbogus(URLSansBogus, userAgent);

    const fetchContent = await fetch(
      `${URLSansBogus}&X-Bogus=${xbogus_parameter}`,
      {
        ...tiktokFetchOptions({
          formattedCookies: joinedCookies,
          stringURL: URLSansBogus,
        }),
      }
    );

    if (!fetchContent.ok) {
      throw new Error(`API request failed with status: ${fetchContent.status}`);
    }

    const jsonContent = await fetchContent.json();
    if (!jsonContent) {
      throw new Error('Failed to parse API response');
    }

    let watchedIds;
    if (sessionToken) {
      const userSession = await fetchSessionByToken(sessionToken);
      if (userSession) {
        watchedIds = userSession.watched.split(',');
      }
    }

    const videoData = await pullVideoData(jsonContent, mode, watchedIds);
    if (videoData instanceof Error) {
      throw videoData;
    }

    const { author, description, id: postID, image, music, video } = videoData;

    if (!author) {
      return new Error('Author not found');
    }
    let workingAuthor = await findAuthorByTiktokId(author.id);

    if (!workingAuthor) {
      const authorDirPath = path.join(process.cwd(), 'public', 'authors');
      const authorImagePath = path.join(authorDirPath, `${author.id}.jpg`);
      if (author.image) {
        await downloadFileHelper(author.image, authorDirPath, authorImagePath);
      }

      workingAuthor = await createAuthor(
        author.id,
        author.name,
        `/authors/${author.id}.jpg`,
        author.handle
      );
    }

    if (image) {
      const musicDirPath = path.join(process.cwd(), 'public', 'audio');
      const musicFilePath = path.join(musicDirPath, `${postID}.mp4`);
      if (music?.url) {
        downloadFileHelper(music.url, musicDirPath, musicFilePath);
      }

      const images = await Promise.all(
        image.list.map(async (imageURL, index) => {
          const dirPath = path.join(process.cwd(), 'public', 'images', postID);
          const filePath = path.join(dirPath, `${index}.jpg`);

          if (ensureDirectoryExistence(filePath)) {
            await downloadFileHelper(imageURL, dirPath, filePath);
            return `/images/${postID}/${index}.jpg`;
          } else {
            return null;
          }
        })
      );

      const post = await createPost({
        authorId: workingAuthor.id,
        type: 'photo',
        tiktokId: postID,
        postDesc: description,
        originalURL: finalURL.toString(),
      });

      await createCarousel({
        audio: music?.url ? `/audio/${postID}.mp4` : '',
        images: images.filter((image) => image !== null).toString(),
        postId: post.id,
      });
    } else if (video) {
      const videoDirPath = path.join(process.cwd(), 'public', 'videos');
      const videoFilePath = path.join(videoDirPath, `${postID}.mp4`);
      // Use the original TikTok URL for yt-dlp, not the CDN/playAddr
      if (video.url) {
        // Try to use the original TikTok post URL
        const tiktokPostUrl = author && postID
          ? `https://www.tiktok.com/@${author.handle}/video/${postID}`
          : finalURL.toString();
        await downloadFileHelper(
          tiktokPostUrl,
          videoDirPath,
          videoFilePath
          // joinedCookies // Only needed if you want to pass cookies
        );
      }

      const thumbnailDirPath = path.join(process.cwd(), 'public', 'thumbnails');
      const thumbnailFilePath = path.join(thumbnailDirPath, `${postID}.jpg`);
      if (video.cover) {
        downloadFileHelper(video.cover, videoDirPath, thumbnailFilePath);
      }

      const post = await createPost({
        authorId: workingAuthor.id,
        type: 'video',
        tiktokId: postID,
        postDesc: description,
        originalURL: finalURL.toString(),
      });

      await createVideo({
        mp4video: `/videos/${postID}.mp4`,
        thumbnail: `/thumbnails/${postID}.jpg`,
        postId: post.id,
      });
    }
    return await fetchPostByTiktokId(postID);
  } catch (error) {
    console.error('TikTok API Error:', error);
    return error instanceof Error
      ? error
      : new Error('Failed to fetch TikTok content');
  }
};

export const downloadPostByUrl = async (url: string, originalID: number) => {
  try {
    const { response, url: finalURL } = await fetchAndFollowURL(url);

    const postId = finalURL.pathname.split('/').at(-1);
    if (!postId) {
      return new Error('Video ID not found');
    }
    const findPost = await fetchPostByTiktokId(postId);

    if (findPost) {
      return findPost;
    }

    const parseData = await parseTikTokData(response);

    if (!parseData || parseData instanceof Error) {
      return new Error('Something went wrong');
    }

    const {
      deviceId,
      odinId,
      webIdLastTime,
      abTestVersions,
      msToken,
      joinedCookies,
    } = parseData;

    const URLSansBogus = `https://www.tiktok.com/api/item/detail/?WebIdLastTime=${webIdLastTime}&aid=1988&app_language=en&app_name=tiktok_web&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=MacIntel&browser_version=${encodeURIComponent(
      userAgent
    )}&channel=tiktok_web&${abTestVersions.map(
      (version) => `clientABVersions${version}&`
    )}cookie_enabled=true&coverFormat=2&data_collection_enabled=true&device_id=${deviceId}&device_platform=web_pc&focus_state=true&from_page=user&history_len=1&is_fullscreen=false&is_page_visible=true&itemId=${postId}&language=en&odinId=${odinId}&os=mac&priority_region=ES&referer=&region=ES&screen_height=1117&screen_width=1728&tz_name=Europe%2FMadrid&user_is_login=true&verifyFp=verify_lws1fk3n_P0R9e85b_CSlT_4mNA_BBoR_9av0jRDDSXI0&webcast_language=en&msToken=${msToken}`;
    const xbogus_parameter = xbogus(URLSansBogus, userAgent);

    const fetchContent = await fetch(
      `${URLSansBogus}&X-Bogus=${xbogus_parameter}`,
      {
        ...tiktokFetchOptions({
          formattedCookies: joinedCookies,
          stringURL: URLSansBogus,
        }),
      }
    );

    const jsonContent = await fetchContent.json();

    const videoData = await pullVideoData(
      jsonContent,
      URL_SANS_BOGUS.FETCH_POST
    );

    if (videoData instanceof Error) {
      return videoData;
    }

    const { id: postID, image, music, video } = videoData;

    if (image) {
      const musicDirPath = path.join(process.cwd(), 'public', 'audio');
      const musicFilePath = path.join(musicDirPath, `${postID}.mp4`);
      if (music?.url) {
        downloadFileHelper(music.url, musicDirPath, musicFilePath);
      }

      await Promise.all(
        image.list.map(async (imageURL, index) => {
          const dirPath = path.join(process.cwd(), 'public', 'images', postID);
          const filePath = path.join(dirPath, `${index}.jpg`);

          if (ensureDirectoryExistence(filePath)) {
            await downloadFileHelper(imageURL, dirPath, filePath);
            return `/images/${postID}/${index}.jpg`;
          } else {
            return null;
          }
        })
      );
    } else if (video) {
      const videoDirPath = path.join(process.cwd(), 'public', 'videos');
      const videoFilePath = path.join(videoDirPath, `${postID}.mp4`);
      if (video.url) {
        await downloadFileHelper(video.url, videoDirPath, videoFilePath);
      }

      const thumbnailDirPath = path.join(process.cwd(), 'public', 'thumbnails');
      const thumbnailFilePath = path.join(thumbnailDirPath, `${postID}.jpg`);
      if (video.cover) {
        downloadFileHelper(video.cover, videoDirPath, thumbnailFilePath);
      }
    }
    await restorePost(originalID);
    return await fetchPostByTiktokId(postID);
  } catch (error) {
    return error instanceof Error ? error : new Error('Something went wrong');
  }
};
