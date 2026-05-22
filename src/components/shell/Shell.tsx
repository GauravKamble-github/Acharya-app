"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import TopNavBar from "./TopNavBar";
import MobileHeader from "./MobileHeader";
import { ShellNavigationProvider, normalizeShellPath } from "./ShellNavigation";
import HomeDashboard from "@/app/(app)/page";
import LearnPage from "@/app/(app)/learn/page";
import VideoPage from "@/app/(app)/video/page";
import QuizPage from "@/app/(app)/quiz/page";
import AskPage from "@/app/(app)/ask/page";
import ApplyPage from "@/app/(app)/apply/page";
import ToolsPage from "@/app/(app)/tools/page";
import ProgressPage from "@/app/(app)/progress/page";
import { acharyaRoute, stripAcharyaPrefix } from "@/lib/acharya-client";

interface Props {
  children: ReactNode;
  persistent?: ReactNode;
}

export default function Shell({ children, persistent }: Props) {
  const pathname = usePathname();
  const cleanPath = stripAcharyaPrefix(pathname);
  const [activePath, setActivePath] = useState(() => normalizeShellPath(cleanPath));

  useEffect(() => {
    setActivePath(normalizeShellPath(cleanPath));
  }, [cleanPath]);

  useEffect(() => {
    function syncFromHistory() {
      setActivePath(normalizeShellPath(stripAcharyaPrefix(window.location.pathname)));
    }

    window.addEventListener("popstate", syncFromHistory);
    return () => window.removeEventListener("popstate", syncFromHistory);
  }, []);

  function navigateInShell(path: string) {
    const nextPath = normalizeShellPath(path);
    setActivePath(nextPath);
    window.history.pushState(null, "", acharyaRoute(nextPath));
  }

  // Chat-like pages manage their own height (thread scrolls internally,
  // composer sticks at the bottom). Other pages let main scroll normally.
  const isChatLike = activePath === "/ask" || activePath === "/apply";
  const activeContent = shellContent(activePath, children);

  return (
    <ShellNavigationProvider value={{ activePath, navigateInShell }}>
      <div className="flex flex-col h-full bg-paper">
        {persistent}
        <TopNavBar />
        <MobileHeader />
        {isChatLike ? (
          <main className="flex-1 min-h-0 flex flex-col">
            {activeContent}
          </main>
        ) : (
          <main className="flex-1 overflow-y-auto pb-10">
            {activeContent}
          </main>
        )}
      </div>
    </ShellNavigationProvider>
  );
}

function shellContent(activePath: string, children: ReactNode) {
  switch (activePath) {
    case "/":
      return <HomeDashboard />;
    case "/learn":
      return <LearnPage />;
    case "/video":
      return <VideoPage />;
    case "/quiz":
      return <QuizPage />;
    case "/ask":
      return <AskPage />;
    case "/apply":
      return <ApplyPage />;
    case "/tools":
      return <ToolsPage />;
    case "/progress":
      return <ProgressPage />;
    default:
      return children;
  }
}
