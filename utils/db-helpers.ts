import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Function to open the database connection
export async function openDb() {
  await prisma.$connect();
}

// Function to close the database connection
export async function closeDb() {
  await prisma.$disconnect();
}

export async function fetchPostByTiktokId(id: string) {
  return await prisma.post.findUnique({
    where: {
      tiktokId: id,
    },
    select: {
      id: true,
      tiktokId: true,
      video: true,
      carousel: true,
      author: true,
      originalURL: true,
      authorId: true,
      postDescription: true,
      type: true,
      deleted: true,
    },
  });
}

export async function fetchOldestPost() {
  return await prisma.post.findFirst({
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      tiktokId: true,
      id: true,
      type: true,
    },
    where: {
      deleted: {
        equals: false,
      },
    },
  });
}

export async function deletePost(id: number) {
  return await prisma.post.update({
    where: {
      id,
    },
    data: {
      deleted: true,
    },
  });
}

export async function restorePost(id: number) {
  return await prisma.post.update({
    where: {
      id,
    },
    data: {
      deleted: false,
      createdAt: new Date(),
    },
  });
}

export async function fetchPostById(id: number) {
  return await prisma.post.findUnique({
    where: {
      id: id,
    },
    include: {
      video: true,
      carousel: true,
      author: true,
    },
  });
}

// Function to create a carousel
export async function createCarousel(carouselData: {
  audio: string;
  images: string;
  postId: number;
}) {
  const { audio, images, postId } = carouselData;
  return await prisma.carousel.create({
    data: {
      audio,
      images,
      post: {
        connect: {
          id: postId,
        },
      },
    },
  });
}

//Function to creatae a video
export async function createVideo(videoData: {
  mp4video: string;
  hlsVideo?: string;
  thumbnail?: string;
  postId: number;
}) {
  const { mp4video, postId, hlsVideo, thumbnail } = videoData;
  return await prisma.video.create({
    data: {
      mp4URL: mp4video,
      hlsURL: hlsVideo,
      thumbnail,
      post: {
        connect: {
          id: postId,
        },
      },
    },
  });
}

//Function to find video by mp4URL
export async function findVideoByMp4URL(mp4URL: string) {
  return await prisma.video.findFirst({
    where: {
      mp4URL,
    },
  });
}

//Fetch newest post
export async function fetchNewestPost() {
  return await prisma.post.findFirst({
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      tiktokId: true,
      type: true,
    },
    where: {
      deleted: {
        equals: false,
      },
    },
  });
}

//Function to find video by mp4URL
export async function findVideoByTiktokID(tiktokId: string) {
  return await prisma.post.findFirst({
    where: {
      tiktokId,
    },
    select: {
      video: true,
      id: true,
    },
  });
}

//Function to update a video
export async function updateVideo(videoData: {
  mp4video?: string;
  hlsVideo?: string;
  thumbnail?: string;
  postId: number;
}) {
  const { mp4video, postId, hlsVideo, thumbnail } = videoData;
  return await prisma.video.update({
    where: {
      postId,
    },
    data: {
      mp4URL: mp4video,
      hlsURL: hlsVideo,
      thumbnail,
    },
  });
}

// Function to create a post
export async function createPost(postData: {
  authorId: number;
  type: string;
  tiktokId: string;
  videoId?: number; // Optional, assuming video is a related model and might not always be present
  carouselId?: number; // Optional, assuming carousel is a related model and might not always be present
  postDesc?: string;
  originalURL: string;
}) {
  const { authorId, type, tiktokId, videoId, carouselId, originalURL } =
    postData;
  return await prisma.post.create({
    data: {
      authorId,
      type,
      tiktokId,
      originalURL,
      video: videoId ? { connect: { id: videoId } } : undefined,
      carousel: carouselId ? { connect: { id: carouselId } } : undefined,
      postDescription: postData.postDesc,
    },
  });
}

// Function to find an author by TikTok ID
export async function findAuthorByTiktokId(tiktokId: string) {
  return await prisma.author.findUnique({
    where: {
      tiktokId,
    },
  });
}

// Function to create an author
export async function createAuthor(
  tiktokId: string,
  name: string,
  image: string,
  handle: string
) {
  return await prisma.author.create({
    data: {
      tiktokId,
      name,
      image,
      handle,
    },
  });
}

// Function to update an author's details
export async function updateAuthor(
  tiktokId: string,
  name: string,
  image: string
) {
  return await prisma.author.update({
    where: {
      tiktokId,
    },
    data: {
      name,
      image,
    },
  });
}

export async function fetchSessionByToken(token: string) {
  return await prisma.session.findUnique({
    where: {
      token,
    },
  });
}

export async function createSession(token: string) {
  return await prisma.session.create({
    data: {
      token,
    },
  });
}

export async function updateSession(token: string, watched: string) {
  const existingSession = await fetchSessionByToken(token);
  const alreadyWatched = existingSession?.watched || '';
  const watchedAsArray = alreadyWatched.split(',');
  const newWatchedAsArray = watched.split(',');
  const newArr = [...new Set([...watchedAsArray, ...newWatchedAsArray])].filter(
    (item) => item !== ''
  );
  const composedWatch = newArr.join(',');
  return await prisma.session.update({
    where: {
      token,
    },
    data: {
      watched: composedWatch,
    },
  });
}
