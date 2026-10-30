// Every suite owns a fresh loopback Worker, random test guard and OS-temp D1.
import { spawn } from 'node:child_process'
import { parseArgs } from 'node:util'
import { setTimeout as delay } from 'node:timers/promises'

const { values } = parseArgs({ options: { suite: { type: 'string', default: 'reliability' }, 'playwright-dir': { type: 'string' } } })
const suites = values.suite === 'all' ? ['auth','customers','products','sales','finance','corrections','reports','adjustments','users','account','audit','directions','reliability'] : values.suite.split(',')
for (const suite of suites) {
  const server = spawn(process.execPath, ['--experimental-strip-types', 'tests/serve-auth.mjs', '--automation'], { windowsHide: true, stdio: ['pipe','pipe','pipe'] })
  let output = ''
  server.stderr.resume()
  try {
    const metadata = await Promise.race([
      new Promise((resolve, reject) => {
        server.once('error', reject)
        server.once('exit', () => reject(new Error('Isolated browser environment stopped before readiness.')))
        server.stdout.on('data', chunk => {
          output = (output + chunk).slice(-8000)
          const match = /Metadata: ([^\r\n]+)/.exec(output)
          if (match) resolve(match[1])
        })
      }),
      delay(45000, undefined, { ref: false }).then(() => { throw new Error('Isolated browser environment readiness timeout.') }),
    ])
    const args = ['tests/run-auth.mjs', '--suite', suite, '--metadata', metadata, ...(values['playwright-dir'] ? ['--playwright-dir', values['playwright-dir']] : [])]
    const runner = spawn(process.execPath, args, { windowsHide: true, stdio: 'inherit' })
    const code = await new Promise((resolve, reject) => { runner.once('error', reject); runner.once('exit', resolve) })
    if (code !== 0) throw new Error(`Browser suite failed: ${suite}`)
    console.log(`PASS isolated suite: ${suite}`)
  } finally {
    const stopped = new Promise(resolve => server.once('exit', resolve))
    server.stdin.end('\n')
    await Promise.race([stopped, delay(15000, undefined, { ref: false })])
    if (server.exitCode === null) server.kill()
  }
}
