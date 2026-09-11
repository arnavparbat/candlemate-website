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
  const hasWax = stage !== "empty";
  const hasWick = stage === "checkout" || stage === "burning" || stage === "done";
  const isBurning = stage === "burning" || stage === "done";

  const stageLabels: Record<CandleStage, string> = {
    empty: "Jar prepared",
    filled: "Soy wax poured",
    checkout: "Spiral wick set",
    burning: "Warm glowing flame",
    done: "Handcrafted & ready",
  };

  return (
    <div
      className={`flex flex-col items-center select-none ${
        compact ? "scale-[0.82] sm:scale-100 origin-bottom" : ""
      }`}
      aria-label={`Candle crafting: ${stageLabels[stage]}`}
    >
      {/* Candle Assembly Viewport (overflow visible so wick & flame bloom naturally) */}
      <div className="relative h-60 w-44 flex items-end justify-center pb-4 overflow-visible">
        {/* Ambient Warm Halo when burning */}
        {isBurning && (
          <motion.div
            animate={{
              opacity: [0.4, 0.7, 0.45, 0.75, 0.4],
              scale: [0.96, 1.06, 0.98, 1.04, 0.96],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-2 left-1/2 -translate-x-1/2 h-48 w-48 rounded-full pointer-events-none -z-10"
            style={{
              background:
                "radial-gradient(circle, rgba(248, 175, 60, 0.45) 0%, rgba(225, 110, 30, 0.18) 45%, transparent 72%)",
            }}
          />
        )}

        {/* Real Wood Coaster Base & Cast Shadow */}
        <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-36 h-4 rounded-[50%] bg-[#2b140a]/30 blur-[5px] -z-10" />
        <div
          className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-3.5 rounded-[50%] border-t border-[#d8a475]/50 shadow-md -z-10"
          style={{
            background:
              "linear-gradient(180deg, #ad7147 0%, #7d4826 60%, #4a2411 100%)",
          }}
        />

        {/* Outer Candle Jar Wrapper */}
        <div className="relative w-28 h-36 flex items-end justify-center">
          {/* Amber Glass Body */}
          <div
            className="absolute inset-0 rounded-b-[22px] rounded-t-[5px] shadow-xl border-t-2 border-white/35 overflow-hidden"
            style={{
              background:
                "linear-gradient(90deg, rgba(65,27,12,0.94) 0%, rgba(142,63,25,0.7) 16%, rgba(210,110,48,0.32) 48%, rgba(245,166,98,0.38) 58%, rgba(148,68,28,0.74) 84%, rgba(58,22,10,0.96) 100%)",
              boxShadow:
                "inset 0 1px 2px rgba(255,255,255,0.45), inset 0 -4px 10px rgba(45,18,8,0.7), 0 10px 20px -5px rgba(50,20,10,0.35)",
            }}
          >
            {/* Glass Rim Top Lip Highlight */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-white/40 to-transparent z-30" />

            {/* Left Vertical Specular Glare */}
            <div className="absolute inset-y-0 left-2.5 w-2 bg-gradient-to-r from-transparent via-white/25 to-transparent z-30 pointer-events-none" />

            {/* Creamy Soy Wax Body (inside the jar) */}
            {hasWax && (
              <motion.div
                initial={{ height: 0 }}
                animate={
                  isBurning
                    ? { height: 96, y: [0, 2, 4] }
                    : { height: 104, y: 0 }
                }
                transition={{ duration: 1.1, ease: "easeOut" }}
                className="absolute bottom-2 inset-x-2 rounded-b-[16px] z-10"
                style={{
                  background: isBurning
                    ? "linear-gradient(180deg, #f5c87e 0%, #edd8b8 16%, #e2c79f 80%, #caa471 100%)"
                    : "linear-gradient(180deg, #fbf4ea 0%, #f1dfc5 20%, #e5cb9f 80%, #caa573 100%)",
                  boxShadow:
                    "inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -3px 6px rgba(90,45,20,0.25)",
                }}
              >
                {/* Molten Glow pool when burning */}
                {isBurning && (
                  <motion.div
                    animate={{ opacity: [0.65, 0.95, 0.7, 1, 0.65] }}
                    transition={{
                      duration: 1.6,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="absolute top-0 inset-x-0 h-3 rounded-[50%] bg-[#ffbe4d]/70 blur-[1px]"
                  />
                )}
              </motion.div>
            )}

            {/* Glass Base Thickness */}
            <div
              className="absolute bottom-0 inset-x-0 h-2.5 rounded-b-[22px] z-20 pointer-events-none"
              style={{
                background:
                  "linear-gradient(180deg, rgba(80,35,16,0.25) 0%, rgba(50,20,8,0.85) 100%)",
                borderTop: "1px solid rgba(255,255,255,0.15)",
              }}
            />
          </div>

          {/* Top Surface Oval Meniscus (Renders above the wax line) */}
          {hasWax && (
            <div
              className="absolute inset-x-2.5 z-20 pointer-events-none"
              style={{
                bottom: isBurning ? "100px" : "108px",
                height: "8px",
                borderRadius: "50%",
                background: isBurning
                  ? "radial-gradient(ellipse at center, #ffe099 0%, #e7a64c 65%, #bb7425 100%)"
                  : "radial-gradient(ellipse at center, #ffffff 0%, #f6ecdc 60%, #e2ccaa 100%)",
                border: "1px solid rgba(255,255,255,0.4)",
              }}
            />
          )}

          {/* Handcrafted Spiral Cotton Wick (Sits directly on TOP of the wax) */}
          {hasWick && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute z-25 pointer-events-none"
              style={{
                bottom: isBurning ? "102px" : "110px",
                left: "50%",
                transform: "translateX(-50%)",
              }}
            >
              <svg
                width="20"
                height="28"
                viewBox="0 0 20 28"
                fill="none"
                className="overflow-visible"
              >
                {/* Wick shadow on wax surface */}
                <ellipse
                  cx="10"
                  cy="26"
                  rx="3"
                  ry="1.2"
                  fill="rgba(40,15,5,0.35)"
                />

                {/* Braided cotton wick with organic spiral curve */}
                <path
                  d="M 10 26 C 9.5 20 9 15 10 12 C 11 8 14.5 7 15.5 4.5 C 16.2 2 14 1 12 1.5 C 10 2 9.5 4 11 5.5 C 12.2 6.5 13.8 5.8 13.2 4.2"
                  stroke="#23130a"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />

                {/* Light cotton thread texture */}
                <path
                  d="M 10 26 C 9.5 20 9 15 10 12 C 11 8 14.5 7 15.5 4.5 C 16.2 2 14 1 12 1.5"
                  stroke="#d7b38d"
                  strokeWidth="0.8"
                  strokeDasharray="1.5,1.5"
                  opacity="0.65"
                />

                {/* Charred spiral ember tip */}
                <circle
                  cx="13.2"
                  cy="4.2"
                  r="1.6"
                  fill={isBurning ? "#ff3700" : "#110603"}
                  style={{
                    filter: isBurning
                      ? "drop-shadow(0 0 4px #ff6600)"
                      : "none",
                  }}
                />
              </svg>
            </motion.div>
          )}

          {/* Living Teardrop Flame (Floats right on top of the spiral ember tip) */}
          {isBurning && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="absolute z-35 flex flex-col items-center pointer-events-none"
              style={{
                bottom: "126px",
                left: "calc(50% + 3.2px)", // perfectly aligns with the spiral tip
                transform: "translateX(-50%)",
              }}
            >
              {/* Flickering Flame Body */}
              <motion.div
                animate={{
                  scaleY: [1, 1.07, 0.95, 1.05, 0.98, 1],
                  scaleX: [1, 0.95, 1.04, 0.96, 1.02, 1],
                  rotate: [-1.5, 1.5, -1, 1.8, -0.8, -1.5],
                  x: [-0.3, 0.4, -0.4, 0.2, -0.3],
                }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  repeatType: "mirror",
                  ease: "easeInOut",
                }}
                className="relative w-5 h-9 flex items-end justify-center"
              >
                {/* Outer Amber Flame Glow */}
                <div
                  className="absolute inset-0 rounded-[50%_50%_35%_35%/60%_60%_40%_40%]"
                  style={{
                    background:
                      "radial-gradient(ellipse at 50% 85%, #ff5500 0%, #ff8c00 50%, #ffa500 80%, transparent 100%)",
                    filter: "blur(1px)",
                    boxShadow:
                      "0 0 14px 2px rgba(255, 140, 0, 0.6), 0 -3px 10px rgba(255, 80, 0, 0.35)",
                  }}
                />

                {/* Middle Golden Core */}
                <div
                  className="absolute inset-x-0.5 bottom-0.5 top-1.5 rounded-[50%_50%_35%_35%/60%_60%_40%_40%]"
                  style={{
                    background:
                      "linear-gradient(180deg, #fff2a3 0%, #ffbe38 55%, #ff7700 100%)",
                  }}
                />

                {/* Incandescent White-Hot Center */}
                <div
                  className="absolute bottom-1 w-1.5 h-3.5 rounded-full"
                  style={{
                    background:
                      "linear-gradient(180deg, #ffffff 0%, #fff7cc 70%, transparent 100%)",
                    filter: "blur(0.4px)",
                  }}
                />

                {/* Ethereal Blue Base at wick */}
                <div
                  className="absolute bottom-0 w-2.5 h-1.5 rounded-full"
                  style={{
                    background:
                      "radial-gradient(ellipse at center, #3a68ff 0%, #2040b0 60%, transparent 100%)",
                    opacity: 0.85,
                  }}
                />
              </motion.div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Progress Badge (Optional) */}
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
