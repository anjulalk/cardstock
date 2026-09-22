import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const dir = resolve('packages/web/public/banks')
for (const name of readdirSync(dir)) {
  const buffer = readFileSync(resolve(dir, name))
  // PNG IHDR: width and height are the two 32 bit big endian words at byte 16.
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  console.log(`${name.padEnd(14)} ${width}x${height}  ${buffer.length} bytes`)
}
