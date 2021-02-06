import * as path from 'path'

import fastify from 'fastify'
import fastifySensible from 'fastify-sensible'
import fastifyCors from 'fastify-cors'
import fastifyStatic from 'fastify-static'
import livereload from 'livereload'

export function createServer (options = {}) {
  const {
    basepath = '/',
    siteDirectory = 'dist'
  } = options

  const app = fastify()

  const liveReloadServer = livereload.createServer({
    delay: 200
  }, () => {
    console.log('livereload listening at http://127.0.0.1:35729')
  })

  app.register(fastifySensible)
  app.register(fastifyCors)
  app.register(fastifyStatic, {
    root: path.join(process.cwd(), siteDirectory),
    prefix: basepath,
    redirect: true
  })

  app.setNotFoundHandler((request, reply) => {
    app.log.warn('404')
    reply.send('404')
  })

  app.setErrorHandler((error, request, reply) => {
    console.log(error)
    app.log.warn('500')
    reply.send('500')
  })

  app.addHook('onSend', async (request, reply, payload) => {
    if (!payload || !payload.filename) {
      return payload
    }

    if (!payload.filename.endsWith('.html')) {
      return payload
    }

    async function revisePayload (originalPayload) {
      let payload = ''

      return new Promise((resolve, reject) => {
        originalPayload
          .on('data', (data) => {
            payload += data
          })
          .on('finish', () => {
            resolve(payload)
          })
          .on('error', (err) => {
            reject(err)
          })
      })
    }

    const liveReloadScript = `<script>
        document.write('<script src="http://' + (location.host || 'localhost').split(':')[0] +
        ':35729/livereload.js?snipver=1"></' + 'script>')
      </script>
    </body>`

    let revisedPayload = await revisePayload(payload)
    revisedPayload = revisedPayload.replace('</body>', liveReloadScript)
    const payloadLength = Buffer.from(revisedPayload).length

    /*
      TODO: fix this hack
      explore resolving this hack to avoid a race condition between
      when a file is written and when the livereload fires in a different way.
    */
    if (payloadLength <= 1) {
      reply.redirect(request.url)
    }

    reply.header('content-length', payloadLength)
    return revisedPayload
  })

  app.addHook('onReady', () => {
    liveReloadServer.watch(path.join(process.cwd(), siteDirectory))
  })

  app.addHook('onClose', async () => {
    await liveReloadServer.close()
  })

  return app
}
