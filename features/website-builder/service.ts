/**
 * Website Builder service — thin re-export from lib/website-service.ts.
 * Agent adapters, API routes, and sidebar all import from here.
 */
export {
  runGenerateWebsite,
  runEditWebsite,
  runPublishWebsite,
  runGetWebsiteStatus,
  listUserWebsites,
  deleteWebsite,
  websiteGenerateAction,
  websiteEditAction,
} from '@/lib/website-service';
