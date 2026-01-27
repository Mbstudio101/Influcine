import { MediaDetails } from '../types';

const TEST_VIDEO_URL = 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/1080/Big_Buck_Bunny_1080_10s_1MB.mp4';

interface SourceResolution {
  url: string;
  quality: string;
  format: string;
}

export const sourceResolver = {
  async resolveSource(
    _media: MediaDetails, 
    _season?: number, 
    _episode?: number
  ): Promise<SourceResolution | null> {
    console.log('Resolving source for:', _media.title, _season, _episode);
    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      url: TEST_VIDEO_URL,
      quality: '1080p',
      format: 'mp4'
    };
  }
};
