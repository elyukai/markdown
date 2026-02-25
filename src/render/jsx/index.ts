import type { AnyNonNullish } from "@elyukai/utils/nullable"

type VNode<P = AnyNonNullish> = {
  type: keyof TagProps | FunctionalComponent<P>
  props: P & { children: Element | Element[] }
}

type BaseProps = {
  key?: string | number
}

type HtmlBaseProps = BaseProps & { className?: string; role?: "note"; style?: object } & {
  [K in `data-${string}`]: string
}

type TagProps = {
  p: HtmlBaseProps
  div: HtmlBaseProps
  span: HtmlBaseProps
  h1: HtmlBaseProps
  h2: HtmlBaseProps
  h3: HtmlBaseProps
  h4: HtmlBaseProps
  h5: HtmlBaseProps
  h6: HtmlBaseProps
  ul: HtmlBaseProps
  ol: HtmlBaseProps
  li: HtmlBaseProps
  table: HtmlBaseProps
  caption: HtmlBaseProps
  thead: HtmlBaseProps
  tbody: HtmlBaseProps
  tr: HtmlBaseProps
  th: {
    colSpan?: number
    scope?: "colgroup"
  } & HtmlBaseProps
  td: {
    colSpan?: number
  } & HtmlBaseProps
  dl: HtmlBaseProps
  dt: HtmlBaseProps
  dd: HtmlBaseProps
  sup: HtmlBaseProps
  sub: HtmlBaseProps
  code: HtmlBaseProps
  pre: HtmlBaseProps
  strong: HtmlBaseProps
  em: HtmlBaseProps
  a: { href: string } & HtmlBaseProps
}

export type HtmlTag = Extract<keyof TagProps, string>

export type Element = string | number | boolean | bigint | object | null | undefined | VNode

export type FunctionalComponent<P> = (props: P & { children?: Element[] }) => Element

export type CreateElementFn = {
  <T extends HtmlTag>(type: T, props?: TagProps[T] | null, ...children: Element[]): VNode
  <P>(
    type: FunctionalComponent<P> | string,
    props: (P & BaseProps) | null,
    ...children: Element[]
  ): VNode<P>
}

export type Fragment = FunctionalComponent<BaseProps>

export { BlockMarkdown } from "./BlockMarkdown.ts"
export { BlockMarkdownHighlighting } from "./BlockMarkdownHighlighting.ts"
export { InlineMarkdown } from "./InlineMarkdown.ts"
export { Markdown } from "./Markdown.ts"
export { MarkdownHighlighting } from "./MarkdownHighlighting.ts"
