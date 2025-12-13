import sharp from 'sharp'
import path from 'path'
import fs from 'fs'

const INPUT_PATH = path.join(process.cwd(), 'public/images/logo.png')
const OUTPUT_DIR = path.join(process.cwd(), 'public')
const APP_DIR = path.join(process.cwd(), 'app')

async function generateFavicons() {
  console.log('🎨 Génération des favicons...')

  // Vérifier que le fichier source existe
  if (!fs.existsSync(INPUT_PATH)) {
    console.error('❌ Fichier logo.png non trouvé dans public/images/')
    process.exit(1)
  }

  const image = sharp(INPUT_PATH)

  // 1. Favicon ICO (multi-résolution) - on génère un PNG 32x32 d'abord
  // Note: sharp ne supporte pas directement ICO, on utilise PNG pour favicon
  console.log('  📁 Génération favicon.png (32x32)...')
  await image
    .clone()
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'favicon.png'))

  // 2. favicon.ico - on utilise un PNG 48x48 comme favicon.ico
  // Les navigateurs modernes acceptent les PNG comme favicons
  console.log('  📁 Génération favicon.ico (48x48)...')
  await image
    .clone()
    .resize(48, 48, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'favicon.ico'))

  // 3. Apple Touch Icon (180x180)
  console.log('  🍎 Génération apple-touch-icon.png (180x180)...')
  await image
    .clone()
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'apple-touch-icon.png'))

  // 4. Icon 192x192 (pour PWA)
  console.log('  📱 Génération icon-192x192.png...')
  await image
    .clone()
    .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'icon-192x192.png'))

  // 5. Icon 512x512 (pour PWA)
  console.log('  📱 Génération icon-512x512.png...')
  await image
    .clone()
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(OUTPUT_DIR, 'icon-512x512.png'))

  // 6. Icon pour app directory (Next.js 13+) - icon.png
  console.log('  📁 Génération app/icon.png (32x32)...')
  await image
    .clone()
    .resize(32, 32, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(APP_DIR, 'icon.png'))

  // 7. Apple icon pour app directory
  console.log('  🍎 Génération app/apple-icon.png (180x180)...')
  await image
    .clone()
    .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(APP_DIR, 'apple-icon.png'))

  console.log('')
  console.log('✅ Favicons générés avec succès!')
  console.log('')
  console.log('Fichiers créés:')
  console.log('  - public/favicon.png (32x32)')
  console.log('  - public/favicon.ico (48x48)')
  console.log('  - public/apple-touch-icon.png (180x180)')
  console.log('  - public/icon-192x192.png (192x192)')
  console.log('  - public/icon-512x512.png (512x512)')
  console.log('  - app/icon.png (32x32)')
  console.log('  - app/apple-icon.png (180x180)')
}

generateFavicons().catch(console.error)
