import { assertExhaustive } from "@elyukai/utils/typeSafety"
import type {
  BlockMarkdownNode,
  TableCellBlockNode,
  TableColumnStyleBlockNode,
} from "../../block/node.ts"
import { checkTableRowsAreSections } from "../../block/rules.ts"
import { InlineMarkdown } from "./InlineMarkdown.ts"
import type { CreateElementFn, Element, Fragment, FunctionalComponent, HtmlTag } from "./index.ts"

type Props = {
  node: BlockMarkdownNode
  outerHeadingLevel?: number
  insertBefore?: Element
  footnoteLabelSuffix?: string
  createElement: CreateElementFn
  fragment: Fragment
}

export const BlockMarkdown: FunctionalComponent<Props> = ({
  node,
  outerHeadingLevel = 0,
  insertBefore,
  footnoteLabelSuffix = ")",
  createElement,
  fragment,
}) => {
  const inheritableProps = { outerHeadingLevel, footnoteLabelSuffix }
  switch (node.kind) {
    case "paragraph":
      return createElement(
        "p",
        null,
        insertBefore,
        ...node.content.map((inline, ii) =>
          createElement(InlineMarkdown, { key: ii, node: inline, createElement }),
        ),
      )
    case "heading":
      const Tag = `h${(node.level + outerHeadingLevel).toString()}` as HtmlTag
      return createElement(
        Tag,
        null,
        insertBefore,
        ...node.content.map((inline, ii) =>
          createElement(InlineMarkdown, { key: ii, node: inline, createElement }),
        ),
      )
    case "list": {
      const Tag = node.ordered ? "ol" : "ul"
      return createElement(
        fragment,
        null,
        insertBefore,
        createElement(
          Tag,
          null,
          ...node.content.map((item, ii) =>
            createElement(
              "li",
              { key: ii },
              ...(item.inlineLabel && item.inlineLabel.length > 0
                ? item.inlineLabel.map((inline, iii) =>
                    createElement(InlineMarkdown, { key: iii, node: inline, createElement }),
                  )
                : []),
              ...item.content.map((content, iii) =>
                createElement(BlockMarkdown, { key: iii, node: content, createElement, fragment }),
              ),
            ),
          ),
        ),
      )
    }
    case "table":
      return createElement(
        fragment,
        null,
        insertBefore,
        createElement(
          "table",
          null,
          node.caption !== undefined &&
            createElement(
              "caption",
              null,
              ...node.caption.map((inline, ci) =>
                createElement(InlineMarkdown, { key: ci, node: inline, createElement }),
              ),
            ),
          createElement(
            "thead",
            null,
            createElement(TableRow, {
              columns: node.columns,
              cells: node.header,
              cellType: "th",
              createElement,
            }),
          ),
          ...(checkTableRowsAreSections(node.rows)
            ? node.rows.map((section, si) =>
                createElement(
                  "tbody",
                  { key: si },
                  section.header &&
                    createElement(TableRow, {
                      columns: node.columns,
                      cells: section.header,
                      cellType: "th",
                      createElement,
                    }),
                  ...section.rows.map((row, ri) =>
                    createElement(TableRow, {
                      key: ri,
                      columns: node.columns,
                      cells: row.cells,
                      createElement,
                    }),
                  ),
                ),
              )
            : [
                createElement(
                  "tbody",
                  null,
                  ...node.rows.map((row, ri) =>
                    createElement(TableRow, {
                      key: ri,
                      columns: node.columns,
                      cells: row.cells,
                      createElement,
                    }),
                  ),
                ),
              ]),
        ),
      )
    case "container":
      return createElement(
        "div",
        { className: node.name },
        insertBefore,
        ...node.content.map((childNode, i) =>
          createElement(BlockMarkdown, {
            ...inheritableProps,
            key: i,
            node: childNode,
            createElement,
            fragment,
          }),
        ),
      )
    case "footnote": {
      const isNumeric = /^\d+$/.test(node.label)
      const label = createElement(
        fragment,
        null,
        createElement(
          "span",
          {
            className: "footnote__label" + (isNumeric ? " footnote__label--numeric" : ""),
            "data-reference": node.label,
            style: { "--label": isNumeric ? Number.parseInt(node.label) : node.label } as Record<
              string,
              string | number
            >,
          },
          createElement("span", { className: "footnote-label" }, node.label),
          footnoteLabelSuffix,
        ),
        " ",
      )

      return createElement(
        "div",
        { role: "note", className: "footnote" },
        insertBefore,
        ...node.content.map((n, i) =>
          createElement(BlockMarkdown, {
            ...inheritableProps,
            key: i,
            node: n,
            insertBefore: label,
            createElement,
            fragment,
          }),
        ),
      )
    }
    case "definitionList":
      return createElement(
        fragment,
        null,
        insertBefore,
        createElement(
          "dl",
          null,
          ...node.content.map((item, ii) =>
            createElement(
              "div",
              { key: ii },
              ...item.terms.map((term, ti) =>
                createElement(
                  "dt",
                  { key: ti },
                  ...term.map((inline, iii) =>
                    createElement(InlineMarkdown, { key: iii, node: inline, createElement }),
                  ),
                ),
              ),
              ...item.definitions.map((definition, di) =>
                createElement(
                  "dd",
                  { key: di },
                  ...definition.map((n, i) =>
                    createElement(BlockMarkdown, {
                      ...inheritableProps,
                      key: i,
                      node: n,
                      createElement,
                      fragment,
                    }),
                  ),
                ),
              ),
            ),
          ),
        ),
      )
    default:
      return assertExhaustive(node)
  }
}

const TableRow = ({
  columns,
  cells,
  cellType = "td",
  createElement,
}: {
  columns: TableColumnStyleBlockNode[]
  cells: TableCellBlockNode[]
  cellType?: "td" | "th"
  createElement: CreateElementFn
}) =>
  createElement(
    "tr",
    null,
    ...cells.reduce<[elements: Element[], columnIndex: number]>(
      ([elements, columnIndex], tc, ci) => [
        [
          ...elements,
          cellType === "th"
            ? createElement(
                cellType,
                {
                  key: ci,
                  scope: cells.length === 1 ? "colgroup" : undefined,
                  colSpan: tc.colSpan,
                  style: columns[columnIndex]?.alignment
                    ? { textAlign: columns[columnIndex].alignment }
                    : undefined,
                },
                ...tc.content.map((inline, cii) =>
                  createElement(InlineMarkdown, { key: cii, node: inline, createElement }),
                ),
              )
            : createElement(
                cellType,
                {
                  key: ci,
                  colSpan: tc.colSpan,
                  style: columns[columnIndex]?.alignment
                    ? { textAlign: columns[columnIndex].alignment }
                    : undefined,
                },
                ...tc.content.map((inline, cii) =>
                  createElement(InlineMarkdown, { key: cii, node: inline, createElement }),
                ),
              ),
        ],
        columnIndex + (tc.colSpan ?? 1),
      ],
      [[], 0],
    )[0],
  )
