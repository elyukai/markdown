import { parseBlockMarkdownForSyntaxHighlighting } from "../../index.ts"
import { BlockMarkdownHighlighting } from "./BlockMarkdownHighlighting.ts"
import type { CreateElementFn, Fragment, FunctionalComponent } from "./index.ts"

type Props = {
  class?: string
  string: string
  createElement: CreateElementFn
  fragment: Fragment
}

export const MarkdownHighlighting: FunctionalComponent<Props> = ({
  class: className,
  string,
  createElement,
  fragment,
}) => {
  const blocks = parseBlockMarkdownForSyntaxHighlighting(string)
  const blockElements = blocks.map((block, i) =>
    createElement(BlockMarkdownHighlighting, {
      key: `md-block-${i.toString()}`,
      node: block,
      createElement,
    }),
  )

  if (className) {
    return createElement("div", { className }, ...blockElements)
  }

  return createElement(fragment, null, ...blockElements)
}
