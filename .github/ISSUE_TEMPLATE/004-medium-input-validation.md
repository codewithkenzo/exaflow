---
title: "🔒 Medium Security: Input Validation Bypass in Query Construction"
labels: ["security", "medium", "input-validation", "injection"]
assignees: []
---

## 🔒 Medium Security Vulnerability: Input Validation Bypass

### 🚨 **Severity: Medium**
- **CVSS Score**: 6.8 (Medium)
- **CWE**: CWE-89: SQL Injection (Analogous), CWE-74: Injection
- **File**: `src/mcp-server.ts:317-326`
- **Impact: Injection Attacks, Query Manipulation, Data Exfiltration**

### 📍 **Location**
```typescript
// File: src/mcp-server.ts
// Lines: 317-326
let enhancedQuery = args.query;

if (args.includeProfiles) {
  enhancedQuery += ' site:linkedin.com';  // ❌ SECURITY ISSUE
}

if (args.includeCompanies) {
  enhancedQuery += ' company OR corporation OR startup';  // ❌ SECURITY ISSUE
}

if (args.location) {
  enhancedQuery += ` ${args.location}`;  // ❌ SECURITY ISSUE - No validation
}
```

### 🎯 **Impact Assessment**

1. **Query Injection**:
   - Direct string concatenation without sanitization
   - Malicious input can modify search query structure
   - Could lead to unintended search results or API abuse

2. **Search Result Manipulation**:
   - Attackers can inject additional search terms
   - Bypass intended search restrictions
   - Potentially access unauthorized content through crafted queries

3. **API Abuse**:
   - Excessive resource consumption through malicious queries
   - Bypass of rate limiting or filtering mechanisms
   - Potential for data exfiltration from unintended sources

### 🔍 **Technical Details**

The vulnerability occurs in multiple MCP tool handlers where user input is directly concatenated to construct search queries:

- **No input validation**: User input is used directly without sanitization
- **String concatenation**: Queries are built using simple string concatenation
- **No escaping**: Special characters in user input are not escaped
- **Trust boundary violation**: User input crosses trust boundaries without validation

**Attack Scenarios:**
```javascript
// Injection through location parameter
args.location = "site:evil.com OR password OR secret";
// Results in: "original query site:evil.com OR password OR secret"

// Query manipulation
args.query = "company secrets) AND (site:internal.com";
// Could bypass intended search restrictions

// Special character injection
args.location = "\"; DROP TABLE users; --";
// While not SQL, similar injection principles apply
```

### 🛠️ **Recommended Remediation**

#### **Immediate Actions:**
1. **Implement input validation and sanitization**:
```typescript
// ✅ Secure approach
import { z } from 'zod';
import { sanitizeSearchQuery } from './util/query-sanitizer';

const SearchToolSchema = z.object({
  query: z.string().min(1).max(1000).transform(sanitizeSearchQuery),
  location: z.string().max(200).optional().transform(sanitizeSearchQuery),
  includeProfiles: z.boolean().default(false),
  includeCompanies: z.boolean().default(false)
});

function sanitizeSearchQuery(input: string): string {
  if (!input) return '';

  // Remove dangerous characters and patterns
  return input
    .replace(/[<>"'`]/g, '') // Remove HTML/JS injection chars
    .replace(/[;|&$(){}[\]]/g, '') // Remove shell injection chars
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .substring(0, 1000); // Limit length
}

function buildSecureQuery(args: z.infer<typeof SearchToolSchema>): string {
  let enhancedQuery = args.query;

  // Validate base query
  if (!enhancedQuery || enhancedQuery.length === 0) {
    throw new Error('Query is required');
  }

  // Sanitized additions
  if (args.includeProfiles) {
    enhancedQuery += ' site:linkedin.com';
  }

  if (args.includeCompanies) {
    enhancedQuery += ' (company OR corporation OR startup)';
  }

  // Safe location addition with validation
  if (args.location && args.location.length > 0) {
    // Validate location format (basic check)
    if (!isValidLocation(args.location)) {
      throw new Error('Invalid location format');
    }
    enhancedQuery += ` ${args.location}`;
  }

  // Final validation
  if (enhancedQuery.length > 2000) {
    throw new Error('Query too long');
  }

  return enhancedQuery;
}

function isValidLocation(location: string): boolean {
  // Basic location validation
  const locationPattern = /^[a-zA-Z\s,.-]+$/;
  return locationPattern.test(location.trim());
}
```

2. **Use parameterized query construction**:
```typescript
// ✅ More secure approach with structured queries
interface SearchComponents {
  baseQuery: string;
  filters: {
    sites?: string[];
    terms?: string[];
    location?: string;
  };
}

function buildStructuredQuery(components: SearchComponents): string {
  let query = components.baseQuery;
  const filters: string[] = [];

  // Add site filters
  if (components.filters.sites) {
    filters.push(`(${components.filters.sites.map(site => `site:${site}`).join(' OR ')})`);
  }

  // Add term filters
  if (components.filters.terms) {
    filters.push(`(${components.filters.terms.join(' OR ')})`);
  }

  // Add location filter
  if (components.filters.location) {
    const sanitizedLocation = sanitizeLocation(components.filters.location);
    filters.push(sanitizedLocation);
  }

  // Combine all parts safely
  if (filters.length > 0) {
    query += ` ${filters.join(' ')}`;
  }

  return query;
}

function sanitizeLocation(location: string): string {
  // Strict location sanitization
  return location
    .replace(/[^a-zA-Z\s,.-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
```

3. **Implement comprehensive input validation**:
```typescript
// File: src/util/input-validator.ts
export class InputValidator {
  private static readonly MAX_QUERY_LENGTH = 1000;
  private static readonly MAX_LOCATION_LENGTH = 200;
  private static readonly DANGEROUS_PATTERNS = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /<script/i,
    /onload=/i,
    /onerror=/i,
    /[;|&$(){}[\]]/,
    /union\s+select/i,
    /drop\s+table/i,
    /insert\s+into/i
  ];

  static validateSearchQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      throw new Error('Query is required and must be a string');
    }

    // Length validation
    if (query.length > this.MAX_QUERY_LENGTH) {
      throw new Error(`Query exceeds maximum length of ${this.MAX_QUERY_LENGTH} characters`);
    }

    // Dangerous pattern detection
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(query)) {
        throw new Error('Query contains potentially dangerous content');
      }
    }

    // Basic sanitization
    return query
      .replace(/[<>"'`]/g, '')
      .trim();
  }

  static validateLocation(location: string): string {
    if (!location || typeof location !== 'string') {
      return '';
    }

    if (location.length > this.MAX_LOCATION_LENGTH) {
      throw new Error(`Location exceeds maximum length of ${this.MAX_LOCATION_LENGTH} characters`);
    }

    // Only allow letters, numbers, spaces, and basic punctuation
    const sanitized = location.replace(/[^a-zA-Z0-9\s,.-]/g, '').trim();

    if (sanitized.length === 0) {
      throw new Error('Invalid location format');
    }

    return sanitized;
  }
}
```

#### **Long-term Improvements:**
1. **Use a query builder library**:
```typescript
import { QueryBuilder } from './util/query-builder';

class SearchQueryBuilder extends QueryBuilder {
  private baseQuery: string = '';
  private filters: string[] = [];

  setBaseQuery(query: string): this {
    this.baseQuery = InputValidator.validateSearchQuery(query);
    return this;
  }

  addSiteFilter(sites: string[]): this {
    const validatedSites = sites.map(site => {
      if (!this.isValidSite(site)) {
        throw new Error(`Invalid site: ${site}`);
      }
      return site;
    });

    this.filters.push(`(${validatedSites.map(s => `site:${s}`).join(' OR ')})`);
    return this;
  }

  addLocationFilter(location: string): this {
    const sanitizedLocation = InputValidator.validateLocation(location);
    this.filters.push(sanitizedLocation);
    return this;
  }

  build(): string {
    let query = this.baseQuery;

    if (this.filters.length > 0) {
      query += ` ${this.filters.join(' ')}`;
    }

    return query;
  }

  private isValidSite(site: string): boolean {
    // Validate site format
    const sitePattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return sitePattern.test(site);
  }
}

// Usage in MCP server
case 'exa_professional_finder': {
  const validatedArgs = SearchToolSchema.parse(args);

  const query = new SearchQueryBuilder()
    .setBaseQuery(validatedArgs.query)
    .addSiteFilter(validatedArgs.includeProfiles ? ['linkedin.com'] : [])
    .addLocationFilter(validatedArgs.location || '')
    .build();

  // Continue with search...
}
```

2. **Implement query auditing and monitoring**:
```typescript
// File: src/util/query-monitor.ts
export class QueryMonitor {
  private static readonly SUSPICIOUS_PATTERNS = [
    /password/i,
    /secret/i,
    /admin/i,
    /internal/i,
    /private/i
  ];

  static auditQuery(query: string, context: string): void {
    // Check for suspicious patterns
    const isSuspicious = this.SUSPICIOUS_PATTERNS.some(pattern => pattern.test(query));

    if (isSuspicious) {
      securityLogger.logSecurityEvent('SUSPICIOUS_QUERY', {
        query: this.maskSensitiveData(query),
        context,
        timestamp: new Date().toISOString(),
        userAgent: process.env.USER_AGENT
      });
    }

    // Log all queries for analysis
    this.logQuery(query, context);
  }

  private static maskSensitiveData(query: string): string {
    return query.replace(/\b(password|secret|key|token)\b/gi, '[REDACTED]');
  }

  private static logQuery(query: string, context: string): void {
    auditLogger.info('QUERY_EXECUTED', {
      queryLength: query.length,
      context,
      timestamp: new Date().toISOString()
    });
  }
}
```

3. **Add rate limiting and abuse protection**:
```typescript
// File: src/util/rate-limiter.ts
import { RateLimiterMemory } from 'rate-limiter-flexible';

const searchRateLimiter = new RateLimiterMemory({
  keyPrefix: 'search',
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
});

export async function checkSearchRateLimit(identifier: string): Promise<void> {
  try {
    await searchRateLimiter.consume(identifier);
  } catch (rejRes) {
    securityLogger.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      identifier,
      retryAfter: rejRes.msBeforeNext,
      timestamp: new Date().toISOString()
    });
    throw new Error('Rate limit exceeded. Please try again later.');
  }
}
```

### ✅ **Verification Steps**

1. **Test input validation**:
```bash
# Test with various malicious inputs
# Test special characters, SQL injection patterns
# Verify all dangerous inputs are rejected or sanitized
```

2. **Query construction testing**:
```bash
# Test with extreme input values
# Verify query structure is maintained
# Check that no unintended query modifications occur
```

3. **Security testing**:
```bash
# Attempt injection attacks through all parameters
# Test with malformed location data
# Verify rate limiting works correctly
```

### 📋 **Related Resources**
- [OWASP A03:2021 - Injection](https://owasp.org/Top10/A03_2021-Injection/)
- [CWE-89: SQL Injection](https://cwe.mitre.org/data/definitions/89.html)
- [Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [Query Parameterization Guide](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html)

### 🚨 **Timeline**
- **Immediate**: Implement basic input validation (0-1 day)
- **Short-term**: Add comprehensive sanitization (1-3 days)
- **Long-term**: Implement query builder and monitoring (1-2 weeks)

---

**🔒 Security Team Notes**: While this vulnerability is medium severity, it could be exploited to manipulate search functionality and potentially access unintended data. Implementation of proper input validation is essential.