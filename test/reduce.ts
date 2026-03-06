import { deepEqual } from "assert/strict"
import { describe, it } from "node:test"
import { type BlockMarkdownSyntaxNode } from "../src/index.ts"
import { reduceSyntaxNodes } from "../src/reduce.ts"

describe("reduceSyntaxNodes", () => {
  it("reduces adjacent text nodes into a single text node", () => {
    deepEqual<BlockMarkdownSyntaxNode[]>(
      reduceSyntaxNodes([
        {
          content: "# ",
          type: "syntax",
          blockType: "heading",
        },
        {
          content: "Heading 1\n\n",
          type: "text",
        },
        {
          content: "This is a paragraph under heading 1.",
          type: "text",
        },
        {
          content: "\n\n",
          type: "text",
        },
        {
          content: "## ",
          type: "syntax",
          blockType: "heading",
        },
        {
          content: "Heading 2",
          type: "text",
        },
        {
          content: "\n\n",
          type: "text",
        },
        {
          content: "This is a paragraph under heading 2.",
          type: "text",
        },
        {
          content: "\n\n",
          type: "text",
        },
        {
          content: "### ",
          type: "syntax",
          blockType: "heading",
        },
        {
          content: "Heading 3",
          type: "text",
        },
        {
          content: "\n\n",
          type: "text",
        },
        {
          content: "This is a paragraph under heading 3.",
          type: "text",
        },
        {
          content: "\n",
          type: "text",
        },
      ]),
      [
        {
          type: "syntax",
          blockType: "heading",
          content: "# ",
        },
        { type: "text", content: "Heading 1\n\nThis is a paragraph under heading 1.\n\n" },
        {
          type: "syntax",
          blockType: "heading",
          content: "## ",
        },
        { type: "text", content: "Heading 2\n\nThis is a paragraph under heading 2.\n\n" },
        {
          type: "syntax",
          blockType: "heading",
          content: "### ",
        },
        { type: "text", content: "Heading 3\n\nThis is a paragraph under heading 3.\n" },
      ],
    )
  })

  it("does not reduce non-adjacent text nodes into a single text node", () => {
    deepEqual<BlockMarkdownSyntaxNode[]>(
      reduceSyntaxNodes([
        { type: "text", content: "This is a " },
        { type: "bold", content: [{ type: "text", content: "bold" }] },
        { type: "text", content: " paragraph." },
      ]),
      [
        { type: "text", content: "This is a " },
        { type: "bold", content: [{ type: "text", content: "bold" }] },
        { type: "text", content: " paragraph." },
      ],
    )
  })
})
