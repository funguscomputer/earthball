import frontmatter from '../lib/frontmatter.js'
import markdown from '../lib/markdown.js'
import liquid from '../lib/liquid.js'
import javascript from '../lib/javascript-transform.js'

export function defaultTransformPreset (config = {}) {
  return {
    transform: [
      frontmatter,
      markdown
    ],
    write: [
      liquid,
      javascript
    ]
  }
}
