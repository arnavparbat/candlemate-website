"use client";

import { motion } from "framer-motion";

export type CandleStage = "empty" | "filled" | "checkout" | "burning" | "done";

export function Candle({
  stage,
  compact = false,
  showBadge = true,
}: {
  stage: CandleStage;
  compact?: boolean;
  showBadge?: boolean;
}) {
  const hasWick = stage !== "empty";
  const isBurning = stage === "burning" || stage === "done";

  const stageLabels: Record<CandleStage, string> = {
    empty: "Jar prepared",
    filled: "Wick centered",
    checkout: "Spiral wick ready",
    burning: "Glowing warm flame",
    done: "Handcrafted & lit",
  };

  return (
    <div
      className={`flex flex-col items-center select-none ${
        compact ? "scale-[0.78] sm:scale-100 origin-center" : ""
      }`}
      aria-label={`Candle crafting: ${stageLabels[stage]}`}
    >
      {/* Candle Assembly Viewport */}
      <div className="relative h-56 w-40 flex items-end justify-center pb-3 overflow-visible">
        {/* Warm Ambient Backlight Glow when lit */}
        {isBurning && (
          <motion.div
            animate={{
              opacity: [0.45, 0.75, 0.5, 0.8, 0.45],
              scale: [0.95, 1.06, 0.98, 1.05, 0.95],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-1 left-1/2 -translate-x-1/2 h-44 w-44 rounded-full pointer-events-none -z-10"
            style={{
              background:
                "radial-gradient(circle, rgba(250, 175, 55, 0.5) 0%, rgba(225, 105, 25, 0.2) 45%, transparent 72%)",
            }}
          />
        )}

        {/* Floating micro-embers rising from flame */}
        {isBurning && (
          <>
            <motion.div
              animate={{
                y: [-5, -35, -55],
                x: [0, 4, -3],
                opacity: [0, 0.9, 0],
                scale: [0.8, 1, 0.4],
              }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeOut", delay: 0.2 }}
              className="absolute h-1 w-1 rounded-full bg-[#ffb703] shadow-[0_0_6px_#ff9e00] pointer-events-none z-40"
              style={{ bottom: "135px", left: "calc(50% + 5px)" }}
            />
            <motion.div
              animate={{
                y: [-2, -28, -48],
                x: [0, -5, 3],
                opacity: [0, 0.8, 0],
                scale: [0.7, 0.9, 0.3],
              }}
              transition={{ duration: 2.1, repeat: Infinity, ease: "easeOut", delay: 1.1 }}
              className="absolute h-1 w-1 rounded-full bg-[#ff8500] shadow-[0_0_5px_#ff5400] pointer-events-none z-40"
              style={{ bottom: "132px", left: "calc(50% - 2px)" }}
            />
          </>
        )}

        {/* Real Wood Coaster Base & Shadow */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-36 h-4 rounded-[50%] bg-[#2b140a]/25 blur-[5px] -z-10" />
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-3.5 rounded-[50%] border-t border-[#d8a475]/50 shadow-md -z-10"
          style={{
            background: "linear-gradient(180deg, #ad7147 0%, #7d4826 60%, #4a2411 100%)",
          }}
        />

        {/* Amber Glass Jar Vessel */}
        <div className="relative w-28 h-36 flex items-end justify-center">
          {/* Glass Cylinder with Amber Tint & Specular Glare */}
          <div
            className="absolute inset-0 rounded-b-[22px] rounded-t-[6px] shadow-xl border-t-2 border-white/35 overflow-hidden"
            style={{
              background:
                "linear-gradient(90deg, rgba(65,27,12,0.92) 0%, rgba(142,63,25,0.65) 16%, rgba(210,110,48,0.25) 48%, rgba(245,166,98,0.32) 58%, rgba(148,68,28,0.68) 84%, rgba(58,22,10,0.95) 100%)",
              boxShadow:
                "inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -4px 10px rgba(45,18,8,0.6), 0 10px 20px -5px rgba(50,20,10,0.3)",
            }}
          >
            {/* Top Lip Glass Highlight */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-white/40 to-transparent z-30" />

            {/* Vertical Specular Glass Reflection */}
            <div className="absolute inset-y-0 left-2.5 w-2 bg-gradient-to-r from-transparent via-white/20 to-transparent z-30 pointer-events-none" />

            {/* Glass Base Thickness */}
            <div
              className="absolute bottom-0 inset-x-0 h-3 rounded-b-[22px] z-20 pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(80,35,16,0.2) 0%, rgba(50,20,8,0.85) 100%)",
                borderTop: "1px solid rgba(255,255,255,0.15)",
              }}
            />
          </div>

          {/* Centered Spiral Braided Cotton Wick (Clean vector wick with metal sustainer tab) */}
          {hasWick && (
            <motion.div
              initial={{ y: -25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute z-25 pointer-events-none"
              style={{
                bottom: "10px",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <svg
                width="36"
                height="96"
                viewBox="0 0 36 96"
                fill="none"
                className="overflow-visible"
              >
                {/* Silver Metal Sustainer Tab at jar bottom */}
                <ellipse cx="18" cy="91" rx="11" ry="3" fill="#b0a597" opacity="0.8" />
                <ellipse cx="18" cy="89.5" rx="5" ry="1.5" fill="#4a3e35" />

                {/* Handcrafted Cotton Wick rising with organic spiral curl */}
                <path
                  d="M 18 89 C 17.5 68 17 48 18 34 C 19 23 25 18 26.5 12 C 27.5 7 24 3 20 4 C 16.5 5 16 9.5 19.5 11.5 C 22.5 13 25 11.5 24 8.5"
                  stroke="#211107"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />

                {/* Braided cotton cord texture line */}
                <path
                  d="M 18 89 C 17.5 68 17 48 18 34 C 19 23 25 18 26.5 12 C 27.5 7 24 3 20 4"
                  stroke="#e2c19b"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                  opacity="0.6"
                />

                {/* Charred spiral ember tip */}
                <circle
                  cx="24"
                  cy="8.5"
                  r="2"
                  fill={isBurning ? "#ff3700" : "#120603"}
                  style={{
                    filter: isBurning ? "drop-shadow(0 0 5px #ff5500)" : "none",
                  }}
                />
              </svg>
            </motion.div>
          )}

          {/* Living Teardrop Flame sitting right on the spiral ember tip */}
          {isBurning && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute z-35 flex flex-col items-center pointer-events-none"
              style={{
                bottom: "94px",
                left: "calc(50% + 6px)", // aligns precisely with the spiral tip
                transform: "translateX(-50%)",
              }}
            >
              {/* Flickering Flame Body */}
              <motion.div
                animate={{
                  scaleY: [1, 1.08, 0.94, 1.06, 0.97, 1],
                  scaleX: [1, 0.94, 1.05, 0.96, 1.02, 1],
                  rotate: [-1.8, 1.8, -1.2, 2, -0.8, -1.8],
                  x: [-0.4, 0.5, -0.5, 0.3, -0.4],
                }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }}
                className="relative flex items-end justify-center"
              >
                <svg
                  width="30"
                  height="50"
                  viewBox="0 0 30 50"
                  fill="none"
                  className="overflow-visible"
                >
                  <defs>
                    {/* Flame outer glow blur */}
                    <filter id="flameBlur" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    {/* Outer radiant gradient */}
                    <radialGradient id="outerHalo" cx="50%" cy="80%" r="65%">
                      <stop offset="0%" stopColor="#ff4500" stopOpacity="0.95" />
                      <stop offset="60%" stopColor="#ff8c00" stopOpacity="0.75" />
                      <stop offset="100%" stopColor="#ffa500" stopOpacity="0" />
                    </radialGradient>

                    {/* Main flame gradient */}
                    <linearGradient id="mainFlame" x1="50%" y1="100%" x2="50%" y2="0%">
                      <stop offset="0%" stopColor="#ff5500" />
                      <stop offset="35%" stopColor="#ffaa00" />
                      <stop offset="75%" stopColor="#ffea75" />
                      <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>

                    {/* White-hot center core */}
                    <linearGradient id="whiteCore" x1="50%" y1="100%" x2="50%" y2="0%">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                      <stop offset="40%" stopColor="#ffffff" stopOpacity="0.95" />
                      <stop offset="100%" stopColor="#ffffff" />
                    </linearGradient>
                  </defs>

                  {/* Outer Amber Halo Teardrop */}
                  <path
                    d="M 15 2 C 22 15 28 26 28 36 C 28 44 22 49 15 49 C 8 49 2 44 2 36 C 2 26 8 15 15 2 Z"
                    fill="url(#outerHalo)"
                    filter="url(#flameBlur)"
                  />

                  {/* Body Teardrop Flame */}
                  <path
                    d="M 15 5 C 21 16 25 26 25 36 C 25 42 20.5 46.5 15 46.5 C 9.5 46.5 5 42 5 36 C 5 26 9 16 15 5 Z"
                    fill="url(#mainFlame)"
                  />

                  {/* Incandescent White Core */}
                  <path
                    d="M 15 16 C 18 24 20 30 20 36 C 20 40 17.5 43 15 43 C 12.5 43 10 40 10 36 C 10 30 12 24 15 16 Z"
                    fill="url(#whiteCore)"
                  />

                  {/* Blue Corona Base right at wick */}
                  <ellipse cx="15" cy="46" rx="4.5" ry="2" fill="#3a68ff" opacity="0.85" />
                  <ellipse cx="15" cy="45.5" rx="2.5" ry="1.2" fill="#90b8ff" opacity="0.9" />
                </svg>
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Progress Badge */}
      {showBadge && (
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="mt-0.5 inline-flex items-center gap-1.5 rounded-full bg-[#fff8ed]/95 border border-[#8a61482a] px-3 py-1 shadow-sm text-xs font-medium text-[#765442] backdrop-blur"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              stage === "done" || stage === "burning"
                ? "bg-[#e5832d] shadow-[0_0_8px_#f19b45]"
                : stage === "checkout"
                ? "bg-[#9e6741]"
                : stage === "filled"
                ? "bg-[#d4a872]"
                : "bg-stone-300"
            }`}
          />
          <span>{stageLabels[stage]}</span>
        </motion.div>
      )}
    </div>
  );
}
