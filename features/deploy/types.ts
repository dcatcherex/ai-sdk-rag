export type ChangeType = 'copy_edit' | 'page_clone' | 'blog_post'

export type DeployPreviewData = {
  changeType: ChangeType
  targetPath: string
  /** Content of the file before the change — null for new files */
  originalContent: string | null
  /** GitHub blob SHA of the original file — required when updating an existing file */
  originalSha: string | null
  newContent: string
  summary: string
  prTitle: string
  prDescription: string
  branchName: string
}

export type DeployResultData = {
  prUrl: string
  prNumber: number
  branchName: string
}

export type DeployRunOutput =
  | ({ status: 'preview' } & DeployPreviewData)
  | ({ status: 'completed' } & DeployPreviewData & DeployResultData)
  | ({ status: 'failed'; error: string } & DeployPreviewData)

export type DeployHistoryItem = {
  id: string
  status: string
  createdAt: Date
  completedAt: Date | null
  output: DeployRunOutput | null
}
