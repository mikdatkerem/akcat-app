import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { verifyAuth } from './auth.browser.mjs'

const { values } = parseArgs({ options: { metadata: { type: 'string' }, 'playwright-dir': { type: 'string' }, channel: { type: 'string', default: 'chrome' } } })
if (!values.metadata) throw new Error('--metadata must point to the isolated serve-auth environment metadata.')
// Use an already installed Playwright runtime; this command never installs packages or browsers.
const require = values['playwright-dir'] ? createRequire(resolve(values['playwright-dir'], 'package.json')) : createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: values.channel, headless: true })
try {
  const page = await browser.newPage()
  const result = await verifyAuth(page, resolve(values.metadata))
  console.log(JSON.stringify(result, null, 2))
} finally { await browser.close() }
