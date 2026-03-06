import { deepEqual } from "assert/strict"
import { describe, it } from "node:test"
import {
  parseInlineMarkdown,
  parseInlineMarkdownForSyntaxHighlighting,
  type InlineMarkdownNode,
} from "../../src/parser/inline.ts"

describe("parseInlineMarkdown", () => {
  it("parses Markdown", () => {
    deepEqual<InlineMarkdownNode[]>(
      parseInlineMarkdown("This is `code` and **bold** and **`boldcode`**test"),
      [
        { type: "text", content: "This is " },
        { type: "code", content: "code" },
        { type: "text", content: " and " },
        { type: "bold", content: [{ type: "text", content: "bold" }] },
        { type: "text", content: " and " },
        {
          type: "bold",
          content: [{ type: "code", content: "boldcode" }],
        },
        { type: "text", content: "test" },
      ],
    )
  })

  describe("code", () => {
    it("parses code Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is `code`."), [
        { type: "text", content: "This is " },
        { type: "code", content: "code" },
        { type: "text", content: "." },
      ])
    })

    it("parses multiple code Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown("This is `code` and this is also `code`."),
        [
          { type: "text", content: "This is " },
          { type: "code", content: "code" },
          { type: "text", content: " and this is also " },
          { type: "code", content: "code" },
          { type: "text", content: "." },
        ],
      )
    })

    it("ignores escaped backticks", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown("This is not \\`code\\`. This is `code with a \\` inside`."),
        [
          { type: "text", content: "This is not `code`. This is " },
          { type: "code", content: "code with a ` inside" },
          { type: "text", content: "." },
        ],
      )
    })

    it("keeps formatting when option set", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdownForSyntaxHighlighting("This is `code`."), [
        { type: "text", content: "This is " },
        { type: "code", content: "`code`" },
        { type: "text", content: "." },
      ])
    })
  })

  describe("bold", () => {
    it("parses a single bold Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is **bold**"), [
        { type: "text", content: "This is " },
        { type: "bold", content: [{ type: "text", content: "bold" }] },
      ])
    })

    it("parses multiple bold Markdown formattings", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown("This is **bold** and this is also **bold**."),
        [
          { type: "text", content: "This is " },
          { type: "bold", content: [{ type: "text", content: "bold" }] },
          { type: "text", content: " and this is also " },
          { type: "bold", content: [{ type: "text", content: "bold" }] },
          { type: "text", content: "." },
        ],
      )
    })

    it("ignores escaped asterisks", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown(
          "This is not \\**bold\\**. This is \\*\\*also\\*\\* not bold. This is **bold with \\*\\* inside**.",
        ),
        [
          { type: "text", content: "This is not *" },
          { type: "italic", content: [{ type: "text", content: "bold*" }] },
          { type: "text", content: ". This is **also** not bold. This is " },
          { type: "bold", content: [{ type: "text", content: "bold with ** inside" }] },
          { type: "text", content: "." },
        ],
      )
    })

    it("keeps formatting when option set", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdownForSyntaxHighlighting("This is **bold**."),
        [
          { type: "text", content: "This is " },
          { type: "bold", content: [{ type: "text", content: "**bold**" }] },
          { type: "text", content: "." },
        ],
      )
    })
  })

  describe("italic", () => {
    it("parses italic Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is *italic*"), [
        { type: "text", content: "This is " },
        { type: "italic", content: [{ type: "text", content: "italic" }] },
      ])
    })

    it("parses multiple italic Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown("This is *italic* and this is also *italic*."),
        [
          { type: "text", content: "This is " },
          { type: "italic", content: [{ type: "text", content: "italic" }] },
          { type: "text", content: " and this is also " },
          { type: "italic", content: [{ type: "text", content: "italic" }] },
          { type: "text", content: "." },
        ],
      )
    })

    it("ignores escaped asterisks", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown("This is not \\*italic\\*. This is *italic with \\* inside*."),
        [
          { type: "text", content: "This is not *italic*. This is " },
          { type: "italic", content: [{ type: "text", content: "italic with * inside" }] },
          { type: "text", content: "." },
        ],
      )
    })

    it("keeps formatting when option set", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdownForSyntaxHighlighting("This is *italic*."),
        [
          { type: "text", content: "This is " },
          { type: "italic", content: [{ type: "text", content: "*italic*" }] },
          { type: "text", content: "." },
        ],
      )
    })
  })

  describe("italic and bold combinations", () => {
    it("parses bold and italic Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is ***bold and italic***"), [
        { type: "text", content: "This is " },
        {
          type: "bold",
          content: [
            {
              type: "italic",
              content: [{ type: "text", content: "bold and italic" }],
            },
          ],
        },
      ])
    })

    it("parses bold and partially italic Markdown formatting with the italic part at the end", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is **bold and *italic***"), [
        { type: "text", content: "This is " },
        {
          type: "bold",
          content: [
            { type: "text", content: "bold and " },
            { type: "italic", content: [{ type: "text", content: "italic" }] },
          ],
        },
      ])
    })

    it("parses bold and partially italic Markdown formatting with the italic part in the middle", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown("This is **bold and *italic* in parts**"),
        [
          { type: "text", content: "This is " },
          {
            type: "bold",
            content: [
              { type: "text", content: "bold and " },
              { type: "italic", content: [{ type: "text", content: "italic" }] },
              { type: "text", content: " in parts" },
            ],
          },
        ],
      )
    })

    it("parses bold and partially italic Markdown formatting with the italic part at the start", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is ***italic* and bold**"), [
        { type: "text", content: "This is " },
        {
          type: "bold",
          content: [
            { type: "italic", content: [{ type: "text", content: "italic" }] },
            { type: "text", content: " and bold" },
          ],
        },
      ])
    })

    it("parses italic and partially bold Markdown formatting with the bold part at the start", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is ***bold** and italic*"), [
        { type: "text", content: "This is " },
        {
          type: "italic",
          content: [
            { type: "bold", content: [{ type: "text", content: "bold" }] },
            { type: "text", content: " and italic" },
          ],
        },
      ])
    })

    it("parses italic and partially bold Markdown formatting with the bold part in the middle", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown("This is *partially **bold** and italic*"),
        [
          { type: "text", content: "This is " },
          {
            type: "italic",
            content: [
              { type: "text", content: "partially " },
              { type: "bold", content: [{ type: "text", content: "bold" }] },
              { type: "text", content: " and italic" },
            ],
          },
        ],
      )
    })

    it("parses italic and partially bold Markdown formatting with the bold part at the end", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is *italic and **bold***"), [
        { type: "text", content: "This is " },
        {
          type: "italic",
          content: [
            { type: "text", content: "italic and " },
            { type: "bold", content: [{ type: "text", content: "bold" }] },
          ],
        },
      ])
    })

    it("parses multiple formattings (first bold then italic) into multiple syntax nodes", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is **bold** and *italic*"), [
        { type: "text", content: "This is " },
        { type: "bold", content: [{ type: "text", content: "bold" }] },
        { type: "text", content: " and " },
        {
          type: "italic",
          content: [{ type: "text", content: "italic" }],
        },
      ])
    })

    it("parses multiple formattings (first italic then bold) into multiple syntax nodes", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is *italic* and **bold**"), [
        { type: "text", content: "This is " },
        {
          type: "italic",
          content: [{ type: "text", content: "italic" }],
        },
        { type: "text", content: " and " },
        { type: "bold", content: [{ type: "text", content: "bold" }] },
      ])
    })
  })

  describe("link", () => {
    it("parses a link Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown("This is a [link](https://example.com)."),
        [
          { type: "text", content: "This is a " },
          {
            type: "link",
            href: "https://example.com",
            content: [{ type: "text", content: "link" }],
          },
          { type: "text", content: "." },
        ],
      )
    })

    it("parses multiple link Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown(
          "This is a [link](https://example.com) and another [link](https://example.org).",
        ),
        [
          { type: "text", content: "This is a " },
          {
            type: "link",
            href: "https://example.com",
            content: [{ type: "text", content: "link" }],
          },
          { type: "text", content: " and another " },
          {
            type: "link",
            href: "https://example.org",
            content: [{ type: "text", content: "link" }],
          },
          { type: "text", content: "." },
        ],
      )
    })

    it("ignores escaped brackets and parentheses", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown(
          "This is not a \\[link\\](https://example.com). This is a [link with \\[escaped brackets\\] and \\(escaped parentheses\\)](https://example.com).",
        ),
        [
          { type: "text", content: "This is not a [link](https://example.com). This is a " },
          {
            type: "link",
            href: "https://example.com",
            content: [
              { type: "text", content: "link with [escaped brackets] and (escaped parentheses)" },
            ],
          },
          { type: "text", content: "." },
        ],
      )
    })

    it("keeps formatting when option set", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdownForSyntaxHighlighting("This is a [link](https://example.com)."),
        [
          { type: "text", content: "This is a " },
          {
            type: "link",
            href: "https://example.com",
            content: [{ type: "text", content: "[link](https://example.com)" }],
          },
          { type: "text", content: "." },
        ],
      )
    })
  })

  describe("attributed string", () => {
    it("parses an attributed string Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown(
          'This is an ^[attributed string](color: "red", size: 12, important: true).',
        ),
        [
          { type: "text", content: "This is an " },
          {
            type: "attributed",
            attributes: { color: "red", size: 12, important: true },
            content: [{ type: "text", content: "attributed string" }],
          },
          { type: "text", content: "." },
        ],
      )
    })

    it("keeps formatting when option set", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdownForSyntaxHighlighting(
          'This is an ^[attributed string](color: "red", size: 12, important: true).',
        ),
        [
          { type: "text", content: "This is an " },
          {
            type: "attributed",
            attributes: { color: "red", size: 12, important: true },
            content: [
              {
                type: "text",
                content: '^[attributed string](color: "red", size: 12, important: true)',
              },
            ],
          },
          { type: "text", content: "." },
        ],
      )
    })
  })

  describe("footnote reference", () => {
    it("parses a footnote reference", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is a footnote reference: [^1]."), [
        { type: "text", content: "This is a footnote reference: " },
        { type: "footnoteRef", label: 1, content: "1" },
        { type: "text", content: "." },
      ])
    })

    it("parses multiple footnote references", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown("Footnote references: [^1], [^2], and [^3]."),
        [
          { type: "text", content: "Footnote references: " },
          { type: "footnoteRef", label: 1, content: "1" },
          { type: "text", content: ", " },
          { type: "footnoteRef", label: 2, content: "2" },
          { type: "text", content: ", and " },
          { type: "footnoteRef", label: 3, content: "3" },
          { type: "text", content: "." },
        ],
      )
    })

    it("keeps formatting when option set", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdownForSyntaxHighlighting("This is a footnote reference: [^1]."),
        [
          { type: "text", content: "This is a footnote reference: " },
          { type: "footnoteRef", label: 1, content: "[^1]" },
          { type: "text", content: "." },
        ],
      )
    })
  })

  describe("superscript", () => {
    it("parses a superscript Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("This is a superscript: x^2^."), [
        { type: "text", content: "This is a superscript: x" },
        { type: "superscript", content: [{ type: "text", content: "2" }] },
        { type: "text", content: "." },
      ])
    })

    it("parses multiple superscript Markdown formatting", () => {
      deepEqual<InlineMarkdownNode[]>(parseInlineMarkdown("Superscripts: x^2^, y^3^, and z^4^."), [
        { type: "text", content: "Superscripts: x" },
        { type: "superscript", content: [{ type: "text", content: "2" }] },
        { type: "text", content: ", y" },
        { type: "superscript", content: [{ type: "text", content: "3" }] },
        { type: "text", content: ", and z" },
        { type: "superscript", content: [{ type: "text", content: "4" }] },
        { type: "text", content: "." },
      ])
    })

    it("ignores escaped carets", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown(
          "This is not a superscript: x\\^2\\^. This is a superscript with an escaped caret inside: x^2\\^3^.",
        ),
        [
          {
            type: "text",
            content:
              "This is not a superscript: x^2^. This is a superscript with an escaped caret inside: x",
          },
          { type: "superscript", content: [{ type: "text", content: "2^3" }] },
          { type: "text", content: "." },
        ],
      )
    })

    it("keeps formatting when option set", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdownForSyntaxHighlighting("This is ^superscript^."),
        [
          { type: "text", content: "This is " },
          { type: "superscript", content: [{ type: "text", content: "^superscript^" }] },
          { type: "text", content: "." },
        ],
      )
    })
  })

  it("parses multiple adjacent formattings into multiple syntax nodes", () => {
    it("alternating styles", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown(
          "This is a **bold** text before an *italic* and a **bold** and another *italic* text.",
        ),
        [
          { type: "text", content: "This is a " },
          { type: "bold", content: [{ type: "text", content: "bold" }] },
          { type: "text", content: " text before an " },
          { type: "italic", content: [{ type: "text", content: "italic" }] },
          { type: "text", content: " and a " },
          { type: "bold", content: [{ type: "text", content: "bold" }] },
          { type: "text", content: " and another " },
          { type: "italic", content: [{ type: "text", content: "italic" }] },
          { type: "text", content: " text." },
        ],
      )
    })

    it("multiple of the same styles adjacent", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown(
          "Here is another *italic* text and *another* with a **bold** in between, before it is an *italic* again. **Bold** and **bold** might also come directly after each other and an *italic* might also be followed directly by another **bold** one.",
        ),
        [
          { type: "text", content: "Here is another " },
          { type: "italic", content: [{ type: "text", content: "italic" }] },
          { type: "text", content: " text and " },
          { type: "italic", content: [{ type: "text", content: "another" }] },
          { type: "text", content: " with a " },
          { type: "bold", content: [{ type: "text", content: "bold" }] },
          { type: "text", content: " in between, before it is an " },
          { type: "italic", content: [{ type: "text", content: "italic" }] },
          { type: "text", content: " again. " },
          { type: "bold", content: [{ type: "text", content: "Bold" }] },
          { type: "text", content: " and " },
          { type: "bold", content: [{ type: "text", content: "bold" }] },
          { type: "text", content: " might also come directly after each other and an " },
          { type: "italic", content: [{ type: "text", content: "italic" }] },
          { type: "text", content: " might also be followed directly by another " },
          { type: "bold", content: [{ type: "text", content: "bold" }] },
          { type: "text", content: " one." },
        ],
      )
    })

    it("does not confuse superscript, attributed string and footnotes", () => {
      deepEqual<InlineMarkdownNode[]>(
        parseInlineMarkdown(
          'Im Kampf gegen Drachen[^1] kann er 1 Aktion^2^ für eine Probe auf ^[Kriegskunst](entity: "Skill") aufwenden.',
        ),
        [
          { type: "text", content: "Im Kampf gegen Drachen" },
          { type: "footnoteRef", label: 1, content: "1" },
          { type: "text", content: " kann er 1 Aktion" },
          { type: "superscript", content: [{ type: "text", content: "2" }] },
          { type: "text", content: " für eine Probe auf " },
          {
            type: "attributed",
            content: [{ type: "text", content: "Kriegskunst" }],
            attributes: { entity: "Skill" },
          },
          { type: "text", content: " aufwenden." },
        ],
      )
    })
  })
})
