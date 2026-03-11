import { DocumentDetailPage } from '@/components/knowledge/document-detail-page';

type KnowledgeDocumentPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function KnowledgeDocumentPage({ params }: KnowledgeDocumentPageProps) {
  const { id } = await params;

  return <DocumentDetailPage documentId={id} />;
}
