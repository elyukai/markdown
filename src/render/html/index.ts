import { isNotNullish } from "@elyukai/utils/nullable"
import { assertExhaustive } from "@elyukai/utils/typeSafety"
import { parseBlockMarkdown, parseInlineMarkdown } from "../../index.ts"
import {
  checkTableRowsAreSections,
  type BlockMarkdownNode,
  type TableCell,
  type TableColumnStyle,
} from "../../parser/block.js"
import type { Attributed, InlineMarkdownNode } from "../../parser/inline.ts"

type Syntax = string[]

type Env = {
  indentation?: number
  outerHeadingLevel?: number
  footnoteLabelSuffix?: string
  renderAttributedString?: (node: Attributed) => string
}

const indent = ({ indentation }: Env, syntax: Syntax): Syntax =>
  indentation ? syntax.map(line => " ".repeat(indentation) + line) : syntax

export const renderInlineMarkdownNode = (env: Env, node: InlineMarkdownNode): string => {
  switch (node.type) {
    case "bold":
      return `<strong>${node.content.map(content => renderInlineMarkdownNode(env, content)).join("")}</strong>`
    case "italic":
      return `<em>${node.content.map(content => renderInlineMarkdownNode(env, content)).join("")}</em>`
    case "code":
      return `<code>${node.content}</code>`
    case "link":
      return `<a href="${node.href}">${node.content.map(content => renderInlineMarkdownNode(env, content)).join("")}</a>`
    case "attributed":
      return (
        env.renderAttributedString?.(node) ??
        `<span class="attributed"${Object.entries(node.attributes)
          .map(([k, v]) => ` data-${k}="${v.toString()}"`)
          .join(
            "",
          )}>${node.content.map(content => renderInlineMarkdownNode(env, content)).join("")}</span>`
      )
    case "text":
      return node.content
    case "superscript":
      return `<sup>${node.content.map(content => renderInlineMarkdownNode(env, content)).join("")}</sup>`
    case "footnoteRef": {
      return `<sup class="footnote-ref${typeof node.label === "number" ? " footnote-ref--numeric" : ""}" style="--label: ${node.label.toString()}" data-reference="${node.label.toString()}">${node.label.toString()}</sup>`
    }
    default:
      return assertExhaustive(node)
  }
}

export const renderInlineMarkdownAsHTML = (env: Env, markdown: string): string => {
  const nodes = parseInlineMarkdown(markdown)
  return nodes.map(node => renderInlineMarkdownNode(env, node)).join("")
}

const renderTableRow = (
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
          }>${tc.content.map(content => renderInlineMarkdownNode(env, content)).join("")}</${cellType}>`,
        ],
        columnIndex + (tc.colSpan ?? 1),
      ],
      [[], 0],
    )[0],
  ),
  "</tr>",
]

export const renderBlockMarkdownNode = (
  env: Env,
  node: BlockMarkdownNode,
  insertBefore?: string,
): string[] => {
  switch (node.type) {
    case "paragraph":
      return [
        `<p>${insertBefore ?? ""}${node.content.map(content => (content.type === "break" ? "<br>" : renderInlineMarkdownNode(env, content))).join("")}</p>`,
      ]
    case "heading": {
      const { outerHeadingLevel = 0 } = env
      const level = (node.level + outerHeadingLevel).toString()
      return [
        `<h${level}>${insertBefore ?? ""}${node.content.map(content => renderInlineMarkdownNode(env, content)).join("")}</h${level}>`,
      ]
    }
    case "list":
      return [
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
                    : [
                        item.inlineLabel
                          .map(content => renderInlineMarkdownNode(env, content))
                          .join(""),
                      ]),
                  ...item.content.flatMap(content => renderBlockMarkdownNode(env, content)),
                  "</li>",
                ]
              : [
                  `<li>${
                    item.inlineLabel === undefined
                      ? ""
                      : item.inlineLabel
                          .map(content => renderInlineMarkdownNode(env, content))
                          .join("")
                  }</li>`,
                ],
          ),
        ),
        `</${node.ordered ? "ol" : "ul"}>`,
      ].filter(isNotNullish)
    case "table":
      return [
        insertBefore,
        "<table>",
        ...indent(env, [
          ...(node.caption === undefined
            ? []
            : [
                `<caption>${node.caption.map(content => renderInlineMarkdownNode(env, content)).join("")}</caption>`,
              ]),
          "<thead>",
          ...indent(env, renderTableRow(env, node.columns, node.header, "th")),
          "</thead>",
          ...(checkTableRowsAreSections(node.rows)
            ? node.rows.flatMap(section => [
                "<tbody>",
                ...(section.header
                  ? indent(env, renderTableRow(env, node.columns, section.header, "th"))
                  : []),
                ...section.rows.flatMap(row =>
                  indent(env, renderTableRow(env, node.columns, row.cells)),
                ),
                "</tbody>",
              ])
            : [
                "<tbody>",
                ...node.rows.flatMap(row =>
                  indent(env, renderTableRow(env, node.columns, row.cells)),
                ),
                "</tbody>",
              ]),
          "</thead>",
        ]),
        "</table>",
      ].filter(isNotNullish)
    case "container":
      return [
        `<div${node.name === undefined ? "" : ` class="${node.name}"`}>`,
        ...indent(
          env,
          [
            insertBefore,
            ...node.content.flatMap(content => renderBlockMarkdownNode(env, content)),
          ].filter(isNotNullish),
        ),
        "</div>",
      ]
    case "footnote": {
      const label = `<span class="footnote__label${typeof node.label === "number" ? " footnote__label--numeric" : ""}" data-reference="${node.label.toString()}" style="--label: ${node.label.toString()}"><span class="footnote-label">${node.label.toString()}</span>${env.footnoteLabelSuffix ?? ""}</span> `

      return [
        `<div role="note" class="footnote">`,
        ...indent(
          env,
          [
            insertBefore,
            ...node.content.flatMap((n, i) =>
              renderBlockMarkdownNode(env, n, i === 0 ? label : undefined),
            ),
          ].filter(isNotNullish),
        ),
        `</div>`,
      ]
    }
    case "definitionList":
      return [
        insertBefore,
        "<dl>",
        ...indent(
          env,
          node.content.flatMap(item => [
            `<div>`,
            ...indent(env, [
              ...item.terms.flatMap(term => [
                `<dt>${term.map(content => renderInlineMarkdownNode(env, content)).join("")}</dt>`,
              ]),
              ...item.descriptions.flatMap(def => [
                `<dd>${def.map(content => renderBlockMarkdownNode(env, content)).join("")}</dd>`,
              ]),
            ]),
            `</div>`,
          ]),
        ),
        "</dl>",
      ].filter(isNotNullish)
    default:
      return assertExhaustive(node)
  }
}

export const renderBlockMarkdownAsHTML = (env: Env, markdown: string): string => {
  const nodes = parseBlockMarkdown(markdown)
  return nodes.flatMap(node => renderBlockMarkdownNode(env, node)).join(env.indentation ? "\n" : "")
}
