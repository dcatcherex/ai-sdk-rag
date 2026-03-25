export const COMPOSITIONS = [
  '', 'Wide shot', 'Close-up', 'Extreme close-up', 'Portrait', 'Low angle', 'Overhead', 'Panoramic',
];

export const STYLES = [
  '', 'Photorealistic', '3D animation', 'Film noir', 'Watercolor', 'Oil painting',
  'Sketch', 'Anime', 'Cinematic', '1990s product photography',
];

export const RATIO_LABELS: Record<string, string> = {
  auto: 'Auto', '1:1': 'Square', '16:9': 'Widescreen', '9:16': 'Social story',
  '4:3': 'Classic', '3:4': 'Portrait', '2:3': 'Portrait', '3:2': 'Landscape',
  '21:9': 'Ultrawide', '4:5': 'Social post', '5:4': 'Photo',
  // Video model aliases
  'landscape': 'Landscape', 'portrait': 'Portrait', 'Auto': 'Auto',
};

export const RESOLUTION_TIMES: Record<string, string> = {
  '1K': '~18s', '2K': '~41s', '4K': '~1m 11s',
};
