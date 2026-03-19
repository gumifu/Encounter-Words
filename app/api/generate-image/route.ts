import { NextResponse } from "next/server";
import { saveGeneratedImageFromBase64, saveGeneratedImageFromRemoteUrl } from "../../../lib/server/share-store";

type GenerateImageRequest = {
  left?: string;
  right?: string;
  phrase?: string;
  variationMode?: "standard" | "strong";
  includeHumanFunny?: boolean;
};

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildPrompt(
  phrase: string,
  variationMode: "standard" | "strong",
  includeHumanFunny: boolean,
): string {
  const styles = [
    "シネマティックな写真風",
    "水彩イラスト風",
    "墨絵と現代デザインの融合",
    "3Dレンダリング風",
    "切り絵コラージュ風",
    "油彩アート風",
    "ポスターデザイン風",
    "ミニマルなグラフィックアート",
  ] as const;
  const compositions = [
    "中央構図",
    "左右非対称構図",
    "俯瞰構図",
    "ローアングル構図",
    "余白を大きく活かした構図",
    "被写体を大胆にクローズアップ",
  ] as const;
  const moods = [
    "静かで詩的",
    "神秘的で夢のよう",
    "エネルギッシュで鮮烈",
    "少しノスタルジック",
    "透明感が高く澄んだ空気感",
  ] as const;
  const colorPalettes = [
    "寒色中心",
    "暖色中心",
    "モノクロに近い低彩度",
    "高彩度でコントラスト強め",
    "パステル調",
  ] as const;
  const textures = [
    "やわらかな拡散光",
    "ドラマチックな陰影",
    "霧のようなレイヤー感",
    "粒子感のあるフィルム質感",
    "ガラスのような透明感",
  ] as const;

  const details =
    variationMode === "strong"
      ? [
          `スタイル: ${pickRandom(styles)}`,
          `構図: ${pickRandom(compositions)}`,
          `ムード: ${pickRandom(moods)}`,
          `色調: ${pickRandom(colorPalettes)}`,
          `質感: ${pickRandom(textures)}`,
          `ランダムキー: ${Math.floor(Math.random() * 1_000_000)}`,
        ]
      : [
          `スタイル: ${pickRandom(styles)}`,
          `構図: ${pickRandom(compositions)}`,
          `色調: ${pickRandom(colorPalettes)}`,
        ];

  const humanFunnyConditions = includeHumanFunny
    ? [
        "- 人物を1人以上、必ず画面内に入れる",
        "- ユーモアのある演出（表情・ポーズ・シチュエーション）を強める",
      ]
    : [];

  return [
    "次の日本語の造語イメージを、1枚の完成されたビジュアルにしてください。",
    `キーワード: ${phrase}`,
    ...details,
    "条件:",
    "- 文字やロゴは入れない",
    "- 日本語の語感を想起させる抽象性と具体性のバランス",
    "- 高品質で破綻のない画像",
    ...humanFunnyConditions,
  ].join("\n");
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY が未設定です。.env.local に設定してください。" },
      { status: 500 },
    );
  }

  let body: GenerateImageRequest;
  try {
    body = (await request.json()) as GenerateImageRequest;
  } catch {
    return NextResponse.json({ error: "リクエスト形式が不正です。" }, { status: 400 });
  }

  const left = body.left?.trim();
  const right = body.right?.trim();
  const phrase = body.phrase?.trim();
  const variationMode = body.variationMode === "strong" ? "strong" : "standard";
  const includeHumanFunny = body.includeHumanFunny === true;
  if (!left || !right || !phrase) {
    return NextResponse.json({ error: "単語ペアが不足しています。" }, { status: 400 });
  }

  const prompt = buildPrompt(phrase, variationMode, includeHumanFunny);

  const openAiResponse = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1024",
    }),
  });

  if (!openAiResponse.ok) {
    const errorText = await openAiResponse.text();
    return NextResponse.json(
      { error: `画像生成APIエラー: ${openAiResponse.status} ${errorText}` },
      { status: 500 },
    );
  }

  const result = (await openAiResponse.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const first = result.data?.[0];
  if (!first) {
    return NextResponse.json({ error: "画像データを取得できませんでした。" }, { status: 500 });
  }

  if (first.url) {
    const imagePath = await saveGeneratedImageFromRemoteUrl(first.url);
    return NextResponse.json({ imageUrl: imagePath });
  }

  if (first.b64_json) {
    const imagePath = await saveGeneratedImageFromBase64(first.b64_json);
    return NextResponse.json({ imageUrl: imagePath });
  }

  return NextResponse.json({ error: "画像データ形式が不正です。" }, { status: 500 });
}
