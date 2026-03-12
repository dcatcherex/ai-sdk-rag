export type UserProfileData = {
  displayName: string;
  email: string;
  initials: string;
  image: string;
};

export type SessionData = {
  user?: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
} | null;

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "chat-sidebar-collapsed";
export const SIDEBAR_VISIBLE_ITEMS_STORAGE_KEY = "chat-sidebar-visible-items";
