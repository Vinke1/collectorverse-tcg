import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AuthCodeError() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-4xl font-bold">Erreur d&apos;authentification</h1>
      <p className="text-muted-foreground">
        Une erreur s&apos;est produite lors de la connexion avec le fournisseur tiers.
      </p>
      <Link href="/login">
        <Button>Retour à la connexion</Button>
      </Link>
    </div>
  );
}

