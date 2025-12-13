/**
 * Script d'initialisation du Supabase Storage pour Lorcana
 *
 * Usage: npm run setup:storage
 */

// Charger les variables d'environnement depuis .env.local
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(process.cwd(), '.env.local') })

import { createLorcanaBucket } from '../lib/supabase/storage'

async function main() {
  console.log('🚀 Initialisation du Supabase Storage pour Lorcana')
  console.log('=' .repeat(60))

  // Vérifier les variables d'environnement
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY === 'placeholder-service-role-key') {
    console.error('\n❌ ERREUR: Veuillez configurer vos vraies clés Supabase dans .env.local')
    console.error('\n📝 Étapes:')
    console.error('   1. Allez sur https://supabase.com/dashboard')
    console.error('   2. Sélectionnez votre projet')
    console.error('   3. Allez dans Settings > API')
    console.error('   4. Copiez:')
    console.error('      - Project URL → NEXT_PUBLIC_SUPABASE_URL')
    console.error('      - anon public key → NEXT_PUBLIC_SUPABASE_ANON_KEY')
    console.error('      - service_role key → SUPABASE_SERVICE_ROLE_KEY')
    console.error('   5. Remplacez les valeurs dans .env.local')
    process.exit(1)
  }

  try {
    const result = await createLorcanaBucket()

    if (result.success) {
      console.log('\n✅ Configuration terminée avec succès!')
      console.log('\n📋 Prochaines étapes:')
      console.log('   1. Exécutez: npm run seed:lorcana')
      console.log('   2. Attendez que le scraping se termine')
      console.log('   3. Lancez l\'app: npm run dev')
      console.log('   4. Visitez: http://localhost:3000/lorcana/series')
    } else {
      console.error('\n❌ Erreur lors de la configuration:', result.error)
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  }
}

main()
