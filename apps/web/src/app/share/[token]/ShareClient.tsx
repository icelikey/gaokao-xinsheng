"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";

type ApiResponse<T> = {
  data: T | null;
  error: { code: string; message: string } | null;
};

type ShareCard = {
  token: string;
  objectUrl: string;
  poster: {
    alt: string;
    width: number;
    height: number;
  };
  publicFields: {
    title: string;
    paperTitle: string | null;
    region: string | null;
    independentScore: number | null;
    collaborativeScore: number | null;
    totalScore: number | null;
    aiHelpCount: number;
    reviewCount: number;
    disclaimer: string;
    visibility: {
      showIndependentScore: boolean;
      showCollaborativeScore: boolean;
      showPaperTitle: boolean;
      showRegion: boolean;
    };
  };
};

export function ShareClient({ token }: { token: string }) {
  const [shareCard, setShareCard] = useState<ShareCard | null>(null);
  const [status, setStatus] = useState("正在打开分享记录...");

  useEffect(() => {
    async function loadShareCard() {
      const response = await fetch(`/api/v1/share/${token}`);
      const payload = (await response.json()) as ApiResponse<ShareCard>;

      if (!payload.data) {
        setStatus(payload.error?.message ?? "分享卡不存在");
        return;
      }

      setShareCard(payload.data);
      setStatus("分享记录已打开。");
    }

    void loadShareCard();
  }, [token]);

  if (!shareCard) {
    return (
      <main className="sharePage">
        <section className="shareCard">
          <p className="eyebrow">Share</p>
          <h1>{status}</h1>
          <Link className="primaryButton" href="/">
            返回产品预览
          </Link>
        </section>
      </main>
    );
  }

  const hasVisibleScore =
    shareCard.publicFields.independentScore !== null || shareCard.publicFields.collaborativeScore !== null;

  return (
    <main className="sharePage">
      <section className="shareCard posterCard">
        <p className="eyebrow">AI估分分享</p>
        {shareCard.objectUrl ? (
          <Image
            className="posterImage"
            src={shareCard.objectUrl}
            alt={shareCard.poster.alt}
            width={shareCard.poster.width}
            height={shareCard.poster.height}
            unoptimized
          />
        ) : null}
        <h1>{shareCard.publicFields.title}</h1>
        {hasVisibleScore ? (
          <div className="scorePair">
            {shareCard.publicFields.independentScore !== null ? (
              <div>
                <span>独立作答分</span>
                <strong>{shareCard.publicFields.independentScore}</strong>
                <small>/{shareCard.publicFields.totalScore}</small>
              </div>
            ) : null}
            {shareCard.publicFields.collaborativeScore !== null ? (
              <div>
                <span>AI协作分</span>
                <strong>{shareCard.publicFields.collaborativeScore}</strong>
                <small>/{shareCard.publicFields.totalScore}</small>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="shareMeta">
          {shareCard.publicFields.paperTitle ? <span>{shareCard.publicFields.paperTitle}</span> : null}
          {shareCard.publicFields.region ? <span>{shareCard.publicFields.region}</span> : null}
          <span>AI提示 {shareCard.publicFields.aiHelpCount} 次</span>
          <span>需复核 {shareCard.publicFields.reviewCount} 题</span>
        </div>
        <p className="disclaimer">{shareCard.publicFields.disclaimer}</p>
        <p className="disclaimer">分享令牌：{shareCard.token}</p>
        <Link className="primaryButton" href="/">
          查看产品预览
        </Link>
      </section>
    </main>
  );
}
