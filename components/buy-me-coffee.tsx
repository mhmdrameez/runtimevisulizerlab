"use client";

import React from "react";

function CoffeeIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
        >
            <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="1" x2="6" y2="4" />
            <line x1="10" y1="1" x2="10" y2="4" />
            <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
    );
}

export function BuyMeCoffee() {
    const username = process.env.NEXT_PUBLIC_BUY_ME_COFFEE_USERNAME || "mhmdrameez";

    return (
        <a
            href={`https://buymeacoffee.com/${username}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all hover:bg-amber-500/20 hover:text-amber-100 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] active:scale-95"
            aria-label="Support me on Buy Me a Coffee"
        >
            <CoffeeIcon />
            <span>Support</span>
        </a>
    );
}
