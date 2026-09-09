import assert from "node:assert/strict"
import { it } from "node:test"
import { stripInlineMarkdown } from "../../src/render/strip.js"

it("removes markdown syntax while preserving text", () => {
  assert.equal(stripInlineMarkdown("Hello **world**"), "Hello world")
  assert.equal(stripInlineMarkdown("A [link](https://example.com) and `code`."), "A link and code.")
})

it("handles empty input", () => {
  assert.equal(stripInlineMarkdown(""), "")
})
