import { describe, it, expect } from "vitest";
import { escapeHtml, stripTags, sanitizeInput, sanitizeUrl, sanitizeEmail } from "../sanitize";

describe("escapeHtml", () => {
  it("escapes & < > \" ' /", () => {
    expect(escapeHtml('&<>"\'/')).toBe("&amp;&lt;&gt;&quot;&#x27;&#x2F;");
  });

  it("leaves safe strings unchanged", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes mixed content", () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;"
    );
  });
});

describe("stripTags", () => {
  it("removes HTML tags", () => {
    expect(stripTags("<b>bold</b>")).toBe("bold");
  });

  it("removes nested tags", () => {
    expect(stripTags("<div><p>hello</p></div>")).toBe("hello");
  });

  it("handles self-closing tags", () => {
    expect(stripTags("line<br/>break")).toBe("linebreak");
  });

  it("handles strings with no tags", () => {
    expect(stripTags("no tags here")).toBe("no tags here");
  });

  it("handles empty string", () => {
    expect(stripTags("")).toBe("");
  });

  it("strips an unclosed tag at the end of the string", () => {
    expect(stripTags("hello <script src=//evil.js")).toBe("hello ");
  });

  it("strips a trailing < with no matching >", () => {
    expect(stripTags("5 < 10")).toBe("5 ");
  });
});

describe("sanitizeInput", () => {
  it("strips tags and trims whitespace", () => {
    expect(sanitizeInput("  <b>hello</b>  ")).toBe("hello");
  });

  it("limits length to maxLength", () => {
    expect(sanitizeInput("a".repeat(2000), 100)).toBe("a".repeat(100));
  });

  it("uses default maxLength of 1000", () => {
    const result = sanitizeInput("x".repeat(1500));
    expect(result.length).toBe(1000);
  });

  it("handles script injection", () => {
    expect(sanitizeInput('<script>alert("xss")</script>Hello')).toBe('alert("xss")Hello');
  });
});

describe("sanitizeUrl", () => {
  it("allows https urls", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("allows http urls", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows mailto urls", () => {
    expect(sanitizeUrl("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  it("adds https to bare domains", () => {
    expect(sanitizeUrl("example.com")).toBe("https://example.com");
  });

  it("rejects javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("");
  });

  it("rejects data: protocol", () => {
    expect(sanitizeUrl("data:text/html,<h1>xss</h1>")).toBe("");
  });

  it("trims whitespace", () => {
    expect(sanitizeUrl("  https://example.com  ")).toBe("https://example.com");
  });
});

describe("sanitizeEmail", () => {
  it("accepts valid email", () => {
    expect(sanitizeEmail("user@example.com")).toBe("user@example.com");
  });

  it("lowercases email", () => {
    expect(sanitizeEmail("User@Example.COM")).toBe("user@example.com");
  });

  it("trims whitespace", () => {
    expect(sanitizeEmail("  user@example.com  ")).toBe("user@example.com");
  });

  it("rejects invalid email", () => {
    expect(sanitizeEmail("not-an-email")).toBe("");
  });

  it("rejects email without @", () => {
    expect(sanitizeEmail("userexample.com")).toBe("");
  });

  it("rejects email without domain", () => {
    expect(sanitizeEmail("user@")).toBe("");
  });
});
