#!/usr/bin/env node

import * as path from 'path'
import * as fs from 'fs'

import mri from 'mri'
import kleur from 'kleur'
import colorSupport from 'color-support'

import { Earthball } from '../index.js'
import { transformSourceTemplate } from '../lib/new-site.js'

kleur.enabled = colorSupport.level > 0

const { pathname: pkgFilePath } = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(fs.readFileSync(pkgFilePath))

const args = mri(process.argv.slice(2), {
  alias: {
    h: 'help',
    w: 'watch',
    s: 'serve',
    p: 'port',
    H: 'host',
    c: 'config',
    o: ['output', 'outputDirectory']
  },
  boolean: ['watch', 'serve'],
  default: {
    watch: false,
    serve: false,
    port: 4567,
    host: '127.0.0.1',
    config: 'earthball.config.js'
  }
})

const helpMessage = `
earthball v${pkg.version}
https://earthball.dev

COMMAND
earthball              Build or serve an earthball site

OPTIONS
-o, --output           Output directory for built site (default: dist)
-c, --config           Relative filepath to the earthball config file (default: earthball.config.js)
-s, --serve            Serve the site and watch for changes (default: false)
-p, --port             Port for serving the site (default: 4567)
-h, --host             Hostname for serving the site (default: 127.0.0.1)
-w, --watch            Watch for changes and rebuild without serving (default: false)
-h, --help             Show this help message

SUBCOMMANDS
earthball new          Create a new earthball site
earthball help         Show this help message

EXAMPLES

CREATE A NEW SITE:
earthball new --title example --description "cool site"

BUILD A SITE
earthball

SERVE A SITE LOCALLY AND WATCH FOR CHANGES WITH LIVERELOAD
earthball --serve

`

const subargs = args._.reduce((obj, subarg) => {
  obj[subarg] = true
  return obj
}, {})

if (args.help || subargs.help) {
  console.log(helpMessage)
  process.exit(0)
}

main()

async function main () {
  if (subargs.new) {
    const { pathname: templateFilePath } = new URL('../lib/starter-template', import.meta.url)

    await transformSourceTemplate(templateFilePath, process.cwd(), {
      title: args.title || path.basename(process.cwd()),
      description: args.description || 'Welcome to earthball'
    })

    return
  }

  if (args.serve) {
    args.watch = true
  }

  const configFilePath = path.join(process.cwd(), args.config)
  const { config } = await import(configFilePath)

  const earthball = new Earthball(Object.assign(config, args))
  await earthball.build()

  if (args.serve) {
    earthball.serve({ port: args.port, host: args.host }, (err, address) => {
      if (err) return console.error(err)
      console.log(`listening on ${kleur.bold(address)}`)
    })
  }
}
