import Ajv from "ajv";
export function structuredValidator<T>(schema: Record<string, unknown>) {
  return new Ajv({ strict: false }).compile<T>(schema);
}
