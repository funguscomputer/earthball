import remark from 'remark'
import stripMd from 'strip-markdown'
import stripHtml from 'remark-strip-html'

export function stripMarkdown (input) {
  return remark()
    .use(stripHtml)
    .use(stripMd)
    .process(input)
}
