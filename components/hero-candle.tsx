"use client";

import { motion } from "framer-motion";

export function HeroCandle() {
  return (
    <div className="relative mx-auto w-full max-w-[180px] sm:max-w-[340px] md:max-w-[400px]">
      {/* Warm atmospheric living glow behind the candle */}
      <motion.div
        animate={{
          opacity: [0.35, 0.62, 0.38, 0.68, 0.35],
          scale: [0.97, 1.04, 0.99, 1.03, 0.97],
        }}
        transition={{
          duration: 3.2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute -inset-2 sm:-inset-6 rounded-[24px] sm:rounded-[44px] bg-gradient-to-tr from-[#f59e0b]/30 via-[#ea580c]/20 to-[#fbbf24]/25 blur-xl sm:blur-3xl -z-10 pointer-events-none"
      />

      {/* Handcrafted aesthetic frame */}
      <div className="group relative overflow-hidden rounded-[20px] sm:rounded-[36px] border border-[#5c392718] bg-[#fffaf3] p-1.5 sm:p-2.5 shadow-xl sm:shadow-2xl shadow-[#8a4a25]/15 transition duration-500 hover:shadow-2xl hover:shadow-[#8a4a25]/25">
        <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[15px] sm:rounded-[28px] bg-[#f5ebe0]">
          {/* Real high-aesthetic lit candle photograph */}
          <img
            src="/hero-candle.jpg"
            alt="Real lit handmade soy candle glowing on wooden coaster"
            className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
            loading="eager"
          />

          {/* Living flame warmth overlay — organic flickering light centered on real flame */}
          <motion.div
            animate={{
              opacity: [0.5, 0.85, 0.55, 0.92, 0.5],
              scale: [0.95, 1.08, 0.98, 1.06, 0.95],
            }}
            transition={{
              duration: 1.8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full"
            style={{
              top: "38%",
              left: "50%",
              width: "50%",
              height: "50%",
              background:
                "radial-gradient(circle, rgba(255, 235, 170, 0.5) 0%, rgba(251, 146, 60, 0.28) 38%, rgba(234, 88, 12, 0.08) 65%, transparent 75%)",
              mixBlendMode: "screen",
            }}
          />

          {/* Micro-spark floating ember 1 */}
          <motion.div
            animate={{
              y: [0, -26, -52],
              x: [0, 4, -3],
              opacity: [0, 0.85, 0],
              scale: [0.6, 1, 0.3],
            }}
            transition={{
              duration: 2.3,
              repeat: Infinity,
              ease: "easeOut",
              delay: 0.3,
            }}
            className="absolute h-1 w-1 rounded-full bg-[#fed7aa] shadow-[0_0_6px_#f97316] pointer-events-none z-10"
            style={{ top: "34%", left: "51%" }}
          />

          {/* Micro-spark floating ember 2 */}
          <motion.div
            animate={{
              y: [0, -22, -46],
              x: [0, -4, 3],
              opacity: [0, 0.75, 0],
              scale: [0.5, 0.9, 0.2],
            }}
            transition={{
              duration: 2.7,
              repeat: Infinity,
              ease: "easeOut",
              delay: 1.4,
            }}
            className="absolute h-1 w-1 rounded-full bg-[#fde047] shadow-[0_0_5px_#eab308] pointer-events-none z-10"
            style={{ top: "36%", left: "48%" }}
          />

          {/* Subtle warm corner gradient for depth */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#2c150b]/25 via-transparent to-black/5 pointer-events-none" />

          {/* Artisanal pill badge */}
          <div className="absolute bottom-2 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 sm:gap-2 rounded-full bg-[#fff8ed]/90 backdrop-blur-md px-2.5 sm:px-3.5 py-0.5 sm:py-1 text-[9px] sm:text-[11px] font-medium text-[#5c3927] border border-[#5c392718] shadow-xs whitespace-nowrap pointer-events-none">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e5832d] shadow-[0_0_6px_#f19b45] animate-pulse" />
            <span>Hand-Poured Soy Wax</span>
          </div>
        </div>
      </div>
    </div>
  );
}
