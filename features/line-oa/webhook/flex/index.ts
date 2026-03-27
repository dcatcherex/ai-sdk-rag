/**
 * Flex message builders — add new templates as new named exports here.
 *
 * To add a new template:
 *  1. Create features/line-oa/webhook/flex/<name>.ts
 *  2. Export your builder function from this index
 *  3. Call it from the relevant event handler
 */
export { buildWelcomeFlex } from './welcome';
export { buildReplyMessages, buildFlexReplyBubble } from './reply';
