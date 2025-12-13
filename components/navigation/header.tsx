"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { type User } from "@supabase/supabase-js";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { signOut } from "@/app/login/actions";
import { LoginModal } from "@/components/auth/login-modal";
import { useLanguage } from "@/components/providers/language-provider";
import { SUPPORTED_LANGUAGES } from "@/lib/constants/app-config";

interface HeaderProps {
  user?: User | null;
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const { language, setLanguage, t } = useLanguage();

  const navigation = [
    { name: t.nav.home, href: "/" },
    { name: t.nav.pokemon, href: "/series/pokemon" },
    { name: t.nav.lorcana, href: "/series/lorcana" },
    { name: t.nav.onepiece, href: "/series/onepiece" },
    { name: t.nav.riftbound, href: "/series/riftbound" },
    { name: t.nav.naruto, href: "/series/naruto" },
  ];

  const currentFlag = SUPPORTED_LANGUAGES.find((l) => l.code === language)?.flag || "/images/flags/fr.svg";

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-4 pointer-events-none">
      <motion.header 
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-7xl pointer-events-auto"
      >
        <nav className="glass rounded-2xl px-6 h-16 flex items-center justify-between mx-auto shadow-lg shadow-purple-500/5 border border-white/10 dark:border-white/10 border-black/5">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="relative w-[60px] h-[60px] flex items-center justify-center rounded-lg overflow-hidden group-hover:scale-110 transition-transform">
              <Image
                src="/images/logo1.png"
                alt="CollectorVerse"
                width={60}
                height={60}
                className="object-contain"
              />
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 dark:from-white dark:via-gray-200 dark:to-gray-400 bg-clip-text text-transparent group-hover:text-neon transition-all duration-300">
              CollectorVerse
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1 p-1 bg-secondary/10 dark:bg-secondary/20 rounded-full border border-black/5 dark:border-white/5">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300",
                  pathname === item.href
                    ? "text-primary-foreground dark:text-white"
                    : "text-muted-foreground hover:text-foreground dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                )}
              >
                {pathname === item.href && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-primary text-primary-foreground shadow-sm rounded-full"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <span className="relative z-10 mix-blend-exclusion dark:mix-blend-normal">{item.name}</span>
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-lg w-9 h-9 overflow-hidden p-0">
                  <Image
                    src={currentFlag}
                    alt="Current Language"
                    width={36}
                    height={36}
                    className="object-cover"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <DropdownMenuItem
                    key={lang.code}
                    onClick={() => setLanguage(lang.code as any)}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-md overflow-hidden flex-shrink-0">
                      <Image
                        src={lang.flag}
                        alt={lang.label}
                        width={24}
                        height={24}
                        className="object-cover"
                      />
                    </div>
                    <span>{lang.label}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeToggle />
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.user_metadata?.avatar_url} alt={user.email} />
                      <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.user_metadata?.full_name || user.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Se déconnecter</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <LoginModal>
                <Button variant="default" size="sm" className="bg-primary hover:bg-primary/80 text-primary-foreground font-bold shadow-[0_0_15px_rgba(0,168,181,0.4)] dark:shadow-[0_0_15px_rgba(0,243,255,0.4)] hover:shadow-[0_0_25px_rgba(0,168,181,0.6)] dark:hover:shadow-[0_0_25px_rgba(0,243,255,0.6)] transition-all duration-300 rounded-full px-6">
                  Connexion
                </Button>
              </LoginModal>
            )}

            {/* Mobile menu button */}
            <Button variant="ghost" size="icon" className="md:hidden hover:bg-black/5 dark:hover:bg-white/10 rounded-full">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </div>
        </nav>
      </motion.header>
    </div>
  );
}
