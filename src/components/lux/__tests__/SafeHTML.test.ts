import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { SafeHTML } from "../SafeHTML";

describe("SafeHTML XSS Protection", () => {
  it("should escape script tags", () => {
    const malicious = '<script>alert("xss")</script>';
    const { container } = render(<SafeHTML content={malicious} />);
    
    // O script não deve ser renderizado como tag real
    expect(container.querySelector("script")).toBeNull();
    // Deve conter a string escapada
    expect(container.innerHTML).toContain("&lt;script&gt;");
  });

  it("should escape event handlers", () => {
    const malicious = '<img src=x onerror=alert(1)>';
    const { container } = render(<SafeHTML content={malicious} />);
    
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).toContain("&lt;img");
  });

  it("should convert newlines to <br />", () => {
    const text = "Linha 1\nLinha 2";
    const { container } = render(<SafeHTML content={text} />);
    expect(container.innerHTML).toContain("Linha 1<br>Linha 2");
  });
});
