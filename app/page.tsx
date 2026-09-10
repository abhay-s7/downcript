"use client";

import { useState } from "react";
import Header from "@/app/components/Header";
import ModelSetupBanner from "@/app/components/ModelSetupBanner";
import UpdateBanner from "@/app/components/UpdateBanner";
import HomeScreen from "@/app/components/HomeScreen";
import DownloadPanel from "@/app/components/DownloadPanel";
import TranscriptPanel from "@/app/components/TranscriptPanel";
import MetaAdPanel from "@/app/components/MetaAdPanel";
import LibraryPanel from "@/app/components/LibraryPanel";
import SettingsPanel from "@/app/components/SettingsPanel";
import { Section } from "@/app/lib/uiTypes";

export default function Home() {
  const [section, setSection] = useState<Section>("home");

  return (
    <>
      <Header section={section} onNavigate={setSection} />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <ModelSetupBanner />
          <UpdateBanner />

          {section === "home" && <HomeScreen onNavigate={setSection} />}
          {section === "settings" && <SettingsPanel />}

          {/* Download/Transcript/Meta Ads stay mounted once visited so their
              queues keep running in the background while you check another
              section, instead of losing in-progress jobs on every switch. */}
          <div className={section === "download" ? "" : "hidden"}>
            <DownloadPanel />
          </div>
          <div className={section === "transcript" ? "" : "hidden"}>
            <TranscriptPanel />
          </div>
          <div className={section === "meta" ? "" : "hidden"}>
            <MetaAdPanel />
          </div>
          <div className={section === "library" ? "" : "hidden"}>
            <LibraryPanel />
          </div>
        </div>
      </main>
      <footer className="py-6 text-center text-xs text-gray-400">Made with ♥ by Abhay · v1.0.4</footer>
    </>
  );
}
