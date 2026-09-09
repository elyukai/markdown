import { intercalate } from "@elyukai/utils/array/transformations"
import { isNotNullish } from "@elyukai/utils/nullable"
import {
  checkTableRowsAreSections,
  type TableCell,
  type TableColumnStyle,
} from "../../parser/block.js"
import type { InlineMarkdownNode } from "../../parser/inline.ts"
import {
  render,
  renderInline,
  type BlockBuilderMap,
  type InlineBuilderMap,
  type ParseInnerNode,
} from "../builder.ts"

type Syntax = string[]

export type Env = {
  indentation?: number
  outerHeadingLevel?: number
  footnoteLabelSuffix?: string
}

export const indent = ({ indentation }: Env, syntax: Syntax): Syntax =>
  indentation ? syntax.map(line => " ".repeat(indentation) + line) : syntax

type InlineHTMLBuilderMap<E extends Env = Env> = InlineBuilderMap<string, [env: E]>
export type InlineMarkdownBuilderAdjustments<E extends Env> = Partial<InlineHTMLBuilderMap<E>>

const inlineBuilderMap: InlineHTMLBuilderMap = {
  bold: (node, parseInner, env) =>
    `<strong>${node.content.map(content => parseInner(content, env)).join("")}</strong>`,
  italic: (node, parseInner, env) =>
    `<em>${node.content.map(content => parseInner(content, env)).join("")}</em>`,
  code: node => `<code>${node.content}</code>`,
  link: (node, parseInner, env) =>
    `<a href="${node.href}">${node.content.map(content => parseInner(content, env)).join("")}</a>`,
  attributed: (node, parseInner, env) =>
    `<span class="attributed"${Object.entries(node.attributes)
      .map(([k, v]) => ` data-${k}="${v.toString()}"`)
      .join("")}>${node.content.map(content => parseInner(content, env)).join("")}</span>`,
  text: node => node.content,
  superscript: (node, parseInner, env) =>
    `<sup>${node.content.map(content => parseInner(content, env)).join("")}</sup>`,
  footnoteRef: node =>
    `<sup class="footnote-ref${typeof node.label === "number" ? " footnote-ref--numeric" : ""}" style="--label: ${node.label.toString()}" data-reference="${node.label.toString()}">${node.label.toString()}</sup>`,
}

export const renderInlineMarkdownAsHTML = <E extends Env>(
  config: E & {
    builderMapAdjustments?: InlineMarkdownBuilderAdjustments<E>
  },
  markdown: string,
): string => {
  const { builderMapAdjustments, ...env } = config
  return renderInline(
    markdown,
    {
      ...(inlineBuilderMap as unknown as InlineBuilderMap<string, [env: E]>),
      ...builderMapAdjustments,
    },
    env as E,
  ).join("")
}

const renderTableRow = (
  parseInnerInline: ParseInnerNode<string, InlineMarkdownNode, [env: Env]>,
  env: Env,
  columns: TableColumnStyle[],
  cells: TableCell[],
  cellType: "td" | "th" = "td",
): Syntax => [
  "<tr>",
  ...indent(
    env,
    cells.reduce<[elements: Syntax, columnIndex: number]>(
      ([elements, columnIndex], tc) => [
        [
          ...elements,
          `<${cellType}${tc.colSpan !== undefined ? ` colspan="${tc.colSpan.toString()}"` : ""}${cellType === "th" && cells.length === 1 ? ` scope="colgroup"` : ""}${
            columns[columnIndex]?.alignment
              ? ` style="text-align: ${columns[columnIndex].alignment}"`
              : ""
          }>${tc.content.map(content => parseInnerInline(content, env)).join("")}</${cellType}>`,
        ],
        columnIndex + (tc.colSpan ?? 1),
      ],
      [[], 0],
    )[0],
  ),
  "</tr>",
]
type BlockHTMLBuilderMap<E extends Env = Env> = BlockBuilderMap<
  string[],
  string,
  [env: E, insertBefore?: string]
>

const blockBuilderMap: BlockBuilderMap<string[], string, [env: Env, insertBefore?: string]> = {
  paragraph: (node, _parseInner, parseInnerInline, env, insertBefore) => [
    `<p>${insertBefore ?? ""}${node.content.map(content => (content.type === "break" ? "<br>" : parseInnerInline(content, env))).join("")}</p>`,
  ],
  heading: (node, _parseInner, parseInnerInline, env, insertBefore) => {
    const { outerHeadingLevel = 0 } = env
    const level = (node.level + outerHeadingLevel).toString()
    return [
      `<h${level}>${insertBefore ?? ""}${node.content.map(content => parseInnerInline(content, env)).join("")}</h${level}>`,
    ]
  },
  list: (node, parseInner, parseInnerInline, env, insertBefore) =>
    [
      insertBefore,
      `<${node.ordered ? "ol" : "ul"}>`,
      ...indent(
        env,
        node.content.flatMap(item =>
          item.content.length > 0
            ? [
                "<li>",
                ...(item.inlineLabel === undefined
                  ? []
                  : [item.inlineLabel.map(content => parseInnerInline(content, env)).join("")]),
                ...item.content.flatMap(content => parseInner(content, env)),
                "</li>",
              ]
            : [
                `<li>${
                  item.inlineLabel === undefined
                    ? ""
                    : item.inlineLabel.map(content => parseInnerInline(content, env)).join("")
                }</li>`,
              ],
        ),
      ),
      `</${node.ordered ? "ol" : "ul"}>`,
    ].filter(isNotNullish),
  table: (node, _parseInner, parseInnerInline, env, insertBefore) =>
    [
      insertBefore,
      "<table>",
      ...indent(env, [
        ...(node.caption === undefined
          ? []
          : [
              `<caption>${intercalate(
                node.caption.map(captionLine =>
                  captionLine.map(content => parseInnerInline(content, env)),
                ),
                ["<br>"],
              ).join("")}</caption>`,
            ]),
        "<thead>",
        ...indent(env, renderTableRow(parseInnerInline, env, node.columns, node.header, "th")),
        "</thead>",
        ...(checkTableRowsAreSections(node.rows)
          ? node.rows.flatMap(section => [
              "<tbody>",
              ...(section.header
                ? indent(
                    env,
                    renderTableRow(parseInnerInline, env, node.columns, section.header, "th"),
                  )
                : []),
              ...section.rows.flatMap(row =>
                indent(env, renderTableRow(parseInnerInline, env, node.columns, row.cells)),
              ),
              "</tbody>",
            ])
          : [
              "<tbody>",
              ...node.rows.flatMap(row =>
                indent(env, renderTableRow(parseInnerInline, env, node.columns, row.cells)),
              ),
              "</tbody>",
            ]),
        "</thead>",
      ]),
      "</table>",
    ].filter(isNotNullish),
  container: (node, parseInner, _parseInnerInline, env, insertBefore) => [
    `<div${node.name === undefined ? "" : ` class="${node.name}"`}>`,
    ...indent(
      env,
      [insertBefore, ...node.content.flatMap(content => parseInner(content, env))].filter(
        isNotNullish,
      ),
    ),
    "</div>",
  ],
  footnote: (node, parseInner, _parseInnerInline, env, insertBefore) => {
    const label = `<span class="footnote__label${typeof node.label === "number" ? " footnote__label--numeric" : ""}" data-reference="${node.label.toString()}" style="--label: ${node.label.toString()}"><span class="footnote-label">${node.label.toString()}</span>${env.footnoteLabelSuffix ?? ""}</span> `

    return [
      `<div role="note" class="footnote">`,
      ...indent(
        env,
        [
          insertBefore,
          ...node.content.flatMap((n, i) => parseInner(n, env, i === 0 ? label : undefined)),
        ].filter(isNotNullish),
      ),
      `</div>`,
    ]
  },
  definitionList: (node, parseInner, parseInnerInline, env, insertBefore) =>
    [
      insertBefore,
      "<dl>",
      ...indent(
        env,
        node.content.flatMap(item => [
          `<div>`,
          ...indent(env, [
            ...item.terms.flatMap(term => [
              `<dt>${term.map(content => parseInnerInline(content, env)).join("")}</dt>`,
            ]),
            ...item.descriptions.flatMap(def => [
              `<dd>${def.map(content => parseInner(content, env)).join("")}</dd>`,
            ]),
          ]),
          `</div>`,
        ]),
      ),
      "</dl>",
    ].filter(isNotNullish),
}

const builderMap = { ...blockBuilderMap, ...inlineBuilderMap }

export type BlockMarkdownBuilderAdjustments<E extends Env> = Partial<
  BlockHTMLBuilderMap<E> & InlineHTMLBuilderMap<E>
>

export const renderBlockMarkdownAsHTML = <E extends Env>(
  config: E & {
    builderMapAdjustments?: BlockMarkdownBuilderAdjustments<E>
  },
  markdown: string,
): string => {
  const { builderMapAdjustments, ...env } = config
  return render(
    markdown,
    {
      ...(builderMap as unknown as BlockHTMLBuilderMap<E> & InlineHTMLBuilderMap<E>),
      ...builderMapAdjustments,
    },
    env as E,
  )
    .flat()
    .join(env.indentation ? "\n" : "")
}
