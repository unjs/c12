import { describe, it, expect } from "vitest";
import { validateConfig } from "../src/validator";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";
import * as v from "valibot";

const ZodSchema = z.object({
  key: z.string(),
});

const ValibotSchema = v.object({
  key: v.string(),
});

describe("validator", () => {
  describe("validateConfig - zod", () => {
    it("should validate a correct input", async () => {
      const schema: StandardSchemaV1 = ZodSchema;
      const input = { key: "value" };
      const result = await validateConfig(schema, input);
      expect(result).toEqual(input);
    });

    it("should throw an error for invalid input", async () => {
      const schema: StandardSchemaV1 = ZodSchema;
      const input = { key: 1 };
      await expect(validateConfig(schema, input)).rejects.toThrow(
        JSON.stringify(
          [
            {
              code: "invalid_type",
              expected: "string",
              received: "number",
              path: ["key"],
              message: "Expected string, received number",
            },
          ],
          undefined,
          2,
        ),
      );
    });

    it("should handle async validation", async () => {
      const schema: StandardSchemaV1 = ZodSchema;
      const input = { key: "value" };
      const result = await validateConfig(schema, input);
      expect(result).toEqual(input);
    });

    it("should handle async validation with issues", async () => {
      const schema: StandardSchemaV1 = ZodSchema;
      const input = { key: 1 };
      await expect(validateConfig(schema, input)).rejects.toThrow(
        JSON.stringify(
          [
            {
              code: "invalid_type",
              expected: "string",
              received: "number",
              path: ["key"],
              message: "Expected string, received number",
            },
          ],
          undefined,
          2,
        ),
      );
    });
  });

  describe("validateConfig - valibot", () => {
    it("should validate a correct input", async () => {
      const schema: StandardSchemaV1 = ValibotSchema;
      const input = { key: "value" };
      const result = await validateConfig(schema, input);
      expect(result).toEqual(input);
    });

    it("should throw an error for invalid input", async () => {
      const schema: StandardSchemaV1 = ValibotSchema;
      const input = { key: 1 };
      await expect(validateConfig(schema, input)).rejects.toThrow(
        JSON.stringify(
          [
            {
              kind: "schema",
              type: "string",
              input: 1,
              expected: "string",
              received: "1",
              message: "Invalid type: Expected string but received 1",
              path: [
                {
                  type: "object",
                  origin: "value",
                  input: {
                    key: 1,
                  },
                  key: "key",
                  value: 1,
                },
              ],
            },
          ],
          undefined,
          2,
        ),
      );
    });

    it("should handle async validation", async () => {
      const schema: StandardSchemaV1 = ValibotSchema;
      const input = { key: "value" };
      const result = await validateConfig(schema, input);
      expect(result).toEqual(input);
    });

    it("should handle async validation with issues", async () => {
      const schema: StandardSchemaV1 = ValibotSchema;
      const input = { key: 1 };
      await expect(validateConfig(schema, input)).rejects.toThrow(
        JSON.stringify(
          [
            {
              kind: "schema",
              type: "string",
              input: 1,
              expected: "string",
              received: "1",
              message: "Invalid type: Expected string but received 1",
              path: [
                {
                  type: "object",
                  origin: "value",
                  input: {
                    key: 1,
                  },
                  key: "key",
                  value: 1,
                },
              ],
            },
          ],
          undefined,
          2,
        ),
      );
    });
  });
});
