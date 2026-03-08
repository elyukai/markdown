import { deepEqual } from "assert/strict"
import { describe, it } from "node:test"
import type { BlockMarkdownSyntaxNode } from "../../src/parser/block.ts"
import {
  parseBlockMarkdown,
  parseBlockMarkdownForSyntaxHighlighting,
  type BlockMarkdownNode,
} from "../../src/parser/block.ts"

describe("parseBlockMarkdown", () => {
  describe("paragraphs", () => {
    it("parses multiple paragraphs", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown("This is the first paragraph.\n\nThis is the second paragraph."),
        [
          {
            type: "paragraph",
            content: [{ type: "text", content: "This is the first paragraph." }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", content: "This is the second paragraph." }],
          },
        ],
      )
    })

    it("parses a paragraph with line breaks", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown("This is the first paragraph with a\nline break."),
        [
          {
            type: "paragraph",
            content: [
              { type: "text", content: "This is the first paragraph with a" },
              { type: "break" },
              { type: "text", content: "line break." },
            ],
          },
        ],
      )
    })

    it("ignores leading newlines", () => {
      deepEqual<BlockMarkdownNode[]>(parseBlockMarkdown("\n\nThis is **bold**"), [
        {
          type: "paragraph",
          content: [
            { type: "text", content: "This is " },
            { type: "bold", content: [{ type: "text", content: "bold" }] },
          ],
        },
      ])
    })
  })

  describe("headings", () => {
    it("parses headings of different levels", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown("# Heading 1\n\n## Heading 2\n\n### Heading 3"),
        [
          { type: "heading", level: 1, content: [{ type: "text", content: "Heading 1" }] },
          { type: "heading", level: 2, content: [{ type: "text", content: "Heading 2" }] },
          { type: "heading", level: 3, content: [{ type: "text", content: "Heading 3" }] },
        ],
      )
    })
  })

  describe("lists", () => {
    it("parses an unordered list", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`- This is the first unordered list item.
- This is the second unordered list item.`),
        [
          {
            type: "list",
            ordered: false,
            content: [
              {
                type: "listItem",
                inlineLabel: [{ type: "text", content: "This is the first unordered list item." }],
                content: [],
              },
              {
                type: "listItem",
                inlineLabel: [{ type: "text", content: "This is the second unordered list item." }],
                content: [],
              },
            ],
          },
        ],
      )
    })

    it("parses an unordered list with a subitem", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`- This is the first unordered list item.
  - This is a subitem of the first unordered list item.
- This is the second unordered list item.`),
        [
          {
            type: "list",
            ordered: false,
            content: [
              {
                type: "listItem",
                inlineLabel: [{ type: "text", content: "This is the first unordered list item." }],
                content: [
                  {
                    type: "list",
                    ordered: false,
                    content: [
                      {
                        type: "listItem",
                        inlineLabel: [
                          {
                            type: "text",
                            content: "This is a subitem of the first unordered list item.",
                          },
                        ],
                        content: [],
                      },
                    ],
                  },
                ],
              },
              {
                type: "listItem",
                inlineLabel: [{ type: "text", content: "This is the second unordered list item." }],
                content: [],
              },
            ],
          },
        ],
      )
    })

    it("parses multiple blocks", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`This is a paragraph.

This is another paragraph.

- This is the first unordered list item.
- This is the second unordered list item.

This is yet another paragraph.

1. This is the first and only ordered list item.

This is the final paragraph.`),
        [
          {
            type: "paragraph",
            content: [{ type: "text", content: "This is a paragraph." }],
          },
          {
            type: "paragraph",
            content: [{ type: "text", content: "This is another paragraph." }],
          },
          {
            type: "list",
            ordered: false,
            content: [
              {
                type: "listItem",
                inlineLabel: [{ type: "text", content: "This is the first unordered list item." }],
                content: [],
              },
              {
                type: "listItem",
                inlineLabel: [{ type: "text", content: "This is the second unordered list item." }],
                content: [],
              },
            ],
          },
          {
            type: "paragraph",
            content: [{ type: "text", content: "This is yet another paragraph." }],
          },
          {
            type: "list",
            ordered: true,
            content: [
              {
                type: "listItem",
                inlineLabel: [
                  { type: "text", content: "This is the first and only ordered list item." },
                ],
                content: [],
              },
            ],
          },
          {
            type: "paragraph",
            content: [{ type: "text", content: "This is the final paragraph." }],
          },
        ],
      )
    })

    it("parses a multi-dimensional unordered list", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`- Item 1
  - Subitem 1.1
    - Subsubitem 1.1.1
    - Subsubitem 1.1.2
  - Subitem 1.2
- Item 2`),
        [
          {
            type: "list",
            ordered: false,
            content: [
              {
                type: "listItem",
                inlineLabel: [{ type: "text", content: "Item 1" }],
                content: [
                  {
                    type: "list",
                    ordered: false,
                    content: [
                      {
                        type: "listItem",
                        inlineLabel: [{ type: "text", content: "Subitem 1.1" }],
                        content: [
                          {
                            type: "list",
                            ordered: false,
                            content: [
                              {
                                type: "listItem",
                                inlineLabel: [{ type: "text", content: "Subsubitem 1.1.1" }],
                                content: [],
                              },
                              {
                                type: "listItem",
                                inlineLabel: [{ type: "text", content: "Subsubitem 1.1.2" }],
                                content: [],
                              },
                            ],
                          },
                        ],
                      },
                      {
                        type: "listItem",
                        inlineLabel: [{ type: "text", content: "Subitem 1.2" }],
                        content: [],
                      },
                    ],
                  },
                ],
              },
              {
                type: "listItem",
                inlineLabel: [{ type: "text", content: "Item 2" }],
                content: [],
              },
            ],
          },
        ],
      )
    })
  })

  describe("table", () => {
    it("parses a table", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Here is a table:

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

This was a table.
`),
        [
          {
            type: "paragraph",
            content: [{ type: "text", content: "Here is a table:" }],
          },
          {
            type: "table",
            columns: [{}, {}],
            header: [
              { type: "tableCell", content: [{ type: "text", content: "Header 1" }] },
              { type: "tableCell", content: [{ type: "text", content: "Header 2" }] },
            ],
            rows: [
              {
                type: "tableRow",
                cells: [
                  { type: "tableCell", content: [{ type: "text", content: "Cell 1" }] },
                  { type: "tableCell", content: [{ type: "text", content: "Cell 2" }] },
                ],
              },
              {
                type: "tableRow",
                cells: [
                  { type: "tableCell", content: [{ type: "text", content: "Cell 3" }] },
                  { type: "tableCell", content: [{ type: "text", content: "Cell 4" }] },
                ],
              },
            ],
          },
          {
            type: "paragraph",
            content: [{ type: "text", content: "This was a table." }],
          },
        ],
      )
    })

    it("parses a table with a table caption", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Here is a table:

|# Table Caption     #|
| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

This was a table.
`),
        [
          {
            type: "paragraph",
            content: [{ type: "text", content: "Here is a table:" }],
          },
          {
            type: "table",
            caption: [[{ type: "text", content: "Table Caption" }]],
            columns: [{}, {}],
            header: [
              { type: "tableCell", content: [{ type: "text", content: "Header 1" }] },
              { type: "tableCell", content: [{ type: "text", content: "Header 2" }] },
            ],
            rows: [
              {
                type: "tableRow",
                cells: [
                  { type: "tableCell", content: [{ type: "text", content: "Cell 1" }] },
                  { type: "tableCell", content: [{ type: "text", content: "Cell 2" }] },
                ],
              },
              {
                type: "tableRow",
                cells: [
                  { type: "tableCell", content: [{ type: "text", content: "Cell 3" }] },
                  { type: "tableCell", content: [{ type: "text", content: "Cell 4" }] },
                ],
              },
            ],
          },
          {
            type: "paragraph",
            content: [{ type: "text", content: "This was a table." }],
          },
        ],
      )
    })

    it("parses a table with section headers", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Here is a table:

| Header 1      | Header 2      |
|---------------|---------------|
| Cell 1        | Cell 2        |
|===============|===============|
| Subheader 1   | Subheader 2   |
| Cell 3        | Cell 4        |
|===============|===============|
| Subheader 3                  ||
| Cell 5        | Cell 6        |
|---------------|---------------|
| Cell 7        | Cell 8        |

This was a table.
`),
        [
          {
            type: "paragraph",
            content: [{ type: "text", content: "Here is a table:" }],
          },
          {
            type: "table",
            columns: [{}, {}],
            header: [
              { type: "tableCell", content: [{ type: "text", content: "Header 1" }] },
              { type: "tableCell", content: [{ type: "text", content: "Header 2" }] },
            ],
            rows: [
              {
                type: "tableSection",
                rows: [
                  {
                    type: "tableRow",
                    cells: [
                      { type: "tableCell", content: [{ type: "text", content: "Cell 1" }] },
                      { type: "tableCell", content: [{ type: "text", content: "Cell 2" }] },
                    ],
                  },
                ],
              },
              {
                type: "tableSection",
                header: [
                  { type: "tableCell", content: [{ type: "text", content: "Subheader 1" }] },
                  { type: "tableCell", content: [{ type: "text", content: "Subheader 2" }] },
                ],
                rows: [
                  {
                    type: "tableRow",
                    cells: [
                      { type: "tableCell", content: [{ type: "text", content: "Cell 3" }] },
                      { type: "tableCell", content: [{ type: "text", content: "Cell 4" }] },
                    ],
                  },
                ],
              },
              {
                type: "tableSection",
                header: [
                  {
                    type: "tableCell",
                    colSpan: 2,
                    content: [{ type: "text", content: "Subheader 3" }],
                  },
                ],
                rows: [
                  {
                    type: "tableRow",
                    cells: [
                      { type: "tableCell", content: [{ type: "text", content: "Cell 5" }] },
                      { type: "tableCell", content: [{ type: "text", content: "Cell 6" }] },
                    ],
                  },
                ],
              },
              {
                type: "tableSection",
                rows: [
                  {
                    type: "tableRow",
                    cells: [
                      { type: "tableCell", content: [{ type: "text", content: "Cell 7" }] },
                      { type: "tableCell", content: [{ type: "text", content: "Cell 8" }] },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: "paragraph",
            content: [{ type: "text", content: "This was a table." }],
          },
        ],
      )
    })
  })

  describe("container", () => {
    it("parses special named section", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`::: name

This is a special section.

:::`),
        [
          {
            type: "container",
            name: "name",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", content: "This is a special section." }],
              },
            ],
          },
        ],
      )
    })

    it("parses special named section between paragraphs", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`This is a paragraph.

::: name

This is a special section.

:::

This is another paragraph.
`),
        [
          {
            type: "paragraph",
            content: [{ type: "text", content: "This is a paragraph." }],
          },
          {
            type: "container",
            name: "name",
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", content: "This is a special section." }],
              },
            ],
          },
          {
            type: "paragraph",
            content: [{ type: "text", content: "This is another paragraph." }],
          },
        ],
      )
    })
  })

  describe("footnotes", () => {
    it("parses a single-line footnote", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(
          "This is a paragraph with a footnote.[^1]\n\n[^1]: This is the footnote.",
        ),
        [
          {
            type: "paragraph",
            content: [
              { type: "text", content: "This is a paragraph with a footnote." },
              {
                type: "footnoteRef",
                label: 1,
                content: "1",
              },
            ],
          },
          {
            type: "footnote",
            label: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", content: "This is the footnote." }],
              },
            ],
          },
        ],
      )
    })

    it("parses a multi-line footnote", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(
          `This is a paragraph with a footnote.[^1]

[^1]: This is the footnote.

  It has multiple paragraphs.

  - And
  - A
  - List

This is not part of the footnote anymore.`,
        ),
        [
          {
            type: "paragraph",
            content: [
              { type: "text", content: "This is a paragraph with a footnote." },
              {
                type: "footnoteRef",
                label: 1,
                content: "1",
              },
            ],
          },
          {
            type: "footnote",
            label: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", content: "This is the footnote." }],
              },
              {
                type: "paragraph",
                content: [{ type: "text", content: "It has multiple paragraphs." }],
              },
              {
                type: "list",
                ordered: false,
                content: [
                  {
                    type: "listItem",
                    inlineLabel: [{ type: "text", content: "And" }],
                    content: [],
                  },
                  { type: "listItem", inlineLabel: [{ type: "text", content: "A" }], content: [] },
                  {
                    type: "listItem",
                    inlineLabel: [{ type: "text", content: "List" }],
                    content: [],
                  },
                ],
              },
            ],
          },
          {
            type: "paragraph",
            content: [{ type: "text", content: "This is not part of the footnote anymore." }],
          },
        ],
      )
    })
  })

  describe("definition lists", () => {
    it("parses a single term with a single description", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Term 1
: Definition 1
`),
        [
          {
            type: "definitionList",
            content: [
              {
                type: "definitionListItem",
                terms: [[{ type: "text", content: "Term 1" }]],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 1" }],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      )
    })

    it("parses a single term with multiple descriptions", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Term 1
: Definition 1
: Definition 2
`),
        [
          {
            type: "definitionList",
            content: [
              {
                type: "definitionListItem",
                terms: [[{ type: "text", content: "Term 1" }]],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 1" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 2" }],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      )
    })

    it("parses a single term with a multi-line description", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Term 1
: Definition 1

  Definition 1 line 2
`),
        [
          {
            type: "definitionList",
            content: [
              {
                type: "definitionListItem",
                terms: [[{ type: "text", content: "Term 1" }]],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 1" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 1 line 2" }],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      )
    })

    it("parses a single term with multiple single-line and multi-line description", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Term 1
: Definition 1
: Definition 2 line 1

  Definition 2 line 2
: Definition 3
: Definition 4
: Definition 5 line 1

  Definition 5 line 2
: Definition 6 line 1

  Definition 6 line 2
`),
        [
          {
            type: "definitionList",
            content: [
              {
                type: "definitionListItem",
                terms: [[{ type: "text", content: "Term 1" }]],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 1" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 2 line 1" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 2 line 2" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 3" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 4" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 5 line 1" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 5 line 2" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 6 line 1" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 6 line 2" }],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      )
    })

    it("parses inline markdown syntax in a single term and its single description", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Term with **bold**
: Definition with *italic* and a [link](https://example.com)
`),
        [
          {
            type: "definitionList",
            content: [
              {
                type: "definitionListItem",
                terms: [
                  [
                    { type: "text", content: "Term with " },
                    { type: "bold", content: [{ type: "text", content: "bold" }] },
                  ],
                ],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", content: "Definition with " },
                        { type: "italic", content: [{ type: "text", content: "italic" }] },
                        { type: "text", content: " and a " },
                        {
                          type: "link",
                          href: "https://example.com",
                          content: [{ type: "text", content: "link" }],
                        },
                      ],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      )
    })

    it("parses multiple terms with a single description", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Term 1
Term 2
: Definition 1
`),
        [
          {
            type: "definitionList",
            content: [
              {
                type: "definitionListItem",
                terms: [
                  [{ type: "text", content: "Term 1" }],
                  [{ type: "text", content: "Term 2" }],
                ],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 1" }],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      )
    })

    it("parses multiple terms with multiple descriptions", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Term 1
Term 2
: Definition 1
: Definition 2
`),
        [
          {
            type: "definitionList",
            content: [
              {
                type: "definitionListItem",
                terms: [
                  [{ type: "text", content: "Term 1" }],
                  [{ type: "text", content: "Term 2" }],
                ],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 1" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 2" }],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      )
    })

    it("parses multiple heterogenuous definition list items into a single list block", () => {
      deepEqual<BlockMarkdownNode[]>(
        parseBlockMarkdown(`Term 1
: Definition 1

Term 2
: Definition 2
: Definition 3

Term 3
: Definition 4 line 1

  Definition 4 line 2

Term 4
: Definition 5 line 1

  Definition 5 line 2
: Definition 6

Term 5
Term 6
: Definition 7

Term 7
Term 8
: Definition 8
: Definition 9

Term 9 with **bold**
: Definition 10 with *italic* and a [link](https://example.com)
`),
        [
          {
            type: "definitionList",
            content: [
              {
                type: "definitionListItem",
                terms: [[{ type: "text", content: "Term 1" }]],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 1" }],
                    },
                  ],
                ],
              },
              {
                type: "definitionListItem",
                terms: [[{ type: "text", content: "Term 2" }]],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 2" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 3" }],
                    },
                  ],
                ],
              },
              {
                type: "definitionListItem",
                terms: [[{ type: "text", content: "Term 3" }]],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 4 line 1" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 4 line 2" }],
                    },
                  ],
                ],
              },
              {
                type: "definitionListItem",
                terms: [[{ type: "text", content: "Term 4" }]],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 5 line 1" }],
                    },
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 5 line 2" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 6" }],
                    },
                  ],
                ],
              },
              {
                type: "definitionListItem",
                terms: [
                  [{ type: "text", content: "Term 5" }],
                  [{ type: "text", content: "Term 6" }],
                ],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 7" }],
                    },
                  ],
                ],
              },
              {
                type: "definitionListItem",
                terms: [
                  [{ type: "text", content: "Term 7" }],
                  [{ type: "text", content: "Term 8" }],
                ],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 8" }],
                    },
                  ],
                  [
                    {
                      type: "paragraph",
                      content: [{ type: "text", content: "Definition 9" }],
                    },
                  ],
                ],
              },
              {
                type: "definitionListItem",
                terms: [
                  [
                    { type: "text", content: "Term 9 with " },
                    { type: "bold", content: [{ type: "text", content: "bold" }] },
                  ],
                ],
                descriptions: [
                  [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", content: "Definition 10 with " },
                        { type: "italic", content: [{ type: "text", content: "italic" }] },
                        { type: "text", content: " and a " },
                        {
                          type: "link",
                          href: "https://example.com",
                          content: [{ type: "text", content: "link" }],
                        },
                      ],
                    },
                  ],
                ],
              },
            ],
          },
        ],
      )
    })
  })
})

describe("parseBlockMarkdownForSyntaxHighlighting", () => {
  it("marks syntax elements while preserving the original text content", () => {
    deepEqual<BlockMarkdownSyntaxNode[]>(
      parseBlockMarkdownForSyntaxHighlighting(`\n\n\n# Title

First paragraph with **bold** and *italic* text.

Second paraph with a [link](https://example.com) and a
footnote [^1].

[^1]: This is the footnote content.

  And this is more footnote content with a list:

  - Item 1
  - Item 2

This is a normal list:

- Item 1
  - Subitem 1.1
  - Subitem 1.2
- Item 2
  - Subitem 2.1
    - Subsubitem 2.1.1
    - Subsubitem 2.1.2
  - Subitem 2.2
- Item 3

This is an ordered list:

1. Item 1
2. Item 2
3. Item 3

This is a table:

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

This is a container:

::: name

This is a special section.

:::

`),
      [
        { type: "text", content: "\n\n\n" },
        { type: "syntax", blockType: "heading", content: "#" },
        { type: "text", content: " Title\n\nFirst paragraph with " },
        { type: "bold", content: [{ type: "text", content: "**bold**" }] },
        { type: "text", content: " and " },
        { type: "italic", content: [{ type: "text", content: "*italic*" }] },
        { type: "text", content: " text.\n\nSecond paraph with a " },
        {
          type: "link",
          href: "https://example.com",
          content: [{ type: "text", content: "[link](https://example.com)" }],
        },
        { type: "text", content: " and a\nfootnote " },
        {
          type: "footnoteRef",
          label: 1,
          content: "[^1]",
        },
        { type: "text", content: ".\n\n" },
        { type: "syntax", blockType: "footnote", content: "[^1]:" },
        {
          type: "text",
          content:
            " This is the footnote content.\n\n  And this is more footnote content with a list:\n\n  ",
        },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Item 1\n  " },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Item 2\n\nThis is a normal list:\n\n" },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Item 1\n  " },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Subitem 1.1\n  " },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Subitem 1.2\n" },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Item 2\n  " },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Subitem 2.1\n    " },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Subsubitem 2.1.1\n    " },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Subsubitem 2.1.2\n  " },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Subitem 2.2\n" },
        { type: "syntax", blockType: "unorderedList", content: "-" },
        { type: "text", content: " Item 3\n\nThis is an ordered list:\n\n" },
        { type: "syntax", blockType: "orderedList", content: "1." },
        { type: "text", content: " Item 1\n" },
        { type: "syntax", blockType: "orderedList", content: "2." },
        { type: "text", content: " Item 2\n" },
        { type: "syntax", blockType: "orderedList", content: "3." },
        { type: "text", content: " Item 3\n\nThis is a table:\n\n" },
        { type: "syntax", blockType: "table", content: "|" },
        { type: "text", content: " Header 1 " },
        { type: "syntax", blockType: "table", content: "|" },
        { type: "text", content: " Header 2 " },
        { type: "syntax", blockType: "table", content: "|" },
        { type: "text", content: "\n" },
        { type: "syntax", blockType: "table", content: "|----------|----------|" },
        { type: "text", content: "\n" },
        { type: "syntax", blockType: "table", content: "|" },
        { type: "text", content: " Cell 1   " },
        { type: "syntax", blockType: "table", content: "|" },
        { type: "text", content: " Cell 2   " },
        { type: "syntax", blockType: "table", content: "|" },
        { type: "text", content: "\n" },
        { type: "syntax", blockType: "table", content: "|" },
        { type: "text", content: " Cell 3   " },
        { type: "syntax", blockType: "table", content: "|" },
        { type: "text", content: " Cell 4   " },
        { type: "syntax", blockType: "table", content: "|" },
        { type: "text", content: "\n\nThis is a container:\n\n" },
        { type: "syntax", blockType: "container", content: "::: name" },
        { type: "text", content: "\n\nThis is a special section.\n\n" },
        { type: "syntax", blockType: "container", content: ":::" },
        { type: "text", content: "\n\n" },
      ],
    )
  })
})
