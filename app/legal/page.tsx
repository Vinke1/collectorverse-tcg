"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { motion } from "framer-motion";

export default function LegalPage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-8">{t.legal.title}</h1>

          <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
            {/* Éditeur */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t.legal.editor.title}</h2>
              <div className="bg-card rounded-lg p-6 border">
                <p className="mb-2">
                  <strong>{t.legal.editor.name}:</strong> CollectorVerse
                </p>
                <p className="mb-2">
                  <strong>{t.legal.editor.status}:</strong> {t.legal.editor.statusValue}
                </p>
                <p className="mb-2">
                  <strong>{t.legal.editor.email}:</strong>{" "}
                  <a href="mailto:contact@collectorverse.fr" className="text-primary hover:underline">
                    contact@collectorverse.fr
                  </a>
                </p>
              </div>
            </section>

            {/* Hébergeur */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t.legal.hosting.title}</h2>
              <div className="bg-card rounded-lg p-6 border">
                <p className="mb-2">
                  <strong>{t.legal.hosting.name}:</strong> Vercel Inc.
                </p>
                <p className="mb-2">
                  <strong>{t.legal.hosting.address}:</strong> 440 N Barranca Ave #4133, Covina, CA 91723, USA
                </p>
                <p className="mb-2">
                  <strong>{t.legal.hosting.website}:</strong>{" "}
                  <a
                    href="https://vercel.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    https://vercel.com
                  </a>
                </p>
              </div>
            </section>

            {/* Base de données */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t.legal.database.title}</h2>
              <div className="bg-card rounded-lg p-6 border">
                <p className="mb-2">
                  <strong>{t.legal.database.name}:</strong> Supabase Inc.
                </p>
                <p className="mb-2">
                  <strong>{t.legal.database.location}:</strong> AWS eu-west-1 (Ireland)
                </p>
                <p className="mb-2">
                  <strong>{t.legal.database.website}:</strong>{" "}
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    https://supabase.com
                  </a>
                </p>
              </div>
            </section>

            {/* Propriété intellectuelle */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t.legal.intellectual.title}</h2>
              <div className="bg-card rounded-lg p-6 border space-y-4">
                <p>{t.legal.intellectual.content}</p>
                <p className="text-sm text-muted-foreground">{t.legal.intellectual.trademarks}</p>
              </div>
            </section>

            {/* Responsabilité */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t.legal.responsibility.title}</h2>
              <div className="bg-card rounded-lg p-6 border">
                <p>{t.legal.responsibility.content}</p>
              </div>
            </section>

            {/* Droit applicable */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">{t.legal.law.title}</h2>
              <div className="bg-card rounded-lg p-6 border">
                <p>{t.legal.law.content}</p>
              </div>
            </section>
          </div>

          <p className="text-sm text-muted-foreground mt-12">
            {t.legal.lastUpdate}: {new Date().toLocaleDateString()}
          </p>
        </motion.div>
      </div>
    </main>
  );
}
