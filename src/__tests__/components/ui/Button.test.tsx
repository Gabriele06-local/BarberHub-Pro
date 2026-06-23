import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole("button", { name: /click me/i })).toBeInTheDocument();
  });

  it("renders with primary variant by default", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-[#B91C1C]");
  });

  it("renders with secondary variant", () => {
    render(<Button variant="secondary">Cancel</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("text-[#E9C349]");
  });

  it("renders with ghost variant", () => {
    render(<Button variant="ghost">Delete</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("backdrop-blur-md");
  });

  it("is disabled when disabled prop is set", () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom</Button>);
    expect(screen.getByRole("button").className).toContain("custom-class");
  });

  it("defaults type to button", () => {
    render(<Button>Default</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });

  it("allows type override", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("calls onClick when clicked", async () => {
    const user = userEvent.setup();
    let clicked = false;
    render(<Button onClick={() => { clicked = true; }}>Click</Button>);
    await user.click(screen.getByRole("button"));
    expect(clicked).toBe(true);
  });
});
