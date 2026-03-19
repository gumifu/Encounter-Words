import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ShareRecord = {
  id: string;
  phrase: string;
  imagePath: string;
  createdAt: string;
};

const PUBLIC_GENERATED_DIR = path.join(process.cwd(), "public", "generated");
const SHARE_DATA_DIR = path.join(process.cwd(), "data", "shares");

async function ensureDirectories(): Promise<void> {
  await mkdir(PUBLIC_GENERATED_DIR, { recursive: true });
  await mkdir(SHARE_DATA_DIR, { recursive: true });
}

export async function saveGeneratedImageFromBase64(base64Data: string): Promise<string> {
  await ensureDirectories();
  const filename = `${crypto.randomUUID()}.png`;
  const absolutePath = path.join(PUBLIC_GENERATED_DIR, filename);
  const buffer = Buffer.from(base64Data, "base64");
  await writeFile(absolutePath, buffer);
  return `/generated/${filename}`;
}

export async function saveGeneratedImageFromRemoteUrl(remoteUrl: string): Promise<string> {
  await ensureDirectories();
  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error("生成画像の保存に失敗しました。");
  }
  const arrayBuffer = await response.arrayBuffer();
  const filename = `${crypto.randomUUID()}.png`;
  const absolutePath = path.join(PUBLIC_GENERATED_DIR, filename);
  await writeFile(absolutePath, Buffer.from(arrayBuffer));
  return `/generated/${filename}`;
}

export async function createShareRecord(input: { phrase: string; imagePath: string }): Promise<ShareRecord> {
  await ensureDirectories();
  const record: ShareRecord = {
    id: crypto.randomUUID(),
    phrase: input.phrase,
    imagePath: input.imagePath,
    createdAt: new Date().toISOString(),
  };
  const absolutePath = path.join(SHARE_DATA_DIR, `${record.id}.json`);
  await writeFile(absolutePath, JSON.stringify(record, null, 2), "utf8");
  return record;
}

export async function getShareRecord(id: string): Promise<ShareRecord | null> {
  try {
    const absolutePath = path.join(SHARE_DATA_DIR, `${id}.json`);
    const raw = await readFile(absolutePath, "utf8");
    const parsed = JSON.parse(raw) as ShareRecord;
    if (!parsed?.id || !parsed?.phrase || !parsed?.imagePath) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
