"use client";

// Shell wraps every page after login. It does three jobs:
//   1. sends visitors who are not signed in back to the login page,
//   2. keeps each role out of pages that are not meant for it,
//   3. draws the top bar with the right menu for the role.
// This is only for convenience. The real security check is in the backend.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { api, clearLogin, getUser, homeFor } from "@/lib/api";

const MENUS = {
  staff: [
    { href: "/requests/new", label: "New request" },
    { href: "/requests", label: "My requests" },
  ],
  technician: [{ href: "/jobs", label: "My jobs" }],
  admin: [
    { href: "/dashboard", label: "Requests" },
    { href: "/reports", label: "Reports" },
    { href: "/users", label: "Users" },
  ],
};

const ROLE_LABELS = { staff: "Staff", technician: "Technician", admin: "Admin" };

const UserContext = createContext(null);

// Pages call useUser() to know who is signed in.
export function useUser() {
  return useContext(UserContext);
}

export default function Shell({ roles, children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = getUser();
    if (!saved) {
      router.replace("/");
    } else if (roles && !roles.includes(saved.role)) {
      router.replace(homeFor(saved.role));
    } else {
      setUser(saved);
    }
  }, []);

  async function signOut() {
    try {
      await api("/logout", { method: "POST" });
    } catch {
      // Even if the server call fails we still clear this browser.
    }
    clearLogin();
    router.replace("/");
  }

  if (!user) return null;

  // Highlight the menu item whose address best matches the current page.
  const menu = MENUS[user.role];
  const active = menu
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <UserContext.Provider value={user}>
      <div className="app">
        <header className="topbar">
          <div className="brand">
            <div className="brand-mark">IT</div>
            ICT Help Desk
          </div>
          <nav className="nav">
            {menu.map((item) => (
              <Link key={item.href} href={item.href} className={item === active ? "active" : ""}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="who">
            <div className="who-name">
              <b>{user.full_name}</b>
              <span className="muted">
                {user.department}, {ROLE_LABELS[user.role]}
              </span>
            </div>
            <button className="link-button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>
        {children}
      </div>
    </UserContext.Provider>
  );
}
