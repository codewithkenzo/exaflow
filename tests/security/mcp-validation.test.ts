import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';

// Import sanitization functions from mcp-server (we'll extract these for testing)
describe('MCP Server Input Validation', () => {
  describe('sanitizeString', () => {
    it('should throw error for non-string input', () => {
      expect(() => sanitizeString(123)).toThrow('Input must be a string');
      expect(() => sanitizeString(null)).toThrow('Input must be a string');
      expect(() => sanitizeString(undefined)).toThrow('Input must be a string');
      expect(() => sanitizeString({})).toThrow('Input must be a string');
    });

    it('should throw error for input exceeding max length', () => {
      const longString = 'a'.repeat(1001);
      expect(() => sanitizeString(longString, 1000)).toThrow('Input exceeds maximum length');
    });

    it('should remove control characters', () => {
      const input = 'test\x00\x01\x02string';
      const result = sanitizeString(input);
      expect(result).toBe('teststring');
    });

    it('should remove non-characters', () => {
      const input = 'test\uFFFE\uFFFFstring';
      const result = sanitizeString(input);
      expect(result).toBe('teststring');
    });

    it('should reject script tag injection', () => {
      expect(() => sanitizeString('<script>alert(1)</script>')).toThrow('dangerous content');
      expect(() => sanitizeString('<SCRIPT>alert(1)</script>')).toThrow('dangerous content');
    });

    it('should reject javascript protocol', () => {
      expect(() => sanitizeString('javascript:alert(1)')).toThrow('dangerous content');
      expect(() => sanitizeString('JaVaScRiPt:alert(1)')).toThrow('dangerous content');
    });

    it('should reject event handlers', () => {
      expect(() => sanitizeString('<img onerror=alert(1)>')).toThrow('dangerous content');
      expect(() => sanitizeString('onclick="alert(1)"')).toThrow('dangerous content');
    });

    it('should reject prototype pollution', () => {
      expect(() => sanitizeString('__proto__')).toThrow('dangerous content');
      expect(() => sanitizeString('constructor')).toThrow('dangerous content');
      expect(() => sanitizeString('prototype')).toThrow('dangerous content');
    });

    it('should accept valid strings', () => {
      expect(sanitizeString('hello world')).toBe('hello world');
      expect(sanitizeString('search query 123')).toBe('search query 123');
      expect(sanitizeString('special chars: @#$%')).toBe('special chars: @#$%');
    });

    it('should trim whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test');
      expect(sanitizeString('\ttest\n')).toBe('test');
    });
  });

  describe('validateDate', () => {
    it('should accept valid ISO 8601 dates', () => {
      expect(() => validateDate('2024-01-15')).not.toThrow();
      expect(() => validateDate('2024-01-15T10:30:00')).not.toThrow();
      expect(() => validateDate('2024-01-15T10:30:00.123Z')).not.toThrow();
      expect(() => validateDate('2024-01-15T10:30:00+05:30')).not.toThrow();
    });

    it('should reject invalid date formats', () => {
      expect(() => validateDate('01-15-2024')).toThrow('Invalid date format');
      expect(() => validateDate('2024/01/15')).toThrow('Invalid date format');
      expect(() => validateDate('Jan 15, 2024')).toThrow('Invalid date format');
      expect(() => validateDate('15-01-2024')).toThrow('Invalid date format');
    });
  });

  describe('Query Concatenation Security', () => {
    it('should reject XSS in location parameter', () => {
      const location = '<script>alert(1)</script>';
      expect(() => sanitizeString(location, 500)).toThrow('dangerous content');
    });

    it('should reject javascript: protocol in location', () => {
      const location = 'javascript:alert(1)';
      expect(() => sanitizeString(location, 500)).toThrow('dangerous content');
    });

    it('should reject event handlers in location', () => {
      const location = 'onload=alert(1)';
      expect(() => sanitizeString(location, 500)).toThrow('dangerous content');
    });

    it('should reject prototype pollution in location', () => {
      const location = '__proto__';
      expect(() => sanitizeString(location, 500)).toThrow('dangerous content');
    });

    it('should accept normal location strings', () => {
      const location = 'New York';
      const sanitized = sanitizeString(location, 500);
      expect(sanitized).toBe('New York');
    });

    it('should reject XSS in language parameter', () => {
      const language = '<script>alert(1)</script>';
      expect(() => sanitizeString(language, 100)).toThrow('dangerous content');
    });

    it('should reject javascript: protocol in language', () => {
      const language = 'javascript:import';
      expect(() => sanitizeString(language, 100)).toThrow('dangerous content');
    });

    it('should accept normal language strings', () => {
      const language = 'python';
      const sanitized = sanitizeString(language, 100);
      expect(sanitized).toBe('python');
    });

    it('should sanitize sources array and filter invalid entries', () => {
      const rawSources = ['wikipedia', 'government', 'invalid-source', '<script>alert(1)</script>'];
      const allowedSources = ['wikipedia', 'government', 'educational', 'news'];
      
      const sanitizedSources = rawSources
        .filter(source => typeof source === 'string' && allowedSources.includes(source))
        .map(source => sanitizeString(source, 100));
      
      expect(sanitizedSources).toEqual(['wikipedia', 'government']);
      expect(sanitizedSources).not.toContain('invalid-source');
      expect(sanitizedSources).not.toContain('<script>');
    });

    it('should remove control characters from queries', () => {
      const maliciousQuery = 'search\x00term\x01';
      const sanitized = sanitizeString(maliciousQuery, 5000);
      expect(sanitized).toBe('searchterm');
    });

    it('should remove non-characters from queries', () => {
      const maliciousQuery = 'search\uFFFEterm\uFFFF';
      const sanitized = sanitizeString(maliciousQuery, 5000);
      expect(sanitized).toBe('searchterm');
    });
  });

  describe('URL Validation', () => {
    it('should validate HTTP URLs', () => {
      expect(() => validateUrl('http://example.com')).not.toThrow();
    });

    it('should validate HTTPS URLs', () => {
      expect(() => validateUrl('https://example.com')).not.toThrow();
    });

    it('should reject non-HTTP protocols', () => {
      expect(() => validateUrl('ftp://example.com')).toThrow();
      expect(() => validateUrl('file:///etc/passwd')).toThrow();
      expect(() => validateUrl('javascript:alert(1)')).toThrow();
    });

    it('should reject invalid URLs', () => {
      expect(() => validateUrl('not-a-url')).toThrow();
      expect(() => validateUrl('')).toThrow();
    });
  });
});

// Extracted sanitization functions for testing
function sanitizeString(input: any, maxLength = 10000): string {
  if (typeof input !== 'string') {
    throw new Error('Input must be a string');
  }

  // Remove potentially dangerous characters
  const sanitized = input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .replace(/[\uFFFE\uFFFF]/g, '') // Remove non-characters
    .trim();

  // Check length
  if (sanitized.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }

  // Check for dangerous patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /__proto__/i,
    /constructor/i,
    /prototype/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      throw new Error('Input contains potentially dangerous content');
    }
  }

  return sanitized;
}

function validateDate(dateString: string): void {
  // Validate ISO 8601 date format
  const iso8601Regex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})?)?$/;
  if (!iso8601Regex.test(dateString)) {
    throw new Error(
      'Invalid date format. Please use ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)'
    );
  }
}

function validateUrl(url: string): void {
  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      throw new Error('Only HTTP and HTTPS URLs are allowed');
    }
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
}
