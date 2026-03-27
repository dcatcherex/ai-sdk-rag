export type { RichMenuAreaConfig } from '@/db/schema';

export type RichMenuLayout = '3-col' | '6-col';

// LINE rich menu image dimensions (full-width large)
export const RICH_MENU_WIDTH = 2500;
export const RICH_MENU_HEIGHT = 843;

// Default color palette for menu buttons
export const MENU_COLORS = [
  '#06C755',  // LINE green
  '#00B0B9',  // teal
  '#FF6B35',  // orange
  '#7B61FF',  // purple
  '#FF4E8C',  // pink
  '#2B88D8',  // blue
] as const;
