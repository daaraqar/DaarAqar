"use client";

import React, { useEffect, useState } from "react";
import { Heart, Share2 } from "lucide-react";

interface PropertyHeaderActionsProps {
  propertyId: string;
  title: string;
  initialFavorited: boolean;
}

export default function PropertyHeaderActions({
  propertyId,
  title,
  initialFavorited,
}: PropertyHeaderActionsProps) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => {
    setFavorited(initialFavorited);
  }, [initialFavorited]);

  useEffect(() => {
    const handleFavoriteUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ propertyId: string; isFavorited: boolean }>;
      if (customEvent.detail?.propertyId === propertyId) {
        setFavorited(customEvent.detail.isFavorited);
      }
    };
    window.addEventListener("favorites-updated", handleFavoriteUpdate);
    return () => window.removeEventListener("favorites-updated", handleFavoriteUpdate);
  }, [propertyId]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: window.location.href });
      } catch {
        // Sharing can be cancelled by the user.
      }
    } else {
      await navigator.clipboard.writeText(window.location.href);
    }
  };

  const handleFavoriteToggle = async () => {
    if (favLoading) return;
    const nextState = !favorited;
    setFavorited(nextState);
    setFavLoading(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, isFavorited: nextState }),
      });
      if (response.status === 401) {
        setFavorited(false);
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        return;
      }
      if (!response.ok) throw new Error(`Favorite update failed (${response.status})`);

      const data = await response.json();
      const isFavorited = typeof data.isFavorited === "boolean" ? data.isFavorited : nextState;
      setFavorited(isFavorited);
      window.dispatchEvent(
        new CustomEvent("favorites-updated", { detail: { propertyId, isFavorited } })
      );
    } catch (error) {
      setFavorited(!nextState);
      console.error("[PropertyHeaderActions] Could not update favorite:", error);
    } finally {
      setFavLoading(false);
    }
  };

  return (
    <div className="ms-auto flex items-center gap-1.5">
      <button
        type="button"
        onClick={handleShare}
        aria-label="مشاركة العقار"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
      >
        <Share2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleFavoriteToggle}
        disabled={favLoading}
        aria-label={favorited ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
        aria-pressed={favorited}
        className={`flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-50 ${
          favorited ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
        }`}
      >
        <Heart className={`h-4 w-4 ${favorited ? "fill-current" : ""}`} />
      </button>
    </div>
  );
}
