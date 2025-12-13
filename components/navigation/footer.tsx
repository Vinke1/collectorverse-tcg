"use client";

import Link from "next/link";
import { useLanguage } from "@/components/providers/language-provider";
import { Github, Twitter, Heart } from "lucide-react";

export function Footer() {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/80 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo & Description */}
          <div className="md:col-span-2">
            <Link href="/" className="text-xl font-bold text-primary">
              CollectorVerse
            </Link>
            <p className="mt-2 text-sm text-muted-foreground max-w-md">
              {t.footer.description}
            </p>
          </div>

          {/* Liens rapides */}
          <div>
            <h3 className="font-semibold mb-3">{t.footer.quickLinks}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/series/pokemon" className="text-muted-foreground hover:text-primary transition-colors">
                  Pokemon
                </Link>
              </li>
              <li>
                <Link href="/series/lorcana" className="text-muted-foreground hover:text-primary transition-colors">
                  Lorcana
                </Link>
              </li>
              <li>
                <Link href="/series/onepiece" className="text-muted-foreground hover:text-primary transition-colors">
                  One Piece
                </Link>
              </li>
            </ul>
          </div>

          {/* Liens légaux */}
          <div>
            <h3 className="font-semibold mb-3">{t.footer.legal}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/legal" className="text-muted-foreground hover:text-primary transition-colors">
                  {t.footer.legalNotice}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-primary transition-colors">
                  {t.footer.privacy}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 pt-8 border-t flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            © {currentYear} CollectorVerse. {t.footer.madeWith}{" "}
            <Heart className="w-4 h-4 text-red-500 fill-red-500" /> {t.footer.inFrance}
          </p>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="GitHub"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-primary transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
