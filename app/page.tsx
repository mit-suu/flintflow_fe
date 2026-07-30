"use client";

import { useState, useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

interface User {
  id: string;
  email: string;
}

interface ApiResponse<T = any> {
  data: T | null;
  meta?: Record<string, unknown>;
  error: { code: string; message: string } | null;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<"auth" | "dashboard" | "spec" | "console">("auth");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("password123");
  
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [backendHealth, setBackendHealth] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Check Backend Health
  const checkHealth = async () => {
    try {
      // Extract base host from API_BASE_URL (e.g. http://localhost:5000/api/v1 -> http://localhost:5000/health)
      const healthUrl = API_BASE_URL.replace(/\/api\/v1\/?$/, "") + "/health";
      const res = await fetch(healthUrl);
      const json: ApiResponse = await res.json();
      setBackendHealth(res.ok && json.data?.status === "ok");
    } catch {
      setBackendHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Helper API Fetcher
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    setLoading(true);
    setMessage(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
      };
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        credentials: "include", // send httpOnly refreshToken cookies
      });

      const json: ApiResponse = await res.json();
      setLastResponse(json);

      if (!res.ok || json.error) {
        throw new Error(json.error?.message || `HTTP ${res.status}`);
      }

      return json;
    } catch (err: any) {
      setMessage({ text: err.message || "Request failed", type: "error" });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const json = await apiCall(endpoint, {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (json.data?.accessToken) {
        setAccessToken(json.data.accessToken);
        setUser(json.data.user);
        setMessage({
          text: `${authMode === "login" ? "Login" : "Registration"} successful! Refresh token set in httpOnly cookie.`,
          type: "success",
        });
        setActiveTab("dashboard");
      }
    } catch (err) {
      // Handled in apiCall
    }
  };

  const handleRefresh = async () => {
    try {
      const json = await apiCall("/auth/refresh", { method: "POST" });
      if (json.data?.accessToken) {
        setAccessToken(json.data.accessToken);
        setMessage({ text: "Refresh Token Rotated! New Access Token issued.", type: "success" });
      }
    } catch (err) {
      setAccessToken("");
      setUser(null);
      setMessage({ text: "Session expired or invalid refresh token.", type: "error" });
    }
  };

  const handleGetMe = async () => {
    try {
      const json = await apiCall("/users/me", { method: "GET" });
      if (json.data) {
        setUser(json.data);
        setMessage({ text: "Profile fetched successfully using Access Token!", type: "success" });
      }
    } catch (err) {}
  };

  const handleLogout = async () => {
    try {
      await apiCall("/auth/logout", { method: "POST" });
      setAccessToken("");
      setUser(null);
      setMessage({ text: "Logged out. Session revoked in DB.", type: "info" });
    } catch (err) {}
  };

  const handleLogoutAll = async () => {
    try {
      await apiCall("/auth/logout-all", { method: "POST" });
      setAccessToken("");
      setUser(null);
      setMessage({ text: "Logged out from all devices! All sessions revoked in DB.", type: "info" });
    } catch (err) {}
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center font-black text-xl text-white shadow-lg shadow-indigo-500/20">
              FF
            </div>
            <div>
              <h1 className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                FlintFlow AI Platform
              </h1>
              <p className="text-xs text-slate-400">Software Specification Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Backend Status */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs font-medium">
              <span
                className={`w-2 h-2 rounded-full ${
                  backendHealth === true
                    ? "bg-emerald-400 animate-pulse"
                    : backendHealth === false
                    ? "bg-rose-500"
                    : "bg-amber-400"
                }`}
              />
              <span className="text-slate-300">
                Backend: {backendHealth === true ? "Online (5000)" : backendHealth === false ? "Offline" : "Checking..."}
              </span>
            </div>

            <a
              href="http://localhost:5000/api-docs"
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition"
            >
              Swagger Docs ↗
            </a>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        {/* User Auth Banner */}
        {user && (
          <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900 border border-indigo-500/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center font-bold text-white uppercase">
                {user.email.substring(0, 2)}
              </div>
              <div>
                <div className="text-sm font-semibold text-white">{user.email}</div>
                <div className="text-xs text-indigo-300 font-mono">ID: {user.id}</div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGetMe}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
              >
                Fetch Profile (/me)
              </button>
              <button
                onClick={handleRefresh}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition shadow-sm"
              >
                Rotate Refresh Token
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 text-rose-300 border border-rose-500/30 hover:bg-rose-600/30 text-xs transition"
              >
                Logout Session
              </button>
              <button
                onClick={handleLogoutAll}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white transition shadow-sm"
              >
                Logout All Devices
              </button>
            </div>
          </div>
        )}

        {/* Global Alert Messages */}
        {message && (
          <div
            className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
              message.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : message.type === "error"
                ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                : "bg-blue-950/60 border-blue-500/40 text-blue-300"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-xs opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Tab Selector */}
        <div className="flex border-b border-slate-800 gap-2">
          {[
            { id: "auth", label: "🔑 Auth & Token Control" },
            { id: "dashboard", label: "📁 Projects Dashboard" },
            { id: "spec", label: "📄 Specification & AI Engine" },
            { id: "console", label: "📡 API Response Inspector" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 font-medium text-sm rounded-t-xl transition-all border-b-2 ${
                activeTab === tab.id
                  ? "border-indigo-500 text-indigo-400 bg-slate-900/60"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Auth & Token Control */}
        {activeTab === "auth" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Form Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold text-white">
                  {authMode === "login" ? "User Sign In" : "Register Account"}
                </h2>
                <div className="flex bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setAuthMode("login")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      authMode === "login" ? "bg-indigo-600 text-white" : "text-slate-400"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => setAuthMode("register")}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      authMode === "register" ? "bg-indigo-600 text-white" : "text-slate-400"
                    }`}
                  >
                    Register
                  </button>
                </div>
              </div>

              <form onSubmit={handleAuthSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-600/25 transition disabled:opacity-50 mt-2"
                >
                  {loading ? "Processing..." : authMode === "login" ? "Sign In" : "Create Account"}
                </button>
              </form>
            </div>

            {/* Token & Session Debug Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
              <h2 className="text-lg font-bold text-white border-b border-slate-800 pb-4">
                JWT State & Security Metrics
              </h2>

              <div className="flex flex-col gap-3">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Access Token (Bearer Header)</span>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono break-all text-indigo-300 max-h-24 overflow-y-auto">
                    {accessToken || <span className="text-slate-600 italic">No access token present</span>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <div className="text-xs text-slate-400">Refresh Token Storage</div>
                    <div className="text-sm font-semibold text-emerald-400 mt-1">httpOnly Cookie</div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                    <div className="text-xs text-slate-400">Rotation & Session DB</div>
                    <div className="text-sm font-semibold text-purple-400 mt-1">SHA-256 Hashed</div>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-4 flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-400">Test Token Actions:</span>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleRefresh}
                      disabled={!accessToken}
                      className="px-3 py-2 bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-medium hover:bg-indigo-600/30 disabled:opacity-40 transition"
                    >
                      Trigger Rotation (/refresh)
                    </button>
                    <button
                      onClick={handleLogout}
                      disabled={!accessToken}
                      className="px-3 py-2 bg-rose-600/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium hover:bg-rose-600/30 disabled:opacity-40 transition"
                    >
                      Revoke Current Session
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Dashboard Preview */}
        {activeTab === "dashboard" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Project Dashboard</h2>
                <p className="text-xs text-slate-400">Manage your software specification projects</p>
              </div>
              <button className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 hover:bg-indigo-500 transition">
                + New Project
              </button>
            </div>

            {/* Mock Project Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {[
                { name: "E-Commerce Microservice", domain: "Marketplace / Retail", step: "step_3", progress: 65 },
                { name: "Fintech Core Wallet API", domain: "Banking / Payment", step: "step_5", progress: 90 },
                { name: "Healthcare Patient Portal", domain: "SaaS / Medical", step: "step_1", progress: 20 },
              ].map((p, idx) => (
                <div key={idx} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col justify-between gap-4 hover:border-slate-700 transition">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded">
                        {p.domain}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    </div>
                    <h3 className="font-bold text-white text-sm">{p.name}</h3>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Step: {p.step}</span>
                      <span>{p.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full" style={{ width: `${p.progress}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Specification Engine Preview */}
        {activeTab === "spec" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-6 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-white">Specification Generator</h2>
              <p className="text-xs text-slate-400">15 Standard Specification Sections supported by FlintFlow AI Engine</p>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {[
                "business_goals", "stakeholders", "vision_problem", "value_proposition",
                "user_journey", "functional_requirements", "non_functional_requirements",
                "rbac", "priority_ranking", "scope_out_of_scope", "assumptions_risks",
                "acceptance_criteria", "user_story", "use_case_spec", "success_metrics"
              ].map((type) => (
                <div key={type} className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-slate-300 font-mono">
                  <span>{type}</span>
                  <span className="text-emerald-400 text-xs">Ready</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: API Response Inspector */}
        {activeTab === "console" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col gap-4 shadow-xl">
            <h2 className="text-lg font-bold text-white">Live Backend Response Inspector</h2>
            <p className="text-xs text-slate-400">
              All FlintFlow API responses follow the standard format: <code className="text-indigo-300">{"{ data, meta, error }"}</code>
            </p>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-96">
              <pre>{JSON.stringify(lastResponse || { data: null, error: null, info: "Make an API request to see JSON response" }, null, 2)}</pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        FlintFlow AI Specification Platform &copy; {new Date().getFullYear()} — Connected to FlintFlow Express BE
      </footer>
    </div>
  );
}