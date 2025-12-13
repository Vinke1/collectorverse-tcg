"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { motion } from "framer-motion";
import { Shield, Database, Cookie, Mail, Trash2, Download } from "lucide-react";

export default function PrivacyPage() {
  const { t } = useLanguage();

  const sections = [
    {
      icon: Database,
      title: t.privacy.dataCollected.title,
      content: t.privacy.dataCollected.content,
      items: t.privacy.dataCollected.items,
    },
    {
      icon: Shield,
      title: t.privacy.dataUsage.title,
      content: t.privacy.dataUsage.content,
      items: t.privacy.dataUsage.items,
    },
    {
      icon: Cookie,
      title: t.privacy.cookies.title,
      content: t.privacy.cookies.content,
      items: t.privacy.cookies.items,
    },
  ];

  const rights = [
    { icon: Download, title: t.privacy.rights.access, desc: t.privacy.rights.accessDesc },
    { icon: Mail, title: t.privacy.rights.rectification, desc: t.privacy.rights.rectificationDesc },
    { icon: Trash2, title: t.privacy.rights.deletion, desc: t.privacy.rights.deletionDesc },
  ];

  return (
    <main className="min-h-screen pt-28 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl font-bold mb-4">{t.privacy.title}</h1>
          <p className="text-lg text-muted-foreground mb-12">{t.privacy.subtitle}</p>

          {/* Introduction */}
          <div className="bg-gradient-to-r from-primary/10 to-purple-500/10 rounded-xl p-6 mb-12 border border-primary/20">
            <p className="text-lg">{t.privacy.intro}</p>
          </div>

          {/* Sections principales */}
          <div className="space-y-8 mb-12">
            {sections.map((section, index) => (
              <motion.section
                key={section.title}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-card rounded-xl p-6 border"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <section.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-xl font-semibold">{section.title}</h2>
                </div>
                <p className="text-muted-foreground mb-4">{section.content}</p>
                {section.items && (
                  <ul className="space-y-2">
                    {section.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.section>
            ))}
          </div>

          {/* Vos droits RGPD */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-6">{t.privacy.rights.title}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {rights.map((right, index) => (
                <motion.div
                  key={right.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.1 }}
                  className="bg-card rounded-xl p-5 border text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <right.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{right.title}</h3>
                  <p className="text-sm text-muted-foreground">{right.desc}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Conservation des données */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">{t.privacy.retention.title}</h2>
            <div className="bg-card rounded-xl p-6 border">
              <p className="mb-4">{t.privacy.retention.content}</p>
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm">
                  <strong>{t.privacy.retention.deletion}:</strong> {t.privacy.retention.deletionDesc}
                </p>
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">{t.privacy.contact.title}</h2>
            <div className="bg-card rounded-xl p-6 border">
              <p className="mb-4">{t.privacy.contact.content}</p>
              <a
                href="mailto:privacy@collectorverse.fr"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <Mail className="w-4 h-4" />
                privacy@collectorverse.fr
              </a>
            </div>
          </section>

          <p className="text-sm text-muted-foreground">
            {t.privacy.lastUpdate}: {new Date().toLocaleDateString()}
          </p>
        </motion.div>
      </div>
    </main>
  );
}
