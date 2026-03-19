"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { gsap } from "gsap";

type Pair = {
  left: string;
  right: string;
};
type LengthFilter = 1 | 2 | 3 | 4;
type PosFilter = "名詞" | "動詞" | "形容詞" | "副詞" | "その他";
type VariationMode = "standard" | "strong";
type GeneratedImage = {
  id: string;
  phrase: string;
  imageUrl: string;
  createdAt: string;
};

const FAVORITES_STORAGE_KEY = "word-fusion.favorites";
const GENERATED_IMAGES_STORAGE_KEY = "word-fusion.generated-images";
const JLPT_CSV_URL = "https://raw.githubusercontent.com/elzup/jlpt-word-list/master/out/all.min.csv";
const MIN_WORD_LENGTH = 1;
const MAX_WORD_LENGTH = 4;
const MIN_WORDS_FOR_REMOTE = 100;

const FALLBACK_A = [
  "空",
  "海",
  "山",
  "川",
  "森",
  "花",
  "風",
  "雨",
  "雪",
  "雲",
  "星",
  "月",
  "火",
  "水",
  "土",
  "光",
  "音",
  "色",
] as const;

const FALLBACK_B = [
  "心",
  "夢",
  "愛",
  "道",
  "家",
  "町",
  "本",
  "紙",
  "鳥",
  "犬",
  "猫",
  "春",
  "夏",
  "秋",
  "冬",
  "朝",
  "昼",
  "夜",
] as const;

const FALLBACK_WORDS = [...FALLBACK_A, ...FALLBACK_B];
const INITIAL_PAIR: Pair = { left: FALLBACK_WORDS[0], right: FALLBACK_WORDS[1] };
const POS_FILTERS: PosFilter[] = ["名詞", "動詞", "形容詞", "副詞", "その他"];

function randomWordIndex(max: number): number {
  return Math.floor(Math.random() * max);
}

function generatePair(words: readonly string[]): Pair {
  const leftIndex = randomWordIndex(words.length);
  let rightIndex = randomWordIndex(words.length);

  while (rightIndex === leftIndex) {
    rightIndex = randomWordIndex(words.length);
  }

  return {
    left: words[leftIndex],
    right: words[rightIndex],
  };
}

function pickDifferentWord(words: readonly string[], current: string): string {
  if (words.length <= 1) return current;
  let next = current;
  let safety = 0;
  while (next === current && safety < 20) {
    next = words[randomWordIndex(words.length)];
    safety += 1;
  }
  return next;
}

function pairToText(pair: Pair): string {
  return `${pair.left} × ${pair.right}`;
}

function inferPos(word: string): PosFilter {
  if (word.endsWith("する") || word.endsWith("れる") || word.endsWith("る") || word.endsWith("む")) {
    return "動詞";
  }
  if (word.endsWith("い")) {
    return "形容詞";
  }
  if (word.endsWith("に") || word.endsWith("と") || word.endsWith("く")) {
    return "副詞";
  }
  if (/^[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]+$/.test(word)) {
    return "名詞";
  }
  return "その他";
}

function parseCSV(csvText: string): string[] {
  const lines = csvText.split(/\r?\n/);
  const seen = new Set<string>();
  const words: string[] = [];

  for (const line of lines) {
    if (!line) continue;
    const firstColumn = line.split(",")[0]?.trim();
    if (!firstColumn) continue;
    if (firstColumn.includes("～")) continue;

    const length = [...firstColumn].length;
    if (length < MIN_WORD_LENGTH || length > MAX_WORD_LENGTH) continue;

    if (!seen.has(firstColumn)) {
      seen.add(firstColumn);
      words.push(firstColumn);
    }
  }

  return words;
}

function loadFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFavorites(favorites: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
}

function loadGeneratedImages(): GeneratedImage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GENERATED_IMAGES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GeneratedImage =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.phrase === "string" &&
        typeof item.imageUrl === "string" &&
        typeof item.createdAt === "string",
    );
  } catch {
    return [];
  }
}

function saveGeneratedImages(images: GeneratedImage[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GENERATED_IMAGES_STORAGE_KEY, JSON.stringify(images));
}

export default function Page() {
  const [pair, setPair] = useState<Pair>(INITIAL_PAIR);
  const [words, setWords] = useState<string[]>(FALLBACK_WORDS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isUsingFallback, setIsUsingFallback] = useState<boolean>(true);
  const [lengthFilters, setLengthFilters] = useState<Record<LengthFilter, boolean>>({
    1: true,
    2: true,
    3: true,
    4: true,
  });
  const [posFilters, setPosFilters] = useState<Record<PosFilter, boolean>>({
    名詞: true,
    動詞: true,
    形容詞: true,
    副詞: true,
    その他: true,
  });
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string>("");
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGalleryModalOpen, setIsGalleryModalOpen] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [imageError, setImageError] = useState("");
  const [variationMode, setVariationMode] = useState<VariationMode>("strong");
  const [includeHumanFunny, setIncludeHumanFunny] = useState(true);
  const previewCardRef = useRef<HTMLDivElement | null>(null);
  const galleryPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = loadFavorites();
    if (!stored.length) return;
    Promise.resolve().then(() => setFavorites(stored));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const left = params.get("left")?.trim();
    const right = params.get("right")?.trim();
    if (!left || !right || left === right) return;
    Promise.resolve().then(() => setPair({ left, right }));
  }, []);

  useEffect(() => {
    const stored = loadGeneratedImages();
    if (!stored.length) return;
    Promise.resolve().then(() => {
      setGeneratedImages(stored);
      setGeneratedImageUrl(stored[0].imageUrl);
    });
  }, []);

  useEffect(() => {
    fetch(JLPT_CSV_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error("CSV取得に失敗しました");
        }
        return response.text();
      })
      .then((csvText) => {
        const parsedWords = parseCSV(csvText);
        if (parsedWords.length <= MIN_WORDS_FOR_REMOTE) {
          Promise.resolve().then(() => {
            setWords(FALLBACK_WORDS);
            setIsUsingFallback(true);
            setPair(generatePair(FALLBACK_WORDS));
          });
          return;
        }

        Promise.resolve().then(() => {
          setWords(parsedWords);
          setIsUsingFallback(false);
          setPair(generatePair(parsedWords));
        });
      })
      .catch(() => {
        Promise.resolve().then(() => {
          setWords(FALLBACK_WORDS);
          setIsUsingFallback(true);
          setPair(generatePair(FALLBACK_WORDS));
        });
      });
  }, []);

  const pairText = useMemo(() => pairToText(pair), [pair]);
  const isFavorited = useMemo(() => favorites.includes(pairText), [favorites, pairText]);
  const filteredByLength = useMemo(() => {
    const next = words.filter((word) => {
      const len = [...word].length as LengthFilter;
      return Boolean(lengthFilters[len]);
    });
    return next;
  }, [lengthFilters, words]);
  const filteredWords = useMemo(() => {
    const next = filteredByLength.filter((word) => posFilters[inferPos(word)]);
    return next.length >= 2 ? next : FALLBACK_WORDS;
  }, [filteredByLength, posFilters]);
  const pairsGeneratedLabel = useMemo(() => {
    const filteredCount = filteredWords.length.toLocaleString("ja-JP");
    if (isUsingFallback) {
      return `フォールバック辞書（${filteredCount}語）から生成`;
    }
    return `約 ${filteredCount} 語のJLPT辞書から生成`;
  }, [filteredWords.length, isUsingFallback]);

  useEffect(() => {
    if (!filteredWords.includes(pair.left) || !filteredWords.includes(pair.right)) {
      Promise.resolve().then(() => setPair(generatePair(filteredWords)));
    }
  }, [filteredWords, pair.left, pair.right]);

  useEffect(() => {
    if (!previewCardRef.current || !generatedImageUrl) return;
    gsap.fromTo(
      previewCardRef.current,
      { autoAlpha: 0, y: 18, scale: 0.98 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.35, ease: "power2.out" },
    );
  }, [generatedImageUrl]);

  useEffect(() => {
    if (!isGalleryModalOpen || !galleryPanelRef.current) return;
    gsap.fromTo(
      galleryPanelRef.current,
      { autoAlpha: 0, y: 24, scale: 0.98 },
      { autoAlpha: 1, y: 0, scale: 1, duration: 0.28, ease: "power2.out" },
    );
    gsap.fromTo(
      galleryPanelRef.current.querySelectorAll("[data-gallery-item='true']"),
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.25, ease: "power2.out", stagger: 0.03, delay: 0.05 },
    );
  }, [isGalleryModalOpen]);

  const handleShuffle = () => {
    setPair(generatePair(filteredWords));
  };

  const handleSwap = () => {
    setPair((prev) => ({ left: prev.right, right: prev.left }));
  };

  const handleShuffleLeft = () => {
    setPair((prev) => {
      const nextLeft = pickDifferentWord(filteredWords, prev.left);
      return {
        left: nextLeft === prev.right ? pickDifferentWord(filteredWords, prev.right) : nextLeft,
        right: prev.right,
      };
    });
  };

  const handleShuffleRight = () => {
    setPair((prev) => {
      const nextRight = pickDifferentWord(filteredWords, prev.right);
      return {
        left: prev.left,
        right: nextRight === prev.left ? pickDifferentWord(filteredWords, prev.left) : nextRight,
      };
    });
  };

  const toggleLengthFilter = (length: LengthFilter) => {
    setLengthFilters((prev) => {
      const next = { ...prev, [length]: !prev[length] };
      const hasEnabled = Object.values(next).some(Boolean);
      return hasEnabled ? next : prev;
    });
  };
  const togglePosFilter = (pos: PosFilter) => {
    setPosFilters((prev) => {
      const next = { ...prev, [pos]: !prev[pos] };
      const hasEnabled = Object.values(next).some(Boolean);
      return hasEnabled ? next : prev;
    });
  };

  const handleFavorite = () => {
    setFavorites((prev) => {
      const next = prev.includes(pairText) ? prev.filter((item) => item !== pairText) : [pairText, ...prev];
      saveFavorites(next);
      return next;
    });
  };

  const handleGenerateImage = async () => {
    if (isGeneratingImage) return;
    setImageError("");
    setShareUrl("");
    setIsGeneratingImage(true);

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          left: pair.left,
          right: pair.right,
          phrase: pairText,
          variationMode,
          includeHumanFunny,
        }),
      });

      const data = (await response.json()) as { imageUrl?: string; error?: string };
      if (!response.ok || !data.imageUrl) {
        throw new Error(data.error ?? "画像生成に失敗しました");
      }

      setGeneratedImageUrl(data.imageUrl);
      setGeneratedImages((prev) => {
        const next: GeneratedImage[] = [
          {
            id: crypto.randomUUID(),
            phrase: pairText,
            imageUrl: data.imageUrl!,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 30);
        saveGeneratedImages(next);
        return next;
      });
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "画像生成に失敗しました");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDeleteGeneratedImage = (id: string) => {
    setGeneratedImages((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveGeneratedImages(next);
      return next;
    });
  };

  const handleCreateShare = async () => {
    if (isCreatingShare) return;
    setImageError("");
    setIsCreatingShare(true);

    try {
      if (!generatedImageUrl) {
        const wordShareUrl = `${window.location.origin}/?left=${encodeURIComponent(pair.left)}&right=${encodeURIComponent(
          pair.right,
        )}`;
        setShareUrl(wordShareUrl);
        await navigator.clipboard.writeText(`${wordShareUrl}\n\n${pairText}`);
        return;
      }

      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phrase: pairText,
          imageUrl: generatedImageUrl,
        }),
      });
      const data = (await response.json()) as { sharePath?: string; error?: string };
      if (!response.ok || !data.sharePath) {
        throw new Error(data.error ?? "シェアURLの作成に失敗しました");
      }
      const absoluteUrl = `${window.location.origin}${data.sharePath}`;
      setShareUrl(absoluteUrl);
      await navigator.clipboard.writeText(absoluteUrl);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "シェアURLの作成に失敗しました");
    } finally {
      setIsCreatingShare(false);
    }
  };

  const handleCreateShareForPhraseAndImage = async (phrase: string, imageUrl: string) => {
    if (isCreatingShare) return;
    setImageError("");
    setIsCreatingShare(true);
    try {
      const response = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrase, imageUrl }),
      });
      const data = (await response.json()) as { sharePath?: string; error?: string };
      if (!response.ok || !data.sharePath) {
        throw new Error(data.error ?? "シェアURLの作成に失敗しました");
      }
      const absoluteUrl = `${window.location.origin}${data.sharePath}`;
      setShareUrl(absoluteUrl);
      await navigator.clipboard.writeText(absoluteUrl);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "シェアURLの作成に失敗しました");
    } finally {
      setIsCreatingShare(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f5f7] p-6">
      <section className="w-full max-w-3xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-[#1d1d1f]">Word Blender</h1>
        <p className="mt-3 text-sm text-[#6e6e73]">ランダムな単語の組み合わせを発見しよう</p>
        <p className="mt-1 text-xs text-[#86868b]">{pairsGeneratedLabel}</p>

        <div className="mx-auto mt-14 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleShuffleLeft}
            className="relative flex h-32 w-56 items-center justify-center rounded-2xl border border-[#c7c7cc] bg-white text-5xl font-semibold text-[#1d1d1f] transition hover:bg-[#fbfbfd]"
            aria-label="左の単語だけシャッフル"
          >
            <span className="absolute right-3 top-3 text-sm text-[#8e8e93]" aria-hidden>
              ↻
            </span>
            {pair.left}
          </button>
          <span className="text-lg text-[#86868b]">×</span>
          <button
            type="button"
            onClick={handleShuffleRight}
            className="relative flex h-32 w-56 items-center justify-center rounded-2xl border border-[#c7c7cc] bg-white text-5xl font-semibold text-[#1d1d1f] transition hover:bg-[#fbfbfd]"
            aria-label="右の単語だけシャッフル"
          >
            <span className="absolute right-3 top-3 text-sm text-[#8e8e93]" aria-hidden>
              ↻
            </span>
            {pair.right}
          </button>
        </div>
        <div className="mt-4">
          <button
            type="button"
            className="inline-flex min-w-28 items-center justify-center gap-2 rounded-full border border-[#222] bg-[#222] px-6 py-2.5 text-base font-medium text-white transition hover:bg-[#111]"
            onClick={handleShuffle}
          >
            <span aria-hidden>↻</span>
            両方
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-8 text-[#515154]">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm transition hover:text-[#1d1d1f]"
            onClick={() => setIsFilterModalOpen(true)}
          >
            <span aria-hidden>☰</span>
            フィルター
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm transition hover:text-[#1d1d1f]"
            onClick={handleSwap}
          >
            <span aria-hidden>⇆</span>
            入れ替え
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-2 text-sm transition ${
              isFavorited ? "text-[#ff375f] hover:text-[#d7003b]" : "hover:text-[#1d1d1f]"
            }`}
            onClick={handleFavorite}
          >
            <span aria-hidden>{isFavorited ? "♥" : "♡"}</span>
            お気に入り
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm transition hover:text-[#1d1d1f] disabled:opacity-50"
            onClick={handleGenerateImage}
            disabled={isGeneratingImage}
          >
            <span aria-hidden>✦</span>
            {isGeneratingImage ? "生成中..." : "AI画像生成"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm transition hover:text-[#1d1d1f] disabled:opacity-40"
            onClick={() => setIsGalleryModalOpen(true)}
            disabled={generatedImages.length === 0}
          >
            <span aria-hidden>▦</span>
            生成一覧
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm transition hover:text-[#1d1d1f] disabled:opacity-40"
            onClick={handleCreateShare}
            disabled={isCreatingShare}
          >
            <span aria-hidden>⤴</span>
            {isCreatingShare ? "作成中..." : generatedImageUrl ? "OGPシェアURL" : "単語をシェア"}
          </button>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="text-xs text-[#8e8e93]">バリエーション</span>
          <button
            type="button"
            onClick={() => setVariationMode("standard")}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              variationMode === "standard"
                ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                : "border-[#d2d2d7] bg-white text-[#515154]"
            }`}
          >
            標準
          </button>
          <button
            type="button"
            onClick={() => setVariationMode("strong")}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              variationMode === "strong"
                ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                : "border-[#d2d2d7] bg-white text-[#515154]"
            }`}
          >
            強め
          </button>
          <button
            type="button"
            onClick={() => setIncludeHumanFunny((prev) => !prev)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              includeHumanFunny
                ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                : "border-[#d2d2d7] bg-white text-[#515154]"
            }`}
          >
            おもしろ系 + 人物必須
          </button>
        </div>

        {imageError ? <p className="mt-4 text-sm text-[#d7003b]">{imageError}</p> : null}
        {shareUrl ? (
          <p className="mx-auto mt-3 max-w-xl rounded-lg bg-[#eef6ff] px-3 py-2 text-xs text-[#1d1d1f]">
            {generatedImageUrl ? "OGPシェアURLをコピーしました" : "単語シェアURLをコピーしました"}: {shareUrl}
          </p>
        ) : null}

        {generatedImageUrl ? (
          <div ref={previewCardRef} className="mx-auto mt-6 max-w-xl overflow-hidden rounded-2xl border border-[#d2d2d7] bg-white">
            <div className="relative">
              <Image
                src={generatedImageUrl}
                alt={`${pairText} の生成画像`}
                width={1024}
                height={1024}
                className="h-auto w-full"
                unoptimized
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="truncate text-sm font-medium text-[#1d1d1f]">{pairText}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    isFavorited
                      ? "border-[#ff375f] bg-[#ff375f] text-white hover:bg-[#d7003b]"
                      : "border-[#d2d2d7] bg-white text-[#1d1d1f] hover:bg-[#f5f5f7]"
                  }`}
                  onClick={handleFavorite}
                >
                  お気に入り
                </button>
                <button
                  type="button"
                  className="rounded-full border border-[#d2d2d7] bg-white px-3 py-1.5 text-xs text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
                  onClick={() => handleCreateShareForPhraseAndImage(pairText, generatedImageUrl)}
                >
                  シェア
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-[#d2d2d7] bg-white p-5 text-left">
          <p className="text-sm font-medium text-[#1d1d1f]">お気に入り一覧（ローカル保存）</p>
          {favorites.length === 0 ? (
            <p className="mt-3 text-sm text-[#6e6e73]">まだお気に入りはありません。</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {favorites.map((item) => (
                <li key={item} className="rounded-xl bg-[#f5f5f7] px-3 py-2 text-sm text-[#1d1d1f]">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {isFilterModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="フィルター設定"
          onClick={() => setIsFilterModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[#d2d2d7] bg-white p-5 text-left"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-[#1d1d1f]">フィルター</h2>
              <button
                type="button"
                className="text-sm text-[#6e6e73] transition hover:text-[#1d1d1f]"
                onClick={() => setIsFilterModalOpen(false)}
              >
                閉じる
              </button>
            </div>

            <div className="mt-4">
              <p className="text-xs text-[#86868b]">文字数</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[1, 2, 3, 4].map((length) => (
                  <button
                    key={length}
                    type="button"
                    onClick={() => toggleLengthFilter(length as LengthFilter)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      lengthFilters[length as LengthFilter]
                        ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                        : "border-[#d2d2d7] bg-white text-[#515154] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    {length}文字
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs text-[#86868b]">品詞（推定）</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {POS_FILTERS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => togglePosFilter(pos)}
                    className={`rounded-full border px-3 py-1 text-xs transition ${
                      posFilters[pos]
                        ? "border-[#1d1d1f] bg-[#1d1d1f] text-white"
                        : "border-[#d2d2d7] bg-white text-[#515154] hover:bg-[#f5f5f7]"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isGalleryModalOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="生成画像一覧"
          onClick={() => setIsGalleryModalOpen(false)}
        >
          <div
            ref={galleryPanelRef}
            className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#111]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-sm font-medium text-white">生成一覧</p>
              <button
                type="button"
                className="text-sm text-white/80 transition hover:text-white"
                onClick={() => setIsGalleryModalOpen(false)}
              >
                閉じる
              </button>
            </div>
            <div className="grid flex-1 grid-cols-2 gap-[1px] overflow-y-auto bg-black/40 sm:grid-cols-3 md:grid-cols-4">
              {generatedImages.map((item) => (
                <div key={item.id} className="group relative bg-black" data-gallery-item="true">
                  <button
                    type="button"
                    className="relative block w-full"
                    onClick={() => {
                      setGeneratedImageUrl(item.imageUrl);
                      setIsGalleryModalOpen(false);
                    }}
                  >
                    <Image
                      src={item.imageUrl}
                      alt={`${item.phrase} の履歴画像`}
                      width={512}
                      height={512}
                      className="aspect-square w-full object-cover transition group-hover:opacity-90"
                      unoptimized
                    />
                    <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/60 px-2.5 py-1 text-xs text-white">
                      {item.phrase}
                    </div>
                  </button>
                  <button
                    type="button"
                    className="absolute left-2 top-2 rounded bg-black/55 px-2 py-1 text-[10px] text-white transition hover:bg-[#d7003b]"
                    onClick={() => handleDeleteGeneratedImage(item.id)}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
