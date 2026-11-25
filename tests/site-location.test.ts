import { describe, it, expect } from "vitest";
import { parseCoordinates } from "../src/lib/site-location";
describe("parseCoordinates", () => {
  it("reads plain pair", () => expect(parseCoordinates("38.5612, 67.9921")).toEqual({ lat: 38.5612, lng: 67.9921 }));
  it("reads google @ link", () => expect(parseCoordinates("https://www.google.com/maps/place/x/@38.56,67.99,17z")).toEqual({ lat: 38.56, lng: 67.99 }));
  it("rejects junk", () => expect(parseCoordinates("Jarqo'rg'on")).toBeNull());
});
