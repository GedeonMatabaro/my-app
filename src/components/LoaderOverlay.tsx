'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import * as React from 'react';


export default function LoaderOverlay({ show, message }: { show: boolean, message?:string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[9999] bg-black/20 backdrop-blur-xs">
      <div className="flex h-full items-center justify-center">
        <motion.div
          initial={{ scale: 0.95, opacity: 0.8 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{
            scale: {
              repeat: Infinity,
              repeatType: 'mirror', // smooth back and forth
              duration: 0.8,
              ease: 'easeInOut',
            },
            opacity: {
              repeat: Infinity,
              repeatType: 'mirror',
              duration: 0.8,
              ease: 'easeInOut',
            },
          }}
          className="grid place-items-center rounded-3xl bg-background/90 p-8 shadow-2xl ring-1 ring-foreground/10"
        >
          <p className="my-3 font-semibold text-teal-700 dark:text-gray-300">Explore. Connect. Belong.</p>
          <div className="grid h-16 w-16 place-items-center rounded-2xl bg-none dark:bg-foreground/10">
            <Image
              src="/logo_loader.webp"        // save logoOg_112_q80.webp as logoOg@2x.webp
              alt="logo"
              width={106}                  // intrinsic size of the 112px-tall asset
              height={112}
              className="w-auto h-14"
              priority
              sizes="64px"
            />
          </div>
          {message && <p className="my-4 font-semibold text-teal-700 dark:text-gray-300">{message}</p>}
          <p className="mt-4 text-sm text-muted-foreground">Processing…</p>
          <div
            className="mt-3 relative h-[4px] w-56 overflow-hidden rounded-full bg-background text-foreground"
            role="progressbar"
            aria-valuetext="Loading"
          >
            {/* Moving sweep */}
            <motion.div
              className="absolute top-0 left-0 h-[2px]"
              style={{
                width: '50%',
                background:
                  'linear-gradient(90deg, transparent, currentColor 50%, currentColor 50%, transparent)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
            />

            {/* Subtle trailing glow */}
            <motion.div
              className="absolute top-0 left-0 h-[2px] opacity-60"
              style={{
                width: '50%',
                filter: 'blur(2px)',
                background:
                  'linear-gradient(90deg, transparent, currentColor 50%, currentColor 50%, transparent)',
              }}
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 1.5, ease: 'linear', repeat: Infinity, delay: 0.1 }}
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
