import { describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { ApiError } from "../src/middleware/error-handler";
import {
  objectIdToString,
  parseObjectId,
  parseObjectIds,
} from "../src/utils/object-id";

describe("ObjectId utilities", () => {
  it("parses valid ObjectId strings", () => {
    const id = new ObjectId();
    expect(objectIdToString(parseObjectId(id.toHexString()))).toBe(
      id.toHexString(),
    );
  });

  it("throws a 400 ApiError for invalid ObjectIds", () => {
    expect(() => parseObjectId("not-an-id", "movieId")).toThrow(ApiError);
  });

  it("parses an array of ObjectIds", () => {
    const ids = [new ObjectId(), new ObjectId()].map((id) => id.toHexString());
    expect(parseObjectIds(ids, "movieIds").map(objectIdToString)).toEqual(ids);
  });
});
