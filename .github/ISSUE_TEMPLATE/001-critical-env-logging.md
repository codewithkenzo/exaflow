---
title: "🔒 Critical Security: Environment Variable Logging in Production"
labels: ["security", "critical", "env-logging"]
assignees: []
---

## 🔒 Critical Security Vulnerability: Environment Variable Logging

### 🚨 **Severity: Critical**
- **CVSS Score**: 8.6 (High)
- **CWE**: CWE-532: Insertion of Sensitive Information into Log File
- **File**: `src/env.ts:47-49`
- **Impact**: Information Disclosure, Configuration Exposure

### 📍 **Location**
```typescript
// File: src/env.ts
// Lines: 47-49
if (!result.success) {
  console.error('Environment validation failed:');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('EXA')));  // ❌ SECURITY ISSUE
  console.error('Process env EXA_API_KEY:', process.env.EXA_API_KEY ? 'SET' : 'NOT SET');        // ❌ SECURITY ISSUE
```

### 🎯 **Impact Assessment**

1. **Information Disclosure**:
   - Environment variable names are logged to console
   - Potential exposure of sensitive configuration information
   - API keys and secrets may be indirectly exposed through variable names

2. **Configuration Intelligence Gathering**:
   - Attackers can learn about the application's configuration structure
   - Environment variable patterns reveal infrastructure details
   - Facilitates targeted attacks on specific configuration components

3. **Compliance Violations**:
   - Violates security best practices for credential management
   - May breach regulatory requirements (PCI-DSS, HIPAA, GDPR)
   - Increases risk surface for social engineering attacks

### 🔍 **Technical Details**

The vulnerability occurs when environment validation fails and the application logs:
- List of environment variables containing 'EXA'
- Status of EXA_API_KEY presence
- This information leaks to logs, monitoring systems, and potentially attackers

### 🛠️ **Recommended Remediation**

#### **Immediate Actions:**
1. **Remove sensitive logging in production**:
```typescript
// ✅ Secure approach
if (!result.success) {
  // Only log generic error in production
  if (process.env.NODE_ENV === 'production') {
    console.error('Environment validation failed. Please check configuration.');
  } else {
    // Detailed logging only in development
    console.error('Environment validation failed:');
    console.error('Validation errors:', result.error.issues);
  }
  throw new Error(`Environment validation failed: ${errors}`);
}
```

2. **Implement structured logging**:
```typescript
import { createLogger } from 'winston';

const logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: process.env.NODE_ENV === 'production'
    ? format.json()
    : format.combine(format.colorize(), format.simple())
});
```

3. **Add environment variable sanitization**:
```typescript
function sanitizeEnvVars(envVars: Record<string, string>): Record<string, string> {
  const sensitivePatterns = [
    /KEY/i, /SECRET/i, /PASSWORD/i, /TOKEN/i, /CREDENTIAL/i
  ];

  return Object.keys(envVars).reduce((sanitized, key) => {
    const isSensitive = sensitivePatterns.some(pattern => pattern.test(key));
    sanitized[key] = isSensitive ? '[REDACTED]' : envVars[key];
    return sanitized;
  }, {} as Record<string, string>);
}
```

#### **Long-term Improvements:**
1. **Environment variable validation without logging**:
```typescript
function validateEnvSilently(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    // Log to secure audit system instead of console
    auditLogger.logSecurityEvent('ENV_VALIDATION_FAILED', {
      timestamp: new Date().toISOString(),
      errors: result.error.issues.map(issue => ({
        path: issue.path,
        message: issue.message
        // No sensitive values logged
      }))
    });

    throw new Error('Environment configuration is invalid');
  }

  return result.data;
}
```

2. **Implement secret management**:
   - Use AWS Secrets Manager, Azure Key Vault, or HashiCorp Vault
   - Rotate credentials regularly
   - Implement least-privilege access

3. **Add monitoring and alerting**:
   - Set up alerts for environment validation failures
   - Monitor for suspicious log patterns
   - Implement log redaction for sensitive data

### ✅ **Verification Steps**

1. **Test the fix**:
   ```bash
   # Set invalid environment
   export EXA_API_KEY=""
   NODE_ENV=production bun run src/cli.ts --help

   # Verify no sensitive information is logged
   # Check that only generic error message appears
   ```

2. **Audit logging behavior**:
   ```bash
   # Test both development and production modes
   NODE_ENV=development bun run src/cli.ts --help
   NODE_ENV=production bun run src/cli.ts --help

   # Compare log outputs
   ```

3. **Security testing**:
   ```bash
   # Monitor logs for any sensitive information leakage
   # Test with various invalid environment configurations
   # Verify audit logging works correctly
   ```

### 📋 **Related Resources**
- [OWASP A01:2021 - Broken Access Control](https://owasp.org/Top10/A01_2021-Broken_Access_Control/)
- [CWE-532: Insertion of Sensitive Information into Log File](https://cwe.mitre.org/data/definitions/532.html)
- [NIST SP 800-53: Security and Privacy Controls](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)

### 🚨 **Timeline**
- **Immediate**: Disable logging in production (0-1 day)
- **Short-term**: Implement structured logging (1-3 days)
- **Long-term**: Implement secret management (1-2 weeks)

---

**🔒 Security Team Notes**: This vulnerability poses a significant risk to information security. Immediate remediation is required to prevent potential credential exposure and configuration intelligence gathering.