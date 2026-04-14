import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import {
  createDriveFolderInputSchema,
  listDriveFilesInputSchema,
  uploadFileToDriveInputSchema,
} from './schema';
import {
  runCreateDriveFolder,
  runListDriveFiles,
  runUploadFileToDrive,
} from './service';

export function createGoogleDriveAgentTools(
  ctx: Pick<AgentToolContext, 'userId'>,
) {
  const { userId } = ctx;

  return {
    list_google_drive_files: tool({
      description: 'List files in a Google Drive folder or search by name.',
      inputSchema: listDriveFilesInputSchema,
      async execute(input) {
        return await runListDriveFiles(input, userId);
      },
    }),

    create_google_drive_folder: tool({
      description: 'Create a folder in Google Drive.',
      inputSchema: createDriveFolderInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runCreateDriveFolder(input, userId);
      },
    }),

    upload_file_to_google_drive: tool({
      description: 'Upload an existing Vaja artifact, media asset, or URL-backed file to Google Drive.',
      inputSchema: uploadFileToDriveInputSchema,
      needsApproval: true,
      async execute(input) {
        return await runUploadFileToDrive(input, userId);
      },
    }),
  };
}
