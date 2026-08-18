import { describe, it, expect } from "@jest/globals";
import { stripMarkdownCodeFence } from "./sanitize-ai-output.js";

describe("stripMarkdownCodeFence", () => {
  it("strips a ```html fence around the content", () => {
    const input = '```html\n<div style="margin:0;">\n  <h1>Title</h1>\n</div>\n```';
    expect(stripMarkdownCodeFence(input)).toBe('<div style="margin:0;">\n  <h1>Title</h1>\n</div>');
  });

  it("strips a bare ``` fence with no language tag", () => {
    const input = "```\n<p>Hello</p>\n```";
    expect(stripMarkdownCodeFence(input)).toBe("<p>Hello</p>");
  });

  it("leaves unfenced content untouched", () => {
    const input = '<div style="margin:0;"><h1>Title</h1></div>';
    expect(stripMarkdownCodeFence(input)).toBe(input);
  });

  it("does not strip a fence that only appears mid-content", () => {
    const input = 'Some text with a ```code``` mention inline.';
    expect(stripMarkdownCodeFence(input)).toBe(input);
  });

  it("trims surrounding whitespace either way", () => {
    expect(stripMarkdownCodeFence("  <p>Hi</p>  \n")).toBe("<p>Hi</p>");
  });

  it("strips 4+ space indentation that would trigger Markdown's indented code block rule", () => {
    const input = '<h1>Title</h1>\n\n    <div style="margin-bottom:24px;">\n        <p>Body</p>\n    </div>';
    expect(stripMarkdownCodeFence(input)).toBe(
      '<h1>Title</h1>\n\n<div style="margin-bottom:24px;">\n<p>Body</p>\n</div>',
    );
  });

  it("leaves indentation under 4 spaces untouched", () => {
    const input = '<div style="margin:0;">\n  <h1>Title</h1>\n</div>';
    expect(stripMarkdownCodeFence(input)).toBe(input);
  });
});
