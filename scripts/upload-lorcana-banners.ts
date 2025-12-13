import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import * as fs from 'fs'
import * as path from 'path'

async function uploadBanners() {
  const supabase = createAdminClient()

  const images = [
    { file: 'fabled.png', name: 'fabled.png' },
    { file: 'Jafar.png', name: 'jafar.png' }
  ]

  for (const img of images) {
    const filePath = path.join(process.cwd(), 'public', 'image', img.file)

    if (!fs.existsSync(filePath)) {
      logger.error(`Fichier non trouvé: ${filePath}`)
      continue
    }

    const fileBuffer = fs.readFileSync(filePath)
    const fileName = `banners/${img.name}`

    logger.processing(`Upload de ${img.file}...`)

    const { error } = await supabase.storage
      .from('lorcana-cards')
      .upload(fileName, fileBuffer, {
        contentType: 'image/png',
        upsert: true
      })

    if (error) {
      logger.error(`Erreur upload ${img.file}: ${error.message}`)
    } else {
      const { data: publicUrlData } = supabase.storage
        .from('lorcana-cards')
        .getPublicUrl(fileName)

      logger.success(`${img.file} uploadé: ${publicUrlData.publicUrl}`)
    }
  }
}

uploadBanners().catch(console.error)
