export const layout = 'default'

export const data = {}

export function render ({ data, content }) {
  return `
    <div class="container">
      ${content}
    </div>
  `
}
