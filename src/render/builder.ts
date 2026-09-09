import { parseBlockMarkdown, type BlockMarkdownNode } from "../parser/block.ts"
import type { NodeToMap } from "../parser/helper.ts"
import { parseInlineMarkdown, type InlineMarkdownNode } from "../parser/inline.ts"

export type ParseInnerNode<Result, Node, Args extends unknown[]> = (
  node: Node,
  ...args: Args
) => Result

export type Builder<
  AnyNode,
  Node extends AnyNode,
  Result,
  Args extends unknown[],
  InnerArgs extends unknown[] = Args,
> = (node: Node, parseInner: ParseInnerNode<Result, AnyNode, InnerArgs>, ...args: Args) => Result

type BuilderMap<
  AnyNode extends { type: string },
  Result,
  Args extends unknown[],
  InnerArgs extends unknown[] = Args,
> = {
  [Type in AnyNode["type"]]: Builder<AnyNode, NodeToMap<AnyNode>[Type], Result, Args, InnerArgs>
}

export type InlineBuilderMap<Result, Args extends unknown[]> = BuilderMap<
  InlineMarkdownNode,
  Result,
  Args
>

type BlockBuilderArgs<InlineResult, Args extends unknown[]> = [
  parseInnerInline: ParseInnerNode<InlineResult, InlineMarkdownNode, Args>,
  ...Args,
]

export type BlockBuilderMap<Result, InlineResult, Args extends unknown[]> = BuilderMap<
  BlockMarkdownNode,
  Result,
  BlockBuilderArgs<InlineResult, Args>,
  Args
>

/**
 * Type safety helper to get the correct builder type for a given node type.
 */
const getBuilderForNode = <
  AnyNode extends { type: string },
  Result,
  Args extends unknown[],
  InnerArgs extends unknown[] = Args,
>(
  builder: BuilderMap<AnyNode, Result, Args, InnerArgs>,
  node: AnyNode,
): Builder<AnyNode, AnyNode, Result, Args, InnerArgs> => builder[node.type as keyof typeof builder]

/**
 * Renders an inline markdown string into an array of type T using the provided builder map.
 *
 * Each node in the parsed markdown is processed by the corresponding builder function.
 *
 * @param markdown The inline markdown string to be rendered.
 * @param builder A map of builder functions for each node type.
 * @returns An array of type T, where each element corresponds to a rendered node.
 */
export const renderInline = <Result, Args extends unknown[]>(
  markdown: string,
  builder: InlineBuilderMap<Result, Args>,
  ...args: Args
): Result[] => {
  const parseInner = (node: InlineMarkdownNode, ...args: Args): Result =>
    getBuilderForNode<InlineMarkdownNode, Result, Args>(builder, node)(node, parseInner, ...args)
  return parseInlineMarkdown(markdown).map(node => parseInner(node, ...args))
}

/**
 * Renders a markdown string into an array of type T using the provided builder map.
 *
 * Each node in the parsed markdown is processed by the corresponding builder function.
 *
 * @param markdown The markdown string to be rendered.
 * @param builder A map of builder functions for each node type.
 * @returns An array of type T, where each element corresponds to a rendered node.
 */
export const render = <Result, InlineResult, Args extends unknown[]>(
  markdown: string,
  builder: BlockBuilderMap<Result, InlineResult, Args> & InlineBuilderMap<InlineResult, Args>,
  ...args: Args
): Result[] => {
  const parseInnerInline = (node: InlineMarkdownNode, ...args: Args): InlineResult =>
    getBuilderForNode<InlineMarkdownNode, InlineResult, Args>(builder, node)(
      node,
      parseInnerInline,
      ...args,
    )

  const parseInner = (node: BlockMarkdownNode, ...args: Args): Result =>
    getBuilderForNode<BlockMarkdownNode, Result, BlockBuilderArgs<InlineResult, Args>, Args>(
      builder,
      node,
    )(node, parseInner, parseInnerInline, ...args)

  return parseBlockMarkdown(markdown).map(node => parseInner(node, ...args))
}
