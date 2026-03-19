import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getShareRecord } from "../../../lib/server/share-store";

type SharePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: SharePageProps): Promise<Metadata> {
  const { id } = await params;
  const record = await getShareRecord(id);
  if (!record) {
    return {
      title: "Word Blender",
      description: "シェアページが見つかりませんでした",
    };
  }

  const title = `Word Blender - ${record.phrase}`;
  const description = `「${record.phrase}」から生成したビジュアル`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: record.imagePath }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [record.imagePath],
    },
  };
}

export default async function SharePage({ params }: SharePageProps) {
  const { id } = await params;
  const record = await getShareRecord(id);
  if (!record) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center bg-[#f5f5f7] p-6">
      <h1 className="text-2xl font-semibold text-[#1d1d1f]">Word Blender</h1>
      <p className="mt-2 text-sm text-[#6e6e73]">{record.phrase}</p>
      <div className="mt-5 w-full overflow-hidden rounded-2xl border border-[#d2d2d7] bg-white">
        <Image src={record.imagePath} alt={record.phrase} width={1024} height={1024} className="h-auto w-full" />
      </div>
      <Link
        href="/"
        className="mt-5 inline-flex items-center rounded-full border border-[#d2d2d7] bg-white px-4 py-2 text-sm text-[#1d1d1f] transition hover:bg-[#f0f0f2]"
      >
        Word Blender に戻る
      </Link>
    </main>
  );
}
