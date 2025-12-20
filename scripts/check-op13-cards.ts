/**
 * Check OP13 cards for SP Parallele entries
 */

import { createAdminClient } from './lib/supabase'

const supabase = createAdminClient()

async function main() {
  const { data: series } = await supabase
    .from('series')
    .select('id')
    .eq('code', 'OP13')
    .single()

  if (!series) {
    console.log('Series not found')
    return
  }

  console.log('Series ID:', series.id)

  // Get all cards with Sp Parallele or similar
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, name, number, rarity, image_url, language')
    .eq('series_id', series.id)
    .or('name.ilike.%parallele%,name.ilike.%beckmann%,name.ilike.%smoker%,name.ilike.%lilith%')
    .order('number')

  if (error) {
    console.log('Error:', error.message)
    return
  }

  console.log('\nCards found:', cards?.length || 0)
  cards?.forEach(c => {
    const hasImage = c.image_url ? 'has image' : 'NO IMAGE'
    console.log('  ' + c.number + ' | ' + c.name + ' | ' + c.rarity + ' | ' + hasImage)
  })

  // Also check for cards with numbers starting with 009, 030, 111, 004
  console.log('\n\nChecking specific numbers...')
  const { data: numberedCards } = await supabase
    .from('cards')
    .select('id, name, number, rarity, image_url')
    .eq('series_id', series.id)
    .or('number.like.009%,number.like.030%,number.like.111%,number.like.004%')
    .order('number')

  console.log('\nCards with specific numbers:', numberedCards?.length || 0)
  numberedCards?.forEach(c => {
    const hasImage = c.image_url ? 'has image' : 'NO IMAGE'
    console.log('  ' + c.number + ' | ' + c.name + ' | ' + c.rarity + ' | ' + hasImage)
  })
}

main()
