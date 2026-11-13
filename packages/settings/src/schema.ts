/**
 * @code-lab/settings — CSP-safe zero-dependency JSON Schema (Draft-07 subset) validator.
 * Never uses `new Function` or `eval`.
 */

export type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null';

export interface JsonSchema {
  readonly $schema?: string;
  readonly title?: string;
  readonly description?: string;
  readonly type?: JsonSchemaType | readonly JsonSchemaType[];
  readonly enum?: readonly unknown[];
  readonly default?: unknown;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly items?: JsonSchema;
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean | JsonSchema;
}

export interface SchemaValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly expected?: string;
}

function matchesSingleType(value: unknown, expected: JsonSchemaType): boolean {
  switch (expected) {
    case 'null':
      return value === null;
    case 'boolean':
      return typeof value === 'boolean';
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}

export function validateJsonSchema(
  value: unknown,
  schema: JsonSchema,
  path = '$'
): SchemaValidationIssue[] {
  const issues: SchemaValidationIssue[] = [];

  if (schema.type !== undefined) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = allowed.some((t) => matchesSingleType(value, t as JsonSchemaType));
    if (!ok) {
      issues.push({
        path,
        message: `Expected type ${allowed.join(' | ')}, received ${value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value}`,
        expected: allowed.join(' | ')
      });
      return issues;
    }
  }

  if (schema.enum !== undefined) {
    const matched = schema.enum.some((candidate) => Object.is(candidate, value));
    if (!matched) {
      const formatted = schema.enum.map((v) => JSON.stringify(v)).join(', ');
      issues.push({
        path,
        message: `Value ${JSON.stringify(value)} must be one of: ${formatted}`,
        expected: formatted
      });
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({
        path,
        message: `Value ${value} is less than minimum ${schema.minimum}`,
        expected: `>= ${schema.minimum}`
      });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({
        path,
        message: `Value ${value} exceeds maximum ${schema.maximum}`,
        expected: `<= ${schema.maximum}`
      });
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      issues.push({
        path,
        message: `String length ${value.length} is shorter than minLength ${schema.minLength}`
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      issues.push({
        path,
        message: `String length ${value.length} exceeds maxLength ${schema.maxLength}`
      });
    }
    if (schema.pattern !== undefined) {
      try {
        if (!new RegExp(schema.pattern).test(value)) {
          issues.push({
            path,
            message: `String does not match pattern /${schema.pattern}/`
          });
        }
      } catch (err) {
        issues.push({
          path,
          message: `Invalid schema pattern /${schema.pattern}/: ${err instanceof Error ? err.message : String(err)}`
        });
      }
    }
  }

  if (Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i++) {
      issues.push(...validateJsonSchema(value[i], schema.items, `${path}[${i}]`));
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (schema.required) {
      for (const reqKey of schema.required) {
        if (!(reqKey in record) || record[reqKey] === undefined) {
          issues.push({
            path: `${path}.${reqKey}`,
            message: `Missing required property "${reqKey}"`
          });
        }
      }
    }
    for (const [k, propVal] of Object.entries(record)) {
      const propSchema = schema.properties?.[k];
      if (propSchema) {
        issues.push(...validateJsonSchema(propVal, propSchema, `${path}.${k}`));
      } else if (schema.additionalProperties === false) {
        issues.push({
          path: `${path}.${k}`,
          message: `Unknown property "${k}" is not allowed`
        });
      } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties !== null) {
        issues.push(...validateJsonSchema(propVal, schema.additionalProperties, `${path}.${k}`));
      }
    }
  }

  return issues;
}
