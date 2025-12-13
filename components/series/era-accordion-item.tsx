"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PokemonEra } from "@/lib/types/pokemon";

interface EraAccordionItemProps {
  era: PokemonEra;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function EraAccordionItem({ era, isExpanded, onToggle, children }: EraAccordionItemProps) {
  // Formater la plage de dates
  const formatDateRange = () => {
    if (!era.dateRange.start) return "";
    const start = new Date(era.dateRange.start).getFullYear();
    const end = era.dateRange.end ? new Date(era.dateRange.end).getFullYear() : "Present";
    return start === end ? `${start}` : `${start} - ${end}`;
  };

  return (
    <div className="relative" id={`era-${era.id}`}>
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-pokemon-electric/50 to-pokemon-electric/10" />

      {/* Timeline node */}
      <div className={cn(
        "absolute left-4 top-6 w-5 h-5 rounded-full border-2 z-10 transition-colors",
        isExpanded
          ? "bg-pokemon-electric border-pokemon-electric"
          : "bg-background border-muted-foreground/30"
      )} />

      {/* Era Header */}
      <button
        onClick={onToggle}
        className={cn(
          "w-full ml-12 flex items-center gap-4 p-4 rounded-xl transition-all",
          "hover:bg-muted/50",
          isExpanded && "bg-muted/30"
        )}
      >
        {/* Era Logo */}
        {era.logo_url && (
          <div className="flex-shrink-0 w-16 h-16 relative">
            <Image
              src={era.logo_url}
              alt={era.name}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
        )}

        {/* Era Info */}
        <div className="flex-1 text-left">
          <h3 className="text-xl font-bold pokemon-title">{era.name}</h3>
          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
            <span>{era.seriesCount} series</span>
            {formatDateRange() && (
              <>
                <span>-</span>
                <span>{formatDateRange()}</span>
              </>
            )}
          </div>
        </div>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-6 h-6 text-muted-foreground" />
        </motion.div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden ml-12"
          >
            <div className="py-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
