import { notFound } from "next/navigation";
import { getSharedCollection } from "../actions";
import { SharedCollectionView } from "@/components/share/shared-collection-view";

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: SharePageProps) {
  const { token } = await params;
  const result = await getSharedCollection(token);

  if (result.error || !result.data) {
    return { title: "Collection non trouvée" };
  }

  const { series, stats, tcg } = result.data;
  return {
    title: `Collection ${series.name} - ${stats.percentage}% complète`,
    description: `${stats.owned}/${stats.total} cartes collectées - ${tcg.name}`,
    openGraph: {
      title: `Collection ${series.name} - ${stats.percentage}%`,
      description: `${stats.owned}/${stats.total} cartes collectées`,
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { token } = await params;
  const result = await getSharedCollection(token);

  if (result.error || !result.data) {
    notFound();
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 pt-20 pb-8 max-w-[1600px]">
      <SharedCollectionView data={result.data} />
    </div>
  );
}
