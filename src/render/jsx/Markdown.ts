import { parseBlockMarkdown } from "../../index.ts"
import { BlockMarkdown } from "./BlockMarkdown.ts"
import type { CreateElementFn, Fragment, FunctionalComponent } from "./index.ts"

type Props = {
  className?: string
  string: string
  outerHeadingLevel?: number
  footnoteLabelSuffix?: string
  createElement: CreateElementFn
  fragment: Fragment
}

export const Markdown: FunctionalComponent<Props> = ({
  className,
  string,
  outerHeadingLevel,
  footnoteLabelSuffix,
  createElement,
  fragment,
}) => {
  const blocks = parseBlockMarkdown(string)
  const blockElements = blocks.map((block, i) =>
    createElement(BlockMarkdown, {
      key: `md-block-${i.toString()}`,
      node: block,
      outerHeadingLevel,
      footnoteLabelSuffix,
      createElement,
      fragment,
    }),
  )

  if (className) {
    return createElement("div", { className }, ...blockElements)
  }

  return createElement(fragment, null, ...blockElements)
}
