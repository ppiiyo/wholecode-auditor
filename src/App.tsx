import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  FileCode2,
  Terminal,
  Search,
  ExternalLink,
  Code2,
  Cpu,
  Layers,
  ChevronRight,
  AlertTriangle,
  FileText,
  Copy,
  Check,
  Zap,
} from "lucide-react";

interface CheckInfo {
  key: string;
  title: string;
  instructions: string;
  trueCrit: string;
  falseCrit: string;
  patterns: string[];
}

const CHECKS_DATA: CheckInfo[] = [
  {
    key: "sql_injection",
    title: "SQL Injection",
    instructions: "Does the code contain SQL injection vulnerabilities?",
    trueCrit: "SQL built via string concatenation/f-strings/format with external input",
    falseCrit: "All SQL uses parameterized queries or a safe ORM API",
    patterns: [
      'execute\\(\\s*f["\']',
      'execute\\(\\s*["\'][^"\']*%s',
      'execute\\(\\s*["\'][^"\']*\\+',
      'query\\s*=\\s*f["\']',
      '\\.raw\\(\\s*f["\']',
      'WHERE.{0,40}\\+\\s*[a-z_]+',
    ],
  },
  {
    key: "hardcoded_secrets",
    title: "Hardcoded Secrets",
    instructions: "Does the code contain hardcoded secrets?",
    trueCrit: "API keys, passwords, tokens or private keys written literally in source",
    falseCrit: "All secrets come from environment variables or a secret manager",
    patterns: [
      '(?i)(api[_-]?key|secret|passwd|password|access[_-]?token)\\s*=\\s*["\'][A-Za-z0-9/+=_\\-]{8,}["\']',
      "-----BEGIN [A-Z ]*PRIVATE KEY-----",
    ],
  },
  {
    key: "xss",
    title: "Cross-Site Scripting (XSS)",
    instructions: "Does the code contain XSS vulnerabilities?",
    trueCrit: "Unescaped user input rendered into HTML (innerHTML, document.write, raw templates)",
    falseCrit: "All user input is escaped or rendered via safe templating",
    patterns: [
      "innerHTML\\s*=",
      "dangerouslySetInnerHTML",
      "document\\.write\\(",
      "\\|\\s*safe\\b",
    ],
  },
  {
    key: "path_traversal",
    title: "Path Traversal",
    instructions: "Does the code contain path traversal vulnerabilities?",
    trueCrit: "File paths built from user input without sanitization",
    falseCrit: "File access uses fixed roots or validated/sanitized paths",
    patterns: [
      "open\\(\\s*(request|req)\\b",
      "os\\.path\\.join\\([^)]*(request|req)\\b",
      "send_file\\([^)]*(request|req|args)\\b",
    ],
  },
  {
    key: "insecure_deserialization",
    title: "Insecure Deserialization / eval",
    instructions: "Does the code deserialize untrusted data or use eval/exec?",
    trueCrit: "pickle/marshal/yaml.load/eval/exec applied to external input",
    falseCrit: "Deserialization uses safe loaders (yaml.safe_load) or avoids eval entirely",
    patterns: [
      "pickle\\.loads?\\(",
      "marshal\\.loads?\\(",
      "yaml\\.load\\((?![^)]*Loader)",
      "\\beval\\(",
      "\\bexec\\(",
    ],
  },
  {
    key: "ssrf",
    title: "Server-Side Request Forgery (SSRF)",
    instructions: "Does the code contain SSRF vulnerabilities?",
    trueCrit: "Outbound URLs built from user input without allowlist validation",
    falseCrit: "Outbound requests use fixed hosts or a validated allowlist",
    patterns: [
      'requests\\.(get|post|put)\\(\\s*f["\']',
      'urlopen\\(\\s*f["\']',
      "requests\\.(get|post)\\([^)]*\\+",
    ],
  },
  {
    key: "weak_crypto",
    title: "Weak Cryptography",
    instructions: "Does the code use weak or broken cryptography?",
    trueCrit: "MD5/SHA1 for security, DES/RC4, or non-crypto RNG for secrets/tokens",
    falseCrit: "Modern algorithms (SHA-256+, AES-GCM) and secrets module for tokens",
    patterns: [
      "\\bmd5\\(",
      "\\bsha1\\(",
      "\\bDES\\b",
      "\\bRC4\\b",
      "random\\.random\\(\\).{0,40}(token|key|secret)",
    ],
  },
  {
    key: "info_leak",
    title: "Sensitive Info Leakage",
    instructions: "Does the code leak sensitive information in errors or logs?",
    trueCrit: "Stack traces, debug mode or secrets exposed to clients/logs",
    falseCrit: "Errors are generic to clients; debug off in production",
    patterns: [
      "debug\\s*=\\s*True",
      "traceback\\.print_exc",
      "print\\([^)]*(password|secret|token)",
    ],
  },
  {
    key: "auth_bypass",
    title: "Missing Authentication / Authorization",
    instructions: "Are there endpoints or sensitive operations without authentication checks?",
    trueCrit: "Routes or admin operations reachable without auth/permission verification",
    falseCrit: "All sensitive endpoints enforce authentication and authorization",
    patterns: ["@app\\.route\\([^)]*\\)\\s*\\n\\s*def\\s+(delete|admin|update)_"],
  },
  {
    key: "race_conditions",
    title: "Race Conditions / TOCTOU",
    instructions: "Does the code contain race conditions on shared state or check-then-act flows?",
    trueCrit: "Non-atomic check-then-act on shared resources (balance, inventory, files)",
    falseCrit: "Shared-state mutations use locks, transactions or atomic operations",
    patterns: [
      "if\\s+.{0,40}(exists|balance|count).{0,40}:\\s*\\n\\s*.{0,60}(update|delete|set)",
    ],
  },
];

const SAMPLE_AUDIT_REPORT = `# Wholecode Audit Report

**Repository:** \`pallets/flask\`  
**Files analyzed:** 48 (512,300 chars, ~128,075 tokens, 1 chunk(s))  
**Overall risk:** 12%  
**Production ready:** YES

## Findings

### ✅ SQL Injection — 2%
### ✅ Hardcoded Secrets — 1%
### ✅ Cross-Site Scripting (XSS) — 4%
### ✅ Path Traversal — 5%
### ✅ Insecure Deserialization / eval — 3%
### ✅ Server-Side Request Forgery (SSRF) — 1%
### ✅ Weak Cryptography — 4%
### ✅ Sensitive Info Leakage — 12%
### ✅ Missing Authentication / Authorization — 8%
### ✅ Race Conditions / TOCTOU — 6%

## Clean checks

✅ SQL Injection, ✅ Hardcoded Secrets, ✅ Cross-Site Scripting (XSS), ✅ Path Traversal, ✅ Insecure Deserialization / eval, ✅ Server-Side Request Forgery (SSRF), ✅ Weak Cryptography, ✅ Sensitive Info Leakage, ✅ Missing Authentication / Authorization, ✅ Race Conditions / TOCTOU

---
_Generated by wholecode-auditor · powered by SubQ Snap (384K-token context)_`;

export default function App() {
  const [activeTab, setActiveTab] = useState<"checks" | "cli" | "report" | "architecture">("checks");
  const [selectedCheck, setSelectedCheck] = useState<CheckInfo>(CHECKS_DATA[0]);
  const [regexTesterCode, setRegexTesterCode] = useState<string>(
    `# Example snippet to test locator patterns\ndef query_user(request):\n    uid = request.args.get('id')\n    db.execute(f"SELECT * FROM users WHERE id={uid}")\n    return {"status": "ok"}`
  );
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg shadow-cyan-500/20 text-white font-bold">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight text-white">wholecode-auditor</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono">v0.1.0</span>
              </div>
              <p className="text-xs text-slate-400">Whole-codebase security auditor powered by SubQ Snap (384K context)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              SubQ Snap 384K Ready
            </span>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <div className="border-b border-slate-800/80 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-6 text-sm">
          {[
            { id: "checks", label: "Security Taxonomy (10 Checks)", icon: ShieldAlert },
            { id: "cli", label: "CLI & Usage", icon: Terminal },
            { id: "report", label: "Audit Reports", icon: FileText },
            { id: "architecture", label: "Architecture & Schema", icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3.5 border-b-2 font-medium transition-colors ${
                  active
                    ? "border-cyan-400 text-cyan-400"
                    : "border-transparent text-slate-400 hover:text-slate-200"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {activeTab === "checks" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar check list */}
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                  Audited Vulnerability Checks
                </h3>
                <span className="text-xs text-slate-400 font-mono">10 Total</span>
              </div>
              <div className="space-y-1.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
                {CHECKS_DATA.map((chk, idx) => {
                  const isSel = selectedCheck.key === chk.key;
                  return (
                    <button
                      key={chk.key}
                      onClick={() => setSelectedCheck(chk)}
                      className={`w-full text-left p-3 rounded-lg border transition-all flex items-start justify-between ${
                        isSel
                          ? "bg-cyan-950/40 border-cyan-500/50 text-white shadow-sm shadow-cyan-950"
                          : "bg-slate-900/40 border-slate-800/80 text-slate-300 hover:bg-slate-900 hover:border-slate-700"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-cyan-400">#{idx + 1}</span>
                          <span className="font-semibold text-sm">{chk.title}</span>
                        </div>
                        <p className="text-xs text-slate-400 line-clamp-1">{chk.instructions}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 ${isSel ? "text-cyan-400" : "text-slate-600"}`} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Check Details & Regex Tester */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">SubQ Noul Spec</span>
                    <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded font-mono">
                      key: {selectedCheck.key}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">{selectedCheck.title}</h2>
                  <p className="text-slate-300 mt-2 text-sm bg-slate-950/60 p-3 rounded-lg border border-slate-800 font-sans">
                    <strong>Question:</strong> {selectedCheck.instructions}
                  </p>
                </div>

                {/* SubQ Noul Criteria */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-red-950/20 border border-red-900/40">
                    <div className="flex items-center gap-1.5 text-red-400 font-semibold text-xs uppercase tracking-wider mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      True Criteria (Vulnerable)
                    </div>
                    <p className="text-sm text-red-200/90 leading-relaxed">{selectedCheck.trueCrit}</p>
                  </div>

                  <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs uppercase tracking-wider mb-2">
                      <ShieldCheck className="w-4 h-4" />
                      False Criteria (Secure)
                    </div>
                    <p className="text-sm text-emerald-200/90 leading-relaxed">{selectedCheck.falseCrit}</p>
                  </div>
                </div>

                {/* Regex Patterns */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    Regex Pre-Screen Patterns (Line Locators)
                  </h4>
                  <div className="space-y-1.5">
                    {selectedCheck.patterns.map((pat, i) => (
                      <div
                        key={i}
                        className="font-mono text-xs bg-slate-950 p-2.5 rounded border border-slate-800 text-cyan-300 flex items-center justify-between"
                      >
                        <code className="break-all">{pat}</code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interactive Regex Test Sandbox */}
                <div className="pt-4 border-t border-slate-800/80">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Interactive Pattern Match Sandbox
                  </h4>
                  <textarea
                    rows={4}
                    value={regexTesterCode}
                    onChange={(e) => setRegexTesterCode(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500"
                    placeholder="Type or paste code to test against this check's patterns..."
                  />

                  {/* Test matches preview */}
                  {(() => {
                    let matches: { line: number; snippet: string }[] = [];
                    const lines = regexTesterCode.split("\n");
                    for (const patStr of selectedCheck.patterns) {
                      try {
                        const regex = new RegExp(patStr, "im");
                        lines.forEach((line, idx) => {
                          if (regex.test(line)) {
                            matches.push({ line: idx + 1, snippet: line.trim() });
                          }
                        });
                      } catch {
                        // ignore regex syntax issues
                      }
                    }
                    return (
                      <div className="mt-3">
                        {matches.length > 0 ? (
                          <div className="p-3 bg-amber-950/20 border border-amber-800/50 rounded-lg space-y-1">
                            <span className="text-xs text-amber-400 font-medium">
                              Pattern pre-screen matched {matches.length} line(s):
                            </span>
                            {matches.map((m, idx) => (
                              <div key={idx} className="text-xs font-mono text-amber-200">
                                Line {m.line}: <code>{m.snippet}</code>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-2.5 bg-slate-950 rounded border border-slate-800 text-xs text-slate-400">
                            No local pattern matches in snippet. (SubQ Snap evaluates whole-code semantic context).
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "cli" && (
          <div className="space-y-8 max-w-4xl mx-auto">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Terminal className="w-5 h-5 text-cyan-400" />
                Command Line Interface (CLI)
              </h2>
              <p className="text-sm text-slate-300">
                Install and audit any GitHub repository or local codebase directly with SubQ Snap's 384K context.
              </p>

              <div className="space-y-4 pt-2">
                {[
                  {
                    title: "Audit a Public GitHub Repository",
                    cmd: "wholecode audit github pallets/flask",
                    desc: "Streams single tarball from GitHub without rate limits, loads into 384K context, and outputs report.",
                  },
                  {
                    title: "Audit a Local Project Directory",
                    cmd: "wholecode audit local ./wholecode",
                    desc: "Recursively scans code files, skips binaries and minified bundles, checks 10 categories.",
                  },
                  {
                    title: "Output Markdown or Structured JSON",
                    cmd: "wholecode audit github owner/repo -o report.md --json",
                    desc: "Writes comprehensive markdown report or JSON data formatted for CI/CD.",
                  },
                  {
                    title: "Run Unit Test Suite",
                    cmd: "pytest -q",
                    desc: "Runs 9 test suites validating probability parser, chunking, multiline regex, and CLI parser.",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-200">{item.title}</span>
                      <button
                        onClick={() => copyToClipboard(item.cmd, `cmd-${idx}`)}
                        className="text-xs flex items-center gap-1 text-slate-400 hover:text-cyan-400"
                      >
                        {copiedText === `cmd-${idx}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <pre className="font-mono text-xs text-cyan-300 bg-slate-900 p-2.5 rounded border border-slate-800 overflow-x-auto">
                      <code>{item.cmd}</code>
                    </pre>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Docker execution */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-3">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                Containerized Execution (Docker)
              </h3>
              <p className="text-xs text-slate-400">
                You can run wholecode-auditor in Docker with zero host dependencies:
              </p>
              <pre className="font-mono text-xs text-cyan-300 bg-slate-950 p-3 rounded border border-slate-800 overflow-x-auto">
                <code>{`docker build -t wholecode-auditor .\ndocker run -e SUBQ_API_KEY=$SUBQ_API_KEY wholecode-auditor audit github pallets/flask`}</code>
              </pre>
            </div>
          </div>
        )}

        {activeTab === "report" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-cyan-400" />
                    Generated Report Preview
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Standard output format generated by wholecode-auditor markdown reporter
                  </p>
                </div>
                <button
                  onClick={() => copyToClipboard(SAMPLE_AUDIT_REPORT, "sample-report")}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 flex items-center gap-1.5"
                >
                  {copiedText === "sample-report" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Markdown</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-950 p-6 rounded-lg border border-slate-800 font-mono text-xs text-slate-300 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                {SAMPLE_AUDIT_REPORT}
              </div>
            </div>
          </div>
        )}

        {activeTab === "architecture" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-xl space-y-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-cyan-400" />
                SubQ Snap Context & Noul Protocol Spec
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Rather than truncating files or relying on lossy RAG embeddings that miss cross-file vulnerabilities (such as auth decorators defined in one module and applied in another), wholecode-auditor packs the entire codebase into SubQ Snap's 384K context.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-cyan-400 font-bold text-sm flex items-center gap-1.5">
                    <Zap className="w-4 h-4" /> 384K Context Window
                  </div>
                  <p className="text-xs text-slate-400">
                    Up to ~1.2M characters per chunk, allowing full repos to be reasoned over holistically in one single pass.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-cyan-400 font-bold text-sm flex items-center gap-1.5">
                    <Code2 className="w-4 h-4" /> Pure Noul Schema
                  </div>
                  <p className="text-xs text-slate-400">
                    Questions use only <code className="text-cyan-300">noul</code> format with symmetric true/false criteria producing accurate calibrated probabilities.
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-cyan-400 font-bold text-sm flex items-center gap-1.5">
                    <Search className="w-4 h-4" /> Regex Pre-Screen
                  </div>
                  <p className="text-xs text-slate-400">
                    When probability ≥ 0.5, targeted multi-line regex pre-screens highlight exact suspect lines for rapid triage.
                  </p>
                </div>
              </div>

              {/* Exact SubQ Request Schema */}
              <div className="pt-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  SubQ API Schema Format
                </h3>
                <pre className="font-mono text-xs bg-slate-950 p-4 rounded-lg border border-slate-800 text-slate-300 overflow-x-auto">
{`// POST https://api.subq.ai/v1/systemone
{
  "model": "subq-snap-preview",
  "state": "# FILE: wholecode/loaders.py\\n...",
  "questions": {
    "sql_injection": {
      "type": "noul",
      "instructions": "Does the code contain SQL injection vulnerabilities?",
      "criteria": {
        "true": "SQL built via string concatenation/f-strings/format with external input",
        "false": "All SQL uses parameterized queries or a safe ORM API"
      }
    }
  }
}`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950 py-6 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>wholecode-auditor · MIT License · Powered by SubQ Snap 384K</div>
          <div className="font-mono">10 Built-in Security Checks · Pure Noul Protocol</div>
        </div>
      </footer>
    </div>
  );
}
