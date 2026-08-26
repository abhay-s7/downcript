"use client";

import { useEffect, useState } from "react";
import { useMetaQueue } from "@/app/hooks/useMetaQueue";
import { useOutputDir } from "@/app/hooks/useOutputDir";
import { OutputFormat } from "@/app/lib/jobs";
import MetaAdInput from "@/app/components/MetaAdInput";
import MetaAdCard from "@/app/components/MetaAdCard";
import OutputFormatToggle from "@/app/components/OutputFormatToggle";

export default function MetaAdPanel() {
  const queue = useMetaQueue();
  const { outputDir, isDesktop, chooseFolder } = useOutputDir();
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("hinglish");

  useEffect(() => {
    queue.setOutputDir(outputDir);
    // queue is a new object every render; only its stable setOutputDir
    // callback (from useCallback) belongs in the dependency array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outputDir, queue.setOutputDir]);

  if (!isDesktop) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">
        Meta Ad extraction needs to run inside the desktop app — it isn&apos;t available in a plain
        browser tab.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <MetaAdInput onSubmit={queue.addUrl} />

        <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span>Saving to: {outputDir || "Downloads/Downcript"}</span>
            <button onClick={chooseFolder} className="text-blue-600 hover:underline">
              Change
            </button>
          </div>
          <OutputFormatToggle value={outputFormat} onChange={setOutputFormat} />
        </div>
      </div>

      {queue.groups.length > 0 && (
        <div className="space-y-3">
          {queue.groups.map((group) => (
            <MetaAdCard
              key={group.id}
              group={group}
              onDownloadCreative={(creativeId) => queue.downloadCreative(group.id, creativeId)}
              onDownloadAll={() => queue.downloadAll(group.id)}
              onCancelCreative={(creativeId) => queue.cancelCreative(group.id, creativeId)}
              onGenerateTranscript={(creativeId) => queue.generateTranscript(group.id, creativeId, outputFormat)}
              onRemove={() => queue.removeGroup(group.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
