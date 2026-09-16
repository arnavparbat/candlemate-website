"use client";

import { motion } from "framer-motion";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

export function HeroCandle() {
  const [isWinking, setIsWinking] = useState(false);
  const [sparkleActive, setSparkleActive] = useState(false);

  // Trigger wink animation
  const triggerWink = useCallback(() => {
    setIsWinking(true);
    setSparkleActive(true);
    const timer = setTimeout(() => {
      setIsWinking(false);
      setSparkleActive(false);
    }, 650);
    return () => clearTimeout(timer);
  }, []);

  // Periodic playful wink cycle every 3.8s
  useEffect(() => {
    const interval = setInterval(() => {
      triggerWink();
    }, 3800);
    return () => clearInterval(interval);
  }, [triggerWink]);

  return (
    <Link
      href="/admin/login"
      onClick={triggerWink}
      onMouseEnter={triggerWink}
      role="link"
      title="Candlemate Studio Login"
      aria-label="Open Candlemate studio login"
      className="relative mx-auto flex flex-col items-center justify-center w-full max-w-[150px] xs:max-w-[185px] sm:max-w-[260px] md:max-w-[300px] cursor-pointer select-none transition-transform active:scale-95 group block"
    >
      {/* Warm Ambient Radial Glow behind the candles */}
      <motion.div
        animate={{
          opacity: [0.5, 0.85, 0.55, 0.9, 0.5],
          scale: [0.94, 1.05, 0.96, 1.04, 0.94],
        }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-0 -top-3 rounded-full pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(ellipse at 48% 45%, rgba(251, 175, 59, 0.45) 0%, rgba(234, 88, 12, 0.16) 45%, rgba(217, 119, 6, 0.04) 70%, transparent 78%)",
          filter: "blur(18px)",
        }}
      />

      {/* Main Assembly Container maintaining exact 880 : 500 ratio */}
      <div className="relative w-full aspect-[880/500]">
        {/* Authentic Logo Line Art Image */}
        <img
          src="/logo-candles-art.png"
          alt="Candlemate Logo Candles"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none drop-shadow-[0_4px_12px_rgba(104,62,40,0.12)] transition-transform duration-300 group-hover:scale-[1.02]"
          loading="eager"
        />

        {/* Vector SVG Layer for Living Burning Flames, Faces, Wink & Sparkles */}
        <svg
          viewBox="0 0 880 500"
          className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
        >
          <defs>
            {/* Left Flame Halo Glow */}
            <radialGradient id="haloLeft" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffa600" stopOpacity="0.75" />
              <stop offset="45%" stopColor="#ff5500" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#ff5500" stopOpacity="0" />
            </radialGradient>

            {/* Right Flame Halo Glow */}
            <radialGradient id="haloRight" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffa600" stopOpacity="0.7" />
              <stop offset="45%" stopColor="#ff5500" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ff5500" stopOpacity="0" />
            </radialGradient>

            {/* Flame Outer Radiant Gradient */}
            <linearGradient id="flameOuter" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ff3700" />
              <stop offset="40%" stopColor="#ff7a00" />
              <stop offset="80%" stopColor="#ffb703" />
              <stop offset="100%" stopColor="#fff3b0" />
            </linearGradient>

            {/* Flame Inner Core Gradient */}
            <linearGradient id="flameCore" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#ff6a00" stopOpacity="0.8" />
              <stop offset="40%" stopColor="#ffd000" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>

            {/* Blur filter for realistic flame glow */}
            <filter id="flameGlowFilter" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* ========================================================= */}
          {/* 1. LEFT CANDLE: LIVING BURNING FLAME (Wick at 279, 173)   */}
          {/* ========================================================= */}
          <g transform="translate(279, 173)">
            {/* Ambient Flame Aura Glow */}
            <motion.circle
              cx="0"
              cy="-60"
              r="58"
              fill="url(#haloLeft)"
              animate={{
                opacity: [0.65, 0.95, 0.7, 1, 0.65],
                scale: [0.94, 1.08, 0.96, 1.05, 0.94],
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Animated Flickering Flame Body */}
            <motion.g
              animate={{
                scaleY: [1, 1.09, 0.93, 1.08, 0.96, 1],
                scaleX: [1, 0.93, 1.06, 0.95, 1.03, 1],
                rotate: [-2, 2.2, -1.5, 2, -0.8, -2],
                x: [-0.6, 0.7, -0.5, 0.6, -0.6],
              }}
              transition={{
                duration: 0.85,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
              style={{ transformOrigin: "0px 0px" }}
            >
              {/* Outer Amber Teardrop */}
              <path
                d="M 0 -130 C 22 -95 36 -60 36 -35 C 36 -12 22 0 0 0 C -22 0 -36 -12 -36 -35 C -36 -60 -22 -95 0 -130 Z"
                fill="url(#flameOuter)"
                filter="url(#flameGlowFilter)"
              />

              {/* Radiant Inner Flame */}
              <path
                d="M 0 -95 C 14 -70 22 -48 22 -28 C 22 -10 13 0 0 0 C -13 0 -22 -10 -22 -28 C -22 -48 -14 -70 0 -95 Z"
                fill="url(#flameCore)"
              />

              {/* Incandescent White Center Core */}
              <path
                d="M 0 -65 C 8 -48 11 -32 11 -18 C 11 -6 6 0 0 0 C -6 0 -11 -6 -11 -18 C -11 -32 -8 -48 0 -65 Z"
                fill="#ffffff"
                opacity="0.95"
              />

              {/* Blue Corona Base at Wick */}
              <ellipse cx="0" cy="-2" rx="9" ry="3.5" fill="#3a68ff" opacity="0.85" />
              <ellipse cx="0" cy="-1.5" rx="5" ry="2" fill="#90b8ff" opacity="0.95" />
            </motion.g>

            {/* Rising Micro-Spark Ember 1 */}
            <motion.circle
              cx="0"
              cy="-50"
              r="2.8"
              fill="#fed7aa"
              animate={{
                cy: [-50, -140, -210],
                cx: [0, 8, -6],
                opacity: [0, 0.9, 0],
                scale: [0.6, 1.2, 0.2],
              }}
              transition={{
                duration: 2.1,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.15,
              }}
            />

            {/* Rising Micro-Spark Ember 2 */}
            <motion.circle
              cx="0"
              cy="-45"
              r="2.4"
              fill="#fde047"
              animate={{
                cy: [-45, -125, -190],
                cx: [0, -7, 5],
                opacity: [0, 0.8, 0],
                scale: [0.5, 1, 0.2],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeOut",
                delay: 1.2,
              }}
            />
          </g>

          {/* ========================================================= */}
          {/* 2. RIGHT CANDLE: COMPANION BURNING FLAME (Wick at 567, 225) */}
          {/* ========================================================= */}
          <g transform="translate(567, 225) scale(0.82)">
            {/* Ambient Flame Aura Glow */}
            <motion.circle
              cx="0"
              cy="-60"
              r="54"
              fill="url(#haloRight)"
              animate={{
                opacity: [0.6, 0.9, 0.65, 0.95, 0.6],
                scale: [0.95, 1.07, 0.97, 1.04, 0.95],
              }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />

            {/* Animated Flickering Flame Body (Counter-phase) */}
            <motion.g
              animate={{
                scaleY: [1, 1.07, 0.94, 1.09, 0.96, 1],
                scaleX: [1, 0.95, 1.05, 0.94, 1.02, 1],
                rotate: [1.8, -2, 1.2, -1.8, 0.7, 1.8],
                x: [0.5, -0.6, 0.4, -0.5, 0.5],
              }}
              transition={{
                duration: 0.92,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
                delay: 0.3,
              }}
              style={{ transformOrigin: "0px 0px" }}
            >
              <path
                d="M 0 -130 C 22 -95 36 -60 36 -35 C 36 -12 22 0 0 0 C -22 0 -36 -12 -36 -35 C -36 -60 -22 -95 0 -130 Z"
                fill="url(#flameOuter)"
                filter="url(#flameGlowFilter)"
              />
              <path
                d="M 0 -95 C 14 -70 22 -48 22 -28 C 22 -10 13 0 0 0 C -13 0 -22 -10 -22 -28 C -22 -48 -14 -70 0 -95 Z"
                fill="url(#flameCore)"
              />
              <path
                d="M 0 -65 C 8 -48 11 -32 11 -18 C 11 -6 6 0 0 0 C -6 0 -11 -6 -11 -18 C -11 -32 -8 -48 0 -65 Z"
                fill="#ffffff"
                opacity="0.95"
              />
              <ellipse cx="0" cy="-2" rx="8.5" ry="3" fill="#3a68ff" opacity="0.8" />
              <ellipse cx="0" cy="-1.5" rx="4.5" ry="1.8" fill="#90b8ff" opacity="0.9" />
            </motion.g>

            {/* Rising Micro-Spark Ember */}
            <motion.circle
              cx="0"
              cy="-48"
              r="2.5"
              fill="#fed7aa"
              animate={{
                cy: [-48, -135, -200],
                cx: [0, 6, -5],
                opacity: [0, 0.85, 0],
                scale: [0.5, 1.1, 0.2],
              }}
              transition={{
                duration: 2.3,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.8,
              }}
            />
          </g>

          {/* ========================================================= */}
          {/* 3. LEFT CANDLE: ARTISANAL FACE & WINK (Center at 279, 282) */}
          {/* ========================================================= */}
          <g transform="translate(279, 282)">
            {/* Left Eye (Serene, gentle curve) */}
            <path
              d="M -18 -4 C -14 -12 -6 -12 -2 -4"
              stroke="#683e28"
              strokeWidth="4.5"
              strokeLinecap="round"
              fill="none"
            />

            {/* Right Eye: Peaceful when idle, Adorable Wink when isWinking */}
            {!isWinking ? (
              <path
                d="M 2 -4 C 6 -12 14 -12 18 -4"
                stroke="#683e28"
                strokeWidth="4.5"
                strokeLinecap="round"
                fill="none"
              />
            ) : (
              <g>
                {/* Winking crescent curve */}
                <path
                  d="M 3 -3 C 7 5 15 5 19 -1"
                  stroke="#683e28"
                  strokeWidth="5"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Cute upward wink eyelash flick */}
                <path
                  d="M 19 -1 L 23 -5"
                  stroke="#683e28"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            )}

            {/* Heartwarming Sweet Smile */}
            <path
              d="M -7 11 Q 0 18 7 11"
              stroke="#683e28"
              strokeWidth="3.6"
              strokeLinecap="round"
              fill="none"
            />

            {/* Soft artisanal terracotta blushing cheeks */}
            <ellipse cx="-22" cy="6" rx="7" ry="4.5" fill="#e07a5f" opacity="0.38" />
            <ellipse cx="22" cy="6" rx="7" ry="4.5" fill="#e07a5f" opacity="0.38" />

            {/* Playful Golden Sparkle Glint during Wink */}
            {sparkleActive && (
              <motion.g
                transform="translate(25, -14)"
                initial={{ scale: 0, opacity: 0, rotate: -20 }}
                animate={{ scale: [0, 1.25, 0], opacity: [0, 1, 0], rotate: [0, 45, 90] }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                {/* 4-point gold glint star */}
                <path
                  d="M 0 -11 Q 0 0 11 0 Q 0 0 0 11 Q 0 0 -11 0 Q 0 0 0 -11 Z"
                  fill="#f59e0b"
                />
                <circle cx="0" cy="0" r="2.5" fill="#ffffff" />
              </motion.g>
            )}
          </g>

          {/* ========================================================= */}
          {/* 4. RIGHT CANDLE: COMPANION FACE (Center at 567, 325)     */}
          {/* ========================================================= */}
          <g transform="translate(567, 325) scale(0.92)">
            {/* Peaceful closed resting eyes basking in the glow */}
            <path
              d="M -14 -4 C -11 -10 -5 -10 -2 -4"
              stroke="#683e28"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 4 -4 C 7 -10 13 -10 16 -4"
              stroke="#683e28"
              strokeWidth="4"
              strokeLinecap="round"
              fill="none"
            />

            {/* Gentle content smile */}
            <path
              d="M -5 8 Q 0 14 5 8"
              stroke="#683e28"
              strokeWidth="3.2"
              strokeLinecap="round"
              fill="none"
            />

            {/* Soft blushing cheeks */}
            <ellipse cx="-16" cy="4" rx="6" ry="4" fill="#e07a5f" opacity="0.32" />
            <ellipse cx="18" cy="4" rx="6" ry="4" fill="#e07a5f" opacity="0.32" />
          </g>
        </svg>

        {/* Soft Ground Contact Shadow under candle bases */}
        <div className="absolute bottom-1 left-[22%] w-[18%] h-2.5 rounded-[50%] bg-[#2e1408]/15 blur-[4px] pointer-events-none" />
        <div className="absolute bottom-1 left-[58%] w-[16%] h-2 rounded-[50%] bg-[#2e1408]/15 blur-[3.5px] pointer-events-none" />
      </div>
    </Link>
  );
}
