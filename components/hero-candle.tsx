"use client";

import { motion } from "framer-motion";

export function HeroCandle() {
  return (
    <div className="relative mx-auto flex flex-col items-center justify-center w-full max-w-[155px] sm:max-w-[260px] md:max-w-[290px] py-1">
      {/* Warm Ambient Glow Aura behind candle flame and jar */}
      <motion.div
        animate={{
          opacity: [0.4, 0.75, 0.45, 0.8, 0.4],
          scale: [0.94, 1.06, 0.97, 1.05, 0.94],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -top-3 sm:-top-8 left-1/2 -translate-x-1/2 h-36 w-36 sm:h-56 sm:w-56 rounded-full pointer-events-none -z-10"
        style={{
          background:
            "radial-gradient(circle, rgba(251, 175, 59, 0.48) 0%, rgba(234, 88, 12, 0.2) 42%, rgba(217, 119, 6, 0.08) 65%, transparent 75%)",
          filter: "blur(20px)",
        }}
      />

      {/* Candle Vessel & Living Flame Assembly */}
      <div className="relative w-full flex items-center justify-center">
        {/* Living Flickering Flame Glow directly centered on the real flame */}
        <motion.div
          animate={{
            opacity: [0.65, 0.98, 0.7, 1, 0.65],
            scale: [0.95, 1.12, 0.98, 1.08, 0.95],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full z-20"
          style={{
            top: "11%",
            left: "50%",
            width: "38%",
            height: "28%",
            background:
              "radial-gradient(circle, rgba(255, 245, 200, 0.8) 0%, rgba(251, 146, 60, 0.4) 42%, rgba(234, 88, 12, 0.12) 65%, transparent 75%)",
            mixBlendMode: "screen",
            filter: "blur(4px)",
          }}
        />

        {/* Micro-spark floating ember 1 */}
        <motion.div
          animate={{
            y: [0, -28, -56],
            x: [0, 4, -3],
            opacity: [0, 0.85, 0],
            scale: [0.6, 1, 0.2],
          }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeOut",
            delay: 0.2,
          }}
          className="absolute h-1 w-1 rounded-full bg-[#fed7aa] shadow-[0_0_6px_#f97316] pointer-events-none z-30"
          style={{ top: "8%", left: "51%" }}
        />

        {/* Micro-spark floating ember 2 */}
        <motion.div
          animate={{
            y: [0, -24, -48],
            x: [0, -4, 2],
            opacity: [0, 0.75, 0],
            scale: [0.5, 0.9, 0.2],
          }}
          transition={{
            duration: 2.6,
            repeat: Infinity,
            ease: "easeOut",
            delay: 1.3,
          }}
          className="absolute h-1 w-1 rounded-full bg-[#fde047] shadow-[0_0_5px_#eab308] pointer-events-none z-30"
          style={{ top: "9%", left: "48%" }}
        />

        {/* Real Transparent Aesthetic Amber Candle — NO background, NO card */}
        <img
          src="/aesthetic-candle.png"
          alt="Artisanal amber glass soy candle"
          className="relative z-10 w-full h-auto object-contain select-none drop-shadow-[0_10px_20px_rgba(59,29,14,0.18)] transition-transform duration-500 ease-out hover:scale-[1.03]"
          loading="eager"
        />

        {/* Realistic Ground Contact Shadow under candle base */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-[72%] h-3 rounded-[50%] bg-[#2e1408]/22 blur-[5px] pointer-events-none" />
        <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-[55%] h-1.5 rounded-[50%] bg-[#1c0a03]/30 blur-[2px] pointer-events-none" />
      </div>
    </div>
  );
}
