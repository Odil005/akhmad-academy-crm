import { describe, expect, it } from "vitest";
import { studentDisplayName } from "../src/lib/student-name";

describe("student display name", () => {
  it("uses the stored full name, as the CRM shows it", () => {
    expect(studentDisplayName({ full_name: "Bekmurodov Oybek", first_name: "Oybek", last_name: "Bekmurodov" })).toBe("Bekmurodov Oybek");
  });

  it("builds 'Familiya Ism' when the full name is empty", () => {
    expect(studentDisplayName({ full_name: null, first_name: "Oybek", last_name: "Bekmurodov" })).toBe("Bekmurodov Oybek");
  });

  it("shows the name even when the student has no profile", () => {
    expect(studentDisplayName({ first_name: "Lola", profile: null })).toBe("Lola");
    expect(studentDisplayName(null)).toBe("O'quvchi");
  });
});
