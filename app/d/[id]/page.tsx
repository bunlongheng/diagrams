import { redirect } from "next/navigation";

export default async function DiagramPublicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/pdf/${id}`);
}
