import * as path from 'path'
import { promises as fs } from 'fs'

import { test } from 'uvu'
import * as assert from 'uvu/assert'

import { transformSourceTemplate } from '../lib/new-site.js'

const { pathname: templateDirectoryPath } = new URL('../lib/starter-template', import.meta.url)
const { pathname: outputDirectoryPath } = new URL('output', import.meta.url)

test('transform source template to create new site', async () => {
  const paths = await transformSourceTemplate(templateDirectoryPath, outputDirectoryPath, {
    example: 'weeeooo'
  })

  assert.ok(paths.size)
  await fs.rm(outputDirectoryPath, { recursive: true })
})

test.run()
