import { NextResponse } from "next/server";
import { createShareRecord } from "../../../lib/server/share-store";

type CreateShareRequest = {
  phrase?: string;
  imageUrl?: string;
};

export async function POST(request: Request) {
  let body: CreateShareRequest;
  try {
    body = (await request.json()) as CreateShareRequest;
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です。" }, { status: 400 });
  }

  const phrase = body.phrase?.trim();
  const imageUrl = body.imageUrl?.trim();

  if (!phrase || !imageUrl) {
    return NextResponse.json({ error: "シェアに必要な情報が不足しています。" }, { status: 400 });
  }

  if (!imageUrl.startsWith("/generated/")) {
    return NextResponse.json({ error: "シェア可能な画像ではありません。先に画像を生成してください。" }, { status: 400 });
  }

  const record = await createShareRecord({ phrase, imagePath: imageUrl });
  return NextResponse.json({ sharePath: `/share/${record.id}` });
}
