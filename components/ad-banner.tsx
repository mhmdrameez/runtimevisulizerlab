"use client";

import { useEffect } from "react";

interface AdBannerProps {
    dataAdSlot: string;
    dataAdFormat?: string;
    dataFullWidthResponsive?: boolean;
}

export function AdBanner({
    dataAdSlot,
    dataAdFormat = "auto",
    dataFullWidthResponsive = true,
}: AdBannerProps) {
    useEffect(() => {
        try {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
            console.error("AdSense initialization error:", err);
        }
    }, []);

    return (
        <div className="ad-container my-4 overflow-hidden rounded-lg bg-zinc-900/50 p-2 text-center text-xs text-zinc-500">
            <div className="mb-2 opacity-30">ADVERTISEMENT</div>
            <ins
                className="adsbygoogle"
                style={{ display: "block" }}
                data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_PUB_ID}
                data-ad-slot={dataAdSlot}
                data-ad-format={dataAdFormat}
                data-full-width-responsive={dataFullWidthResponsive.toString()}
            ></ins>
        </div>
    );
}
