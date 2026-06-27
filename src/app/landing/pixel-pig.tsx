"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * 8-bit truffle-hunting pig.
 * Walks parent-width track (px-measured), head dips while truffling,
 * legs trot in 2-frame cycle, sprite flips so snout leads direction.
 */
const SPRITE_PX = 56;

export function PixelPig() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [maxX, setMaxX] = useState(0);

  useEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    let last = 0;
    const measure = () => {
      const w = node.offsetWidth;
      const next = Math.max(0, w - SPRITE_PX);
      // Only update if change > 4px — prevents animation restart on tiny layout fluctuations
      if (Math.abs(next - last) > 4) {
        last = next;
        setMaxX(next);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={trackRef}
      className="pixel-pig"
      aria-hidden
      style={{ width: "100%", height: SPRITE_PX + 4, position: "relative" }}
    >
      {maxX > 0 && (
        <motion.div
          className="pixel-pig-sprite"
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: SPRITE_PX,
            height: SPRITE_PX,
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: 1,
            // Cycle: walk right → pause+sniff → flip → walk back → flip back
            x: [0, maxX, maxX, maxX, 0, 0, 0],
            scaleX: [1, 1, 1, -1, -1, 1, 1],
          }}
          transition={{
            opacity: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
            default: {
              duration: 12,
              repeat: Infinity,
              repeatType: "loop",
              ease: "linear",
              times: [0, 0.35, 0.55, 0.5501, 0.9, 0.9001, 1],
              delay: 0.3,
            },
          }}
        >
          <motion.svg
            viewBox="0 0 16 14"
            width={SPRITE_PX}
            height={SPRITE_PX}
            shapeRendering="crispEdges"
            style={{ display: "block", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
            animate={{ y: [0, -0.8, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* TAIL */}
            <rect x="0" y="3" width="1" height="1" fill="#D4BC82" />
            <rect x="1" y="2" width="1" height="2" fill="#D4BC82" />

            {/* BODY */}
            <rect x="2" y="3" width="11" height="6" fill="#E8C99A" />
            <rect x="3" y="2" width="9" height="1" fill="#E8C99A" />

            {/* BELLY */}
            <rect x="3" y="9" width="10" height="1" fill="#D4BC82" />

            {/* HEAD GROUP — truffling dip */}
            <motion.g
              animate={{ y: [0, 0.8, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
            >
              <rect x="11" y="1" width="2" height="1" fill="#D4BC82" />
              <rect x="12" y="2" width="1" height="1" fill="#D4BC82" />
              <rect x="11" y="4" width="1" height="1" fill="#311f13" />
              <rect x="13" y="5" width="2" height="3" fill="#C9A84C" />
              <rect x="15" y="6" width="1" height="1" fill="#C9A84C" />
              <rect x="14" y="6" width="1" height="1" fill="#311f13" />
              <motion.rect
                x="14"
                y="9"
                width="1"
                height="1"
                fill="#D4B55C"
                animate={{ opacity: [0, 1, 0, 0] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
              />
            </motion.g>

            {/* FRONT LEGS */}
            <motion.g
              style={{ transformOrigin: "11.5px 9px" }}
              animate={{ scaleY: [1, 0.55, 1] }}
              transition={{ duration: 0.42, repeat: Infinity, ease: "easeInOut" }}
            >
              <rect x="11" y="9" width="2" height="3" fill="#C9A84C" />
            </motion.g>

            {/* BACK LEGS */}
            <motion.g
              style={{ transformOrigin: "3.5px 9px" }}
              animate={{ scaleY: [0.55, 1, 0.55] }}
              transition={{ duration: 0.42, repeat: Infinity, ease: "easeInOut" }}
            >
              <rect x="3" y="9" width="2" height="3" fill="#C9A84C" />
            </motion.g>

            {/* DIRT particles */}
            <motion.g
              animate={{ opacity: [0, 0.8, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            >
              <rect x="12" y="11" width="1" height="1" fill="#8C7B6B" />
              <rect x="10" y="12" width="1" height="1" fill="#8C7B6B" />
            </motion.g>
          </motion.svg>
        </motion.div>
      )}
    </div>
  );
}
