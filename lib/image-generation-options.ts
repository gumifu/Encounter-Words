export type ImageStyle = "cinematic" | "watercolor" | "manga" | "pop" | "minimal";
export type ImageStyleOption = {
  id: string;
  label: string;
  prompt: string;
};

export const IMAGE_STYLE_OPTIONS: ImageStyleOption[] = [
  {
    id: "cinematic",
    label: "シネマ",
    prompt: "シネマティックな実写風。映画のワンシーンのようなライティングと構図。",
  },
  {
    id: "watercolor",
    label: "水彩",
    prompt: "水彩イラスト風。にじみや紙の質感を活かした柔らかい表現。",
  },
  {
    id: "manga",
    label: "マンガ",
    prompt: "現代マンガ風。躍動感のあるポーズと明快なコントラスト。",
  },
  {
    id: "pop",
    label: "ポップ",
    prompt: "ポップアート風。大胆な色使いと楽しい雰囲気。",
  },
  {
    id: "minimal",
    label: "ミニマル",
    prompt: "ミニマルなグラフィックアート。余白と形状を活かした洗練デザイン。",
  },
  {
    id: "fantasy",
    label: "ファンタジー",
    prompt: "幻想世界の要素（魔法・異世界感・神秘的な空気）を含める。",
  },
  {
    id: "funny",
    label: "おもしろ",
    prompt: "コミカルでクスッと笑える演出（誇張された動きや表情）を入れる。",
  },
  {
    id: "surreal",
    label: "ネタ強め",
    prompt: "常識を少し外したシュールな発想で、意外性のある画作りにする。",
  },
];
