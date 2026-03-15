"use client";

import { useEffect, useRef, useState } from "react";

interface GoogleAdProps {
    dataAdSlot: string;
    dataAdFormat?: string;
    dataFullWidthResponsive?: boolean;
}

export function GoogleAd({
    dataAdSlot,
    dataAdFormat = "auto",
    dataFullWidthResponsive = true,
}: GoogleAdProps) {
    const [isVisible, setIsVisible] = useState(false);
    const adRef = useRef<HTMLModElement>(null);

    useEffect(() => {
        // 1. Trigger the initialization
        try {
            // @ts-ignore
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
            console.error("AdSense initialization error:", err);
        }

        // 2. Observer for checking if the ad is served
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === "attributes" && mutation.attributeName === "data-ad-status") {
                    const status = adRef.current?.getAttribute("data-ad-status");
                    if (status === "filled") {
                        setIsVisible(true);
                        observer.disconnect(); // Stop observing once it's filled
                    }
                }
            });
        });

        if (adRef.current) {
            observer.observe(adRef.current, {
                attributes: true,
                attributeFilter: ["data-ad-status"],
            });

            // Handle immediate filled state if it happened before observation
            if (adRef.current.getAttribute("data-ad-status") === "filled") {
                setIsVisible(true);
                observer.disconnect();
            }
        }

        return () => observer.disconnect();
    }, []);

    const pubId = process.env.NEXT_PUBLIC_ADSENSE_PUB_ID;

    return (
        <div
            className={`ad-container overflow-hidden transition-all duration-500 ease-in-out ${isVisible ? "my-4 max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                }`}
        >
            <div className="rounded-lg bg-zinc-900/50 p-2 text-center text-xs text-zinc-500 shadow-sm">
                <div className="mb-2 uppercase tracking-widest opacity-30">Advertisement</div>
                <ins
                    ref={adRef}
                    className="adsbygoogle"
                    style={{ display: "block" }}
                    data-ad-client={pubId}
                    data-ad-slot={dataAdSlot}
                    data-ad-format={dataAdFormat}
                    data-full-width-responsive={dataFullWidthResponsive.toString()}
                ></ins>
            </div>
        </div>
    );
}
