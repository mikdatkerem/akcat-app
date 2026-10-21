// Isolated browser-test environment. Uses the existing API test harness, never akcat-db.
import { spawn } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, writeFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'node:net'
import { setTimeout as delay } from 'node:timers/promises'
import { hashPassword } from '../../akcat-api/src/security/password.ts'

if (!process.stdin.isTTY) {
  console.error('Start the isolated browser-test environment in an interactive terminal so Enter can close it safely.')
  process.exit(1)
}

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const api = resolve(web, '../akcat-api')
const temporary = await mkdtemp(join(tmpdir(), 'akcat-web-auth-test-'))
const children = []
let stopping = false
const key = randomBytes(32).toString('hex')

async function freePort() {
  const server = createServer()
  await new Promise(done => server.listen(0, '127.0.0.1', done))
  const port = server.address().port
  await new Promise(done => server.close(done))
  return port
}

function start(args, cwd, env = {}) {
  const child = spawn(process.execPath, args, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', ...env } })
  children.push(child)
  child.stdout.resume()
  child.stderr.resume()
  return child
}

async function ready(url, headers = {}) {
  for (let attempt = 0; attempt < 160; attempt++) {
    if (children.some(child => child.exitCode !== null)) throw new Error('Test process stopped before readiness.')
    try { if ((await fetch(url, { headers })).ok) return } catch { /* starting */ }
    await delay(250)
  }
  throw new Error('Test environment did not become ready.')
}

async function stop() {
  if (stopping) return
  stopping = true
  await Promise.all(children.map(async child => {
    if (child.exitCode !== null) return
    const stopped = new Promise(done => child.once('exit', done))
    child.kill()
    await Promise.race([stopped, delay(10000, undefined, { ref: false })])
  }))
  const target = await realpath(temporary)
  const parent = await realpath(tmpdir())
  if (dirname(target).toLowerCase() !== parent.toLowerCase()
    || !target.toLowerCase().startsWith(`${parent}${sep}akcat-web-auth-test-`.toLowerCase())) throw new Error('Unexpected temporary directory.')
  await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 })
  process.stdin.pause()
}

try {
  // Verify the test database identity before starting either local process.
  const config = JSON.parse(await readFile(join(api, 'tests/wrangler.jsonc'), 'utf8'))
  if (config.d1_databases?.[0]?.database_id !== '11111111-1111-4111-8111-111111111111') throw new Error('Unexpected test database.')
  const apiPort = await freePort()
  const webPort = await freePort()
  const base = `http://127.0.0.1:${apiPort}`
  const origin = `http://127.0.0.1:${webPort}`
  start([join(api, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--config', join(api, 'tests/wrangler.jsonc'),
    '--local', '--ip', '127.0.0.1', '--port', String(apiPort), '--inspector-port', '0', '--persist-to', join(temporary, 'state'),
    '--var', `TEST_KEY:${key}`, '--var', `AUTH_ALLOWED_ORIGINS:${origin}`, '--show-interactive-dev-session', 'false'], api)
  await ready(`${base}/api/health`, { 'X-Test-Key': key })
  async function control(path, body) {
    const response = await fetch(base + path, { method: 'POST', headers: { 'X-Test-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!response.ok) throw new Error('Isolated test setup failed.')
  }
  await control('/__test/schema', { sql: await readFile(join(api, 'migrations/0001_initial_schema.sql'), 'utf8') })
  // One random fixture in temporary test D1 only. No admin, public seed or persistent account.
  const fixture = { id: randomUUID(), username: `browser_${randomBytes(6).toString('hex')}`, password: randomBytes(24).toString('base64url') }
  const now = new Date().toISOString()
  await control('/__test/sql', { sql: 'INSERT INTO users(id,username,password_hash,role,is_active,created_at,updated_at) VALUES(?,?,?,\'employee\',1,?,?)',
    params: [fixture.id, fixture.username, await hashPassword(fixture.password), now, now] })
  start([join(web, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(webPort), '--strictPort'], web,
    { API_PROXY_TARGET: base, VITE_API_BASE_URL: '' })
  await ready(origin)
  const metadata = join(temporary, 'browser.json')
  await writeFile(metadata, JSON.stringify({ origin, api: base, key, fixture, temporary }), { mode: 0o600 })
  // Only the path is printed. Fixture credentials and guard keys never enter console output.
  console.log(`Isolated auth environment ready. Metadata: ${metadata}`)
  console.log('Run tests/auth.browser.mjs with a Playwright page. Press Enter to stop and remove temporary state.')
  const timeout = setTimeout(() => { void stop().then(() => process.exit()) }, 15 * 60 * 1000)
  timeout.unref()
  process.stdin.resume()
  process.stdin.once('data', () => { clearTimeout(timeout); void stop().then(() => process.exit()) })
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { clearTimeout(timeout); void stop().then(() => process.exit()) })
} catch {
  // Avoid forwarding raw process/SQL logs that might contain fixture secrets.
  console.error('Isolated auth environment failed to start. No production database was used.')
  await stop()
  process.exitCode = 1
}
