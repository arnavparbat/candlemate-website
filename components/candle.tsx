"use client";

import { motion } from "framer-motion";

type CandleStage = "empty" | "filled" | "checkout" | "burning" | "done";

export function Candle({ stage }: { stage: CandleStage }) {
  const hasWax = stage !== "empty";
  const hasWick = stage === "checkout" || stage === "burning" || stage === "done";
  const isBurning = stage === "burning" || stage === "done";

  const stageLabels: Record<CandleStage, string> = {
    empty: "Jar prepared",
    filled: "Soy wax poured",
    checkout: "Wick set & centered",
    burning: "Flame burning warm",
    done: "Handcrafted & ready",
  };

  return (
    <div className="flex flex-col items-center select-none" aria-label={`Candle crafting: ${stageLabels[stage]}`}>
      {/* Candle Assembly Container */}
      <div className="relative h-64 w-44 flex items-end justify-center pb-5">
        {/* Ambient Warm Halo when lit */}
        {isBurning && (
          <motion.div
            animate={{
              opacity: [0.45, 0.75, 0.5, 0.8, 0.45],
              scale: [0.95, 1.08, 0.98, 1.05, 0.95],
            }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
            className="absolute -top-6 left-1/2 -translate-x-1/2 h-52 w-52 rounded-full pointer-events-none -z-10"
            style={{
              background: "radial-gradient(circle, rgba(245, 178, 66, 0.45) 0%, rgba(224, 114, 38, 0.2) 40%, transparent 70%)",
            }}
          />
        )}

        {/* Real Wood Coaster Base & Shadow */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-40 h-5 rounded-[50%] bg-[#2e160c]/25 blur-[6px] -z-10" />
        <div
          className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-4 rounded-[50%] border-t border-[#d49e6f]/40 shadow-md"
          style={{
            background: "linear-gradient(180deg, #b07248 0%, #7e4b2a 60%, #522d17 100%)",
          }}
        />

        {/* Amber Glass Jar */}
        <div
          className="relative w-28 h-40 rounded-b-[24px] rounded-t-[6px] overflow-hidden shadow-2xl border-t-2 border-white/30"
          style={{
            background:
              "linear-gradient(90deg, rgba(62,28,14,0.92) 0%, rgba(138,62,26,0.65) 16%, rgba(206,108,46,0.3) 48%, rgba(240,162,94,0.35) 58%, rgba(145,67,29,0.72) 84%, rgba(55,23,11,0.95) 100%)",
            boxShadow:
              "inset 0 1px 2px rgba(255,255,255,0.4), inset 0 -4px 10px rgba(45,18,8,0.7), 0 12px 24px -6px rgba(50,20,10,0.35)",
          }}
        >
          {/* Jar Rim Glass Highlight */}
          <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-transparent via-white/40 to-transparent z-30" />

          {/* Left Vertical Specular Glare */}
          <div className="absolute inset-y-0 left-3 w-2.5 bg-gradient-to-r from-transparent via-white/25 to-transparent z-30 pointer-events-none" />

          {/* Right Edge Specular Reflection */}
          <div className="absolute inset-y-0 right-2 w-1.5 bg-gradient-to-r from-transparent via-white/15 to-transparent z-30 pointer-events-none" />

          {/* Creamy Natural Soy Wax Fill */}
          {hasWax && (
            <motion.div
              initial={{ height: 0 }}
              animate={
                isBurning
                  ? { height: 110, y: [0, 3, 6] }
                  : { height: 118, y: 0 }
              }
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute bottom-2 inset-x-2 rounded-b-[18px] overflow-hidden z-10"
              style={{
                background: isBurning
                  ? "linear-gradient(180deg, #f5c87e 0%, #edd8b8 15%, #e2c79f 80%, #caa471 100%)"
                  : "linear-gradient(180deg, #fbf4ea 0%, #f1dfc5 20%, #e5cb9f 80%, #caa573 100%)",
                boxShadow: "inset 0 2px 4px rgba(255,255,255,0.6), inset 0 -3px 6px rgba(90,45,20,0.25)",
              }}
            >
              {/* Wax Pool Surface Meniscus */}
              <div
                className="absolute top-0 inset-x-0 h-3 rounded-[50%]"
                style={{
                  background: isBurning
                    ? "radial-gradient(ellipse at center, #ffd680 0%, #e49e3e 70%, #ba6d20 100%)"
                    : "radial-gradient(ellipse at center, #ffffff 0%, #f6ecdc 60%, #e2ccaa 100%)",
                }}
              />

              {/* Molten Wax Glow when burning */}
              {isBurning && (
                <motion.div
                  animate={{ opacity: [0.6, 0.9, 0.7, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute top-0.5 left-1/2 -translate-x-1/2 w-12 h-2.5 rounded-[50%] bg-[#ffbe4d]/70 blur-[1px]"
                />
              )}
            </motion.div>
          )}

          {/* Glass Base Thickness */}
          <div
            className="absolute bottom-0 inset-x-0 h-3 rounded-b-[24px] z-20"
            style={{
              background: "linear-gradient(180deg, rgba(80,35,16,0.3) 0%, rgba(50,20,8,0.85) 100%)",
              borderTop: "1px solid rgba(255,255,255,0.15)",
            }}
          />
        </div>

        {/* Cotton Braided Wick */}
        {hasWick && (
          <motion.div
            initial={{ y: -25, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute z-25"
            style={{
              bottom: isBurning ? "112px" : "120px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            {/* Braided wick body */}
            <div className="w-[3px] h-6 rounded-full bg-[#3d2417] relative">
              {/* Charred wick tip */}
              <div className="absolute top-0 left-0 w-full h-2 bg-[#1a0e08] rounded-t-full" />
            </div>
          </motion.div>
        )}

        {/* Living Teardrop Flame */}
        {isBurning && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute z-35 flex flex-col items-center pointer-events-none"
            style={{
              bottom: "128px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            {/* Flickering Flame Body */}
            <motion.div
              animate={{
                scaleY: [1, 1.08, 0.94, 1.05, 0.97, 1],
                scaleX: [1, 0.95, 1.04, 0.97, 1.02, 1],
                rotate: [-1.5, 1.8, -1.2, 2, -0.8, -1.5],
                x: [-0.4, 0.6, -0.5, 0.3, -0.4],
              }}
              transition={{
                duration: 0.7,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut",
              }}
              className="relative w-6 h-10 flex items-end justify-center"
            >
              {/* Outer Amber Halo */}
              <div
                className="absolute inset-0 rounded-[50%_50%_35%_35%/60%_60%_40%_40%]"
                style={{
                  background:
                    "radial-gradient(ellipse at 50% 85%, #ff5500 0%, #ff8c00 50%, #ffa500 80%, transparent 100%)",
                  filter: "blur(1px)",
                  boxShadow:
                    "0 0 16px 3px rgba(255, 140, 0, 0.65), 0 -4px 12px rgba(255, 80, 0, 0.4)",
                }}
              />

              {/* Middle Golden Flame */}
              <div
                className="absolute inset-x-0.5 bottom-0.5 top-2 rounded-[50%_50%_35%_35%/60%_60%_40%_40%]"
                style={{
                  background: "linear-gradient(180deg, #fff2a3 0%, #ffc038 55%, #ff7700 100%)",
                }}
              />

              {/* White-Hot Core */}
              <div
                className="absolute bottom-1.5 w-2 h-4 rounded-full"
                style={{
                  background: "linear-gradient(180deg, #ffffff 0%, #fff7cc 70%, transparent 100%)",
                  filter: "blur(0.5px)",
                }}
              />

              {/* Blue Base of Flame */}
              <div
                className="absolute bottom-0 w-3 h-1.5 rounded-full"
                style={{
                  background: "radial-gradient(ellipse at center, #3a68ff 0%, #2040b0 60%, transparent 100%)",
                  opacity: 0.85,
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* Craftsmanship Progress Badge */}
      <motion.div
        key={stage}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[#fff8ed]/95 border border-[#8a61482a] px-3 py-1 shadow-sm text-xs font-medium text-[#765442] backdrop-blur"
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
    </div>
  );
}
