"use client";

import React, { useState } from "react";
import { AtSign, Check, Clock, LogOut, Mail, Pencil, ShieldCheck, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import { useAuthStore } from "@/lib/store/auth.store";
import { useLogoutMutation } from "@/lib/auth/mutations";
import { useCurrentUserQuery, useUpdateCurrentUserMutation } from "@/lib/user/mutations";

function getInitials(value: string): string {
  const [first, second] = value.split(/[.\s_-]+/).filter(Boolean);
  if (!first) return "?";
  if (!second) return first.slice(0, 2).toUpperCase();
  return `${first[0]}${second[0]}`.toUpperCase();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s.]/g, "")
    .replace(/\s+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

// Client-side-only suggestions — there's no availability-check endpoint,
// so these are just alternates for the user to consider/copy.
function suggestUsernames(seed: string, count = 3): string[] {
  const root = slugify(seed).replace(/\.\d+$/, "") || "user";
  const suggestions = new Set<string>();
  while (suggestions.size < count) {
    suggestions.add(`${root}.${Math.floor(100 + Math.random() * 900)}`);
  }
  return Array.from(suggestions);
}

function formatMonthYear(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default function ProfilePage() {
  const { t } = useTranslation("profile");
  // The auth store only ever holds {id, username, email} from login/signup — the
  // full profile (including the display name chosen at signup) lives behind its
  // own endpoint, since login/refresh don't return a user object at all.
  const storeUser = useAuthStore((s) => s.user);
  const { data: currentUser } = useCurrentUserQuery();
  const logout = useLogoutMutation();
  const updateName = useUpdateCurrentUserMutation();
  const updateUsername = useUpdateCurrentUserMutation();

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameJustSaved, setNameJustSaved] = useState(false);

  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameDraft, setUsernameDraft] = useState("");
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [usernameJustSaved, setUsernameJustSaved] = useState(false);

  const username = currentUser?.username ?? storeUser?.username;
  const email = currentUser?.email ?? storeUser?.email;
  const fullName = currentUser?.name ?? null;
  const displayName = fullName ?? username;

  const flashSaved = (setter: (v: boolean) => void) => {
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  const startEditingName = () => {
    setNameDraft(fullName ?? "");
    setNameError(null);
    setIsEditingName(true);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setNameError(null);
  };

  const saveName = () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      setNameError(t("fullName.emptyError"));
      return;
    }
    setNameError(null);
    updateName.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setIsEditingName(false);
          flashSaved(setNameJustSaved);
        },
        onError: (err) => setNameError((err as Error).message || t("fullName.genericError")),
      },
    );
  };

  const startEditingUsername = () => {
    if (!username) return;
    setUsernameDraft(username);
    setUsernameSuggestions(suggestUsernames(fullName ?? username));
    setUsernameError(null);
    setIsEditingUsername(true);
  };

  const cancelEditingUsername = () => {
    setIsEditingUsername(false);
    setUsernameError(null);
  };

  const saveUsername = () => {
    const trimmed = usernameDraft.trim();
    if (trimmed.length < 3) {
      setUsernameError(t("username.tooShortError"));
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(trimmed)) {
      setUsernameError(t("username.invalidCharsError"));
      return;
    }
    setUsernameError(null);
    updateUsername.mutate(
      { username: trimmed },
      {
        onSuccess: () => {
          setIsEditingUsername(false);
          flashSaved(setUsernameJustSaved);
        },
        onError: (err) => setUsernameError((err as Error).message || t("username.genericError")),
      },
    );
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-linear-to-b from-slate-50 to-blue-50/50 text-[#181c1e] font-['Inter',sans-serif]">
      <GlobalHeader activeTab="profile" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        {/* Module Title Context */}
        <div className="w-full flex flex-col gap-2">
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-[#131a33]">{t("title")}</h1>
          <p className="text-[#45464d] text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Identity Hero Card */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1c2547] to-[#0b132b] p-8 md:p-10 text-white shadow-lg">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-[#ffe088]/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#ffe088] text-2xl font-['Libre_Caslon_Text',serif] ring-2 ring-[#ffe088]/40">
              {displayName ? getInitials(displayName) : "—"}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              <h2 className="font-['Libre_Caslon_Text',serif] text-[26px] md:text-[28px] leading-tight truncate">
                {displayName ?? t("loadingAccount")}
              </h2>
              {fullName && username && <p className="text-white/60 text-[14px]">@{username}</p>}
              <p className="text-white/80 text-[15px] truncate">{email ?? "—"}</p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#ffe088]">
                  <ShieldCheck className="w-3 h-3" aria-hidden="true" />
                  {t("verifiedMember")}
                </span>
                {currentUser?.createdAt && (
                  <span className="text-[11px] text-white/50">
                    {t("memberSince", { date: formatMonthYear(currentUser.createdAt) })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Account Information */}
        <section className="bg-white rounded-xl border border-[#e2e4e9] shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-[#e2e4e9]">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-[#181c1e]">{t("accountInformation.heading")}</h2>
            <p className="text-[13px] text-[#45464d] mt-0.5">{t("accountInformation.subheading")}</p>
          </div>

          <div className="flex flex-col divide-y divide-[#e2e4e9]">
            {/* Full Name row */}
            <div className="px-6 md:px-8 py-5 flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
                <User className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="full-name-field" className="text-[10px] font-semibold tracking-[1.2px] text-gray-500 uppercase">
                    {t("fullName.label")}
                  </label>
                  <div className="flex items-center gap-2">
                    {nameJustSaved && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                        <Check className="h-3 w-3" aria-hidden="true" />
                        {t("fullName.saved")}
                      </span>
                    )}
                    {!isEditingName && (
                      <button
                        type="button"
                        onClick={startEditingName}
                        title={t("fullName.editAriaLabel")}
                        aria-label={t("fullName.editAriaLabel")}
                        className="cursor-pointer rounded-full p-2 -m-1 text-gray-400 transition-colors hover:bg-black/5 hover:text-[#131a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditingName ? (
                  <div className="flex flex-col gap-3 mt-2">
                    <input
                      id="full-name-field"
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder={t("fullName.placeholder")}
                      autoFocus
                      className="w-full rounded-lg border border-[#c6c6ce] bg-white px-3 py-2 text-[15px] text-[#181c1e] outline-none transition-colors focus:border-[#131a33] focus-visible:ring-2 focus-visible:ring-[#131a33]/20"
                    />
                    {nameError && <p className="text-[12px] text-red-600">{nameError}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={updateName.isPending}
                        onClick={saveName}
                        className="cursor-pointer rounded-lg bg-[#131a33] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#1c2547] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updateName.isPending ? t("fullName.saving") : t("fullName.save")}
                      </button>
                      <button
                        type="button"
                        disabled={updateName.isPending}
                        onClick={cancelEditingName}
                        className="cursor-pointer rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30 disabled:opacity-50"
                      >
                        {t("fullName.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p id="full-name-field" className="text-[16px] text-[#181c1e] mt-1">{fullName ?? t("fullName.notProvided")}</p>
                )}
              </div>
            </div>

            {/* Username row */}
            <div className="px-6 md:px-8 py-5 flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
                <AtSign className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor="username-field" className="text-[10px] font-semibold tracking-[1.2px] text-gray-500 uppercase">
                    {t("username.label")}
                  </label>
                  <div className="flex items-center gap-2">
                    {usernameJustSaved && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                        <Check className="h-3 w-3" aria-hidden="true" />
                        {t("username.saved")}
                      </span>
                    )}
                    {!isEditingUsername && username && (
                      <button
                        type="button"
                        onClick={startEditingUsername}
                        title={t("username.editAriaLabel")}
                        aria-label={t("username.editAriaLabel")}
                        className="cursor-pointer rounded-full p-2 -m-1 text-gray-400 transition-colors hover:bg-black/5 hover:text-[#131a33] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditingUsername ? (
                  <div className="flex flex-col gap-3 mt-2">
                    <input
                      id="username-field"
                      type="text"
                      value={usernameDraft}
                      onChange={(e) => setUsernameDraft(e.target.value)}
                      className="w-full rounded-lg border border-[#c6c6ce] bg-white px-3 py-2 text-[15px] text-[#181c1e] outline-none transition-colors focus:border-[#131a33] focus-visible:ring-2 focus-visible:ring-[#131a33]/20"
                    />

                    {usernameSuggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {usernameSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => setUsernameDraft(suggestion)}
                            className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30 ${
                              usernameDraft === suggestion
                                ? "border-[#131a33] bg-[#131a33] text-white"
                                : "border-[#c6c6ce] text-[#45464d] hover:border-[#131a33] hover:text-[#131a33]"
                            }`}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}

                    {usernameError && <p className="text-[12px] text-red-600">{usernameError}</p>}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={updateUsername.isPending}
                        onClick={saveUsername}
                        className="cursor-pointer rounded-lg bg-[#131a33] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#1c2547] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {updateUsername.isPending ? t("username.saving") : t("username.save")}
                      </button>
                      <button
                        type="button"
                        disabled={updateUsername.isPending}
                        onClick={cancelEditingUsername}
                        className="cursor-pointer rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 transition-colors hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30 disabled:opacity-50"
                      >
                        {t("username.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p id="username-field" className="text-[16px] text-[#181c1e] mt-1">{username ?? "—"}</p>
                )}
              </div>
            </div>

            {/* Email row */}
            <div className="px-6 md:px-8 py-5 flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold tracking-[1.2px] text-gray-500 uppercase">{t("emailAddress")}</span>
                <p className="text-[16px] text-[#181c1e] mt-1 truncate">{email ?? "—"}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="bg-white rounded-xl border border-[#e2e4e9] shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-[#e2e4e9]">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-[#181c1e]">{t("security.heading")}</h2>
            <p className="text-[13px] text-[#45464d] mt-0.5">{t("security.subheading")}</p>
          </div>

          <div className="flex flex-col divide-y divide-[#e2e4e9]">
            {currentUser?.lastLoginAt && (
              <div className="px-6 md:px-8 py-5 flex gap-4 items-center">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold tracking-[1.2px] text-gray-500 uppercase">{t("security.lastSignedIn")}</span>
                  <p className="text-[16px] text-[#181c1e] mt-1">{formatDateTime(currentUser.lastLoginAt)}</p>
                </div>
              </div>
            )}

            <div className="px-6 md:px-8 py-5 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex gap-4 items-center">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="font-medium text-[#181c1e] text-[16px]">{t("security.signOutTitle")}</p>
                  <p className="text-[#45464d] text-[14px]">{t("security.signOutDescription")}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={logout.isPending}
                onClick={() => logout.mutate()}
                className="cursor-pointer flex items-center gap-2 bg-[#131a33] text-white px-6 py-2.5 text-[12px] font-semibold tracking-[1.2px] uppercase rounded-lg hover:bg-[#1c2547] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
                {logout.isPending ? t("security.loggingOut") : t("security.logout")}
              </button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
