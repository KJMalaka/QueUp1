"use client"

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0A0A0A]"
        >
          <div className="relative flex items-center justify-center h-full w-full">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex items-baseline space-x-1"
            >
              <span className="text-6xl md:text-8xl font-headline font-extrabold text-[#F5F2EE]">Que</span>
              <span className="text-6xl md:text-8xl font-headline font-extrabold text-[#C4F135] pulsate">Up</span>
            </motion.div>
            
            <div className="netflix-loading-bar" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
