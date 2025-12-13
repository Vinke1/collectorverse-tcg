"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        disabled={isLoading}
        className={className}
        title={t.share?.button || "Partager ma collection"}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Share2 className="w-4 h-4" />
        )}
        <span className="hidden sm:inline ml-2">{t.share?.button || "Partager"}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />
              {t.share?.title || "Partager ma collection"}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {seriesName}
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
                {/* QR Code */}
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="flex justify-center"
                >
                  <div className="p-4 bg-white rounded-xl shadow-lg">
                    <QRCodeSVG
                      value={shareData.url}
                      size={180}
                      level="M"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                </motion.div>

                {/* Link input */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border/50"
                >
                  <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <input
                    readOnly
                    value={shareData.url}
                    className="flex-1 bg-transparent text-sm truncate outline-none font-mono"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleCopy}
                    className="flex-shrink-0 h-8 w-8"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </motion.div>

                {/* Social share buttons */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="flex items-center justify-center gap-3"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = encodeURIComponent(shareData.url);
                      // Facebook ne permet plus de pré-remplir le texte (restriction API)
                      window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
                    }}
                    className="flex items-center gap-2 hover:bg-[#1877f2]/10 hover:text-[#1877f2] hover:border-[#1877f2]/50"
                  >
                    <Facebook className="w-4 h-4" />
                    <span className="hidden sm:inline">Facebook</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Twitter/X permet de pré-remplir le texte avec le lien intégré
                      const message = `Découvre ma collection ${seriesName} ! ${shareData.url}`;
                      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`, '_blank', 'width=600,height=400');
                    }}
                    className="flex items-center gap-2 hover:bg-black/10 hover:text-black dark:hover:bg-white/10 dark:hover:text-white hover:border-black/50 dark:hover:border-white/50"
                  >
                    <Twitter className="w-4 h-4" />
                    <span className="hidden sm:inline">X</span>
                  </Button>
                </motion.div>

                {/* Expiration info */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center justify-center gap-4 text-sm text-muted-foreground"
                >
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {t.share?.expiresOn || "Expire le"} {formatExpirationDate(shareData.expiresAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-full text-primary font-medium">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{getDaysRemaining(shareData.expiresAt)} {t.share?.daysRemaining || "jour"}</span>
                  </div>
                </motion.div>

                {/* Actions */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex justify-between gap-3 pt-2"
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevoke}
                    disabled={isRevoking}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    {isRevoking ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4 mr-2" />
                    )}
                    {t.share?.revoke || "Révoquer"}
                  </Button>
                  <Button onClick={handleCopy} className="flex-1">
                    {copied ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {t.share?.copyLink || "Copier le lien"}
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
