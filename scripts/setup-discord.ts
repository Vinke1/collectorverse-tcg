/**
 * Discord Server Setup Script for CollectorVerse TCG
 *
 * This is a ONE-TIME script that creates all roles for your Discord server.
 * After running, you can delete the bot from your server.
 *
 * Usage:
 *   npx tsx scripts/setup-discord.ts
 *
 * Prerequisites:
 *   1. Create a Discord bot at https://discord.com/developers/applications
 *   2. Add DISCORD_BOT_TOKEN and DISCORD_GUILD_ID to .env.local
 *   3. Invite the bot to your server with Administrator permissions
 */

import { Client, GatewayIntentBits, PermissionFlagsBits, PermissionsBitField } from 'discord.js'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD_ID = process.env.DISCORD_GUILD_ID

if (!BOT_TOKEN) {
  console.error('❌ Missing DISCORD_BOT_TOKEN in .env.local')
  process.exit(1)
}

if (!GUILD_ID) {
  console.error('❌ Missing DISCORD_GUILD_ID in .env.local')
  process.exit(1)
}

// =============================================================================
// ROLES CONFIGURATION
// =============================================================================

interface RoleConfig {
  name: string
  color: string
  hoist?: boolean      // Display separately in member list
  mentionable?: boolean
  permissions?: bigint | bigint[]
}

const STAFF_ROLES: RoleConfig[] = [
  {
    name: '👑 Founder',
    color: '#FFD700',
    permissions: PermissionFlagsBits.Administrator,
    hoist: true
  },
  {
    name: '🛡️ Admin',
    color: '#E74C3C',
    permissions: PermissionFlagsBits.Administrator,
    hoist: true
  },
  {
    name: '🔧 Moderator',
    color: '#3498DB',
    permissions: [
      PermissionFlagsBits.ManageMessages,
      PermissionFlagsBits.KickMembers,
      PermissionFlagsBits.ModerateMembers,
      PermissionFlagsBits.ManageNicknames,
    ],
    hoist: true
  },
]

const SPECIAL_ROLES: RoleConfig[] = [
  { name: '⭐ Beta Tester', color: '#9B59B6', hoist: true },
  { name: '🎁 Contributor', color: '#2ECC71', hoist: true },
]

const TCG_ROLES: RoleConfig[] = [
  { name: '🎴 Pokemon', color: '#FFCB05', mentionable: true },
  { name: '🏰 Lorcana', color: '#1E90FF', mentionable: true },
  { name: '🏴‍☠️ One Piece', color: '#E63946', mentionable: true },
  { name: '⭐ Star Wars', color: '#FFE81F', mentionable: true },
  { name: '🌀 Riftbound', color: '#00CED1', mentionable: true },
  { name: '🔮 Magic', color: '#8B4513', mentionable: true },
  { name: '🍥 Naruto', color: '#FF6B35', mentionable: true },
]

const LANGUAGE_ROLES: RoleConfig[] = [
  { name: '🇫🇷 French', color: '#0055A4' },
  { name: '🇬🇧 English', color: '#C8102E' },
  { name: '🇯🇵 Japanese', color: '#BC002D' },
  { name: '🇨🇳 Chinese', color: '#DE2910' },
]

// Combine all roles (order matters for hierarchy - first = highest)
const ALL_ROLES: RoleConfig[] = [
  ...STAFF_ROLES,
  ...SPECIAL_ROLES,
  ...TCG_ROLES,
  ...LANGUAGE_ROLES,
]

// =============================================================================
// MAIN SCRIPT
// =============================================================================

async function setupDiscord() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║         CollectorVerse TCG - Discord Setup Script          ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  })

  try {
    // Connect to Discord
    console.log('🔌 Connecting to Discord...')
    await client.login(BOT_TOKEN)
    console.log(`✅ Connected as ${client.user?.tag}\n`)

    // Get the guild (server)
    const guild = await client.guilds.fetch(GUILD_ID!)
    console.log(`📍 Server: ${guild.name}`)
    console.log(`👥 Members: ${guild.memberCount}\n`)

    // Create roles (in reverse order for correct hierarchy)
    console.log('═══════════════════════════════════════════════════════════')
    console.log('                      Creating Roles                        ')
    console.log('═══════════════════════════════════════════════════════════\n')

    // We need to create roles in reverse order so the hierarchy is correct
    // Discord places newly created roles just above @everyone
    const rolesToCreate = [...ALL_ROLES].reverse()

    let created = 0
    let skipped = 0

    for (const roleConfig of rolesToCreate) {
      // Check if role already exists
      const existing = guild.roles.cache.find(r => r.name === roleConfig.name)
      if (existing) {
        console.log(`⏭️  Already exists: ${roleConfig.name}`)
        skipped++
        continue
      }

      // Calculate permissions
      let permissions: bigint = 0n
      if (roleConfig.permissions) {
        if (Array.isArray(roleConfig.permissions)) {
          permissions = roleConfig.permissions.reduce((acc, p) => acc | p, 0n)
        } else {
          permissions = roleConfig.permissions
        }
      }

      // Create the role
      await guild.roles.create({
        name: roleConfig.name,
        color: roleConfig.color as `#${string}`,
        hoist: roleConfig.hoist ?? false,
        mentionable: roleConfig.mentionable ?? false,
        permissions: new PermissionsBitField(permissions),
      })

      console.log(`✅ Created: ${roleConfig.name}`)
      created++

      // Rate limit protection
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Summary
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('                        Summary                             ')
    console.log('═══════════════════════════════════════════════════════════\n')
    console.log(`✅ Created: ${created} roles`)
    console.log(`⏭️  Skipped: ${skipped} roles (already existed)`)
    console.log(`📊 Total roles configured: ${ALL_ROLES.length}`)

    // Next steps
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('                       Next Steps                           ')
    console.log('═══════════════════════════════════════════════════════════\n')
    console.log('1. Assign yourself the "👑 Founder" role manually')
    console.log('2. Set up Carl-bot for reaction roles (see guide)')
    console.log('3. You can now remove this bot from your server')
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    client.destroy()
    console.log('🔌 Disconnected from Discord')
  }
}

// Run the script
setupDiscord()
