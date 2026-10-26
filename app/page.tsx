"use client";

import { useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import Topline from "@/app/components/Topline";
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
    <div className="grid grid-cols-[244px_1fr] h-screen">
      <Sidebar section={section} onNavigate={setSection} />

      <div className="overflow-y-auto relative">
        <Topline onNavigate={setSection} />

        {/* Meta Ads gets a wider content column (room for the embedded
            browser), everything else stays at the narrower reading width --
            matches the reference's `.content:has(#meta.active)` rule. */}
        <div className={`px-12 pb-20 ${section === "meta" ? "max-w-[1360px] mx-auto" : "max-w-[940px]"}`}>
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
      </div>
    </div>
  );
}
