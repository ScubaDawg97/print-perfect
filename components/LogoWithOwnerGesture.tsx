"use client";

import { useState, useEffect } from "react";
import SpoolIcon from "./SpoolIcon";
import OwnerAuthModal from "./OwnerAuthModal";

/**
 * Logo component with secret owner access gesture.
 *
 * Gesture: Shift + Ctrl (or Cmd on Mac) + click
 * Triggers owner authentication modal.
 *
 * When owner mode is active, displays a subtle orange glow around the logo.
 */
export default function LogoWithOwnerGesture() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOwnerActive, setIsOwnerActive] = useState(false);

  // Check for owner indicator cookie on mount and when modal closes
  useEffect(() => {
    const checkOwnerStatus = () => {
      const ownerActive =
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("pp_owner_active="))
          ?.split("=")[1] === "1";
      setIsOwnerActive(ownerActive);
    };

    checkOwnerStatus();

    // Re-check when modal closes
    if (!isModalOpen) {
      checkOwnerStatus();
    }
  }, [isModalOpen]);

  const handleLogoInteraction = (e: React.MouseEvent) => {
    // Check for the secret combination: Shift + Ctrl (or Cmd on Mac) + click
    if (e.shiftKey && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      e.stopPropagation();
      setIsModalOpen(true);
      return;
    }

    // Normal logo click — scroll to top / reset app
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <a
        href="/"
        className={`flex items-center gap-2 group select-none ${
          isOwnerActive ? "owner-active" : ""
        }`}
        title="Start over — return to home"
        onMouseDown={handleLogoInteraction}
      >
        <span
          className={`text-primary-600 group-hover:text-primary-500 transition-colors ${
            isOwnerActive ? "owner-logo-glow" : ""
          }`}
        >
          <SpoolIcon className="w-7 h-7" />
        </span>
        <span className="font-bold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
          Print
          <span className="text-primary-600 group-hover:text-primary-500 transition-colors">
            Perfect
          </span>
        </span>
      </a>

      {/* Owner indicator glow — only visible when owner mode is active */}
      <style jsx>{`
        .owner-logo-glow {
          filter: drop-shadow(0 0 4px rgba(244, 121, 32, 0.6));
        }
      `}</style>

      {/* Owner authentication modal */}
      <OwnerAuthModal
        isOpen={isModalOpen}
        isAlreadyActive={isOwnerActive}
        onClose={() => setIsModalOpen(false)}
        onDeactivate={() => setIsOwnerActive(false)}
      />
    </>
  );
}
