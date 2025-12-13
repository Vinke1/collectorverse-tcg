"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Gamepad2, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";

interface TcgGame {
  name: string;
  description: string;
  href: string;
  gradient: string;
  shadowColor: string;
  icon: LucideIcon;
  iconImage?: string;
  backgroundImage?: string;
  backgroundVideo?: string;
  titleImage?: string;
  stats: string;
  colSpan?: string;
  videoScale?: string; // Custom scale for video (e.g., "scale-90")
}

export default function Home() {
  const { t } = useLanguage();

  const tcgGames: TcgGame[] = [
      {
        name: t.nav.pokemon,
        description: t.home.tcg.pokemon.desc,
        href: "/series/pokemon",
        gradient: "from-yellow-400 to-red-500",
        shadowColor: "rgba(255, 200, 0, 0.4)",
        icon: Zap,
        iconImage: "/image/pokeball.png",
        backgroundVideo: "/image/pokemon.mp4",
        stats: t.home.tcg.pokemon.stats,
        colSpan: "md:col-span-2",
      },
      {
        name: t.nav.lorcana,
        description: t.home.tcg.lorcana.desc,
        href: "/series/lorcana",
        gradient: "from-purple-400 to-cyan-500",
        shadowColor: "rgba(0, 243, 255, 0.4)",
        icon: Sparkles,
        iconImage: "/image/mickey.png",
        backgroundVideo: "/image/Lorcana.mp4",
        titleImage: "/image/LorcanaTexte.png",
        stats: t.home.tcg.lorcana.stats,
        colSpan: "md:col-span-1",
      },
      {
        name: t.nav.onepiece,
        description: t.home.tcg.onepiece.desc,
        href: "/series/onepiece",
        gradient: "from-red-500 to-rose-600",
        shadowColor: "rgba(220, 38, 38, 0.4)",
        icon: Gamepad2,
        iconImage: "/image/onepiece.webp",
        backgroundVideo: "/image/OnePiece.mp4",
        stats: t.home.tcg.onepiece.stats,
        colSpan: "md:col-span-1",
      },
      {
        name: t.nav.riftbound,
        description: t.home.tcg.riftbound.desc,
        href: "/series/riftbound",
        gradient: "from-indigo-400 to-purple-500",
        shadowColor: "rgba(99, 102, 241, 0.4)",
        icon: Gamepad2,
        backgroundVideo: "/image/RiftBound.mp4",
        titleImage: "/image/RiftBoundTexte.png",
        stats: t.home.tcg.riftbound.stats,
        colSpan: "md:col-span-2",
      },
      {
        name: t.nav.naruto,
        description: t.home.tcg.naruto.desc,
        href: "/series/naruto",
        gradient: "from-orange-400 to-red-500",
        shadowColor: "rgba(249, 115, 22, 0.4)",
        icon: Zap,
        iconImage: "/image/naruto.png",
        backgroundImage: "/image/Naruto.mp4",
        backgroundVideo: "/image/Naruto.mp4",
        stats: t.home.tcg.naruto.stats,
        colSpan: "md:col-span-1",
      },
      {
        name: t.nav.starwars,
        description: t.home.tcg.starwars.desc,
        href: "/series/starwars",
        gradient: "from-yellow-400 to-amber-600",
        shadowColor: "rgba(245, 158, 11, 0.4)",
        icon: Sparkles,
        backgroundVideo: "/image/starwars.mp4",
        stats: t.home.tcg.starwars.stats,
        colSpan: "md:col-span-1",
        videoScale: "object-cover",
      },
    ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 },
  };

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden selection:bg-primary/30">
      {/* Hero Section Text */}
      <div className="relative z-10 max-w-7xl mx-auto mb-16 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter mb-6">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-400">
              {t.home.hero.explore}
            </span>{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-cyan-600 to-purple-600 dark:from-primary dark:via-cyan-400 dark:to-purple-500 text-neon">
              Collector Verse
            </span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
            {t.home.hero.platform}
          </p>
        </motion.div>
      </div>

      {/* Grid Section */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        {tcgGames.map((game, index) => (
          <motion.div
            key={game.href}
            variants={item}
            className={cn("group relative h-[400px] rounded-3xl overflow-hidden border border-black/5 dark:border-white/10 bg-white/10 dark:bg-card/30 backdrop-blur-sm transition-all duration-500 hover:border-primary/50 hover:shadow-[0_0_40px_-10px_var(--shadow-color)]", game.colSpan || "md:col-span-1")}
            style={{ "--shadow-color": game.shadowColor } as React.CSSProperties}
          >
            <Link href={game.href} className="block w-full h-full relative z-20">
              {/* Video Background */}
              <div className="absolute inset-0 z-0 bg-black/20">
                {game.backgroundVideo ? (
                  <video
                    src={game.backgroundVideo}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className={cn(
                      "w-full h-full transition-transform duration-700",
                      game.videoScale?.includes("object-") ? game.videoScale : "object-cover",
                      !game.videoScale?.includes("object-") && (game.videoScale || "scale-105 group-hover:scale-100")
                    )}
                  />
                ) : game.backgroundImage ? (
                  <Image
                    src={game.backgroundImage}
                    alt={game.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className={cn("absolute inset-0 bg-gradient-to-br", game.gradient)} />
                )}
                {/* Gradient Overlay - Forcé en sombre pour garder le contraste avec le texte blanc */}
                <div className={cn("absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-90 group-hover:opacity-60 transition-opacity duration-500")} />
              </div>

              {/* Content */}
              <div className="absolute inset-0 z-10 flex flex-col justify-between p-8">
                {/* Top Bar */}
                <div className="flex justify-between items-start transform translate-y-[-10px] opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 delay-100">
                   <div className="px-3 py-1 rounded-full glass text-xs font-medium text-white border-white/20">
                     {game.stats}
                   </div>
                   <div className="w-8 h-8 rounded-full glass flex items-center justify-center text-white border-white/20">
                     <ArrowRight className="w-4 h-4 -rotate-45 group-hover:rotate-0 transition-transform duration-500" />
                   </div>
                </div>

                {/* Bottom Info */}
                <div className="transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                  <div className="flex items-center gap-3 mb-2">
                    {game.iconImage ? (
                       <div className="relative w-auto h-8 min-w-[24px] flex items-center justify-center">
                         <Image 
                           src={game.iconImage} 
                           width={40} 
                           height={40} 
                           alt="icon" 
                           className="w-auto h-full object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" 
                         />
                       </div>
                    ) : (
                       <game.icon className={cn("w-6 h-6", `text-${game.gradient.split('-')[1]}-400`)} />
                    )}
                    
                    {game.titleImage ? (
                      <>
                        <span className="sr-only">{game.name}</span>
                        <div className="max-w-[150px] opacity-80 group-hover:opacity-100 transition-opacity flex items-center h-8">
                           <Image src={game.titleImage} alt={game.name} width={200} height={60} className="object-contain object-left h-full w-auto" />
                        </div>
                      </>
                    ) : (
                      <h2 className="text-3xl font-bold text-white tracking-wide">
                        {game.name}
                      </h2>
                    )}
                  </div>

                  <p className="text-gray-300 text-sm font-medium line-clamp-2 max-w-[90%] group-hover:text-white transition-colors">
                    {game.description}
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </main>
  );
}
