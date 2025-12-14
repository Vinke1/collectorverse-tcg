"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Share2, Copy, Check, Loader2, Link2, Trash2, Calendar, Eye, Facebook, Twitter } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { createShareLink, revokeShareLink } from "@/app/share/actions";
import { QRCodeSVG } from "qrcode.react";
import { useLanguage } from "@/components/providers/language-provider";

// Mapping TCG slug to display name
const TCG_NAMES: Record<string, string> = {
  lorcana: "Lorcana",
  pokemon: "Pokémon",
  onepiece: "One Piece",
  riftbound: "Riftbound",
  naruto: "Naruto",
  starwars: "Star Wars",
};

interface ShareButtonProps {
  seriesId: string;
  seriesName: string;
  tcgSlug: string;
  selectedLanguage?: string;
  className?: string;
}

export function ShareButton({
  seriesId,
  seriesName,
  tcgSlug,
  selectedLanguage = "fr",
  className,
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [shareData, setShareData] = useState<{
    token: string;
    expiresAt: string;
    url: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useLanguage();

  // Get the full collection name (TCG + Series)
  const tcgName = TCG_NAMES[tcgSlug] || tcgSlug;
  const fullCollectionName = `${tcgName} : ${seriesName}`;

  const handleShare = async () => {
    setIsLoading(true);
    try {
      const result = await createShareLink(seriesId, selectedLanguage);
      if (result.error) {
        toast.error(result.error);
        return;
      }

      const shareUrl = `${window.location.origin}/share/${result.token}`;
      setShareData({
        token: result.token!,
        expiresAt: result.expiresAt!,
        url: shareUrl,
      });
      setIsOpen(true);
    } catch (error) {
      console.error("Share error:", error);
      toast.error(t.share?.error || "Erreur lors de la création du lien");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!shareData) return;
    await navigator.clipboard.writeText(shareData.url);
    setCopied(true);
    toast.success(t.share?.copied || "Lien copié !");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRevoke = async () => {
    setIsRevoking(true);
    try {
      const result = await revokeShareLink(seriesId, selectedLanguage);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t.share?.revoked || "Lien révoqué");
      setIsOpen(false);
      setShareData(null);
    } catch (error) {
      console.error("Revoke error:", error);
      toast.error(t.share?.revokeError || "Erreur lors de la révocation");
    } finally {
      setIsRevoking(false);
    }
  };

  const formatExpirationDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getDaysRemaining = (dateStr: string) => {
    const expiresAt = new Date(dateStr);
    const now = new Date();
    const diffTime = expiresAt.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <>
      <button
        onClick={handleShare}
        disabled={isLoading}
        className={`
          group relative inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
          rounded-lg overflow-hidden transition-all duration-300
          bg-gradient-to-r from-violet-500/10 via-fuchsia-500/10 to-violet-500/10
          hover:from-violet-500/20 hover:via-fuchsia-500/20 hover:to-violet-500/20
          border border-violet-500/30 hover:border-violet-400/50
          text-violet-400 hover:text-violet-300
          shadow-[0_0_15px_-3px_rgba(139,92,246,0.2)] hover:shadow-[0_0_25px_-3px_rgba(139,92,246,0.4)]
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
          ${className}
        `}
        title={t.share?.button || "Partager ma collection"}
      >
        {/* Glow effect on hover */}
        <span className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-violet-500/10 to-violet-500/0 
          translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
        
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin relative z-10" />
        ) : (
          <Share2 className="w-4 h-4 relative z-10 transition-transform group-hover:scale-110" />
        )}
        <span className="hidden sm:inline relative z-10">{t.share?.button || "Partager"}</span>
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-2xl">
          {/* Background with gradient */}
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 rounded-xl border border-white/10">
            {/* Decorative gradient orbs */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-violet-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl" />
            
            <div className="relative p-6">
              <DialogHeader className="pb-4">
                <DialogTitle className="flex items-center justify-center gap-3 text-lg">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
                    <Share2 className="w-5 h-5 text-violet-400" />
                  </div>
                  <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                    {t.share?.title || "Partager ma collection"}
                  </span>
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-center mt-2 text-base font-medium">
                  {fullCollectionName}
                </DialogDescription>
              </DialogHeader>

              <AnimatePresence mode="wait">
                {shareData && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-5"
                  >
                    {/* QR Code with styled container */}
                    <motion.div
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="flex justify-center"
                    >
                      <div className="relative group">
                        {/* Glow behind QR */}
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/30 to-cyan-500/30 rounded-2xl blur-xl opacity-50 group-hover:opacity-70 transition-opacity" />
                        <div className="relative p-4 bg-white rounded-2xl shadow-2xl ring-1 ring-white/20">
                          <QRCodeSVG
                            value={shareData.url}
                            size={180}
                            level="M"
                            includeMargin={false}
                            bgColor="#ffffff"
                            fgColor="#1e1b4b"
                          />
                        </div>
                      </div>
                    </motion.div>

                    {/* Link input with enhanced styling */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 backdrop-blur-sm"
                    >
                      <Link2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <input
                        readOnly
                        value={shareData.url}
                        className="flex-1 bg-transparent text-sm truncate outline-none font-mono text-slate-300"
                      />
                      <button
                        onClick={handleCopy}
                        className="flex-shrink-0 h-8 w-8 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 
                          flex items-center justify-center transition-colors border border-slate-600/50"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-400 hover:text-white transition-colors" />
                        )}
                      </button>
                    </motion.div>

                    {/* Social share buttons with enhanced styling */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="flex items-center justify-center gap-3"
                    >
                      <button
                        onClick={() => {
                          const url = encodeURIComponent(shareData.url);
                          window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                          bg-[#1877f2]/10 border border-[#1877f2]/30 text-[#1877f2]
                          hover:bg-[#1877f2]/20 hover:border-[#1877f2]/50 transition-all"
                      >
                        <Facebook className="w-4 h-4" />
                        <span>Facebook</span>
                      </button>
                      <button
                        onClick={() => {
                          const message = `Découvre ma collection ${fullCollectionName} ! ${shareData.url}`;
                          window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank', 'width=600,height=400');
                        }}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                          bg-white/5 border border-white/20 text-slate-300
                          hover:bg-white/10 hover:border-white/30 hover:text-white transition-all"
                      >
                        <Twitter className="w-4 h-4" />
                        <span>X</span>
                      </button>
                    </motion.div>

                    {/* Expiration info with enhanced styling */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="flex items-center justify-center gap-4 text-sm"
                    >
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {t.share?.expiresOn || "Expire le"} {formatExpirationDate(shareData.expiresAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 px-3 py-1 
                        bg-gradient-to-r from-cyan-500/20 to-cyan-500/10 
                        rounded-full text-cyan-400 font-medium border border-cyan-500/30">
                        <Eye className="w-3.5 h-3.5" />
                        <span>{getDaysRemaining(shareData.expiresAt)} {t.share?.daysRemaining || "jours"}</span>
                      </div>
                    </motion.div>

                    {/* Actions with enhanced styling */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="flex justify-between gap-3 pt-2"
                    >
                      <button
                        onClick={handleRevoke}
                        disabled={isRevoking}
                        className="flex items-center px-4 py-2.5 rounded-lg text-sm font-medium
                          bg-red-500/10 border border-red-500/30 text-red-400
                          hover:bg-red-500/20 hover:border-red-500/50 transition-all
                          disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isRevoking ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        {t.share?.revoke || "Révoquer"}
                      </button>
                      <button
                        onClick={handleCopy}
                        className="flex-1 flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium
                          bg-gradient-to-r from-cyan-500 to-teal-500 text-white
                          hover:from-cyan-400 hover:to-teal-400 transition-all
                          shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 mr-2" />
                        ) : (
                          <Copy className="w-4 h-4 mr-2" />
                        )}
                        {t.share?.copyLink || "Copier le lien"}
                      </button>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
