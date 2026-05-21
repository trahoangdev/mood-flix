import { ObjectId } from "mongodb";
import { ApiError } from "../middleware/error-handler";

export function parseObjectId(value: string, fieldName = "id"): ObjectId {
  if (!ObjectId.isValid(value)) {
    throw new ApiError(400, `Invalid ObjectId for ${fieldName}`);
  }

  return new ObjectId(value);
}

export function parseObjectIds(
  values: string[],
  fieldName: string,
): ObjectId[] {
  return values.map((value) => parseObjectId(value, fieldName));
}

export function objectIdToString(value: ObjectId): string {
  return value.toHexString();
}
