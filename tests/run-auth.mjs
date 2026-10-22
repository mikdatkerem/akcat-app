import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { verifyAuth } from './auth.browser.mjs'
import { verifyCustomers } from './customers.browser.mjs'
import { verifyProducts } from './products.browser.mjs'
import { verifySales } from './sales.browser.mjs'
import { verifyFinance } from './finance.browser.mjs'
import { verifyCorrections } from './corrections.browser.mjs'

const { values } = parseArgs({ options: { metadata: { type: 'string' }, 'playwright-dir': { type: 'string' }, channel: { type: 'string', default: 'chrome' }, suite: { type: 'string', default: 'auth' } } })
if (!values.metadata) throw new Error('--metadata must point to the isolated serve-auth environment metadata.')
// Use an already installed Playwright runtime; this command never installs packages or browsers.
const require = values['playwright-dir'] ? createRequire(resolve(values['playwright-dir'], 'package.json')) : createRequire(import.meta.url)
const { chromium } = require('playwright')
const browser = await chromium.launch({ channel: values.channel, headless: true })
try {
  const page = await browser.newPage()
  const suites = { auth: verifyAuth, customers: verifyCustomers, products: verifyProducts, sales: verifySales, finance: verifyFinance, corrections: verifyCorrections }
  if (!Object.hasOwn(suites, values.suite)) throw new Error('Unknown test suite.')
  const result = await suites[values.suite](page, resolve(values.metadata))
  console.log(JSON.stringify(result, null, 2))
} finally { await browser.close() }
