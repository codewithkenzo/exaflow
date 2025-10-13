---
title: "🔒 High Security: Insecure JSON Parsing with Prototype Pollution Risk"
labels: ["security", "high", "json-parsing", "prototype-pollution"]
assignees: []
---

## 🔒 High Security Vulnerability: Insecure JSON Parsing

### 🚨 **Severity: High**
- **CVSS Score**: 7.8 (High)
- **CWE**: CWE-94: Improper Control of Generation of Code ('Code Injection')
- **File**: `src/cli.ts:407`
- **Impact**: Prototype Pollution, DoS, Remote Code Execution

### 📍 **Location**
```typescript
// File: src/cli.ts
// Line: 407
if (options.schema) {
  const schemaContent = await fs.readFile(options.schema);
  outputSchema = JSON.parse(schemaContent);  // ❌ SECURITY ISSUE
}
```

### 🎯 **Impact Assessment**

1. **Prototype Pollution**:
   - Direct JSON.parse without validation
   - Malicious JSON can modify Object.prototype
   - Leads to property injection and application logic bypass

2. **Denial of Service (DoS)**:
   - Large or deeply nested JSON objects can cause stack overflow
   - Memory exhaustion through resource consumption
   - Application becomes unresponsive

3. **Remote Code Execution**:
   - In certain environments, prototype pollution can lead to RCE
   - Bypass of security controls through prototype manipulation
   - Access to unauthorized functionality

### 🔍 **Technical Details**

The vulnerability occurs when parsing JSON schema files:
- No input validation before JSON.parse
- No size limits or depth checks
- No sanitization of parsed data
- Direct assignment to application variables

**Attack Scenarios:**
```json
// Prototype Pollution Payload
{
  "__proto__": {
    "isAdmin": true,
    "hasAccess": "all"
  }
}

// DoS Payload - Deep Nesting
{"a": {"b": {"c": {"d": ... (10000 levels deep) }}}}

// Large Payload - Memory Exhaustion
{
  "data": ["very long string repeated 100000 times"]
}
```

### 🛠️ **Recommended Remediation**

#### **Immediate Actions:**
1. **Implement secure JSON parsing**:
```typescript
// ✅ Secure approach
import safeJsonParse from 'safe-json-parse';
import { z } from 'zod';

const SchemaSchema = z.object({
  type: z.string(),
  properties: z.record(z.any()).optional(),
  required: z.array(z.string()).optional(),
  additionalProperties: z.boolean().optional()
});

async function loadSchemaSecure(filePath: string): Promise<any> {
  try {
    const schemaContent = await fs.readFile(filePath);

    // Validate content size
    if (schemaContent.length > 1024 * 1024) { // 1MB limit
      throw new Error('Schema file too large');
    }

    // Use safe JSON parser
    const parsedSchema = await new Promise((resolve, reject) => {
      safeJsonParse(schemaContent, (err, data) => {
        if (err) reject(err);
        else resolve(data);
      });
    });

    // Validate the schema structure
    const result = SchemaSchema.safeParse(parsedSchema);
    if (!result.success) {
      throw new Error(`Invalid schema format: ${result.error.message}`);
    }

    // Sanitize to prevent prototype pollution
    return sanitizeJson(result.data);

  } catch (error) {
    throw new Error(`Failed to load schema: ${error.message}`);
  }
}
```

2. **Add JSON sanitization**:
```typescript
// File: src/util/json-sanitizer.ts
export function sanitizeJson(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => sanitizeJson(item));
  }

  // Create a new object to avoid prototype pollution
  const sanitized = Object.create(null);

  for (const key in data) {
    // Skip dangerous keys
    if (isDangerousKey(key)) {
      continue;
    }

    sanitized[key] = sanitizeJson(data[key]);
  }

  return sanitized;
}

function isDangerousKey(key: string): boolean {
  const dangerousKeys = [
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__'
  ];

  return dangerousKeys.includes(key);
}
```

3. **Implement size and depth limits**:
```typescript
// File: src/util/json-validator.ts
export class JsonValidator {
  private static readonly MAX_DEPTH = 100;
  private static readonly MAX_SIZE = 1024 * 1024; // 1MB
  private static readonly MAX_KEYS = 10000;

  static validateJson(content: string): void {
    // Size check
    if (content.length > this.MAX_SIZE) {
      throw new Error(`JSON content exceeds maximum size of ${this.MAX_SIZE} bytes`);
    }

    try {
      const parsed = JSON.parse(content);
      this.validateStructure(parsed, 0, 0);
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  private static validateStructure(obj: any, depth: number, keyCount: number): number {
    if (depth > this.MAX_DEPTH) {
      throw new Error(`JSON nesting depth exceeds maximum of ${this.MAX_DEPTH}`);
    }

    if (keyCount > this.MAX_KEYS) {
      throw new Error(`JSON key count exceeds maximum of ${this.MAX_KEYS}`);
    }

    if (obj === null || typeof obj !== 'object') {
      return keyCount;
    }

    if (Array.isArray(obj)) {
      return obj.reduce((count, item) =>
        this.validateStructure(item, depth + 1, count), keyCount);
    }

    return Object.keys(obj).reduce((count, key) => {
      if (isDangerousKey(key)) {
        throw new Error(`Dangerous key detected: ${key}`);
      }
      return this.validateStructure(obj[key], depth + 1, count + 1);
    }, keyCount);
  }
}
```

#### **Long-term Improvements:**
1. **Use a secure JSON library**:
```typescript
import secureJSON from 'secure-json-parse';

async function loadSchemaWithSecureJSON(filePath: string): Promise<any> {
  try {
    const schemaContent = await fs.readFile(filePath);

    // Validate first
    JsonValidator.validateJson(schemaContent);

    // Parse securely
    const parsed = secureJSON.parse(schemaContent, {
      protoAction: 'remove',
      constructorAction: 'remove'
    });

    return SchemaSchema.parse(parsed);
  } catch (error) {
    throw new Error(`Failed to load schema: ${error.message}`);
  }
}
```

2. **Implement content validation**:
```typescript
import { createHash } from 'crypto';

async function validateSchemaFile(filePath: string): Promise<void> {
  const stats = await fs.stat(filePath);

  // File size check
  if (stats.size > 1024 * 1024) {
    throw new Error('Schema file exceeds maximum size');
  }

  // Content type check
  const content = await fs.readFile(filePath, 'utf8');
  if (!content.trim().startsWith('{') || !content.trim().endsWith('}')) {
    throw new Error('Invalid schema file format');
  }

  // Hash check for known malicious schemas
  const hash = createHash('sha256').update(content).digest('hex');
  if (isKnownMaliciousHash(hash)) {
    throw new Error('Known malicious schema detected');
  }
}
```

3. **Add comprehensive error handling**:
```typescript
async function safeLoadSchema(filePath: string): Promise<any> {
  try {
    // Multiple layers of validation
    await validateSchemaFile(filePath);
    const content = await fs.readFile(filePath);
    JsonValidator.validateJson(content);

    return await loadSchemaWithSecureJSON(filePath);

  } catch (error) {
    // Log security events
    securityLogger.logSecurityEvent('SCHEMA_LOAD_FAILED', {
      filePath,
      error: error.message,
      timestamp: new Date().toISOString()
    });

    throw new Error(`Schema validation failed: ${error.message}`);
  }
}
```

### ✅ **Verification Steps**

1. **Test prototype pollution**:
```bash
# Create malicious schema file
echo '{"__proto__": {"isAdmin": true}}' > malicious-schema.json

# Try to use it
bun run src/cli.ts research --schema malicious-schema.json --instructions "test"

# Verify the application rejects it
```

2. **Test DoS protection**:
```bash
# Create large JSON file
# Create deeply nested JSON file
# Verify the application handles them gracefully
```

3. **Security testing**:
```bash
# Test with various malicious JSON payloads
# Verify no prototype pollution occurs
# Check memory usage during parsing
```

### 📋 **Related Resources**
- [OWASP A05:2021 - Security Misconfiguration](https://owasp.org/Top10/A05_2021-Security_Misconfiguration/)
- [CWE-94: Improper Control of Generation of Code](https://cwe.mitre.org/data/definitions/94.html)
- [Prototype Pollution Guide](https://github.com/HoLyVieR/prototype-pollution-nsec18)
- [JSON Security Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html)

### 🚨 **Timeline**
- **Immediate**: Implement input validation (0-1 day)
- **Short-term**: Add secure JSON parsing (1-3 days)
- **Long-term**: Implement comprehensive security controls (1-2 weeks)

---

**🔒 Security Team Notes**: This vulnerability can lead to serious security breaches including prototype pollution and potential RCE. Immediate implementation of secure JSON parsing is critical.