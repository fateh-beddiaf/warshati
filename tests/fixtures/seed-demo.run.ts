import { join } from 'path'
import { seedDemoDatabase } from './demo-data'

// Usage: electron -r tsx tests/fixtures/seed-demo.run.ts <dataDir>
// Creates <dataDir>/data/warshati.db filled with demo shop data (see demo-data.ts).
const dataDir = process.argv[process.argv.length - 1]
if (!dataDir || dataDir.endsWith('.ts')) {
  console.error('usage: seed-demo.run.ts <dataDir>')
  process.exit(2)
}
seedDemoDatabase(join(dataDir, 'data', 'warshati.db'))
console.log(`demo data written to ${dataDir}`)
process.exit(0)
