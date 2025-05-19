import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import logger from './logger';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export function extractThumbnail(
  videoPath: string,
  outputThumbnailPath: string,
  callback: (err: string | null, output?: string) => void
) {
  ffmpeg(videoPath)
    .on('end', () => {
      logger.info('Thumbnail extracted');
      callback(null, outputThumbnailPath);
    })
    .on('error', function (err, stdout, stderr) {
      callback(err.message);
    })
    .screenshots({
      timestamps: [0], // Capture the first frame
      filename: path.basename(outputThumbnailPath),
      folder: path.dirname(outputThumbnailPath),
      size: '320x?', // Set the width to 320px, and keep aspect ratio
    });
}

// Example usage
// extractThumbnail('path/to/video.mp4', 'path/to/thumbnail.jpg', (err, output) => {
//     if (err) {
//         logger.info(err);
//     } else {
//         logger.info('Thumbnail saved to:', output);
//     }
// });
