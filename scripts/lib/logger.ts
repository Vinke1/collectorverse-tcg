/**
 * Consistent logging utilities for scripts
 */

export const logger = {
  /**
   * Log a success message
   */
  success: (msg: string) => console.log('✅', msg),

  /**
   * Log an error message
   */
  error: (msg: string) => console.error('❌', msg),

  /**
   * Log an info message
   */
  info: (msg: string) => console.log('ℹ️ ', msg),

  /**
   * Log a warning message
   */
  warn: (msg: string) => console.warn('⚠️ ', msg),

  /**
   * Log a download/fetch message
   */
  download: (msg: string) => console.log('📥', msg),

  /**
   * Log an upload/cloud message
   */
  upload: (msg: string) => console.log('☁️ ', msg),

  /**
   * Log a processing message
   */
  processing: (msg: string) => console.log('🔧', msg),

  /**
   * Log a progress message
   */
  progress: (msg: string) => console.log('📊', msg),

  /**
   * Log a web/browser message
   */
  web: (msg: string) => console.log('🌐', msg),

  /**
   * Log a spider/scraping message
   */
  scrape: (msg: string) => console.log('🕷️ ', msg),

  /**
   * Log a page/document message
   */
  page: (msg: string) => console.log('📄', msg),

  /**
   * Log a section separator with title
   */
  section: (title: string) => {
    console.log('\n' + '='.repeat(80))
    console.log(title)
    console.log('='.repeat(80))
  },

  /**
   * Log a small separator
   */
  separator: () => console.log('─'.repeat(60)),
}
