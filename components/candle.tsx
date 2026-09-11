"use client";
import { motion } from "framer-motion";
export function Candle({ stage }: { stage: "empty" | "filled" | "checkout" | "burning" | "done" }) {
  if (stage === "done") return <motion.div initial={{opacity:0,scale:.7}} animate={{opacity:1,scale:1}} className="text-center"><p className="display text-4xl text-clay">Congratulations!</p><p className="mt-2 text-sm text-[#765442]">Your candle is on its way.</p></motion.div>;
  const hasWax = stage !== "empty", hasWick = stage === "checkout" || stage === "burning", burning = stage === "burning";
  return <div aria-hidden className="candle-glow relative h-56 w-36 opacity-80">
    <div className="absolute bottom-0 left-1/2 h-6 w-40 -translate-x-1/2 rounded-[50%] bg-[#5b382b]/25 blur-md" />
    <div className="absolute bottom-4 left-1/2 h-40 w-28 -translate-x-1/2 rounded-b-[30px] border-[5px] border-[#a66a46] bg-[#f3d2a1]/30" />
    {hasWax && <motion.div animate={burning ? {height:[132,116,90], y:[0,15,42]} : {height:132}} transition={{duration:3.2, ease:"easeInOut"}} className="absolute bottom-8 left-1/2 w-[94px] -translate-x-1/2 rounded-b-[23px] bg-[#f4dec0]" />}
    {hasWick && <motion.div animate={burning ? {scaleY:[1, .76]} : {}} transition={{duration:3}} className="absolute left-[65px] top-[37px] h-10 w-[3px] rounded bg-[#44251b] origin-bottom" />}
    {burning && <motion.div animate={{scale:[.82,1.1,.9], y:[2,-4,2]}} transition={{repeat:Infinity,duration:.75}} className="absolute left-[50px] top-[3px] h-12 w-9 rounded-[80%_20%_70%_30%] bg-[#f6af3f] shadow-[0_0_25px_#ffbd53]"><div className="absolute bottom-1 left-2 h-6 w-4 rounded-full bg-[#fff4b0]"/></motion.div>}
  </div>;
}
