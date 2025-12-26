/**
 * Discord Permissions Setup Script for CollectorVerse TCG
 *
 * This script configures channel permissions:
 * - Welcome: visible to everyone (read-only, can react)
 * - General: visible to everyone
 * - Collections: each TCG channel visible only to users with that TCG role
 * - Community: visible to everyone, BUT language channels require language role
 *
 * Usage:
 *   npx tsx scripts/setup-discord-permissions.ts
 */

import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  TextChannel,
  CategoryChannel,
  Role,
  Guild,
} from 'discord.js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN
const GUILD_ID = process.env.DISCORD_GUILD_ID

if (!BOT_TOKEN || !GUILD_ID) {
  console.error('❌ Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID in .env.local')
  process.exit(1)
}

// =============================================================================
// CONFIGURATION
// =============================================================================

// Channel names (lowercase, as they appear in Discord)
const CONFIG = {
  // Welcome category - everyone can see, read-only
  welcomeCategory: 'bienvenue',
  welcomeChannels: ['rules', 'news', 'welcome'],

  // General category - everyone can see and chat
  generalCategory: 'general',
  generalChannels: ['discussion', 'support', 'suggestions', 'bugs'],

  // Collections category - TCG-specific access
  collectionsCategory: 'collections',
  tcgChannelToRole: {
    'pokemon': '🎴 Pokemon',
    'lorcana': '🏰 Lorcana',
    'one-piece': '🏴‍☠️ One Piece',
    'starwars': '⭐ Star Wars',
    'riftbound': '🌀 Riftbound',
    'magics': '🔮 Magic',
    'magic': '🔮 Magic',
    'naruto': '🍥 Naruto',
  },

  // Community category - language-specific channels
  communityCategory: 'communaute',
  languageChannelToRole: {
    'fr': '🇫🇷 French',
    'en': '🇬🇧 English',
    'jp': '🇯🇵 Japanese',
    'cn': '🇨🇳 Chinese',
  },
  // These community channels are visible to everyone
  publicCommunityChannels: ['collections', 'giveaways'],
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function findChannelByName(guild: Guild, name: string, type?: ChannelType) {
  return guild.channels.cache.find(
    (ch) =>
      ch.name.toLowerCase().includes(name.toLowerCase()) &&
      (type === undefined || ch.type === type)
  )
}

function findRoleByName(guild: Guild, name: string): Role | undefined {
  return guild.roles.cache.find((r) => r.name === name)
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// =============================================================================
// MAIN SCRIPT
// =============================================================================

async function setupPermissions() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║      CollectorVerse TCG - Discord Permissions Setup        ║')
  console.log('╚════════════════════════════════════════════════════════════╝\n')

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  })

  try {
    console.log('🔌 Connecting to Discord...')
    await client.login(BOT_TOKEN)
    console.log(`✅ Connected as ${client.user?.tag}\n`)

    const guild = await client.guilds.fetch(GUILD_ID!)
    // Fetch all channels and roles
    await guild.channels.fetch()
    await guild.roles.fetch()

    console.log(`📍 Server: ${guild.name}\n`)

    const everyone = guild.roles.everyone

    // =========================================================================
    // STEP 1: Configure Welcome Category
    // =========================================================================
    console.log('═══════════════════════════════════════════════════════════')
    console.log('           Configuring WELCOME Category                    ')
    console.log('═══════════════════════════════════════════════════════════\n')

    const welcomeCategory = findChannelByName(guild, CONFIG.welcomeCategory, ChannelType.GuildCategory) as CategoryChannel

    if (welcomeCategory) {
      // Everyone can view welcome category
      await welcomeCategory.permissionOverwrites.set([
        {
          id: everyone.id,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
          deny: [PermissionFlagsBits.SendMessages],
        },
      ])
      console.log(`✅ ${welcomeCategory.name}: visible to everyone (read-only)`)

      // Configure individual welcome channels
      for (const channelName of CONFIG.welcomeChannels) {
        const channel = guild.channels.cache.find(
          (ch) => ch.parentId === welcomeCategory.id && ch.name.toLowerCase().includes(channelName)
        ) as TextChannel

        if (channel) {
          if (channelName === 'welcome') {
            // Welcome channel: can react but not send messages
            await channel.permissionOverwrites.set([
              {
                id: everyone.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.ReadMessageHistory,
                  PermissionFlagsBits.AddReactions,
                ],
                deny: [PermissionFlagsBits.SendMessages],
              },
            ])
            console.log(`  ✅ #${channel.name}: can react, cannot send messages`)
          } else {
            // Rules/News: read-only
            await channel.permissionOverwrites.set([
              {
                id: everyone.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                deny: [PermissionFlagsBits.SendMessages],
              },
            ])
            console.log(`  ✅ #${channel.name}: read-only`)
          }
        }
        await delay(300)
      }
    } else {
      console.log('⚠️  Welcome category not found')
    }

    // =========================================================================
    // STEP 2: Configure General Category
    // =========================================================================
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('           Configuring GENERAL Category                    ')
    console.log('═══════════════════════════════════════════════════════════\n')

    const generalCategory = findChannelByName(guild, CONFIG.generalCategory, ChannelType.GuildCategory) as CategoryChannel

    if (generalCategory) {
      // Everyone can view and chat in general
      await generalCategory.permissionOverwrites.set([
        {
          id: everyone.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AddReactions,
          ],
        },
      ])
      console.log(`✅ ${generalCategory.name}: visible to everyone (can chat)`)
    } else {
      console.log('⚠️  General category not found')
    }

    // =========================================================================
    // STEP 3: Configure Collections Category (TCG-specific)
    // =========================================================================
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('        Configuring COLLECTIONS Category (TCG roles)       ')
    console.log('═══════════════════════════════════════════════════════════\n')

    const collectionsCategory = findChannelByName(guild, CONFIG.collectionsCategory, ChannelType.GuildCategory) as CategoryChannel

    if (collectionsCategory) {
      // Hide collections category from everyone by default
      await collectionsCategory.permissionOverwrites.set([
        {
          id: everyone.id,
          deny: [PermissionFlagsBits.ViewChannel],
        },
      ])
      console.log(`✅ ${collectionsCategory.name}: hidden by default`)

      // Configure each TCG channel
      for (const [channelName, roleName] of Object.entries(CONFIG.tcgChannelToRole)) {
        const channel = guild.channels.cache.find(
          (ch) => ch.parentId === collectionsCategory.id && ch.name.toLowerCase().includes(channelName)
        ) as TextChannel

        const role = findRoleByName(guild, roleName)

        if (channel && role) {
          await channel.permissionOverwrites.set([
            {
              id: everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: role.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AddReactions,
              ],
            },
          ])
          console.log(`  ✅ #${channel.name}: visible only to "${roleName}"`)
        } else if (!channel) {
          // Channel not found, skip silently (might be different naming)
        } else if (!role) {
          console.log(`  ⚠️  Role "${roleName}" not found for #${channelName}`)
        }
        await delay(300)
      }
    } else {
      console.log('⚠️  Collections category not found')
    }

    // =========================================================================
    // STEP 4: Configure Community Category (Language-specific)
    // =========================================================================
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('       Configuring COMMUNITY Category (Language roles)     ')
    console.log('═══════════════════════════════════════════════════════════\n')

    const communityCategory = findChannelByName(guild, CONFIG.communityCategory, ChannelType.GuildCategory) as CategoryChannel

    if (communityCategory) {
      // Community category visible to everyone
      await communityCategory.permissionOverwrites.set([
        {
          id: everyone.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
          ],
        },
      ])
      console.log(`✅ ${communityCategory.name}: visible to everyone`)

      // Configure public community channels
      for (const channelName of CONFIG.publicCommunityChannels) {
        const channel = guild.channels.cache.find(
          (ch) => ch.parentId === communityCategory.id && ch.name.toLowerCase().includes(channelName)
        ) as TextChannel

        if (channel) {
          await channel.permissionOverwrites.set([
            {
              id: everyone.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
              ],
            },
          ])
          console.log(`  ✅ #${channel.name}: visible to everyone`)
        }
        await delay(300)
      }

      // Configure language channels
      for (const [channelName, roleName] of Object.entries(CONFIG.languageChannelToRole)) {
        const channel = guild.channels.cache.find(
          (ch) => ch.parentId === communityCategory.id && ch.name.toLowerCase().includes(channelName)
        ) as TextChannel

        const role = findRoleByName(guild, roleName)

        if (channel && role) {
          await channel.permissionOverwrites.set([
            {
              id: everyone.id,
              deny: [PermissionFlagsBits.ViewChannel],
            },
            {
              id: role.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AddReactions,
              ],
            },
          ])
          console.log(`  ✅ #${channel.name}: visible only to "${roleName}"`)
        } else if (!channel) {
          console.log(`  ⚠️  Channel "#${channelName}" not found`)
        } else if (!role) {
          console.log(`  ⚠️  Role "${roleName}" not found`)
        }
        await delay(300)
      }
    } else {
      console.log('⚠️  Community category not found')
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('                        Summary                             ')
    console.log('═══════════════════════════════════════════════════════════\n')

    console.log('📋 Permission structure configured:')
    console.log('')
    console.log('  👤 New member joins:')
    console.log('     ├── ✅ Sees: Welcome, General, Community (public)')
    console.log('     ├── ❌ Hidden: Collections, Language channels')
    console.log('     └── 📍 Lands on: #welcome')
    console.log('')
    console.log('  🎴 Picks a TCG role (e.g., Pokemon):')
    console.log('     └── ✅ Unlocks: #pokemon channel')
    console.log('')
    console.log('  🇫🇷 Picks a language role (e.g., French):')
    console.log('     └── ✅ Unlocks: #fr channel')

    console.log('\n═══════════════════════════════════════════════════════════')
    console.log('                       Next Steps                           ')
    console.log('═══════════════════════════════════════════════════════════\n')
    console.log('1. Set #welcome as the default channel:')
    console.log('   Server Settings → Overview → System Messages Channel → #welcome')
    console.log('')
    console.log('2. Enable Welcome Screen (optional):')
    console.log('   Server Settings → Community → Welcome Screen')
    console.log('')
    console.log('3. Test with a new account or ask a friend to join!')
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    client.destroy()
    console.log('🔌 Disconnected from Discord')
  }
}

setupPermissions()
