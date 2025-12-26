"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

interface SponsorBannerProps {
  videoSrc?: string;
  imageSrc?: string;
  href: string;
  name: string;
}

export function SponsorBanner({
  videoSrc = "/image/gac.mp4",
  imageSrc,
  href,
  name
}: SponsorBannerProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.3 }}
      className="hidden xl:block fixed right-4 top-1/2 -translate-y-1/2 z-40"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block relative"
      >
        {/* Banner Container */}
        <div className="relative w-[160px] h-[400px] rounded-2xl overflow-hidden border border-white/10 bg-black/40 backdrop-blur-sm shadow-2xl transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_40px_-10px_rgba(0,243,255,0.4)]">
          {/* Video/Image Background */}
          <div className="absolute inset-0">
            {videoSrc ? (
              <video
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700"
              />
            ) : imageSrc ? (
              <img
                src={imageSrc}
                alt={name}
                className="w-full h-full object-cover scale-105 group-hover:scale-100 transition-transform duration-700"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400" />
            )}

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-500" />
          </div>

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-between p-4">
            {/* Sponsor Badge */}
            <div className="flex justify-center">
              <span className="px-2 py-1 rounded-full bg-white/10 backdrop-blur-sm text-[10px] font-medium text-white/70 border border-white/10">
                Sponsor
              </span>
            </div>

            {/* Bottom Info */}
            <div className="text-center space-y-2">
              <p className="text-white font-bold text-sm leading-tight">
                {name}
              </p>
              <div className="flex items-center justify-center gap-1 text-primary text-xs font-medium opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                <span>Visiter</span>
                <ExternalLink className="w-3 h-3" />
              </div>
            </div>
          </div>

          {/* Hover Glow Effect */}
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent" />
          </div>
        </div>
      </a>
    </motion.aside>
  );
}
