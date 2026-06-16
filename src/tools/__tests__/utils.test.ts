import { describe, expect, it } from "vitest";

import { parseIssueId } from "../utils.js";

describe("parseIssueId", () => {
    it("normalizes string and number issue IDs", () => {
        expect(parseIssueId("#12345")).toEqual({
            success: true,
            numericId: 12345,
        });
        expect(parseIssueId(12345)).toEqual({
            success: true,
            numericId: 12345,
        });
    });

    it("rejects malformed or unsafe issue IDs", () => {
        for (const issueId of ["123abc", "0", "-1", "1.5", 0, -1, 1.5]) {
            expect(parseIssueId(issueId)).toEqual({
                success: false,
                error: `Invalid issue ID: ${issueId}`,
            });
        }

        const unsafeIssueId = "9007199254740993";
        expect(parseIssueId(unsafeIssueId)).toEqual({
            success: false,
            error: `Invalid issue ID: ${unsafeIssueId}`,
        });
    });
});
