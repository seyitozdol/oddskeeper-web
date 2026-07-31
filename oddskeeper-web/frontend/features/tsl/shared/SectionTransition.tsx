"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// Bolum/tasarim degisince icerik yumusak gecis yapsin (her navigasyonda remount).
export default function SectionTransition({
  transitionKey,
  children,
}: {
  transitionKey: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      key={transitionKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
